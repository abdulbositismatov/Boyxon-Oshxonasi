import { CakeSlice, ChefHat, Croissant, CupSoda, Flame, Salad, Soup, Wheat, LayoutGrid, CookingPot, Drumstick, Fish, IceCreamCone, Pizza } from 'lucide-react';
import type { Category } from '../../types';
import { useTranslation } from 'react-i18next';
import { localizedCategoryName } from '../../lib/format';
import { cn } from '../../lib/utils';

const iconMap: Record<string, typeof Soup> = {
  soup: Soup,
  Soup,
  palov: CookingPot,
  CookingPot,
  samsa: Croissant,
  Croissant,
  kabob: Flame,
  kebab: Flame,
  Flame,
  salad: Salad,
  Salad,
  desert: CakeSlice,
  dessert: CakeSlice,
  CakeSlice,
  drink: CupSoda,
  drinks: CupSoda,
  CupSoda,
  bread: Wheat,
  non: Wheat,
  Wheat,
  chicken: Drumstick,
  Drumstick,
  fish: Fish,
  Fish,
  icecream: IceCreamCone,
  IceCreamCone,
  pizza: Pizza,
  Pizza,
  chef: ChefHat,
  ChefHat,
};

interface Props {
  categories: Category[];
  active?: string;
  onChange: (slug: string | undefined) => void;
}

export function CategoryChips({ categories, active, onChange }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const items = [{ _id: 'all', name: t('category.all'), slug: '' } as unknown as Category, ...categories];
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
      {items.map((c, idx) => {
        const Icon = iconMap[c.icon ?? ''] ?? iconMap[(c.icon ?? '').toLowerCase()] ?? LayoutGrid;
        const isActive = active === c.slug || (!active && !c.slug);
        const label = !c.slug ? t('category.all') : (localizedCategoryName(c, lang) || c.name);
        return (
          <Button
            key={c._id}
            onClick={() => onChange(c.slug || undefined)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-150 active:scale-90 select-none touch-manipulation hover:scale-[1.04] animate-fade-in-up',
              isActive
                ? 'border-primary-700 bg-primary-700 text-white shadow-md shadow-primary-700/25 scale-[1.02]'
                : 'border-ink-line bg-surface text-ink-700 hover:border-primary-500/50 hover:bg-surface-raised',
            )}
            style={{ animationDelay: `${idx * 45}ms` }}
          >
            <Icon className={cn('h-4 w-4 transition-transform duration-200', isActive && 'scale-110')} />
            {label}
          </Button>
        );
      })}
    </div>
  );
}
