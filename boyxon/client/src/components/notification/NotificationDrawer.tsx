import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BellOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Sheet } from '../ui/Sheet';
import { NotificationItem } from './NotificationItem';
import { notificationsApi } from '../../api/notifications.api';
import { useUiStore } from '../../store/ui.store';
import { useAuthStore } from '../../store/auth.store';

export function NotificationDrawer() {
  const { t } = useTranslation();
  const { notifOpen, set } = useUiStore();
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(1, 30),
    enabled: Boolean(token) && notifOpen,
  });

  const markAll = async (): Promise<void> => {
    await notificationsApi.readAll();
    await qc.invalidateQueries({ queryKey: ['notifications'] });
    await qc.invalidateQueries({ queryKey: ['unread-count'] });
  };

  const openItem = async (id: string, link?: string): Promise<void> => {
    await notificationsApi.readOne(id);
    await qc.invalidateQueries({ queryKey: ['notifications'] });
    await qc.invalidateQueries({ queryKey: ['unread-count'] });
    set({ notifOpen: false });
    if (link) nav(link);
  };

  return (
    <Sheet open={notifOpen} onClose={() => set({ notifOpen: false })} title={t('notifications.title')}>
      {!!data?.data.length && (
        <Button onClick={markAll} className="mb-2 text-sm font-medium text-primary-600">
          {t('notifications.mark_all_read')}
        </Button>
      )}
      <div className="flex flex-col gap-1">
        {isLoading && <p className="py-6 text-center text-sm text-ink-300">{t('common.loading')}</p>}
        {!isLoading && !data?.data.length && (
          <div className="py-10 text-center">
            <BellOff className="mx-auto h-10 w-10 text-ink-300" />
            <p className="mt-2 text-sm text-ink-300">{t('notifications.empty')}</p>
          </div>
        )}
        {data?.data.map((n) => (
          <NotificationItem key={n._id} n={n} onClick={() => void openItem(n._id, n.link)} />
        ))}
      </div>
      {/* qo'ng'iroq ikonkasi bildirishnoma elementlarida chiziladi */}
    </Sheet>
  );
}
