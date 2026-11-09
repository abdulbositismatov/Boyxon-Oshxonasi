import { Pencil, Power, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Dish } from '../../types';
import { formatPrice, localizedDishName } from '../../lib/format';

interface Props {
  dishes: Dish[];
  loading?: boolean;
  onEdit: (d: Dish) => void;
  onToggle: (d: Dish) => void;
  onDelete: (d: Dish) => void;
}

export function DishesTable({ dishes, loading, onEdit, onToggle, onDelete }: Props) {
  const { t, i18n } = useTranslation();
  if (loading) return <div className="rounded-card bg-surface p-6 text-center text-ink-300">{t('common.loading')}</div>;
  if (!dishes.length) return <div className="rounded-card bg-surface p-6 text-center text-ink-300">{t('admin.dishes_empty')}</div>;

  return (
    <div className="overflow-x-auto rounded-card bg-surface shadow-sm">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b border-ink-line bg-surface-raised text-left text-xs text-ink-300">
          <tr>
            <th className="px-4 py-3">{t('admin.col_dish')}</th>
            <th className="px-4 py-3">{t('admin.col_price')}</th>
            <th className="px-4 py-3">{t('admin.col_category')}</th>
            <th className="px-4 py-3">{t('admin.col_rating')}</th>
            <th className="px-4 py-3">{t('admin.col_status')}</th>
            <th className="px-4 py-3 text-right">{t('admin.col_actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-line/60">
          {dishes.map((d) => (
            <tr key={d._id}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-14 shrink-0 overflow-hidden rounded-lg">
                    {d.image ? (
                      <img src={d.image} alt={localizedDishName(d, i18n.language)} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-muted text-[10px] text-ink-300">{t('dish.no_image')}</div>
                    )}
                  </div>
                  <span className="font-medium">{localizedDishName(d, i18n.language)}</span>
                </div>
              </td>
              <td className="px-4 py-3">{formatPrice(d.price)}</td>
              <td className="px-4 py-3 text-ink-300">{typeof d.category === 'object' ? d.category.name : '—'}</td>
              <td className="px-4 py-3">{d.rating.toFixed(1)}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${d.isActive ? 'bg-success/10 text-success' : 'bg-surface-raised text-ink-300'}`}>
                  {d.isActive ? t('common.active') : t('common.inactive')}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <Button onClick={() => onEdit(d)} className="rounded-lg p-2 hover:bg-surface-raised" aria-label={t('common.edit')}><Pencil className="h-4 w-4" /></Button>
                  <Button onClick={() => onToggle(d)} className="rounded-lg p-2 hover:bg-surface-raised" aria-label={t('admin.toggle')}><Power className="h-4 w-4" /></Button>
                  <Button onClick={() => onDelete(d)} className="rounded-lg p-2 text-danger hover:bg-danger/10" aria-label={t('common.delete')}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
