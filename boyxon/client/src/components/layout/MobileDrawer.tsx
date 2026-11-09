import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Home, LogOut, Settings, ShieldCheck, ShoppingBag, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '../../store/ui.store';
import { useAuthStore } from '../../store/auth.store';

export function MobileDrawer() {
  const { t } = useTranslation();
  const { mobileDrawer, set } = useUiStore();
  const { user, accessToken } = useAuthStore();
  const qc = useQueryClient();
  const close = (): void => set({ mobileDrawer: false });

  const doLogout = (): void => {
    // ProtectedRoute/nav poygasidan qochish uchun hard reload bilan '/' ga chiqamiz.
    void (async () => {
      qc.clear();
      await useAuthStore.getState().logoutServer();
      // Persist yozilishi uchun kichik pauza — aks holda reload eski token'ni qayta tiklaydi
      await new Promise((r) => setTimeout(r, 50));
      close();
      window.location.href = '/';
    })();
  };

  return (
    <AnimatePresence>
      {mobileDrawer && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
          <motion.aside
            className="fixed left-0 top-0 z-50 flex h-full w-72 flex-col bg-surface p-4"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-lg font-extrabold text-primary-600">Boyxon</span>
              <button type="button" onClick={close} className="rounded-full p-2 hover:bg-surface-raised" aria-label={t('common.close')}><X className="h-5 w-5" /></button>
            </div>
            {user && <p className="mt-2 text-sm text-ink-300">{user.name}</p>}
            <nav className="mt-4 flex flex-col gap-1 text-[15px] font-medium">
              <Link to="/" onClick={close} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-raised"><Home className="h-5 w-5" />{t('nav.home')}</Link>
              <Link to="/cart" onClick={close} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-raised"><ShoppingBag className="h-5 w-5" />{t('nav.cart')}</Link>
              <Link to="/settings" onClick={close} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-raised"><Settings className="h-5 w-5" />{t('nav.settings')}</Link>
              {user?.role === 'admin' && (
                <Link to="/admin" onClick={close} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-raised"><ShieldCheck className="h-5 w-5" />{t('nav.admin')}</Link>
              )}
            </nav>
            <div className="mt-auto">
              {accessToken ? (
                <button
                  type="button"
                  onClick={doLogout}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-danger hover:bg-danger/10"
                >
                  <LogOut className="h-5 w-5" />{t('auth.logout')}
                </button>
              ) : (
                <Link to="/auth" onClick={close} className="block rounded-full bg-primary-700 py-3 text-center font-semibold text-white">
                  {t('auth.signin')}
                </Link>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
