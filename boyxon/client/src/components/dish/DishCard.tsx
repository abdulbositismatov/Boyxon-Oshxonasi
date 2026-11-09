import { useState } from 'react';
import { Plus, Star, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Dish } from '../../types';
import { formatPrice, localizedDishDescription, localizedDishName, tVal } from '../../lib/format';
import { useCart } from '../../hooks/useCart';
import { DishPlaceholder } from './DishPlaceholder';
import { Badge } from '../ui/Badge';

export function DishCard({ dish }: { dish: Dish }) {
  const { t, i18n } = useTranslation();
  const { add } = useCart();
  // URL ishlayotgan-deya xatolik (404/CORS) — singan rasm o'rniga placeholder.
  const [imgFailed, setImgFailed] = useState(false);
  const lang = i18n.language;
  const name = localizedDishName(dish, lang);
  const desc = localizedDishDescription(dish, lang);

  const addToCart = (): void => {
    add({ dishId: dish._id, name: dish.name, price: dish.price, image: dish.image }, 1);
    toast.success(tVal(t('dish.added'), { name }));
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(15);
      } catch {
        /* no-op */
      }
    }
  };

  return (
    <article className="scroll-reveal dish-contain card-hover-lift group relative overflow-hidden rounded-card border border-ink-line/60 bg-surface shadow-sm transition-all duration-300 hover:shadow-xl hover:border-primary-500/40">
      <Link to={`/dish/${dish.slug || dish._id}`} className="block overflow-hidden relative">
        {dish.image && !imgFailed ? (
          <>
            <img
              src={dish.image}
              alt={name}
              loading="lazy"
              decoding="async"
              width={640}
              height={480}
              onError={() => setImgFailed(true)}
              className="aspect-[4/3] w-full rounded-t-[20px] object-cover transition-transform duration-500 ease-out group-hover:scale-108"
            />
            {/* Gradient overlay on hover */}
            <div className="absolute inset-0 rounded-t-[20px] bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          </>
        ) : (
          <DishPlaceholder />
        )}
        {/* Discount badge */}
        {dish.oldPrice && (
          <span className="animate-badge-pop absolute left-2 top-2 rounded-full bg-danger px-2 py-0.5 text-[10px] font-extrabold text-white shadow-md">
            -{Math.round(((dish.oldPrice - dish.price) / dish.oldPrice) * 100)}%
          </span>
        )}
        {dish.isFeatured && !dish.oldPrice && (
          <span className="absolute left-2 top-2 rounded-full bg-primary-600 px-2 py-0.5 text-[10px] font-extrabold text-white shadow-md">
            🔥 TOP
          </span>
        )}
      </Link>
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 font-display font-semibold text-ink-900 transition-colors group-hover:text-primary-600">{name}</h3>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
            {dish.rating.toFixed(1)}
          </span>
        </div>
        <p className="line-clamp-2 text-sm text-ink-300">{desc}</p>
        <div className="flex items-center gap-3 text-xs text-ink-300">
          <span className="flex items-center gap-1">
            <Timer className="h-3.5 w-3.5" />
            {dish.deliveryTime} {t('dish.minutes')}
          </span>
          {dish.tags.includes('vegetarian') && <Badge tone="success">{t('dish.diet')}</Badge>}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <div>
            <p className="text-base font-bold text-ink-900">{formatPrice(dish.price)}</p>
            {dish.oldPrice ? (
              <p className="text-xs text-ink-300 line-through">{formatPrice(dish.oldPrice)}</p>
            ) : null}
          </div>
          <button
            onClick={addToCart}
            aria-label={t('dish.add')}
            className="ripple-container btn-glow grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-md transition-all duration-150 hover:scale-110 active:scale-75 active:rotate-45 select-none touch-manipulation"
          >
            <Plus className="h-5 w-5 transition-transform duration-300 group-hover:rotate-90" />
          </button>
        </div>
      </div>
    </article>
  );
}
