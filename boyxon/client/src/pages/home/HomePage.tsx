import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { dishesApi, type DishFilters } from '../../api/dishes.api';
import { categoriesApi } from '../../api/categories.api';
import { CategoryChips } from '../../components/dish/CategoryChips';
import { DishGrid } from '../../components/dish/DishGrid';
import { DishCard } from '../../components/dish/DishCard';
import type { DishFilterValues } from '../../components/dish/DishFilterSheet';
import { Seo } from '../../components/seo/Seo';
import { HomeHero } from '../../components/home/HomeHero';
import { useDebounce } from '../../hooks/useDebounce';
import { useCartStore } from '../../store/cart.store';
import { DELIVERY_FEE, FREE_DELIVERY_FROM, QUERY_KEYS } from '../../lib/constants';
import { formatPrice, localizedDishName, tVal } from '../../lib/format';
import { absoluteUrl, canonicalFor, pathLang, SITE_URL, withLang } from '../../lib/seo';

const DishFilterSheet = lazy(() =>
  import('../../components/dish/DishFilterSheet').then((m) => ({ default: m.DishFilterSheet })),
);

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const lang = pathLang();
  const [searchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') ?? '';
  const cartSubtotal = useCartStore((s) => s.lines.reduce((a, l) => a + l.price * l.quantity, 0));
  const [search, setSearch] = useState(urlQuery);
  const [category, setCategory] = useState<string | undefined>();
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterLoaded, setFilterLoaded] = useState(false);
  const [filters, setFilters] = useState<DishFilterValues>({});
  const [page, setPage] = useState(1);
  const [belowFoldReady] = useState(true);
  const debounced = useDebounce(search, 400);

  // Filter oynasi birinchi marta ochilganda yuklanadi; keyin mounted qoladi,
  // shunda yopilish animatsiyasi ishlaydi va framer-motion boshlang'ich
  // bundle'ga tushmaydi.
  useEffect(() => {
    if (filterOpen) setFilterLoaded(true);
  }, [filterOpen]);

  // Sitelinks SearchBox / ulashilgan havola: /?q=palov
  useEffect(() => {
    setSearch(urlQuery);
    setPage(1);
  }, [urlQuery]);

  const { data: cats, isLoading: catsLoading } = useQuery({
    queryKey: [QUERY_KEYS.categories],
    queryFn: () => categoriesApi.list().then((r) => r.data),
    staleTime: 15 * 60 * 1000,
  });

  const params: DishFilters = useMemo(
    () => ({
      category,
      search: debounced || undefined,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      rating: filters.rating,
      tags: filters.tags,
      sort: filters.sort,
      page,
      limit: 12,
    }),
    [category, debounced, filters, page],
  );

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: [QUERY_KEYS.dishes, params],
    queryFn: () => dishesApi.list(params),
    staleTime: 5 * 60 * 1000,
  });

  const { data: featured, isLoading: featLoading } = useQuery({
    queryKey: [QUERY_KEYS.featured],
    queryFn: () => dishesApi.featured().then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });

  const setCat = (slug?: string): void => {
    setCategory(slug);
    setPage(1);
  };
  const applyFilters = (v: DishFilterValues): void => {
    setFilters(v);
    setPage(1);
  };

  const pages = data?.pagination.pages ?? 1;

  const homeUrl = canonicalFor('/', lang);
  const restaurantId = `${SITE_URL}/#restaurant`;
  const websiteId = `${SITE_URL}/#website`;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Restaurant',
      '@id': restaurantId,
      name: 'Boyxon Oshxonasi',
      url: homeUrl,
      image: absoluteUrl('/og-image.png'),
      logo: absoluteUrl('/icon-512.png'),
      telephone: '+998939588458',
      priceRange: "4 000–65 000 so'm",
      paymentAccepted: 'Cash, Payme, Click, Uzum Bank',
      currenciesAccepted: 'UZS',
      servesCuisine: ['Uzbek', 'Central Asian'],
      areaServed: { '@type': 'City', name: 'Toshkent' },
      address: {
        '@type': 'PostalAddress',
        streetAddress: "Zirabuloq ko'chasi, 1-son texnikum yonida",
        addressLocality: 'Namangan',
        addressRegion: 'Namangan',
        postalCode: '160104',
        addressCountry: 'UZ',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 41.0048,
        longitude: 71.6806,
      },
      hasMenu: homeUrl,
      acceptsReservations: false,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': websiteId,
      url: homeUrl,
      name: 'Boyxon Oshxonasi',
      inLanguage: lang,
      publisher: { '@id': restaurantId },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${homeUrl}?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
    ...(featured && featured.length > 0
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: t('home.featured'),
            itemListElement: featured.map((dish, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: localizedDishName(dish, i18n.language),
              url: absoluteUrl(withLang(`/dish/${dish.slug || dish._id}`, lang)),
            })),
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-5">
      <Seo
        title={t('seo.home.title')}
        description={t('seo.home.description')}
        path="/"
        keywords={t('seo.home.keywords')}
        noindex={Boolean(search.trim())}
        jsonLd={jsonLd}
      />

      {/* Salom + qidiruv */}
      <div className="mb-4 animate-fade-in-up">
        <p className="text-sm text-ink-300 animate-fade-in-up">{t('home.greeting')} <span className="inline-block animate-float">👋</span></p>
        <h1 className="font-display text-2xl font-extrabold text-ink-900 animate-fade-in-up delay-75">{t('seo.home.h1')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-300 animate-fade-in-up delay-100">{t('seo.home.subtitle')}</p>
      </div>

      <div className="mb-5 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-300 transition-colors" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('home.search_placeholder')}
            aria-label={t('nav.search')}
            className="h-12 w-full rounded-full border border-ink-line bg-surface pl-11 pr-4 text-[15px] outline-none transition-all duration-300 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 focus:shadow-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-ink-line bg-surface text-ink-700 transition-all duration-300 hover:border-primary-500/50 hover:bg-surface-raised active:scale-90 hover:rotate-6"
          aria-label={t('filter.title')}
        >
          <SlidersHorizontal className="h-5 w-5" />
        </button>
      </div>

      {/* Jozibali Boyxon Hero Banneri */}
      <HomeHero dishes={data?.data || featured} onSelectCategory={setCat} />

      {belowFoldReady && (
        <>
      {/* Kategoriyalar */}
      <div id="dishes-section" className="mb-6 scroll-mt-20">
        {cats ? (
          <CategoryChips categories={cats} active={category} onChange={setCat} />
        ) : catsLoading ? (
          <div className="flex gap-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-9 w-24 animate-pulse rounded-full bg-muted-2" />)}</div>
        ) : null}
      </div>

      {/* Mashhur taomlar (gorizontal) */}
      {featured && featured.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-lg font-bold">{t('home.featured')}</h2>
          <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
            {featured.map((d) => (
              <div key={d._id} className="w-64 shrink-0 md:w-72">
                <DishCard dish={d} />
              </div>
            ))}
          </div>
        </section>
      )}
      {featLoading && (
        <div className="mb-8 flex gap-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-72 w-64 shrink-0 animate-pulse rounded-card bg-muted-2" />)}
        </div>
      )}

      {/* Barcha taomlar */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{t('home.all_dishes')}</h2>
          <span className="shrink-0 text-sm text-ink-300">{tVal(t('home.items_count'), { count: data?.pagination.total ?? 0 })}</span>
        </div>

        {isError ? (
          <div className="rounded-card bg-danger/10 p-6 text-center">
            <p className="text-sm text-danger">{t('home.load_error')}</p>
            <button type="button" onClick={() => void refetch()} className="mt-2 text-sm font-semibold text-primary-600">
              {t('common.retry')}
            </button>
          </div>
        ) : (
          <DishGrid dishes={data?.data} loading={isLoading || isFetching} />
        )}

        {pages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="h-10 rounded-full border border-ink-line px-4 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← {t('common.prev')}
            </button>
            <span className="px-2 text-sm text-ink-300">{page} / {pages}</span>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
              className="h-10 rounded-full border border-ink-line px-4 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('common.next')} →
            </button>
          </div>
        )}
      </section>
        </>
      )}

      {filterLoaded && (
        <Suspense fallback={null}>
          <DishFilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} value={filters} onApply={applyFilters} />
        </Suspense>
      )}
    </div>
  );
}
