import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, CheckCircle2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { DeliveryToggle } from './DeliveryToggle';
import { PaymentMethods } from './PaymentMethods';
import { PromoInput } from './PromoInput';
import { CartSummary } from './CartSummary';
import { useCart } from '../../hooks/useCart';
import { useKitchenStatus } from '../../hooks/useKitchenStatus';
import { useAuthStore } from '../../store/auth.store';
import { useUiStore } from '../../store/ui.store';
import { ordersApi } from '../../api/orders.api';
import { DELIVERY_FEE, FREE_DELIVERY_FROM } from '../../lib/constants';
import type { Order } from '../../types';

/** Admin panelda haqiqiy rekvizitlar kiritilmaguncha demo uchun ko'rsatiladi. */
const DEMO_CARD_NUMBER = '8600 1234 5678 9012';
const DEMO_CARD_HOLDER = 'Demo karta';

export function CheckoutSheet() {
  const { t } = useTranslation();
  const { checkoutOpen, set } = useUiStore();
  const { lines, subtotal, discount, promoCode, clear } = useCart();
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: kitchen, refetch: refetchKitchen } = useKitchenStatus();
  const kitchenClosed = kitchen?.kitchenOpen === false;
  const configuredCardNumber = kitchen?.cardNumber?.trim() ?? '';
  const configuredCardHolder = kitchen?.cardHolder?.trim() ?? '';
  const cardNumber = configuredCardNumber || DEMO_CARD_NUMBER;
  const cardHolder = configuredCardHolder || DEMO_CARD_HOLDER;
  const cardIsDemo = !configuredCardNumber;
  const cardEnabled = Boolean(cardNumber);

  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [copied, setCopied] = useState(false);
  const [addressId, setAddressId] = useState<string>(
    user?.addresses?.find((a) => a.isDefault)?._id ?? user?.addresses?.[0]?._id ?? '',
  );
  const [notes, setNotes] = useState('');
  const [created, setCreated] = useState<Order | null>(null);

  const addresses = user?.addresses ?? [];

  /** Manzil uchun barqaror React key: yangi manzil hali _id olmaganda ham ishlaydi. */
  const addrKey = (a: { _id?: string; label: string; address: string }): string =>
    a._id ?? `${a.label}|${a.address}`;

  // Checkout ochiq turganda profil/manzillar yangilansa (yoki login kechiksa),
  // tanlangan manzilni yangilab boramiz — bo'sh addressId bilan bekor bo'lmaydi.
  useEffect(() => {
    if (!checkoutOpen) return;
    if (addressId) return;
    const fallback = addresses.find((a) => a.isDefault)?._id ?? addresses[0]?._id;
    if (fallback) setAddressId(fallback);
  }, [checkoutOpen, addresses, addressId]);

  // Checkout ochilganda holatni yangilaymiz: admin oshxonani yaqinda yopgan
  // bo'lsa, foydalanuvchi eskirgan "ochiq" holat bilan formani to'ldirmasin.
  useEffect(() => {
    if (checkoutOpen) void refetchKitchen();
  }, [checkoutOpen, refetchKitchen]);

  // Karta rekvizitlari o'chirilgan bo'lsa, tanlangan karta usulini naqdga qaytaramiz.
  useEffect(() => {
    if (!cardEnabled && paymentMethod === 'card') setPaymentMethod('cash');
  }, [cardEnabled, paymentMethod]);

  const deliveryFee = deliveryType === 'pickup' || subtotal >= FREE_DELIVERY_FROM ? 0 : DELIVERY_FEE;
  const total = Math.max(0, subtotal + deliveryFee - discount);

  const mutation = useMutation({
    mutationFn: () => {
      const addr = addresses.find((a) => a._id === addressId);
      return ordersApi.create({
        items: lines.map((l) => ({ dish: l.dishId, quantity: l.quantity })),
        deliveryType,
        address: deliveryType === 'delivery' && addr ? { label: addr.label, address: addr.address, lat: addr.lat, lng: addr.lng } : undefined,
        paymentMethod: paymentMethod as 'cash' | 'card',
        promoCode,
        notes: notes || undefined,
      });
    },
    onSuccess: (r) => {
      setCreated(r.data);
      clear();
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      void qc.invalidateQueries({ queryKey: ['unread-count'] });
      toast.success(t('cart.order_placed'));
    },
    onError: (e) => {
      const err = e as { response?: { data?: { message?: string; code?: string } } };
      // Server oshxona yopilganini aytdi (holat shu orada o'zgargan bo'lishi mumkin).
      // Umumiy xato o'rniga tushunarli xabar + holatni qayta yuklaymiz.
      if (err?.response?.data?.code === 'KITCHEN_CLOSED') {
        void qc.invalidateQueries({ queryKey: ['settings'] });
        toast.error(t('kitchen.hint_closed'));
        return;
      }
      toast.error(err?.response?.data?.message ?? t('common.error'));
    },
  });

  const close = (): void => {
    setCreated(null);
    set({ checkoutOpen: false });
  };

  const goHome = (): void => {
    const wasSuccess = mutation.isSuccess;
    setCreated(null);
    set({ checkoutOpen: false });
    if (wasSuccess) nav('/');
  };

  const goOrders = (): void => {
    const wasSuccess = mutation.isSuccess;
    const target = created ? `/orders/${created._id}` : '/settings';
    setCreated(null);
    set({ checkoutOpen: false });
    if (wasSuccess) nav(target);
  };

  if (created) {
    return (
      <Sheet open={checkoutOpen} onClose={close} title={t('cart.order_placed')}>
        <div className="py-6 text-center">
          <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
          <p className="mt-4 font-display text-xl font-bold">{created.orderNumber}</p>
          <p className="mt-1 text-sm text-ink-300">{t('cart.track_realtime')}</p>
          <div className="mt-6 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={goHome}>{t('cart.go_home')}</Button>
            <Button className="flex-1" onClick={goOrders}>{t('nav.orders')}</Button>
          </div>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open={checkoutOpen} onClose={() => set({ checkoutOpen: false })} title={t('cart.place_order')}>
      <div className="space-y-5">
        {kitchenClosed && (
          <div role="alert" className="rounded-2xl border border-danger/20 bg-danger/10 px-3 py-3 text-sm text-danger">
            <p className="font-semibold">{t('kitchen.closed')}</p>
            <p className="mt-0.5">{t('kitchen.desc_closed')}</p>
          </div>
        )}

        <DeliveryToggle value={deliveryType} onChange={setDeliveryType} />

        {deliveryType === 'delivery' && (
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink-700">{t('cart.address')}</label>
            {addresses.length ? (
              <div className="flex flex-col gap-2">
                {addresses.map((a) => (
                  <button
                    key={addrKey(a)}
                    onClick={() => setAddressId(a._id ?? '')}
                    className={`rounded-2xl border px-3 py-3 text-left text-sm ${
                      addressId === a._id
                        ? 'border-primary-500 bg-primary-50 text-primary-800'
                        : 'border-ink-line'
                    }`}
                  >
                    <span className="font-semibold">{a.label}</span>
                    <span
                      className={`mt-0.5 block ${
                        addressId === a._id ? 'text-primary-800/75' : 'text-ink-300'
                      }`}
                    >
                      {a.address}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-primary-500/30 bg-primary-50/60 p-3.5 text-sm dark:bg-primary-950/30">
                <p className="font-medium text-primary-900 dark:text-primary-200">
                  {t('cart.no_address')}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    set({ checkoutOpen: false });
                    nav('/settings');
                  }}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-primary-700 active:scale-95"
                >
                  + {t('nav.addresses') || 'Manzil qo‘shish'}
                </button>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink-700">{t('cart.payment_method')}</label>
          <PaymentMethods value={paymentMethod} onChange={setPaymentMethod} cardEnabled={cardEnabled} />
        </div>

        {paymentMethod === 'card' && cardEnabled && (
          <div className="rounded-2xl border border-ink-line bg-surface-raised px-3.5 py-3.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-300">
              {t('payment.card_number')}
            </p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <p className="font-mono text-base font-bold tracking-wide text-ink-900">{cardNumber}</p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(cardNumber);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 2000);
                  } catch {
                    toast.error(t('common.error'));
                  }
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ink-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-700 transition hover:border-primary-500"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? t('payment.copied') : t('payment.copy')}
              </button>
            </div>
            {cardHolder && (
              <p className="mt-1 text-xs text-ink-300">
                {t('payment.card_holder')}: <span className="font-medium text-ink-700">{cardHolder}</span>
              </p>
            )}
            <p className="mt-2 text-xs leading-relaxed text-ink-300">{t('payment.card_hint')}</p>
            {cardIsDemo && (
              <p className="mt-2 rounded-lg bg-primary-50 px-2 py-1.5 text-[11px] font-semibold leading-snug text-primary-800">
                {t('payment.card_demo_hint')}
              </p>
            )}
          </div>
        )}

        <PromoInput />

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink-700">{t('cart.notes')}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder={t('cart.notes_placeholder')}
            className="w-full rounded-2xl border border-ink-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary-500"
          />
        </div>

        <CartSummary subtotal={subtotal} deliveryFee={deliveryFee} discount={discount} total={total} />

        <Button
          className="w-full"
          size="lg"
          disabled={!lines.length || mutation.isPending || kitchenClosed || (deliveryType === 'delivery' && !addressId)}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? t('cart.processing') : kitchenClosed ? t('kitchen.closed') : t('cart.checkout')}
        </Button>
      </div>
    </Sheet>
  );
}

