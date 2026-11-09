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
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full gap-3 rounded-2xl border p-3 text-left transition hover:bg-surface-raised',
        n.isRead ? 'border-ink-line' : 'border-primary-200 bg-primary-50/60',
      )}
    >
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface text-primary-600 shadow-sm">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="font-semibold text-ink-900">{n.title}</span>
          {!n.isRead && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary-500" />}
        </span>
        <span className="mt-0.5 block text-sm text-ink-500">{n.message}</span>
        <span className="mt-1 block text-xs text-ink-300">{formatDate(n.createdAt)}</span>
      </span>
    </button>
  );
}
