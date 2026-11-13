/**
 * Minimal native WebSocket klient — socket.io-client o'rniga.
 *
 * Protokol: JSON `{ event, data }` (ikkala yo'nalishda ham).
 * - Avtomatik qayta ulanish (1s → 10s backoff).
 * - Token har safar `getToken()` dan olinadi.
 * - Ulanish hali ochilmaganda yuborilgan eventlar navbatga yig'iladi.
 */
export type RealtimeListener = (data: unknown) => void;

export type RealtimeOptions = {
  url: string;
  getToken: () => string | null;
  /** 401/403 yoki tarmoq uzilishida bir marta chaqiriladi — token yangilash uchun. */
  onUnauthorized?: () => void;
  onOpen?: () => void;
  onClose?: () => void;
};

export class RealtimeClient {
  private ws: WebSocket | null = null;
  private readonly listeners = new Map<string, Set<RealtimeListener>>();
  private readonly queue: string[] = [];
  private disposed = false;
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private unauthorizedFired = false;

  constructor(private readonly opts: RealtimeOptions) {}

  connect(): void {
    if (this.disposed || this.ws) return;
    const token = this.opts.getToken();
    if (!token) return;

    const sep = this.opts.url.includes('?') ? '&' : '?';
    let ws: WebSocket;
    try {
      // Token sarlavhada ketadi (query emas) — loglar/tarixga tushmasin.
      // `boyxon.v1` — server tanlaydigan protokol; `auth.<jwt>` — token tashuvchisi.
      ws = new WebSocket(this.opts.url, ['boyxon.v1', `auth.${token}`]);
    } catch {
      // Ba'zi eski WebSocket implementatsiyalari subprotocol'ni qo'llamasligi mumkin.
      try {
        ws = new WebSocket(`${this.opts.url}${sep}token=${encodeURIComponent(token)}`);
      } catch {
        this.scheduleReconnect();
        return;
      }
    }
    this.ws = ws;

    ws.onopen = () => {
      this.attempt = 0;
      this.unauthorizedFired = false;
      this.flush();
      this.opts.onOpen?.();
    };

    ws.onmessage = (event) => {
      let msg: { event?: string; data?: unknown };
      try {
        msg = JSON.parse(String(event.data)) as { event?: string; data?: unknown };
      } catch {
        return;
      }
      if (msg.event) this.dispatch(msg.event, msg.data);
    };

    ws.onerror = () => {
      /* onclose ham chaqiriladi — u yerda qayta ulanamiz */
    };

    ws.onclose = (event) => {
      if (this.ws === ws) this.ws = null;
      this.opts.onClose?.();
      if (this.disposed) return;

      // Brauzer HTTP 401/403 ni 1006 ga aylantiradi — tokenni yangilashga urinamiz.
      if (!this.unauthorizedFired && (event.code === 1006 || event.code === 4401 || event.code === 4403)) {
        this.unauthorizedFired = true;
        this.opts.onUnauthorized?.();
      }
      this.scheduleReconnect();
    };
  }

  on(event: string, listener: RealtimeListener): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
    return () => {
      set!.delete(listener);
    };
  }

  emit(event: string, data?: unknown): void {
    const frame = JSON.stringify({ event, data });
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(frame);
      return;
    }
    // Navbat cheksiz o'smasin.
    if (this.queue.length < 50) this.queue.push(frame);
  }

  disconnect(): void {
    this.disposed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const ws = this.ws;
    this.ws = null;
    try {
      ws?.close();
    } catch {
      /* ignore */
    }
  }

  private dispatch(event: string, data: unknown): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of set) {
      try {
        listener(data);
      } catch {
        /* bitta listener xatosi boshqalarni to'xtatmasin */
      }
    }
  }

  private flush(): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    while (this.queue.length) {
      const frame = this.queue.shift();
      if (frame) this.ws.send(frame);
    }
  }

  private scheduleReconnect(): void {
    if (this.disposed || this.reconnectTimer) return;
    const delay = Math.min(1000 * 2 ** this.attempt, 10_000);
    this.attempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}
