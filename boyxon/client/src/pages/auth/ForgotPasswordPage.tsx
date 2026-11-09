import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck, Loader2, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { authApi } from '../../api/auth.api';
import { forgotValidator, type ForgotForm } from '../../lib/validators';

/**
 * Parolni tiklash — 1-qadam: email kiritiladi, server reset havolasini yuboradi.
 *
 * Xavfsizlik: javob har doim bir xil (`auth.reset_sent`) — email ro'yxatda
 * bor-yo'qligini bilib bo'lmaydi (enumeration himoyasi serverda).
 */
export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [sent, setSent] = useState(false);
  const form = useForm<ForgotForm>({
    resolver: zodResolver(forgotValidator),
    defaultValues: { email: '' },
  });

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      const r = await authApi.forgotPassword(v.email.trim().toLowerCase());
      setSent(true);
      form.reset({ email: v.email });
      void r;
    } catch (e) {
      form.setError('email', {
        message:
          (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t('common.error'),
      });
    }
  });

  return (
    <div className="grid min-h-screen place-items-center bg-bg p-6">
      <div className="w-full max-w-md rounded-card border border-ink-line bg-surface p-8 text-center shadow-sm">
        {sent ? (
          <>
            <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
            <h1 className="mt-4 font-display text-xl font-extrabold text-ink-900">{t('auth.reset_title')}</h1>
            <p className="mt-2 text-sm text-ink-300">{t('auth.reset_sent')}</p>
          </>
        ) : (
          <>
            <MailCheck className="mx-auto h-14 w-14 text-primary-500" />
            <h1 className="mt-4 font-display text-xl font-extrabold text-ink-900">{t('auth.reset_title')}</h1>
            <p className="mt-2 text-sm text-ink-300">{t('auth.reset_subtitle')}</p>
            <form onSubmit={onSubmit} className="mt-6 space-y-3 text-left">
              <Input type="email" placeholder={t('auth.email')} {...form.register('email')} />
              <p className="min-h-4 text-xs text-danger">{form.formState.errors.email?.message}</p>
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  t('auth.reset_send')
                )}
              </Button>
            </form>
          </>
        )}
        <button
          type="button"
          onClick={() => nav('/auth', { replace: true })}
          className="mt-4 text-xs font-medium text-ink-300 underline"
        >
          {t('auth.reset_back')}
        </button>
      </div>
    </div>
  );
}
