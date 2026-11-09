import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Loader2, CheckCircle2, XCircle, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { authApi } from '../../api/auth.api';
import { resetValidator, type ResetForm } from '../../lib/validators';

type Mode = 'checking' | 'form' | 'done' | 'failed';

/**
 * Parolni tiklash — 2-qadam: `/reset-password/:token` havolasidan kelib,
 * alohida tiklash oynasida yangi parol o'rnatiladi.
 *
 * Sahifa ochilganda token tekshiriladi va QAYSI EMAIL uchunligi ko'rsatiladi
 * (`GET /info` — parolni o'zgartirmaydi). Token 1 soat amal qiladi, bir martalik.
 */
export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { token } = useParams<{ token?: string }>();
  const [mode, setMode] = useState<Mode>(token ? 'checking' : 'failed');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [serverError, setServerError] = useState('');
  // StrictMode'da effekt ikki marta ishlaydi — info so'rovni takrorlamaymiz.
  const handled = useRef(false);
  const form = useForm<ResetForm>({
    resolver: zodResolver(resetValidator),
    defaultValues: { password: '', confirm: '' },
  });

  useEffect(() => {
    if (!token || handled.current) return;
    handled.current = true;
    authApi
      .resetPasswordInfo(token)
      .then((r) => {
        setEmail(r.data.email);
        setMode('form');
      })
      .catch((e) => {
        setMessage(
          (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            t('auth.reset_failed'),
        );
        setMode('failed');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const onSubmit = form.handleSubmit(async (v) => {
    if (!token) return;
    setServerError('');
    try {
      await authApi.resetPassword(token, v.password);
      setMode('done');
    } catch (e) {
      setServerError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t('auth.reset_failed'),
      );
    }
  });

  return (
    <div className="grid min-h-screen place-items-center bg-bg p-6">
      <div className="w-full max-w-md rounded-card border border-ink-line bg-surface p-8 text-center shadow-sm">
        {mode === 'checking' && (
          <>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary-500" />
            <p className="mt-4 text-sm text-ink-300">{t('auth.verify_checking')}</p>
          </>
        )}
        {mode === 'failed' && (
          <>
            <XCircle className="mx-auto h-14 w-14 text-danger" />
            <h1 className="mt-4 font-display text-xl font-extrabold text-ink-900">
              {t('auth.reset_failed')}
            </h1>
            {message && <p className="mt-2 text-sm text-ink-300">{message}</p>}
            <Button className="mt-6 w-full" onClick={() => nav('/forgot-password', { replace: true })}>
              {t('auth.reset_retry')}
            </Button>
            <button
              type="button"
              onClick={() => nav('/auth', { replace: true })}
              className="mt-3 text-xs font-medium text-ink-300 underline"
            >
              {t('auth.reset_back')}
            </button>
          </>
        )}
        {mode === 'form' && (
          <>
            <KeyRound className="mx-auto h-14 w-14 text-primary-500" />
            <h1 className="mt-4 font-display text-xl font-extrabold text-ink-900">
              {t('auth.reset_new_title')}
            </h1>
            {email && (
              <p className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-3 py-1.5 text-xs font-medium text-ink-700">
                <Mail className="h-3.5 w-3.5 text-primary-500" />
                {email}
              </p>
            )}
            <p className="mt-2 text-sm text-ink-300">{t('auth.reset_new_subtitle')}</p>
            <form onSubmit={onSubmit} className="mt-6 space-y-3 text-left">
              <Input
                type="password"
                placeholder={t('auth.reset_new_password')}
                autoComplete="new-password"
                {...form.register('password')}
              />
              <Input
                type="password"
                placeholder={t('auth.reset_confirm')}
                autoComplete="new-password"
                {...form.register('confirm')}
              />
              <p className="min-h-4 text-xs text-danger">
                {form.formState.errors.password?.message ??
                  form.formState.errors.confirm?.message ??
                  serverError}
              </p>
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  t('auth.reset_save')
                )}
              </Button>
            </form>
          </>
        )}
        {mode === 'done' && (
          <>
            <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
            <h1 className="mt-4 font-display text-xl font-extrabold text-ink-900">
              {t('auth.reset_done_title')}
            </h1>
            {email && (
              <p className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-3 py-1.5 text-xs font-medium text-ink-700">
                <Mail className="h-3.5 w-3.5 text-success" />
                {email}
              </p>
            )}
            <p className="mt-2 text-sm text-ink-300">{t('auth.reset_success')}</p>
            <Button className="mt-6 w-full" onClick={() => nav('/auth', { replace: true })}>
              {t('auth.reset_go_login')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
