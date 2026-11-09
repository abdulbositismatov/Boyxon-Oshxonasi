import { NavLink } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ChefHat, Home, Gift, Megaphone, MessageCircle, Package, ShoppingCart, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/auth.store';
import { cn } from '../../lib/utils';

const links = [
  { to: '/admin', icon: Home, k: 'admin.dashboard', end: true },
  { to: '/admin/chat', icon: MessageCircle, k: 'admin.chat' },
  { to: '/admin/orders', icon: ShoppingCart, k: 'admin.orders' },
  { to: '/admin/dishes', icon: ChefHat, k: 'admin.dishes' },
  { to: '/admin/categories', icon: Package, k: 'admin.categories' },
  { to: '/admin/users', icon: Users, k: 'admin.users' },
  { to: '/admin/promos', icon: Gift, k: 'admin.promos' },
  { to: '/admin/push', icon: Megaphone, k: 'admin.push' },
];

export function AdminSidebar() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const doLogout = (): void => {
    // AdminRoute ichidan nav() poygada yutqazadi — hard reload bilan '/' ga chiqamiz.
    void (async () => {
      qc.clear();
      await useAuthStore.getState().logoutServer();
      // Persist yozilishi uchun kichik pauza — aks holda reload eski token'ni qayta tiklaydi
      await new Promise((r) => setTimeout(r, 50));
      window.location.href = '/';
    })();
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-[#1A1512] p-4 md:flex">
        <NavLink to="/" className="font-display text-lg font-extrabold text-primary-500">
          {t('admin.title')}
        </NavLink>
        <nav className="mt-6 flex flex-col gap-1">
          {links.map(({ to, icon: Icon, k, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium',
                  isActive ? 'bg-primary-700 text-white' : 'text-white/70 hover:bg-white/10',
                )
              }
            >
              <Icon className="h-5 w-5" />
              {t(k)}
            </NavLink>
          ))}
        </nav>
        <button type="button"
          onClick={doLogout}
          className="mt-auto rounded-xl px-3 py-2.5 text-left text-sm font-medium text-white/60 hover:bg-white/10"
        >
          {t('nav.logout')}
        </button>
      </aside>

      {/* Mobile nav */}
      <nav className="no-scrollbar sticky top-0 z-20 flex gap-1 overflow-x-auto bg-[#1A1512] p-2 md:hidden">
        {links.map(({ to, icon: Icon, k, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium',
                isActive ? 'bg-primary-700 text-white' : 'text-white/70',
              )
            }
          >
            <Icon className="h-4 w-4" />
            {t(k)}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
