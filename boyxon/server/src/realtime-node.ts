/**
 * Node (Render/local) uchun WebSocket server.
 *
 * Cloudflare Workers'dagi RealtimeHub Durable Object bilan AYNAN bir xil
 * protokol: JSON `{ event, data }`, `/ws?token=...`, xonalar `user:<id>` va
 * `admin`. Shu tufayli mijoz kodi ikkala muhitda ham bir xil ishlaydi.
 */
import type { Server, IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyAccessToken } from './services/token.service';
import { User } from './models/User.model';
import { setRealtimeBroadcaster } from './socket';

type ClientInfo = {
  userId: string;
  role: 'user' | 'admin';
  rooms: Set<string>;
};

function send(ws: WebSocket, event: string, data?: unknown): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify({ event, data }));
  } catch {
    /* ignore */
  }
}

function rejectUpgrade(socket: Duplex, status: number, message: string): void {
  const body = JSON.stringify({ success: false, message, data: null });
  socket.write(
    `HTTP/1.1 ${status} ${status === 401 ? 'Unauthorized' : 'Forbidden'}\r\n` +
      'Content-Type: application/json; charset=utf-8\r\n' +
      `Content-Length: ${Buffer.byteLength(body)}\r\n` +
      'Connection: close\r\n\r\n' +
      body,
  );
  socket.destroy();
}

export function attachRealtimeServer(server: Server): WebSocketServer {
  /**
   * Token endi URL query'da emas, `Sec-WebSocket-Protocol` sarlavhasida keladi:
   *   new WebSocket(url, ['boyxon.v1', 'auth.<jwt>'])
   *
   * Sabab: query string'lar proksi/CDN loglariga, brauzer tarixiga va
   * `Referer`ga tushib qoladi. Sarlavha esa loglanmaydi.
   * Eski mobil ilova uchun `?token=` zaxira sifatida qoldirilgan.
   */
  const wss = new WebSocketServer({
    noServer: true,
    handleProtocols: (protocols) => (protocols.has('boyxon.v1') ? 'boyxon.v1' : false),
  });
  const clients = new Map<WebSocket, ClientInfo>();

  setRealtimeBroadcaster((room, event, payload) => {
    const frame = JSON.stringify({ event, data: payload });
    for (const [ws, info] of clients) {
      if (room && !info.rooms.has(room)) continue;
      if (ws.readyState !== WebSocket.OPEN) continue;
      try {
        ws.send(frame);
      } catch {
        /* ignore */
      }
    }
  });

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    if (url.pathname !== '/ws') {
      socket.destroy();
      return;
    }

    const protocolHeader = String(req.headers['sec-websocket-protocol'] ?? '');
    const fromProtocol = protocolHeader
      .split(',')
      .map((p) => p.trim())
      .find((p) => p.startsWith('auth.'))
      ?.slice('auth.'.length);

    const token = fromProtocol || url.searchParams.get('token');
    if (!token) return rejectUpgrade(socket, 401, 'Token kerak');

    let decoded: { id: string; ver: number };
    try {
      decoded = verifyAccessToken(token);
    } catch {
      return rejectUpgrade(socket, 401, 'Token yaroqsiz');
    }

    void User.findById(decoded.id)
      .select('role isActive tokenVersion')
      .lean()
      .then((user) => {
        if (!user || !user.isActive) return rejectUpgrade(socket, 401, 'Hisob faol emas');
        if ((user.tokenVersion ?? 0) !== decoded.ver) {
          return rejectUpgrade(socket, 401, 'Sessiya bekor qilingan');
        }

        const role: 'user' | 'admin' = user.role === 'admin' ? 'admin' : 'user';
        const rooms = new Set<string>([`user:${decoded.id}`]);
        if (role === 'admin') rooms.add('admin');

        wss.handleUpgrade(req, socket, head, (ws) => {
          clients.set(ws, { userId: decoded.id, role, rooms });
          send(ws, 'connected', { role });

          ws.on('message', (raw) => {
            let msg: { event?: string; data?: { to?: unknown } };
            try {
              msg = JSON.parse(String(raw)) as typeof msg;
            } catch {
              return;
            }
            if (msg.event !== 'chat:typing') return;

            if (role === 'user') {
              const frame = JSON.stringify({
                event: 'chat:typing',
                data: { from: decoded.id, role },
              });
              for (const [peer, info] of clients) {
                if (peer !== ws && info.rooms.has('admin')) {
                  try {
                    peer.send(frame);
                  } catch {
                    /* ignore */
                  }
                }
              }
            } else {
              const to = msg.data?.to;
              if (typeof to === 'string' && /^[0-9a-fA-F]{24}$/.test(to)) {
                const frame = JSON.stringify({
                  event: 'chat:typing',
                  data: { role: 'admin' },
                });
                for (const [peer, info] of clients) {
                  if (peer !== ws && info.rooms.has(`user:${to}`)) {
                    try {
                      peer.send(frame);
                    } catch {
                      /* ignore */
                    }
                  }
                }
              }
            }
          });

          ws.on('close', () => clients.delete(ws));
          ws.on('error', () => clients.delete(ws));
        });
      })
      .catch(() => rejectUpgrade(socket, 401, 'Autentifikatsiya xatosi'));
  });

  return wss;
}
