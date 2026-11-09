import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import i18n from '../locales/i18n';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  /** Deploydan keyin eski chunk topilmadi — bu vaqtinchalik holat, xato ekrani emas. */
  chunkError: boolean;
}

/**
 * Butun ilova uchun xavfsizlik to'ri (Error Boundary).
 *
 * Nega kerak: React'da render paytida kutilmagan xato yuz bersa (masalan, yangi
 * deploydan keyin eski chunk topilmasa yoki biror komponent buzilsa), butun SPA
 * oq ekranga aylanib qolardi. Endi foydalanuvchi tushunarli xabar va
 * "Sahifani yangilash" tugmasini ko'radi.
 *
 * Class komponent — React'da error boundary faqat class orqali aniqlanadi.
 * i18n to'g'ridan-to'g'ri import qilinadi (hook ishlatib bo'lmaydi).
 */
const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk|Failed to fetch/i;

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, chunkError: false };

  static getDerivedStateFromError(error: Error): State {
    const message = String(error?.message ?? error);
    return { hasError: true, chunkError: CHUNK_ERROR.test(message) };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keyinchalik Sentry va h.k. ulanadigan joy. Hozircha konsolga yozamiz.
    console.error('UI ErrorBoundary:', error, info.componentStack);

    // Deploydan keyin eski JS chunk topilmasa — sahifani bir marta avtomatik
    // yangilaymiz. Yangi HTML yangi chunk nomlarini olib keladi.
    const message = String(error?.message ?? error);
    if (CHUNK_ERROR.test(message)) {
      try {
        const key = 'boyxon-chunk-reload';
        const last = Number(sessionStorage.getItem(key) || 0);
        if (Date.now() - last >= 15000) {
          sessionStorage.setItem(key, String(Date.now()));
          window.location.reload();
        }
      } catch {
        /* private mode */
      }
    }
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    const t = i18n.t.bind(i18n);

    // Eski chunk (yangi deploy) — xato ekrani o'rniga qisqa "yuklanmoqda".
    // Sahifa avtomatik yangilanadi; tugma faqat zaxira uchun.
    if (this.state.chunkError) {
      return (
        <div className="grid min-h-screen place-items-center bg-bg px-4">
          <div className="w-full max-w-sm rounded-card border border-ink-line/60 bg-surface p-6 text-center shadow-sm">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-accent" strokeWidth={2.5} />
            <p className="mt-4 text-sm font-medium text-ink-700">{t('common.loading')}</p>
            <Button
              onClick={() => window.location.reload()}
              className="mt-4 text-sm font-semibold text-primary-600 hover:underline"
            >
              {t('errors.boundary_reload')}
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="grid min-h-screen place-items-center bg-bg px-4">
        <div className="w-full max-w-sm rounded-card border border-ink-line/60 bg-surface p-6 text-center shadow-sm">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-danger/10 text-danger">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-display text-xl font-bold text-ink-900">{t('common.error')}</h1>
          <p className="mt-2 text-sm text-ink-300">{t('errors.boundary_desc')}</p>
          <Button
            onClick={() => window.location.reload()}
            className="mt-5 h-12 w-full rounded-full bg-gradient-to-r from-primary-500 to-[#F39C12] text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            {t('errors.boundary_reload')}
          </Button>
          <a
            href="/"
            className="mt-3 inline-block text-sm font-medium text-primary-600 hover:underline"
          >
            {t('nav.home')}
          </a>
        </div>
      </div>
    );
  }
}
