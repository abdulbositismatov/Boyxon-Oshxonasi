import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';

export interface DishFilterValues {
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  tags?: string;
  sort?: 'new' | 'price_asc' | 'price_desc' | 'rating' | 'popular';
}

interface Props {
  open: boolean;
  onClose: () => void;
  value: DishFilterValues;
  onApply: (v: DishFilterValues) => void;
}

const TAGS = [
  { v: 'vegetarian', k: 'dish.diet' },
  { v: 'spicy', k: 'dish.spicy' },
  { v: 'top', k: 'dish.top' },
  { v: 'new', k: 'dish.new' },
];

const SORTS: { v: DishFilterValues['sort']; k: string }[] = [
  { v: 'new', k: 'filter.sort.new' },
  { v: 'rating', k: 'filter.sort.rating' },
  { v: 'price_asc', k: 'filter.sort.price_asc' },
  { v: 'price_desc', k: 'filter.sort.price_desc' },
  { v: 'popular', k: 'filter.sort.popular' },
];

export function DishFilterSheet({ open, onClose, value, onApply }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<DishFilterValues>(value);
  useEffect(() => setDraft(value), [value, open]);

  return (
    <Sheet open={open} onClose={onClose} title={t('filter.title')}>
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-semibold text-ink-700">{t('filter.price')}</p>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder={t('filter.from')}
              value={draft.minPrice ?? ''}
              onChange={(e) => setDraft({ ...draft, minPrice: e.target.value ? Number(e.target.value) : undefined })}
              className="h-11 w-full rounded-xl border border-ink-line px-3 outline-none focus:border-primary-500"
            />
            <input
              type="number"
              placeholder={t('filter.to')}
              value={draft.maxPrice ?? ''}
              onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value ? Number(e.target.value) : undefined })}
              className="h-11 w-full rounded-xl border border-ink-line px-3 outline-none focus:border-primary-500"
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-ink-700">{t('filter.rating')}</p>
          <div className="flex flex-wrap gap-2">
            {[0, 4, 4.5, 4.7].map((r) => (
              <Button
                key={r}
                onClick={() => setDraft({ ...draft, rating: r === 0 ? undefined : r })}
                className={`rounded-full border px-3 py-1.5 text-sm ${draft.rating === r || (r === 0 && !draft.rating) ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-ink-line'}`}
              >
                {r === 0 ? t('filter.all') : `${r}+`}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-ink-700">{t('filter.tags')}</p>
          <div className="flex flex-wrap gap-2">
            {TAGS.map((tag) => {
              const on = draft.tags?.split(',').includes(tag.v);
              return (
                <Button
                  key={tag.v}
                  onClick={() => {
                    const cur = new Set((draft.tags ?? '').split(',').filter(Boolean));
                    on ? cur.delete(tag.v) : cur.add(tag.v);
                    setDraft({ ...draft, tags: [...cur].join(',') || undefined });
                  }}
                  className={`rounded-full border px-3 py-1.5 text-sm ${on ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-ink-line'}`}
                >
                  {t(tag.k)}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-ink-700">{t('filter.sort')}</p>
          <div className="flex flex-wrap gap-2">
            {SORTS.map((s) => (
              <Button
                key={s.v}
                onClick={() => setDraft({ ...draft, sort: s.v })}
                className={`rounded-full border px-3 py-1.5 text-sm ${draft.sort === s.v ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-ink-line'}`}
              >
                {t(s.k)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => setDraft({})}>
            {t('filter.reset')}
          </Button>
          <Button className="flex-1" onClick={() => { onApply(draft); onClose(); }}>
            {t('filter.apply')}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
