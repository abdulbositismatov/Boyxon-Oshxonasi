import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../api/admin.api';
import { Sheet } from '../../components/ui/Sheet';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { cn } from '../../lib/utils';
import type { Category } from '../../types';

const empty = { name: '', slug: '', icon: '', order: '0' };
const FILTERS = ['all', 'active', 'deleted'] as const;
type Filter = (typeof FILTERS)[number];

export default function AdminCategories() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState(empty);
  const [filter, setFilter] = useState<Filter>('all');

  const { data, isLoading } = useQuery({ queryKey: ['admin-categories'], queryFn: () => adminApi.categories() });
  const refresh = (): void => void qc.invalidateQueries({ queryKey: ['admin-categories'] });

  const saveM = useMutation({
    mutationFn: () => {
      const body = { name: form.name, slug: form.slug, icon: form.icon || undefined, order: Number(form.order) };
      return editing ? adminApi.updateCategory(editing._id, body) : adminApi.createCategory(body);
    },
    onSuccess: () => { toast.success(editing ? t('common.updated') : t('common.created')); refresh(); setOpen(false); },
    onError: (e) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.error')),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => adminApi.deleteCategory(id),
    onSuccess: () => { toast.success(t('common.deleted')); refresh(); },
    onError: (e) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('admin.delete_error')),
  });

  const restoreM = useMutation({
    mutationFn: (id: string) => adminApi.restoreCategory(id),
    onSuccess: () => { toast.success(t('admin.restored')); refresh(); },
    onError: (e) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.error')),
  });

  // Filtr: "Hammasi" — barchasi, "Faollar" — faqat isActive, "O'chirilganlar" — soft-delete qilinganlar.
  const items = (data?.data ?? []).filter((c) =>
    filter === 'all' ? true : filter === 'active' ? c.isActive : !c.isActive,
  );

  const inputCls = 'h-11 w-full rounded-xl border border-ink-line px-3 text-sm outline-none focus:border-primary-500';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => { setEditing(null); setForm(empty); setOpen(true); }}>
          <Plus className="h-4 w-4" /> {t('admin.new_category')}
        </Button>
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <Button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-semibold',
                filter === f ? 'bg-primary-700 text-white' : 'bg-surface-raised text-ink-700 hover:opacity-80',
              )}
            >
              {t(`admin.cat_filter_${f}`)}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <div className="rounded-card bg-surface p-6 text-center text-ink-300">{t('common.loading')}</div>}
      {!isLoading && !items.length && (
        <div className="rounded-card bg-surface p-6 text-center text-ink-300">{t('admin.cat_empty')}</div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => (
          <Card key={c._id} className={cn('flex items-center justify-between p-4', !c.isActive && 'opacity-60')}>
            <div>
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {c.name}
                {!c.isActive && (
                  <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-300">
                    {t('admin.deleted_badge')}
                  </span>
                )}
              </p>
              <p className="text-xs text-ink-300">/{c.slug} · {c.order}</p>
            </div>
            <div className="flex gap-1">
              <Button
                onClick={() => { setEditing(c); setForm({ name: c.name, slug: c.slug, icon: c.icon ?? '', order: String(c.order) }); setOpen(true); }}
                className="rounded-lg p-2 hover:bg-surface-raised"
                aria-label={t('common.edit')}
              >
                <Pencil className="h-4 w-4" />
              </button>
              {c.isActive ? (
                <Button
                  onClick={() => { if (confirm(t('admin.delete_confirm', { name: c.name }))) deleteM.mutate(c._id); }}
                  className="rounded-lg p-2 text-danger hover:bg-danger/10"
                  aria-label={t('common.delete')}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : (
                <Button
                  onClick={() => restoreM.mutate(c._id)}
                  className="rounded-lg p-2 text-success hover:bg-success/10"
                  aria-label={t('admin.restore')}
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title={editing ? t('admin.edit_category') : t('admin.new_category')}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-700">{t('admin.category_name')} *</label>
            <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-700">{t('admin.slug')} *</label>
            <input className={inputCls} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} placeholder="palovlar" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-700">{t('admin.icon')}</label>
              <input className={inputCls} value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="Soup" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-700">{t('admin.order')}</label>
              <input type="number" className={inputCls} value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} />
            </div>
          </div>
          <Button className="w-full" disabled={saveM.isPending || !form.name || !form.slug} onClick={() => saveM.mutate()}>
            {saveM.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}