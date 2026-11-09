import { useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/auth.store';

export function AdminTopBar({ title }: { title: string }) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-ink-line bg-surface px-4 md:px-6">
      <h1 className="font-display text-lg font-bold">{title}</h1>
      <div className="flex items-center gap-3">
        <Button
          onClick={() => nav('/')}
          className="flex items-center gap-1.5 text-sm font-medium text-ink-700 hover:text-primary-600"
        >
          <ExternalLink className="h-4 w-4" />
          {t('admin.view_site')}
        </button>
        <span className="hidden text-sm text-ink-300 sm:block">{user?.email}</span>
      </div>
    </header>
  );
}
