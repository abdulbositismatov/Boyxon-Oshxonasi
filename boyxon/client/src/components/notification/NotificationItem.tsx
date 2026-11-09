import type { AppNotification } from '../../types';
import { formatDate } from '../../lib/format';
import { Bell, CheckCircle2, Gift, Info, UtensilsCrossed } from 'lucide-react';
import { cn } from '../../lib/utils';

const icons = {
  order: CheckCircle2,
  promo: Gift,
  system: Info,
  new_dish: UtensilsCrossed,
  bonus: Gift,
};

export function NotificationItem({
  n,
  onClick,
}: {
  n: AppNotification;
  onClick?: () => void;
}) {
  const Icon = icons[n.type] ?? Bell;
  return (
    <Button
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-surface-raised',
        !n.isRead && 'bg-primary-50/60',
      )}
    >
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-100 text-primary-600">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink-900">{n.title}</span>
        <span className="block text-sm text-ink-500">{n.message}</span>
        <span className="mt-0.5 block text-xs text-ink-300">{formatDate(n.createdAt)}</span>
      </span>
      {!n.isRead && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary-500" />}
    </button>
  );
}
