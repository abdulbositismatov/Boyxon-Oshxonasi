import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Star, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { dishesApi } from '../../api/dishes.api';
import { useCart } from '../../hooks/useCart';
import {
  formatPrice,
  localizedCategoryName,
  localizedDishDescription,
  localizedDishName,
  tVal,
} from '../../lib/format';
import { QUERY_KEYS } from '../../lib/constants';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DishPlaceholder } from '../../components/dish/DishPlaceholder';
import { DishCard } from '../../components/dish/DishCard';
import { Skeleton } from '../../components/ui/Skeleton';
import { Seo } from '../../components/seo/Seo';
import { getCategorySeo } from '../../lib/category-seo';
import { breadcrumbSchema } from '../../lib/seo-schema';
import {
  absoluteUrl,
  canonicalFor,
  pathLang,
  SITE_URL,
} from '../../lib/seo';
import type { Dish } from '../../types';

interface Review {
  _id: string;
  rating: number;
  comment?: string;
  user?: { _id: string; name: string; avatar?: string | null };
}

function absoluteImage(image: string | null | undefined): string {
  if (!image) return absoluteUrl('/og-image.png');
  return /^https?:\/\//i.test(image) ? image : absoluteUrl(image);
}

/**
 * GET /dish/:slug — bitta taom sahifasi.
 * DishCard shu yerga link qiladi (slug yoki _id).
 */
export default function DishPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { add } = useCart();
  const lang = pathLang();
  // Buzilgan rasm URL'i uchun placeholder fallback.
  const [imgFailed, setImgFailed] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: [QUERY_KEYS.dishes, 'detail', slug],
    queryFn: () => dishesApi.detail(slug),
    enabled: Boolean(slug),
  });

  const dish: Dish | undefined = data?.data?.dish;
  const reviews: Review[] = (data?.data?.reviews as Review[] | undefined) ?? [];
  const category = dish && typeof dish.category === 'object' ? dish.category : null;
  const categorySlug = category?.slug;

  // Eski _id havolasini canonical slug URL'ga almashtiramiz (dublikat kontent oldini olish).
  useEffect(() => {
    if (dish?.slug && dish.slug !== slug) {
      navigate(`/dish/${dish.slug}`, { replace: true });
    }
  }, [dish?.slug, slug, navigate]);

  const relatedQuery = useQuery({
    queryKey: [QUERY_KEYS.dishes, 'related', categorySlug],
    queryFn: () => dishesApi.list({ category: categorySlug, limit: 6, sort: 'popular' }),
    enabled: Boolean(categorySlug),
  });
  const related = (relatedQuery.data?.data ?? [])
    .filter((item) => item._id !== dish?._id)
    .slice(0, 4);

  const langCode = i18n.language;
  const name = dish ? localizedDishName(dish, langCode) : '';
  const description = dish ? localizedDishDescription(dish, langCode) : '';
  const categoryName = category ? localizedCategoryName(category, langCode) : '';
  const categoryCrumb = category
    ? (getCategorySeo(category.slug, lang)?.crumb ?? categoryName)
    : '';
  const dishPath = dish ? `/dish/${dish.slug || dish._id}` : `/dish/${slug}`;
  const seoTitle = dish
    ? t('seo.dish.title', { name })
    : `${t('nav.menu')} — Boyxon Oshxonasi`;
  const seoDescription = dish
    ? t('seo.dish.description', { name, price: formatPrice(dish.price) })
    : t('seo.home.description');

  const jsonLd = dish
    ? [
        {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name,
          description,
          image: [absoluteImage(dish.image)],
          sku: dish._id,
          ...(categoryName ? { category: categoryCrumb } : {}),
          brand: { '@type': 'Brand', name: 'Boyxon Oshxonasi' },
          offers: {
            '@type': 'Offer',
            url: canonicalFor(dishPath, lang),
            priceCurrency: 'UZS',
            price: dish.price,
            availability: 'https://schema.org/InStock',
            itemCondition: 'https://schema.org/NewCondition',
            seller: {
              '@type': 'Restaurant',
              '@id': `${SITE_URL}/#restaurant`,
              name: 'Boyxon Oshxonasi',
            },
          },
          ...(dish.reviewCount > 0
            ? {
                aggregateRating: {
                  '@type': 'AggregateRating',
                  ratingValue: dish.rating,
                  reviewCount: dish.reviewCount,
                  bestRating: 5,
                  worstRating: 1,
                },
              }
            : {}),
        },
        breadcrumbSchema(lang, [
          { name: t('seo.breadcrumb_home'), path: '/' },
          ...(category
            ? [{ name: categoryCrumb, path: `/category/${category.slug}` }]
            : []),
          { name, path: dishPath },
        ]),
      ]
    : undefined;

  const addToCart = (): void => {
    if (!dish) return;
    add({ dishId: dish._id, name: dish.name, price: dish.price, image: dish.image }, 1);
    toast.success(tVal(t('dish.added'), { name: localizedDishName(dish, langCode) }));
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(15);
      } catch {
        /* no-op */
      }
    }
  };

  return (
    <>
      <Seo
        title={seoTitle}
        description={seoDescription}
        path={dishPath}
        image={dish?.image ?? undefined}
        type={dish ? 'product' : 'website'}
        noindex={!dish && !isLoading}
        keywords={dish ? t('seo.dish.keywords', { name, category: categoryCrumb }) : undefined}
        jsonLd={jsonLd}
      />

      {isLoading ? (
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-5">
          <Skeleton className="aspect-[16/9] w-full" />
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ) : isError || !dish ? (
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">
            {t('pages.404.title')}
          </h1>
          <p className="mt-2 text-ink-300">{t('dish.not_found')}</p>
          <Link to="/" className="mt-4 inline-block">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" /> {t('dish.back_to_menu')}
            </Button>
          </Link>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl space-y-5 px-4 py-5">
          <div className="flex items-center gap-2 text-xs text-ink-300 mb-4">
            <Button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 hover:text-primary-600 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
              {t('common.back')}
            </Button>
          </div>

          <div className="overflow-hidden rounded-card border border-ink-line/60 bg-surface shadow-sm">
            {dish.image && !imgFailed ? (
              <img
                src={dish.image}
                alt={name}
                loading="eager"
                decoding="async"
                width={1200}
                height={675}
                onError={() => setImgFailed(true)}
                className="aspect-[16/9] w-full object-cover"
              />
            ) : (
              <DishPlaceholder className="rounded-none" />
            )}

            <div className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <h1 className="font-display text-2xl font-extrabold text-ink-900">{name}</h1>
                <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-ink-700">
                  <Star className="h-4 w-4 fill-[#FDAB12] text-[#FDAB12]" />
                  {dish.rating.toFixed(1)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-300">
                {category ? (
                  <Link
                    to={`/category/${category.slug}`}
                    className="font-semibold text-primary-600 hover:underline"
                  >
                    {categoryCrumb}
                  </Link>
                ) : null}
                <span className="flex items-center gap-1">
                  <Timer className="h-3.5 w-3.5" />
                  {dish.deliveryTime} {t('dish.minutes')}
                </span>
                {typeof dish.calories === 'number' && dish.calories > 0 && (
                  <span>{tVal(t('dish.calories'), { count: dish.calories })}</span>
                )}
                {dish.tags.includes('vegetarian') && <Badge tone="success">{t('dish.vegetarian')}</Badge>}
                {dish.tags.includes('spicy') && <Badge tone="danger">{t('dish.spicy')}</Badge>}
                {dish.isFeatured && <Badge tone="promo">{t('dish.top')}</Badge>}
              </div>

              <div>
                <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-ink-300">
                  {t('dish.description')}
                </h2>
                <p className="text-[15px] leading-relaxed text-ink-700">{description}</p>
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-ink-line pt-4">
                <div>
                  <p className="font-display text-2xl font-bold text-primary-600">{formatPrice(dish.price)}</p>
                  {dish.oldPrice ? (
                    <p className="text-sm text-ink-300 line-through">{formatPrice(dish.oldPrice)}</p>
                  ) : null}
                </div>
                <Button size="lg" onClick={addToCart}>
                  {t('dish.add_to_cart')}
                </Button>
              </div>
            </div>
          </div>

          <DishReviews reviews={reviews} reviewCount={dish.reviewCount} />

          {related.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-lg font-bold">{t('seo.dish.related_title')}</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {related.map((item) => (
                  <DishCard key={item._id} dish={item} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}

/** Sharhlar bo'limi — alohida komponent, asosiy sahifa soddaroq bo'lsin. */
function DishReviews({ reviews, reviewCount }: { reviews: Review[]; reviewCount: number }) {
  const { t } = useTranslation();
  return (
    <section>
      <h2 className="mb-2 font-display text-lg font-bold">
        {t('dish.reviews')}{' '}
        <span className="text-sm font-normal text-ink-300">
          {tVal(t('dish.reviews_count'), { count: reviewCount })}
        </span>
      </h2>
      {reviews.length ? (
        <div className="space-y-2">
          {reviews.map((r) => (
            <Card key={r._id} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-ink-900">{r.user?.name ?? '—'}</p>
                <span className="flex items-center gap-1 text-xs font-semibold text-ink-700">
                  <Star className="h-3.5 w-3.5 fill-[#FDAB12] text-[#FDAB12]" />
                  {r.rating}
                </span>
              </div>
              {r.comment ? <p className="mt-1 text-sm text-ink-500">{r.comment}</p> : null}
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-6 text-center text-sm text-ink-300">{t('dish.no_reviews')}</Card>
      )}
    </section>
  );
}
