import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, Check, Copy, Download, MapPin, Navigation, Phone } from 'lucide-react';

/** Boyxon Oshxonasi joylashuvi: Namangan, Zirabuloq ko'chasi (1-son texnikum yonida). */
const MAPS_URL = 'https://www.google.com/maps/search/?api=1&query=41.0048%2C71.6806';

const PHONE_DISPLAY = '+998 (93) 958-84-58';
const PHONE_COPY = '+998939588458';

/**
 * APK Workers Assets'ga sig'maydi (25 MiB limit) — alohida joyga (masalan R2)
 * qo'yiladi va `VITE_APK_URL` orqali beriladi. Production'da URL berilmagan
 * bo'lsa havola UMUMAN ko'rsatilmaydi (aks holda bosilganda 404 bo'lardi —
 * Cloudflare Assets mavjud bo'lmagan fayl uchun JS 404 qaytaradi).
 * Faqat lokal dev'da Vite middleware `/boyxon-mobile.apk`ni beradi.
 */
const APK_URL =
  (import.meta.env.VITE_APK_URL as string | undefined)?.trim() ||
  (import.meta.env.DEV ? '/boyxon-mobile.apk' : '');

export function Footer() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copyPhone = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(PHONE_COPY);
    } catch {
      // clipboard API ishlamasa (http / eski brauzer) — fallback
      const ta = document.createElement('textarea');
      ta.value = PHONE_COPY;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const year = new Date().getFullYear();

  return (
    <footer className="mt-12 border-t border-ink-line bg-surface pb-20 md:pb-0">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-8 text-sm text-ink-300 md:grid-cols-2">
          <div>
            <p className="font-semibold text-ink-700">{t('footer.contact')}</p>
            <div className="mt-2 flex items-center gap-2">
              <a
                href={`tel:${PHONE_COPY}`}
                className="flex items-center gap-2 rounded-xl border border-ink-line bg-bg px-3 py-2 font-semibold text-ink-700 transition hover:border-primary-500/50 hover:text-primary-600"
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                <span>{PHONE_DISPLAY}</span>
              </a>
              <button
                type="button"
                onClick={() => void copyPhone()}
                title={PHONE_DISPLAY}
                aria-label={copied ? t('footer.copied') : t('footer.copy_phone')}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-ink-line text-ink-300 transition hover:border-primary-500/50 hover:text-primary-600"
              >
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            {copied && <p className="mt-1 text-xs font-medium text-success">{t('footer.copied')}</p>}

            <a
              href={MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${t('footer.open_map')} — ${t('footer.address_line')}`}
              className="group mt-3 block rounded-2xl border border-ink-line bg-bg p-3 transition duration-200 hover:-translate-y-0.5 hover:border-primary-500/70 hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 active:translate-y-0"
            >
              <span className="flex items-start gap-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-500/15 text-primary-600 transition group-hover:bg-primary-500 group-hover:text-white">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold leading-snug text-ink-700">
                    {t('footer.address_line')}
                  </span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-ink-300">
                    {t('footer.landmark_line')}
                  </span>
                </span>
              </span>
              <span className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-primary-600 px-3 py-2.5 text-xs font-bold text-white shadow-sm transition group-hover:bg-primary-700">
                <Navigation className="h-4 w-4" aria-hidden="true" />
                {t('footer.open_map')}
                <ArrowUpRight
                  className="h-3.5 w-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </span>
            </a>
          </div>

          <div>
            <p className="font-semibold text-ink-700">{t('footer.download_app')}</p>
            {APK_URL ? (
              <>
                <a
                  href={APK_URL}
                  download
                  className="mt-2 flex items-center gap-2 rounded-xl border border-ink-line bg-bg px-3 py-2 font-semibold text-ink-700 transition hover:border-primary-500/50 hover:text-primary-600"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span>{t('footer.download_app_desc')}</span>
                </a>
                <p className="mt-1 text-xs text-ink-300">APK • Android 7.0+</p>
              </>
            ) : (
              <p className="mt-2 rounded-xl border border-ink-line bg-bg px-3 py-2 text-xs text-ink-300">
                {t('footer.download_app_soon')}
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-1 border-t border-ink-line/60 pt-4 text-xs text-ink-300 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Boyxon Oshxonasi. {t('footer.rights')}.</p>
          <p>{t('footer.address_line')}</p>
        </div>
      </div>
    </footer>
  );
}
