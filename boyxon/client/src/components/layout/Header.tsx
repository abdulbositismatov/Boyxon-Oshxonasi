import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Bell, Menu, User, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/auth.store';
import { useUiStore } from '../../store/ui.store';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '../../api/notifications.api';
import { useKitchenStatus } from '../../hooks/useKitchenStatus';

export function Header() {
  const { t } = useTranslation();
  const { user, accessToken } = useAuthStore();
  const { set } = useUiStore();
  const nav = useNavigate();
  const { data } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => notificationsApi.unreadCount().then((r) => r.data.count),
    enabled: Boolean(accessToken),
    refetchInterval: 60_000,
  });
  const { data: kitchen } = useKitchenStatus();
  const kitchenOpen = kitchen?.kitchenOpen;
  const kitchenTone =
    kitchenOpen === undefined
      ? 'border-ink-line bg-surface-raised text-ink-300'
      : kitchenOpen
        ? 'border-success/20 bg-success/10 text-success'
        : 'border-danger/20 bg-danger/10 text-danger';
  const kitchenDot =
    kitchenOpen === undefined ? 'animate-pulse bg-ink-300' : kitchenOpen ? 'bg-success' : 'bg-danger';

  // Scroll position — header compresses yoki ochiladi
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`sticky top-0 z-30 border-b border-ink-line/40 bg-cream/50 backdrop-blur-md shadow-sm transition-all duration-300 ${
      scrolled ? 'shadow-md backdrop-blur-xl bg-cream/70 dark:bg-surface/80' : ''
    }`}>
      <div className={`mx-auto flex max-w-6xl items-center gap-2 px-4 transition-all duration-300 ${scrolled ? 'h-10' : 'h-12'}`}>
        <Button className="rounded-full p-2 hover:bg-surface-raised active:scale-90 transition-transform md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" onClick={() => set({ mobileDrawer: true })} aria-label={t('nav.menu')}>
          <Menu className="h-5 w-5" />
        </button>
        <Link to="/" className="font-display text-lg font-extrabold text-primary-600 tracking-tight transition-transform duration-200 hover:scale-105 active:scale-95">
          Boyxon
        </Link>
        <nav className="ml-5 hidden items-center gap-4 text-sm font-medium md:flex">
          <Link to="/" className="transition-colors hover:text-primary-600">{t('nav.menu')}</Link>
          <Link to="/cart" className="transition-colors hover:text-primary-600">{t('nav.cart')}</Link>
          {user?.role === 'admin' && <Link to="/admin" className="transition-colors hover:text-primary-600">{t('nav.admin')}</Link>}
            {accessToken && (
              <button
                type="button"
                onClick={() => set({ chatOpen: true })}
                className="flex items-center gap-1 rounded-full border border-ink-line px-2.5 py-0.5 text-xs font-medium transition-all hover:border-primary-500/50 hover:text-primary-600 hover:bg-surface-raised active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                aria-label="Chat"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Chat
              </button>
            )}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {accessToken && (
            <>
              <Button className="relative rounded-full p-2 hover:bg-surface-raised active:scale-90 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" onClick={() => set({ notifOpen: true })} aria-label={t('nav.notifications')}>
                <Bell className="h-4 w-4 transition-transform duration-200 hover:rotate-12" />
                {(data ?? 0) > 0 && (
                  <span className="absolute right-1 top-1 grid h-3 min-w-3 place-items-center rounded-full bg-danger px-1 text-[9px] font-bold text-white animate-pulse">
                    {(data ?? 0) > 99 ? '99+' : data}
                  </span>
                )}
              </button>
            </>
          )}
          <span
            role="status"
            aria-live="polite"
            aria-label={
              kitchenOpen === undefined
                ? t('kitchen.aria_loading')
                : kitchenOpen
                  ? t('kitchen.aria_open')
                  : t('kitchen.aria_closed')
            }
            title={
              kitchenOpen === undefined
                ? t('kitchen.aria_loading')
                : kitchenOpen
                  ? t('kitchen.hint_open')
                  : t('kitchen.hint_closed')
            }
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-semibold transition-colors ${kitchenTone}`}
          >
            <span className={`h-2 w-2 rounded-full ${kitchenDot}`} />
            {kitchenOpen === undefined ? '…' : kitchenOpen ? t('kitchen.open') : t('kitchen.closed')}
          </span>
          <button
            type="button"
            className={`rounded-full hover:bg-surface-raised transition-transform duration-200 hover:scale-105 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${user?.avatar ? 'p-1' : 'p-2'}`}
            onClick={() => nav(accessToken ? '/settings' : '/auth')}
            aria-label={t('nav.profile')}
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt=""
                className="h-7 w-7 rounded-full border border-ink-line object-cover"
              />
            ) : (
              <User className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

