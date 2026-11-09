import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  icon?: LucideIcon;
  label: string;
  value?: string;
  onClick?: () => void;
  danger?: boolean;
  right?: ReactNode;
}

export function SettingsRow({ icon: Icon, label, value, onClick, danger, right }: Props) {
  const content = (
    <>
      {Icon && (
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${danger ? 'bg-danger/10 text-danger' : 'bg-primary-50 text-primary-600'}`}>
          <Icon className="h-5 w-5" />
        </span>
      )}
      <span className={`min-w-0 flex-1 truncate text-sm font-medium ${danger ? 'text-danger' : 'text-ink-900'}`}>{label}</span>
      {value && <span className="max-w-[140px] shrink-0 truncate text-right text-sm text-ink-300">{value}</span>}
      {right && <span className="shrink-0">{right}</span>}
      {onClick && !right && <ChevronRight className="h-4 w-4 shrink-0 text-ink-300" />}
    </>
  );
  if (!onClick) return <div className="flex w-full items-center gap-3 px-4 py-3.5">{content}</div>;
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-raised">
      {content}
    </button>
  );
}
