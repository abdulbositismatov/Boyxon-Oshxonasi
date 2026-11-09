import { forwardRef, useEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail, User as UserIcon } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { authApi } from '../../api/auth.api';
import { ensureServerReady } from '../../api/health.api';
import { useAuthStore } from '../../store/auth.store';
import { loginValidator, registerValidator, type LoginForm, type RegisterForm } from '../../lib/validators';
import type { User } from '../../types';
import { cn } from '../../lib/utils';

const FOOD_EMOJIS = ['🍜', '🥘', '🍲', '🫕', '🥗', '🍱', '🥩', '🫔'];

export default function AuthPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const loc = useLocation();
  const [searchParams] = useSearchParams();
  const { accessToken, setToken, setUser, user } = useAuthStore();

  const from =
    (loc.state as { from?: string } | null)?.from ??
    searchParams.get('from') ??
    searchParams.get('redirect') ??
    '/';

  useEffect(() => {
    const err = searchParams.get('error');
    if (!err) return;
    if (err === 'google') toast.error(t('auth.google_cancelled'));
    else if (err === 'google_not_configured') toast.error(t('auth.google_not_configured'));
    else if (err === 'admin_password_only') toast.error(t('auth.admin_password_only'));
  }, [searchParams, t]);

  useEffect(() => {
    if (accessToken && user) {
      nav(user.role === 'admin' ? '/admin' : from, { replace: true });
    }
  }, [accessToken, user, nav, from]);

  return (
    <div className="min-h-screen md:grid md:grid-cols-2">
      {/* Chap: premium hero panel */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-primary-800 via-primary-700 to-primary-600 p-6 text-white sm:p-8 md:p-12">
        {/* Animated blobs */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-12 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-40 w-40 -translate-x-1/2 rounded-full bg-primary-500/40 blur-2xl" />

        {/* Suzuvchi emoji'lar (faqat desktopda to'liq ko'rinadi) */}
        <div className="hidden sm:block">
          {FOOD_EMOJIS.map((emoji, i) => (
            <span
              key={i}
              className="pointer-events-none absolute select-none text-3xl opacity-20"
              style={{
                left: `${10 + (i % 4) * 22}%`,
                top: `${15 + Math.floor(i / 4) * 45}%`,
                animation: `float ${3 + i * 0.4}s ease-in-out infinite`,
                animationDelay: `${i * 0.5}s`,
              }}
            >
              {emoji}
            </span>
          ))}
        </div>

        {/* Yuqori qism: Orqaga qaytish va brend nomi */}
        <div className="relative z-10 flex items-center justify-between">
          <Link
            to={from || '/'}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-white/20 active:scale-95"
            aria-label={t('common.back') || 'Orqaga'}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{t('common.back') || 'Bosh sahifa'}</span>
          </Link>
          <span className="font-display text-xl font-extrabold tracking-tight sm:text-2xl">
            Boyxon Oshxonasi
          </span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative z-10 my-8 hidden md:block"
        >
          <h1 className="font-display text-4xl font-extrabold leading-tight">
            {t('auth.hero_line1')}
            <br />
            {t('auth.hero_line2')}
          </h1>
          <p className="mt-3 max-w-sm text-white/80">{t('auth.hero_subtitle')}</p>

          {/* Feature highlights */}
          <div className="mt-8 grid grid-cols-2 gap-3">
            {['🚀 Tez yetkazib berish', '🍽️ 50+ taom', '💳 Qulay to\'lov', '⭐ Eng yaxshi sifat'].map(
              (f) => (
                <div
                  key={f}
                  className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium backdrop-blur-sm"
                >
                  {f}
                </div>
              ),
            )}
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="relative z-10 hidden text-sm text-white/60 md:block"
        >
          © {new Date().getFullYear()} Boyxon
        </motion.p>
      </div>

      {/* O'ng: forma */}
      <div className="flex items-center justify-center bg-bg p-6 md:p-12">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm"
        >
          <div className="mb-6">
            <h2 className="font-display text-2xl font-extrabold text-ink-900">
              {t('auth.welcome')}
            </h2>
            <p className="mt-1 text-sm text-ink-300">{t('auth.welcome_sub')}</p>
          </div>
          <AuthForm
            onDone={(token, u) => {
              setToken(token);
              setUser(u);
              nav(u.role === 'admin' ? '/admin' : from, { replace: true });
            }}
          />
        </motion.div>
      </div>
    </div>
  );
}

const IconInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & {
    icon: React.ElementType;
    error?: string;
  }
>(function IconInput({ icon: Icon, type, placeholder, error, className, ...rest }, ref) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (show ? 'text' : 'password') : type;

  return (
    <div className="space-y-1">
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
        <Input
          ref={ref}
          type={inputType}
          placeholder={placeholder}
          className={cn(
            'pl-10 pr-10',
            error && 'border-danger focus:border-danger focus:ring-danger/20',
            className,
          )}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShow((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-300 transition-colors hover:text-ink-700 active:scale-90"
            aria-label={show ? 'Parolni yashirish' : "Parolni ko'rish"}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error && <p className="animate-fade-in-down px-1 text-xs text-danger">{error}</p>}
    </div>
  );
});

function AuthForm({ onDone }: { onDone: (token: string, u: User) => void }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [googleLoading, setGoogleLoading] = useState(false);
  const googleToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);
  const googleUrl = authApi.googleUrl();
  const nav = useNavigate();

  useEffect(() => {
    isMounted.current = true;
    void ensureServerReady().catch(() => {});
    return () => {
      isMounted.current = false;
      if (googleToastTimer.current !== null) clearTimeout(googleToastTimer.current);
      toast.dismiss('google-server-wake');
    };
  }, []);

  const onGoogle = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    googleToastTimer.current = setTimeout(() => {
      toast.loading(t('auth.server_waking'), { id: 'google-server-wake' });
    }, 1200);
    try {
      await ensureServerReady();
      if (!isMounted.current) return;
      if (googleToastTimer.current !== null) {
        clearTimeout(googleToastTimer.current);
        googleToastTimer.current = null;
      }
      toast.dismiss('google-server-wake');
      window.location.assign(googleUrl);
    } catch {
      if (googleToastTimer.current !== null) {
        clearTimeout(googleToastTimer.current);
        googleToastTimer.current = null;
      }
      toast.dismiss('google-server-wake');
      if (isMounted.current) {
        toast.error(t('auth.server_unavailable'));
        setGoogleLoading(false);
      }
    }
  };

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginValidator),
    defaultValues: { email: '', password: '' },
  });
  const regForm = useForm<RegisterForm>({
    resolver: zodResolver(registerValidator),
    defaultValues: { name: '', email: '', password: '' },
  });

  const onLogin = loginForm.handleSubmit(async (v) => {
    try {
      const r = await authApi.login(v);
      onDone(r.data.accessToken, r.data.user);
      toast.success(t('auth.welcome_back'));
    } catch (e) {
      const res = (
        e as {
          response?: {
            data?: { message?: string; code?: string; data?: { email?: string } };
          };
        }
      )?.response?.data;
      if (res?.code === 'EMAIL_NOT_VERIFIED') {
        toast.error(res.message ?? t('auth.verify_not_verified'));
        nav(`/verify-email?email=${encodeURIComponent(res.data?.email ?? v.email)}`, {
          replace: true,
        });
        return;
      }
      toast.error(res?.message ?? t('auth.login_error'));
    }
  });

  const onRegister = regForm.handleSubmit(async (v) => {
    try {
      const r = await authApi.register(v);
      toast.success(r.message);
      if (r.data.verificationRequired || !r.data.accessToken) {
        if (!r.data.emailDelivered) toast.error(t('auth.code_not_delivered'));
        nav(`/verify-email?email=${encodeURIComponent(r.data.user.email)}`, { replace: true });
        return;
      }
      onDone(r.data.accessToken, r.data.user);
    } catch (e) {
      toast.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t('common.error'),
      );
    }
  });

  return (
    <div>
      {/* Tab switcher */}
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-2xl bg-surface-raised p-1 shadow-inner">
        {(['signin', 'signup'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`relative rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 active:scale-95 ${
              tab === key
                ? 'text-primary-700 dark:text-primary-400'
                : 'text-ink-300 hover:text-ink-700'
            }`}
          >
            {tab === key && (
              <motion.span
                layoutId="auth-tab-pill"
                className="absolute inset-0 rounded-xl bg-surface shadow-sm"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative z-10">
              {key === 'signin' ? t('auth.signin') : t('auth.signup')}
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'signin' ? (
          <motion.form
            key="signin"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.2 }}
            onSubmit={onLogin}
            className="space-y-3"
          >
            <IconInput
              icon={Mail}
              type="email"
              placeholder={t('auth.email')}
              error={loginForm.formState.errors.email?.message}
              {...loginForm.register('email')}
            />
            <IconInput
              icon={Lock}
              type="password"
              placeholder={t('auth.password')}
              error={loginForm.formState.errors.password?.message}
              {...loginForm.register('password')}
            />

            <Button type="submit" className="w-full mt-2" disabled={loginForm.formState.isSubmitting}>
              {loginForm.formState.isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('common.loading')}
                </span>
              ) : (
                t('auth.signin')
              )}
            </Button>
            <button
              type="button"
              onClick={() => nav('/forgot-password')}
              className="w-full pt-1 text-center text-xs font-medium text-primary-600 hover:underline active:scale-95 transition"
            >
              {t('auth.forgot')}
            </Button>
          </motion.form>
        ) : (
          <motion.form
            key="signup"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
            onSubmit={onRegister}
            className="space-y-3"
          >
            <IconInput
              icon={UserIcon}
              placeholder={t('auth.name')}
              error={regForm.formState.errors.name?.message}
              {...regForm.register('name')}
            />
            <IconInput
              icon={Mail}
              type="email"
              placeholder={t('auth.email')}
              error={regForm.formState.errors.email?.message}
              {...regForm.register('email')}
            />
            <IconInput
              icon={Lock}
              type="password"
              placeholder={t('auth.password_hint')}
              error={regForm.formState.errors.password?.message}
              {...regForm.register('password')}
            />

            <Button type="submit" className="w-full mt-2" disabled={regForm.formState.isSubmitting}>
              {regForm.formState.isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('common.loading')}
                </span>
              ) : (
                t('auth.signup')
              )}
            </Button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="my-5 flex items-center gap-3 text-xs text-ink-300">
        <span className="h-px flex-1 bg-ink-line" /> {t('auth.or')}{' '}
        <span className="h-px flex-1 bg-ink-line" />
      </div>

      {/* Google tugmasi */}
      <motion.button
        type="button"
        onClick={onGoogle}
        disabled={googleLoading}
        aria-busy={googleLoading}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-full border-2 border-ink-line/60 bg-surface text-[15px] font-semibold shadow-sm transition hover:border-primary-500/40 hover:bg-surface-raised hover:shadow-md disabled:cursor-wait disabled:opacity-70"
      >
        {googleLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : (
          <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06L5.84 9.9c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
        )}
        {googleLoading ? t('auth.google_connecting') : t('auth.google')}
      </motion.button>

      {import.meta.env.DEV && (
        <p className="mt-4 rounded-xl bg-surface-raised px-3 py-2 text-center text-xs text-ink-300">
          🔑 Demo:{' '}
          <span className="font-mono font-semibold text-primary-600">
            aziz@example.com / User123!
          </span>
        </p>
      )}
    </div>
  );
}
