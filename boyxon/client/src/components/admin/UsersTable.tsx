import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { User } from '../../types';
import { adminApi } from '../../api/admin.api';
import { formatDate } from '../../lib/format';

export function UsersTable({ users, loading }: { users: User[]; loading?: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const roleM = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => adminApi.changeRole(id, role),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin-users'] }); toast.success(t('admin.role_updated')); },
    onError: (e) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('admin.role_error')),
  });
  const blockM = useMutation({
    mutationFn: ({ id, block }: { id: string; block: boolean }) => adminApi.toggleBlock(id, block),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin-users'] }); toast.success(t('admin.status_updated')); },
    onError: (e) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.error')),
  });

  if (loading) return <div className="rounded-card bg-surface p-6 text-center text-ink-300">{t('common.loading')}</div>;
  if (!users.length) return <div className="rounded-card bg-surface p-6 text-center text-ink-300">{t('admin.users_empty')}</div>;

  return (
    <div className="overflow-x-auto rounded-card bg-surface shadow-sm">
      <table className="w-full min-w-[700px] text-sm">
        <thead className="border-b border-ink-line bg-surface-raised text-left text-xs text-ink-300">
          <tr>
            <th className="px-4 py-3">{t('admin.col_name')}</th>
            <th className="px-4 py-3">{t('admin.col_email')}</th>
            <th className="px-4 py-3">{t('admin.col_role')}</th>
            <th className="px-4 py-3">{t('admin.col_date')}</th>
            <th className="px-4 py-3">{t('admin.col_status')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-line/60">
          {users.map((u) => (
            <tr key={u._id}>
              <td className="px-4 py-3 font-medium">{u.name}</td>
              <td className="px-4 py-3 text-ink-300">{u.email}</td>
              <td className="px-4 py-3">
                <select
                  value={u.role}
                  onChange={(e) => roleM.mutate({ id: u._id, role: e.target.value })}
                  className="h-8 rounded-lg border border-ink-line bg-surface px-1.5 text-xs outline-none"
                >
                  <option value="user">{t('admin.role_user')}</option>
                  <option value="admin">{t('admin.role_admin')}</option>
                </select>
              </td>
              <td className="px-4 py-3 text-ink-300">{formatDate(u.createdAt)}</td>
              <td className="px-4 py-3">
                <Button
                  onClick={() => blockM.mutate({ id: u._id, block: u.isActive })}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${u.isActive ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}
                >
                  {u.isActive ? t('common.active') : t('admin.blocked')}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
