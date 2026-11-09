import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

/**
 * Sovuq start (Render free-tier uyqudan uyg'onishi) 30â€“60 soniya davom etadi.
 * Bu komponent 4 soniyadan keyin ham ma'lumot kelmasa, foydalanuvchiga
 * "Server uyg'onmoqda..." xabarini ko'rsatadi â€” sahifa jim osilib turmaydi.
 *
 * Faqat ma'lumoti yo'q (skeleton ko'rinib turgan) so'rovlar hisobga olinadi:
 * localStorage keshidan chizilgan menyu fonida yangilanayotganda xabar
 * bezovta qilmaydi.
 */

const NOTICE_ID = 'server-wake';
const SHOW_AFTER_MS = 8000;
const AUTO_DISMISS_MS = 10000;

export function ServerWakeNotice(): null {
  const qc = useQueryClient();
  const { t } = useTranslation();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let dismissTimer: ReturnType<typeof setTimeout> | null = null;
    let shown = false;

    const clearTimer = (): void => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const clearDismissTimer = (): void => {
      if (dismissTimer !== null) {
        clearTimeout(dismissTimer);
        dismissTimer = null;
      }
    };

    const hide = (): void => {
      if (!shown) return;
      shown = false;
      clearDismissTimer();
      toast.dismiss(NOTICE_ID);
    };

    const evaluate = (): void => {
      const waiting = qc
        .getQueryCache()
        .getAll()
        .some((query) => query.state.fetchStatus === 'fetching' && query.state.data === undefined);

      if (!waiting) {
        clearTimer();
        hide();
        return;
      }

      if (shown || timer !== null) return;

      timer = setTimeout(() => {
        timer = null;
        shown = true;
        toast.loading(t('auth.server_waking'), { id: NOTICE_ID });
        clearDismissTimer();
        dismissTimer = setTimeout(() => {
          hide();
        }, AUTO_DISMISS_MS);
      }, SHOW_AFTER_MS);
    };

    evaluate();
    const unsubscribe = qc.getQueryCache().subscribe(evaluate);

    return () => {
      unsubscribe();
      clearTimer();
      clearDismissTimer();
      hide();
    };
  }, [qc, t]);

  return null;
}
