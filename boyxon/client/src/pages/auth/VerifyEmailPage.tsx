import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { CheckCircle2, Loader2, MailCheck, ShieldCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { authApi } from '../../api/auth.api';
import { useAuthStore } from '../../store/auth.store';
import { tVal } from '../../lib/format';
import type { User } from '../../types';

type Mode = 'code' | 'checking' | 'success' | 'failed';

/** Qayta yuborish orasidagi minimal vaqt (server ham xuddi shunday cheklaydi). */
const RESEND_SECONDS = 60;
const CODE_LENGTH = 6;

/**
 * Email tasdiqlash sahifasi.
 *
 * 1. `/verify-email?email=...` — emailga yuborilgan 6 xonali kodni kiritish.
 *    Kod to'g'ri bo'lsa server darhol token beradi (qayta login shart emas).
 * 2. `/verify-email/:token` — eski havolali xatlar uchun zaxira yo'l.
 *
 * Kod 10 daqiqa amal qiladi, 5 marta xato kiritilsa bloklanadi.
 */
export default function VerifyEmailPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const loc = useLocation();
  const { token } = useParams<{ token?: string }>();
  const [params] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const setToken = useAuthStore((s) => s.setToken);
  const setSessionReady = useAuthStore((s) => s.setSessionReady);

  const from = (loc.state as { from?: string } | null)?.from ?? params.get('from') ?? '/';
  const email = user?.email ?? params.get('email') ?? '';

  const [mode, setMode] = useState<Mode>(token ? 'checking' : 'code');
  const [message, setMessage] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  // StrictMode'da effekt ikki marta ishlaydi — token bir martalik, takror yubormaymiz.
  const handled = useRef(false);

  // Eski havola (token) bilan kelgan bo'lsa — avtomatik tasdiqlash.
  useEffect(() => {
    if (!token || handled.current) return;
    handled.current = true;
    authApi
      .verifyEmail(token)
      .then((r) => {
        setMode('success');
        setMessage(r.message);
        if (user) setUser({ ...user, emailVerified: true });
      })
      .catch((e) => {
        setMode('failed');
        setMessage(
          (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            t('auth.verify_failed'),
        );
      });
  }, [token, user, setUser, t]);

  // Email yo'q bo'lsa kodni qayerga yuborishni bilmaymiz.
  useEffect(() => {
    if (!token && !email) nav('/auth', { replace: true });
  }, [token, email, nav]);

  // Qayta yuborish taymeri.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const finish = (accessToken: string, u: User): void => {
    setToken(accessToken);
    setUser(u);
    setSessionReady(true);
    toast.success(t('auth.code_success'));
    nav(u.role === 'admin' ? '/admin' : from, { replace: true });
  };

  const submit = async (value = code): Promise<void> => {
    if (submitting || value.length !== CODE_LENGTH) return;
    setSubmitting(true);
    try {
      const r = await authApi.verifyEmailCode(email, value);
      if (r.data.alreadyVerified || !r.data.accessToken || !r.data.user) {
        toast.success(t('auth.code_already'));
        nav('/auth', { replace: true });
        return;
      }
      finish(r.data.accessToken, r.data.user);
    } catch (e) {
      const res = (e as { response?: { data?: { message?: string } } })?.response?.data;
      toast.error(res?.message ?? t('common.error'));
      setCode('');
      setSubmitting(false);
    }
  };

  // 6 raqam terilishi bilan avtomatik yuborish.
  const onChange = (raw: string): void => {
    const digits = raw.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (digits.length === CODE_LENGTH) void submit(digits);
  };

  const resend = async (): Promise<void> => {
    if (!email) return;
    setResending(true);
    try {
      await authApi.resendVerification(email);
      setSecondsLeft(RESEND_SECONDS);
      toast.success(t('auth.code_resent'));
    } catch (e) {
      toast.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t('common.error'),
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-bg p-6">
      <div className="w-full max-w-md rounded-card border border-ink-line bg-surface p-8 text-center shadow-sm">
        {mode === 'checking' && (
          <>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary-500" />
            <p className="mt-4 text-sm text-ink-300">{t('auth.verify_checking')}</p>
          </>
        )}

        {mode === 'success' && (
          <>
            <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
            <h1 className="mt-4 font-display text-xl font-extrabold text-ink-900">{t('auth.verify_success')}</h1>
            <p className="mt-2 text-sm text-ink-300">{message}</p>
            <Button className="mt-6 w-full" onClick={() => nav(user?.role === 'admin' ? '/admin' : '/', { replace: true })}>
              {t('common.next')}
            </Button>
          </>
        )}

        {mode === 'failed' && (
          <>
            <XCircle className="mx-auto h-14 w-14 text-danger" />
            <h1 className="mt-4 font-display text-xl font-extrabold text-ink-900">{t('auth.verify_failed')}</h1>
            <p className="mt-2 text-sm text-ink-300">{message}</p>
            <Button className="mt-6 w-full" onClick={() => nav('/auth', { replace: true })}>
              {t('auth.verify_go_login')}
            </Button>
          </>
        )}

        {mode === 'code' && (
          <>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary-500/10">
              <MailCheck className="h-7 w-7 text-primary-500" />
            </div>
            <h1 className="mt-4 font-display text-xl font-extrabold text-ink-900">{t('auth.code_title')}</h1>
            <p className="mt-2 text-sm text-ink-300">{tVal(t('auth.code_sent_to'), { email })}</p>

            <form
              className="mt-6"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <input
                value={code}
                onChange={(e) => onChange(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={CODE_LENGTH}
                aria-label={t('auth.code_label')}
                placeholder="000000"
                className="h-16 w-full rounded-2xl border border-ink-line bg-surface-raised text-center font-display text-3xl font-bold tracking-[0.45em] text-ink-900 outline-none transition-colors placeholder:text-ink-300/40 focus:border-primary-500"
              />
              <p className="mt-3 text-xs text-ink-300">{t('auth.code_hint')}</p>

              <Button
                type="submit"
                className="mt-5 w-full"
                disabled={submitting || code.length !== CODE_LENGTH}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('common.loading')}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    {t('auth.code_submit')}
                  </span>
                )}
              </Button>
            </form>

            <button
              type="button"
              onClick={() => void resend()}
              disabled={resending || secondsLeft > 0}
              className="mt-5 text-sm font-semibold text-primary-600 hover:underline disabled:text-ink-300 disabled:no-underline"
            >
              {secondsLeft > 0
                ? tVal(t('auth.code_resend_in'), { seconds: secondsLeft })
                : resending
                  ? t('common.loading')
                  : t('auth.verify_resend')}
            </Button>

            <button
              type="button"
              onClick={() => nav('/auth', { replace: true })}
              className="mt-3 block w-full text-xs font-medium text-ink-300 underline"
            >
              {t('auth.verify_go_login')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
