import { Bike, Store } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

interface Props {
  value: 'delivery' | 'pickup';
  onChange: (v: 'delivery' | 'pickup') => void;
}

export function DeliveryToggle({ value, onChange }: Props) {
  const { t } = useTranslation();
  const opts = [
    { v: 'delivery' as const, k: 'cart.delivery', Icon: Bike },
    { v: 'pickup' as const, k: 'cart.pickup', Icon: Store },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1">
      {opts.map(({ v, k, Icon }) => (
        <Button
          key={v}
          onClick={() => onChange(v)}
          className={cn(
            'flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition',
            value === v
              ? 'bg-surface text-primary-700 shadow-sm dark:text-primary-400'
              : 'text-ink-300',
          )}
        >
          <Icon className="h-4 w-4" />
          {t(k)}
        </button>
      ))}
    </div>
  );
}
