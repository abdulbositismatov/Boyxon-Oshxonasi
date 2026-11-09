import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, ShoppingBag, Settings, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useCartStore } from '../../store/cart.store';
import { useAuthStore } from '../../store/auth.store';
import { useUiStore } from '../../store/ui.store';
import { cn } from '../../lib/utils';

export function BottomNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const nav = useNavigate();
  const token = useAuthStore((s) => s.accessToken);
  const { chatOpen, set } = useUiStore();
  const count = useCartStore((s) => s.lines.reduce((a, l) => a + l.quantity, 0));

  const handleChatClick = () => {
    if (!token) {
      nav('/auth');
      toast.info(t('chat.login_required') || 'Chatdan foydalanish uchun profilingizga kiring');
      return;
    }
    set({ chatOpen: !chatOpen });
  };

  const navItems = [
    { to: '/', icon: Home, label: t('nav.home') },
    { to: '/cart', icon: ShoppingBag, label: t('nav.cart'), badge: count },
    { to: '/settings', icon: Settings, label: t('nav.settings') },
  ];

  return (
    // Suzuvchi "pill" navigatsiya + o'ng tomonda alohida chat tugmasi.
    // Chat ochiq bo'lsa ham navigatsiya ko'rinib turadi (z-60 > chat z-50).
    <nav
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 flex justify-center px-3 pb-[calc(0.6rem_+_env(safe-area-inset-bottom,0px))] md:hidden',
        // Chat ochiq bo'lganda navigatsiya backdrop ustida ko'rinadi;
        // boshqa modal oynalarda odatdagidek pastda qoladi.
        chatOpen ? 'z-[60]' : 'z-30',
      )}
    >
      <div className="pointer-events-auto flex w-full max-w-[360px] items-end gap-2">
        <div className="flex min-w-0 flex-1 items-center justify-around gap-1 rounded-[26px] border border-ink-line/50 bg-surface/90 p-1.5 shadow-2xl backdrop-blur-xl dark:border-ink-line/30 dark:bg-surface/85">
          {navItems.map((item) => {
            const isItemActive =
              !chatOpen &&
              (item.to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.to));

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                aria-label={item.label}
                onClick={() => {
                  if (chatOpen) set({ chatOpen: false });
                }}
                className={cn(
                  'relative flex h-[42px] flex-1 flex-col items-center justify-center rounded-[20px] px-1 py-1 transition-all duration-150 active:scale-90 select-none touch-manipulation',
                  isItemActive
                    ? 'font-bold text-primary-600 dark:text-primary-400'
                    : 'font-medium text-ink-300 hover:text-ink-500',
                )}
              >
                {isItemActive && (
                  <motion.div
                    layoutId="bottomNavIndicator"
                    className="absolute inset-0 rounded-[20px] bg-primary-500/10 dark:bg-primary-500/20"
                    transition={{ type: 'spring', stiffness: 500, damping: 32, mass: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex flex-col items-center">
                  <span className="relative">
                    <item.icon
                      className={cn(
                        'h-[19px] w-[19px] transition-transform duration-200',
                        isItemActive ? 'scale-110 stroke-[2.3]' : 'stroke-[1.9]',
                      )}
                    />
                    {'badge' in item && !!item.badge && item.badge > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-gradient-to-r from-primary-600 to-primary-700 px-1 text-[9px] font-extrabold text-white shadow-sm"
                      >
                        {item.badge > 99 ? '99+' : item.badge}
                      </motion.span>
                    )}
                  </span>
                  <span className="mt-1 text-[10px] leading-none tracking-tight">
                    {item.label}
                  </span>
                </span>
              </NavLink>
            );
          })}
        </div>

        {/* Chat — navigatsiyaning o'ng tomonida, alohida dumaloq tugma */}
        <button
          type="button"
          onClick={handleChatClick}
          aria-label={t('nav.chat') || 'Chat'}
          aria-expanded={chatOpen}
          className={cn(
            'relative grid h-[56px] w-[56px] shrink-0 place-items-center rounded-full border shadow-2xl transition-all duration-150 active:scale-85 select-none touch-manipulation',
            chatOpen
              ? 'border-primary-400/70 bg-primary-700 text-white ring-4 ring-primary-500/25'
              : 'border-white/15 bg-gradient-to-br from-primary-600 to-primary-800 text-white shadow-primary-600/30 animate-pulse-subtle',
          )}
        >
          <MessageCircle
            className={cn('h-5 w-5 transition-transform duration-200', chatOpen && 'scale-90')}
          />
          {chatOpen && (
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-surface bg-green-400" />
          )}
        </button>
      </div>
    </nav>
  );
}
