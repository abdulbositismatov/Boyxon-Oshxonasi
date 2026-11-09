import { useEffect } from 'react';
import { AppRouter } from './routes/AppRouter';
import { useSocket } from './hooks/useSocket';
import { useAuthStore } from './store/auth.store';
import { usersApi } from './api/users.api';
import { authApi } from './api/auth.api';
import { langFromPath } from './lib/seo';
import { useTranslation } from 'react-i18next';
import { MobileTouchFeedback } from './components/system/MobileTouchFeedback';

export default function App() {
  useSocket();
  const { accessToken, setUser, setToken, user, logout, sessionReady, setSessionReady } = useAuthStore();
  const { i18n } = useTranslation();

  useEffect(() => {
    // Global scroll optimizatsiyasi - silliq va past latency
    if ('scrollBehavior' in document.documentElement.style) {
      document.documentElement.style.scrollBehavior = 'smooth';
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function restoreSession(): Promise<void> {
      if (useAuthStore.getState().accessToken) {
        if (!useAuthStore.getState().sessionReady) setSessionReady(true);
        return;
      }
      try {
        const r = await authApi.refresh();
        if (cancelled) return;
        setToken(r.data.accessToken);
        if (r.data.user) setUser(r.data.user);
      } catch {
        // Cookie yo'q yoki eskirgan — mehmon holati.
      } finally {
        if (!cancelled) setSessionReady(true);
      }
    }
    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, [setSessionReady, setToken, setUser]);

  useEffect(() => {
    if (accessToken && !user) {
      // Token yaroqsiz bo'lsa jim yutmaymiz — logout qilib tozalaymiz,
      // aks holda keyingi so'rovlarda keraksiz 401 loop ketadi.
      usersApi.me().then((r) => setUser(r.data)).catch(() => logout());
    }
  }, [accessToken, user, setUser, logout]);

  useEffect(() => {
    // URL'dagi til prefiksi (/ru, /en) ustuvor — foydalanuvchi tanlovi
    // faqat prefikssiz (default uz) URL'da qo'llaniladi.
    if (langFromPath()) return;
    const lang = user?.preferences?.language;
    if (lang && lang !== i18n.language) {
      void i18n.changeLanguage(lang);
    }
  }, [user, i18n]);

  useEffect(() => {
    // Tema: qurilmadagi tanlov (localStorage) ustuvor — refresh'da o'zgarmasin.
    // Birinchi marta kirgan qurilmada serverdagi pref ishlatiladi.
    const stored = localStorage.getItem('boyxon-theme');
    const pref = user?.preferences?.theme;
    const theme = stored === 'light' || stored === 'dark' ? stored : pref ?? 'dark';
    document.documentElement.classList.toggle('dark', theme === 'dark');
    if (!stored) {
      try {
        localStorage.setItem('boyxon-theme', theme);
      } catch {
        /* private mode */
      }
    }
  }, [user]);

  return (
    <>
      <MobileTouchFeedback />
      <AppRouter />
    </>
  );
}
