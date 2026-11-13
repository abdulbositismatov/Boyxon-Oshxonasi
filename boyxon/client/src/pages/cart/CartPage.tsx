import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useCart } from '../../hooks/useCart';
import { useKitchenStatus } from '../../hooks/useKitchenStatus';
import { useAuthStore } from '../../store/auth.store';
import { useUiStore } from '../../store/ui.store';
import { CartItem } from '../../components/cart/CartItem';
import { CartSummary } from '../../components/cart/CartSummary';
import { CheckoutSheet } from '../../components/cart/CheckoutSheet';
import { Button } from '../../components/ui/Button';
import { ordersApi } from '../../api/orders.api';
import { DELIVERY_FEE, FREE_DELIVERY_FROM } from '../../lib/constants';
import { formatPrice, tVal } from '../../lib/format';

export default function CartPage() {
  const { t } = useTranslation();
  const { lines, setQty, remove, subtotal, discount, promoCode } = useCart();
  const set = useUiStore((s) => s.set);
  const user = useAuthStore((s) => s.user);
  const { data: kitchen } = useKitchenStatus();

  // Savat sahifasidagi summa ham serverdan — checkout bilan bir xil bo'lsin.
  const defaultAddress = user?.addresses?.find((a) => a.isDefault) ?? user?.addresses?.[0];
  const quoteKey = lines.map((l) => `${l.dishId}:${l.quantity}`).join(',');
  const { data: quote } = useQuery({
    queryKey: ['order-quote', 'cart', quoteKey, defaultAddress?._id ?? '', promoCode ?? ''],
    queryFn: () =>
      ordersApi.quote({
        items: lines.map((l) => ({ dish: l.dishId, quantity: l.quantity })),
        deliveryType: 'delivery',
        address: defaultAddress
          ? {
              label: defaultAddress.label,
              address: defaultAddress.address,
              lat: defaultAddress.lat,
              lng: defaultAddress.lng,
            }
          : undefined,
        promoCode,
      }),
    enabled: lines.length > 0 && Boolean(defaultAddress?.address),
    retry: false,
    staleTime: 20_000,
  });

  const freeFrom =
    quote?.freeDeliveryFrom ?? kitchen?.freeDeliveryFrom ?? FREE_DELIVERY_FROM;
  const baseFee = kitchen?.deliveryBaseFee ?? DELIVERY_FEE;
  const deliveryFee =
    quote?.deliveryFee ?? (subtotal >= freeFrom ? 0 : baseFee);
  const total = quote?.total ?? Math.max(0, subtotal + deliveryFee - discount);
  const toFree = Math.max(0, freeFrom - subtotal);

  const contentClass = lines.length
    ? 'mx-auto max-w-6xl px-4 pt-5 pb-44 md:pb-8'
    : 'mx-auto flex max-w-6xl flex-col items-center px-4 py-20 text-center';

  return (
    <div className={contentClass}>
      {!lines.length ? (
        <>
          <span className="grid h-20 w-20 place-items-center rounded-full bg-muted">
            <ShoppingBag className="h-9 w-9 text-ink-300" />
          </span>
          <h1 className="mt-4 font-display text-xl font-bold">{t('cart.empty')}</h1>
          <p className="mt-1 text-sm text-ink-300">{t('cart.empty_desc')}</p>
          <Link to="/">
            <Button className="mt-6">{t('cart.go_menu')}</Button>
          </Link>
        </>
      ) : (
        <>
          <h1 className="mb-4 font-display text-2xl font-extrabold">{t('cart.title')}</h1>
      <div className="mb-4 rounded-xl bg-primary-50 px-3 py-2.5 text-sm font-semibold text-primary-700">
        {toFree > 0
          ? tVal(t('cart.free_delivery_hint'), { amount: formatPrice(toFree), fee: formatPrice(baseFee) })
          : tVal(t('cart.free_delivery_done'), { fee: formatPrice(baseFee) })}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {lines.map((l) => (
            <CartItem key={l.dishId} line={l} onQty={setQty} onRemove={remove} />
          ))}
        </div>
        <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
          <CartSummary
            subtotal={subtotal}
            deliveryFee={deliveryFee}
            discount={quote?.discount ?? discount}
            total={total}
            freeDeliveryFrom={freeFrom}
            baseDeliveryFee={baseFee}
          />
          <Button className="mt-3 w-full" size="lg" onClick={() => set({ checkoutOpen: true })}>
            {t('cart.checkout')}
          </Button>
        </aside>
      </div>

      {/* Mobil checkout paneli — BottomNav (64px + safe-area) ustida turadi, kontentni yopmaydi (pb-44). */}
      <div className="cart-checkout-bar fixed inset-x-0 bottom-[calc(4rem_+_env(safe-area-inset-bottom,0px))] z-20 border-t border-ink-line bg-surface p-3 md:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-primary-700 dark:text-primary-400">
              {toFree > 0
                ? tVal(t('cart.free_delivery_hint'), { amount: formatPrice(toFree), fee: formatPrice(baseFee) })
                : tVal(t('cart.free_delivery_done'), { fee: formatPrice(baseFee) })}
            </p>
            <p className="text-xs text-ink-300">
              {t('cart.total')}: <span className="font-bold text-primary-600">{formatPrice(total)}</span>
            </p>
          </div>
          <Button onClick={() => set({ checkoutOpen: true })}>{t('cart.checkout')}</Button>
        </div>
      </div>
        </>
      )}

      <CheckoutSheet />
    </div>
  );
}
