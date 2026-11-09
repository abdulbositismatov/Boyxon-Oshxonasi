import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, ChevronDown, Globe, LogOut, MapPin, Moon, Package, Phone, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ProfileCard } from '../../components/settings/ProfileCard';
import { SettingsGroup } from '../../components/settings/SettingsGroup';
import { SettingsRow } from '../../components/settings/SettingsRow';
import { NotificationPrefs } from '../../components/settings/NotificationPrefs';
import { AddressManager } from '../../components/settings/AddressManager';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Switch } from '../../components/ui/Switch';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { usersApi } from '../../api/users.api';
import { ordersApi } from '../../api/orders.api';
import { formatDate, formatPrice, tVal } from '../../lib/format';
import { stripLang, withLang } from '../../lib/seo';

const LANGS: { v: 'uz' | 'ru' | 'en'; l: string }[] = [
  { v: 'uz', l: "O'zbekcha" },
  { v: 'ru', l: 'Русский' },
  { v: 'en', l: 'English' },
];

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const qc = useQueryClient();
  const [addressesOpen, setAddressesOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  // Tema darhol almashishi uchun lokal holat; server javobi fonda yuboriladi.
  // localStorage — qurilmadagi tanlov, refresh'da ham saqlanadi.
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('boyxon-theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return user?.preferences?.theme ?? 'dark';
  });
  const [themeSaving, setThemeSaving] = useState(false);
  const themeRequest = useRef(0);

  // Qurilmada tanlov yo'q bo'lsa (birinchi kirish) — serverdagi prefni olamiz.
  useEffect(() => {
    if (localStorage.getItem('boyxon-theme')) return;
    const pref = user?.preferences?.theme;
    if (!pref) return;
    setTheme(pref);
    try {
      localStorage.setItem('boyxon-theme', pref);
    } catch {
      /* private mode */
    }
  }, [user?.preferences?.theme]);

  const { data: orders } = useQuery({
    queryKey: ['orders'],
    queryFn: () => ordersApi.myOrders(1, 5),
    enabled: !!user,
    staleTime: 30_000,
  });

  if (!user) return <div className="grid min-h-[50vh] place-items-center text-ink-300">{t('common.loading')}</div>;

  const setLang = async (v: 'uz' | 'ru' | 'en'): Promise<void> => {
    try {
      const r = await usersApi.updatePrefs({ language: v });
      setUser({ ...user, preferences: r.data });
      localStorage.setItem('boyxon-lang', v);
      // URL til prefiksi interfeys tiliga mos bo'lishi shart (SEO/canonical).
      // Reloadsiz: avval URL'ni almashtiramiz, keyin tilni — `Root`dagi
      // `basename` URL'dan olinadi va router yangi prefiks bilan qayta quriladi.
      const target =
        withLang(stripLang(window.location.pathname), v) +
        window.location.search +
        window.location.hash;
      window.history.replaceState(window.history.state, '', target);
      try {
        await i18n.changeLanguage(v);
      } catch {
        // Tarjima chunk'i yuklanmasa — to'liq navigatsiya bilan tiklanadi.
        window.location.assign(target);
      }
    } catch {
      toast.error(t('settings.save_error'));
    }
  };

  const applyTheme = (next: 'light' | 'dark'): void => {
    // DOM + localStorage bir zumda — React/network javobi kutilmaydi.
    localStorage.setItem('boyxon-theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    // Switch va header darhol yangilanadi (optimistik).
    setTheme(next);
    setUser({
      ...user,
      preferences: {
        language: user.preferences?.language ?? 'uz',
        fontSize: user.preferences?.fontSize ?? 'medium',
        theme: next,
      },
    });
  };

  const toggleTheme = (nextDark: boolean): void => {
    const next: 'light' | 'dark' = nextDark ? 'dark' : 'light';
    if (next === theme) return;
    const previous = theme;
    const requestId = ++themeRequest.current;
    setThemeSaving(true);
    applyTheme(next);

    // Serverga yuboriladi; javob kelguncha switch kutish holatida turadi.
    void usersApi
      .updatePrefs({ theme: next })
      .then((r) => {
        // Tez ketma-ket bosishda eski javob yangisini bosib ketmasin.
        if (requestId !== themeRequest.current) return;
        const latest = useAuthStore.getState().user;
        if (latest) setUser({ ...latest, preferences: r.data });
        setThemeSaving(false);
      })
      .catch(() => {
        if (requestId !== themeRequest.current) return;
        applyTheme(previous);
        setThemeSaving(false);
        toast.error(t('settings.save_error'));
      });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-5">
      <h1 className="font-display text-2xl font-extrabold">{t('nav.settings')}</h1>
      <ProfileCard user={user} />

      <SettingsGroup title={t('settings.account')}>
        {/* Manzillarim — bosilsa o'z tagida ochiladi */}
        <SettingsRow
          icon={MapPin}
          label={t('settings.addresses')}
          value={tVal(t('home.items_count'), { count: user.addresses?.length ?? 0 })}
          right={
            <ChevronDown className={`h-4 w-4 shrink-0 text-ink-300 transition-transform ${addressesOpen ? 'rotate-180' : ''}`} />
          }
          onClick={() => setAddressesOpen((v) => !v)}
        />
        {addressesOpen && (
          <div className="border-t border-ink-line/60 px-4 py-3">
            <AddressManager />
          </div>
        )}

        {/* Buyurtmalarim — bosilsa o'z tagida ochiladi */}
        <SettingsRow
          icon={Package}
          label={t('settings.orders')}
          value={orders ? tVal(t('home.items_count'), { count: orders.pagination.total }) : '...'}
          right={
            <ChevronDown className={`h-4 w-4 shrink-0 text-ink-300 transition-transform ${ordersOpen ? 'rotate-180' : ''}`} />
          }
          onClick={() => setOrdersOpen((v) => !v)}
        />
        {ordersOpen && (
          <div className="space-y-2 border-t border-ink-line/60 px-4 py-3">
            {!orders?.data.length && <Card className="p-4 text-sm text-ink-300">{t('settings.no_orders')}</Card>}
            {orders?.data.map((o) => (
              <button
                key={o._id}
                type="button"
                className="rounded-card border border-ink-line/60 bg-surface shadow-sm flex w-full items-center justify-between p-3.5 text-left"
                onClick={() => navigate(`/orders/${o._id}`)}
              >
                 <div>
                   <p className="font-semibold">{o.orderNumber}</p>
                   <p className="text-xs text-ink-300">{formatDate(o.createdAt)} · {tVal(t('settings.dishes_count'), { count: o.items.length })}</p>
                 </div>
                 <div className="text-right">
                   <p className="font-bold text-primary-600">{formatPrice(o.total)}</p>
                   <p className="text-xs text-ink-300">{t(`status.${o.status}`)}</p>
                 </div>
               </button>
             ))}
          </div>
        )}

        {/* Bildirishnomalar — bosilsa o'z tagida ochiladi */}
        <SettingsRow
          icon={Bell}
          label={t('settings.notifications')}
          right={
            <ChevronDown className={`h-4 w-4 shrink-0 text-ink-300 transition-transform ${notifOpen ? 'rotate-180' : ''}`} />
          }
          onClick={() => setNotifOpen((v) => !v)}
        />
        {notifOpen && (
          <div className="border-t border-ink-line/60 px-1 py-1">
            <NotificationPrefs
              bare
              prefs={user.notificationPrefs ?? { pushEnabled: true }}
            />
          </div>
        )}
      </SettingsGroup>

      <SettingsGroup title={t('settings.preferences')}>
        <SettingsRow
          icon={Globe}
          label={t('settings.language')}
          right={
            <div className="flex gap-1">
              {LANGS.map((l) => (
                <button
                  key={l.v}
                  onClick={() => void setLang(l.v)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${i18n.language === l.v ? 'bg-primary-700 text-white' : 'bg-surface-raised text-ink-700'}`}
                >
                  {l.v.toUpperCase()}
                </button>
              ))}
            </div>
          }
        />
        <SettingsRow
          icon={theme === 'dark' ? Moon : Sun}
          label={t('settings.theme')}
          value={theme === 'dark' ? t('theme.dark') : t('theme.light')}
          right={
            <Switch
              checked={theme === 'dark'}
              disabled={themeSaving}
              pending={themeSaving}
              onChange={toggleTheme}
              label={t('settings.theme')}
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup title={t('settings.security')}>
        <SettingsRow
          icon={LogOut}
          label={t('auth.logout')}
          danger
          onClick={() => {
            // ProtectedRoute ichidan nav() poygada yutqazadi — shuning uchun hard reload.
            // "Chiqish" bosilganda '/' ga chiqamiz (auth'da ushlanib qolmasligi uchun).
            void (async () => {
              qc.clear();
              await useAuthStore.getState().logoutServer();
              // Persist yozilishi uchun kichik pauza — aks holda reload eski token'ni qayta tiklaydi
              await new Promise((r) => setTimeout(r, 50));
              window.location.href = '/';
            })();
          }}
        />
      </SettingsGroup>

      <div className="pb-4">
        <a
          href="tel:+998939588458"
          aria-label={t('settings.help_contact')}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-ink-line bg-bg px-4 py-3 text-sm font-semibold text-ink-700 transition hover:border-primary-500/60 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t('settings.help_contact')}</span>
        </a>
      </div>
    </div>
  );
}