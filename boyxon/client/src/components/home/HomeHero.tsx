import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, Clock, Dices, Flame, ShieldCheck, Sparkles, Star, Utensils } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import type { Dish } from '../../types';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { formatPrice, localizedDishDescription, localizedDishName, tVal } from '../../lib/format';
import { useCart } from '../../hooks/useCart';

interface Props {
  dishes?: Dish[];
  onSelectCategory?: (slug?: string) => void;
}

export function HomeHero({ dishes = [], onSelectCategory }: Props) {
  const { t, i18n } = useTranslation();
  const { add } = useCart();
  const [randomModalOpen, setRandomModalOpen] = useState(false);
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);

  const lang = i18n.language;

  // Tasodifiy taom tanlash (Bugun nima yesam ekan?)
  const handleRandomPick = () => {
    if (!dishes.length) return;
    setIsSpinning(true);
    setRandomModalOpen(true);

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([15, 30, 15]);
      } catch {
        /* no-op */
      }
    }

    // Qiziqarli roulette animatsiyasi: tez aylanib bitta taomda to'xtaydi
    let counter = 0;
    const interval = setInterval(() => {
      const tempPick = dishes[Math.floor(Math.random() * dishes.length)];
      setSelectedDish(tempPick);
      counter++;
      if (counter > 8) {
        clearInterval(interval);
        const finalPick = dishes[Math.floor(Math.random() * dishes.length)];
        setSelectedDish(finalPick);
        setIsSpinning(false);
      }
    }, 80);
  };

  const scrollToMenu = () => {
    const el = document.getElementById('dishes-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleShortcut = (categorySlug: string) => {
    onSelectCategory?.(categorySlug);
    scrollToMenu();
  };

  const handleAddRandomToCart = () => {
    if (!selectedDish) return;
    const name = localizedDishName(selectedDish, lang);
    add(
      {
        dishId: selectedDish._id,
        name: selectedDish.name,
        price: selectedDish.price,
        image: selectedDish.image,
      },
      1,
    );
    toast.success(tVal(t('dish.added'), { name }));
    setRandomModalOpen(false);
  };

  return (
    <>
      <div className="shimmer-card mb-6 overflow-hidden rounded-[26px] border border-amber-500/20 bg-gradient-to-br from-primary-800 via-primary-700 to-amber-800 p-5 text-white shadow-xl md:p-7 dark:border-amber-500/15 dark:from-neutral-900 dark:via-primary-950 dark:to-neutral-900">
        {/* Dekorativ animatsiyalar */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 right-20 h-40 w-40 rounded-full bg-primary-500/20 blur-2xl" />

        {/* Suzuvchi emojilar */}
        <div className="pointer-events-none absolute right-4 top-4 text-3xl opacity-25 animate-float">
          🥘
        </div>
        <div
          className="pointer-events-none absolute right-20 bottom-5 text-2xl opacity-20 animate-float"
          style={{ animationDelay: '1.5s' }}
        >
          🥩
        </div>

        {/* Yuqori brend nishoni */}
        <div className="relative z-10 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-black/25 px-3 py-1 text-xs font-bold tracking-wide text-amber-200 backdrop-blur-md shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            {t('home.hero_badge')}
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80 backdrop-blur-sm">
            <Flame className="h-3 w-3 text-amber-400" />
            {t('home.hero_feature_fresh')}
          </span>
        </div>

        {/* Asosiy jozibali sarlavha */}
        <div className="relative z-10 mt-3 max-w-2xl">
          <h2 className="font-display text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl md:text-4xl">
            {t('home.hero_title')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-amber-50/90 sm:text-base">
            {t('home.hero_subtitle')}
          </p>
        </div>

        {/* Xususiyat piktogrammalari (Pills) */}
        <div className="relative z-10 mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-white/95">
          <div className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 backdrop-blur-md border border-white/10 shadow-sm">
            <Clock className="h-3.5 w-3.5 text-amber-300" />
            <span>{t('home.hero_feature_fast')}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 backdrop-blur-md border border-white/10 shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
            <span>{t('home.hero_feature_halal')}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 backdrop-blur-md border border-white/10 shadow-sm">
            <Utensils className="h-3.5 w-3.5 text-orange-300" />
            <span>{t('home.hero_feature_fresh')}</span>
          </div>
        </div>

        {/* Asosiy harakat tugmalari */}
        <div className="relative z-10 mt-5 flex flex-wrap items-center gap-3">
          <Button
            onClick={scrollToMenu}
            className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-primary-900 shadow-lg shadow-black/15 transition-all duration-150 hover:bg-amber-100 hover:scale-105 active:scale-95 touch-manipulation"
          >
            <span>{t('home.hero_cta_menu')}</span>
            <ArrowDown className="h-4 w-4" />
          </Button>

          {dishes.length > 0 && (
            <Button
              onClick={handleRandomPick}
              className="flex items-center gap-2 rounded-full border border-amber-300/40 bg-white/15 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition-all duration-150 hover:bg-white/25 active:scale-90 touch-manipulation shadow-sm"
            >
              <Dices className="h-4 w-4 text-amber-300 animate-spin-slow" />
              <span>{t('home.hero_cta_random')}</span>
            </Button>
          )}
        </div>

        {/* Tezkor ishtahani ochuvchi taom kategoriyalari */}
        <div className="relative z-10 mt-4 border-t border-white/15 pt-3">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar text-xs">
            <span className="text-white/70 shrink-0 font-medium">Tezkor tanlov:</span>
            <Button
              onClick={() => handleShortcut('palovlar')}
              className="shrink-0 rounded-full bg-black/20 hover:bg-black/35 px-2.5 py-1 text-amber-200 border border-white/10 transition active:scale-90"
            >
              👑 Palovlar
            </Button>
            <Button
              onClick={() => handleShortcut('somsa')}
              className="shrink-0 rounded-full bg-black/20 hover:bg-black/35 px-2.5 py-1 text-amber-200 border border-white/10 transition active:scale-90"
            >
              🥟 Somsalar
            </Button>
            <Button
              onClick={() => handleShortcut('kaboblar')}
              className="shrink-0 rounded-full bg-black/20 hover:bg-black/35 px-2.5 py-1 text-amber-200 border border-white/10 transition active:scale-90"
            >
              🥩 Qozon kabob
            </Button>
            <Button
              onClick={() => handleShortcut('shorvalar')}
              className="shrink-0 rounded-full bg-black/20 hover:bg-black/35 px-2.5 py-1 text-amber-200 border border-white/10 transition active:scale-90"
            >
              🍲 Sho'rvalar
            </Button>
          </div>
        </div>
      </div>

      {/* "Bugun nima yesam ekan?" Interaktiv taom tavsiyasi modali */}
      <Sheet
        open={randomModalOpen}
        onClose={() => setRandomModalOpen(false)}
        title={t('home.random_modal_title')}
      >
        {selectedDish && (
          <div className="flex flex-col items-center text-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedDish._id}
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 250 }}
                className="w-full"
              >
                <div className="relative mx-auto mb-4 h-48 w-full max-w-xs overflow-hidden rounded-2xl shadow-md border border-ink-line">
                  {selectedDish.image ? (
                    <img
                      src={selectedDish.image}
                      alt={localizedDishName(selectedDish, lang)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center bg-muted text-4xl">
                      🍽️
                    </div>
                  )}
                  <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-bold text-amber-300 backdrop-blur-md">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {selectedDish.rating?.toFixed(1) ?? '5.0'}
                  </span>
                </div>

                <h4 className="font-display text-xl font-bold text-ink-900">
                  {localizedDishName(selectedDish, lang)}
                </h4>
                <p className="mt-1 line-clamp-2 text-sm text-ink-300">
                  {localizedDishDescription(selectedDish, lang)}
                </p>

                <p className="mt-3 text-2xl font-black text-primary-600">
                  {formatPrice(selectedDish.price)}
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="mt-6 flex w-full flex-col gap-2.5">
              <Button
                variant="primary"
                size="lg"
                onClick={handleAddRandomToCart}
                className="w-full text-base font-bold shadow-lg"
              >
                {t('home.random_order')}
              </Button>
              <button
                type="button"
                disabled={isSpinning}
                onClick={handleRandomPick}
                className="flex items-center justify-center gap-2 rounded-full border border-ink-line py-3 text-sm font-semibold text-ink-700 transition hover:bg-surface-raised active:scale-95"
              >
                <Dices className={`h-4 w-4 text-primary-500 ${isSpinning ? 'animate-spin' : ''}`} />
                <span>{t('home.random_spin')}</span>
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}
