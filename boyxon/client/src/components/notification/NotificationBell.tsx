import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { notificationsApi } from '../../api/notifications.api';
import { useAuthStore } from '../../store/auth.store';
import { useUiStore } from '../../store/ui.store';

/** Header uchun qo‘ng‘iroq tugmasi + unread badge. */
export function NotificationBell() {
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.accessToken);
  const set = useUiStore((s) => s.set);
  const { data } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => notificationsApi.unreadCount().then((r) => r.data.count),
    enabled: Boolean(token),
    refetchInterval: 60_000,
  });
  const count = data ?? 0;
  return (
    <Button className="relative rounded-full p-2.5 hover:bg-surface-raised" onClick={() => set({ notifOpen: true })} aria-label={t('nav.notifications')}>
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
          {count}
        </span>
      )}
    </Button>
  );
}
