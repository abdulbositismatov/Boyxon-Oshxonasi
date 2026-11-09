import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2, Star } from 'lucide-react';
import { ordersApi } from '../../api/orders.api';
import { formatPrice, formatDate } from '../../lib/format';
import { Button } from '../../components/ui/Button';
import type { Order } from '../../types';

function apiMessage(e: unknown): string | undefined {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

function dishIdOf(dish: Order['items'][number]['dish']): string {
  return typeof dish === 'string' ? dish : dish._id;
}

export default function OrderDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [ratings, setRatings] = useState<Record<string, { rating: number; comment: string }>>({});
  const [reviewSent, setReviewSent] = useState(false);

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['order', id],
    queryFn: () => ordersApi.detail(id as string).then((r) => r.data),
    enabled: Boolean(id),
  });

  const cancelMutation = useMutation({
    mutationFn: () => ordersApi.cancel(id as string),
    onSuccess: () => {
      toast.success(t('orders.cancel_done'));
      // PATCH javobida `user` populate qilinmagan — sahifani qayta yuklaymiz.
      void qc.invalidateQueries({ queryKey: ['order', id] });
      void qc.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (e) => toast.error(apiMessage(e) ?? t('orders.cancel_error')),
  });

  const reviewMutation = useMutation({
    mutationFn: () => {
      const payload = Object.entries(ratings)
        .filter(([, v]) => v.rating > 0)
        .map(([dish, v]) => ({ dish, rating: v.rating, comment: v.comment.trim() || undefined }));
      return ordersApi.review(id as string, payload);
    },
    onSuccess: () => {
      setReviewSent(true);
      setRatings({});
      toast.success(t('orders.review_sent'));
    },
    onError: (e) => toast.error(apiMessage(e) ?? t('orders.review_error')),
  });

  const goBack = (): void => {
    if (window.history.length > 1) nav(-1);
    else nav('/settings');
  };

  if (!id) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-bg p-6 text-center">
        <p className="text-danger">{t('orders.invalid_id')}</p>
        <Button variant="outline" onClick={goBack}>{t('common.back')}</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-bg p-6 text-center">
        <p className="text-danger">{status === 403 ? t('orders.unauthorized') : t('orders.load_error')}</p>
        <Button variant="outline" onClick={goBack}>{t('common.back')}</Button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-bg p-6 text-center">
        <p className="text-danger">{t('orders.not_found')}</p>
        <Button variant="outline" onClick={goBack}>{t('common.back')}</Button>
      </div>
    );
  }

  const customer = typeof order.user === 'object' && order.user !== null ? order.user : null;
  const canCancel = order.status === 'pending' || order.status === 'confirmed';
  const canReview = order.status === 'delivered' && !reviewSent;
  const hasRating = Object.values(ratings).some((v) => v.rating > 0);

  const setRating = (dishId: string, rating: number): void => {
    setRatings((prev) => ({
      ...prev,
      [dishId]: { rating, comment: prev[dishId]?.comment ?? '' },
    }));
  };
  const setComment = (dishId: string, comment: string): void => {
    setRatings((prev) => ({
      ...prev,
      [dishId]: { rating: prev[dishId]?.rating ?? 0, comment },
    }));
  };

  return (
    <div className="min-h-screen bg-bg p-6">
      <div className="max-w-xl mx-auto bg-surface rounded-card shadow-sm p-6">
        <div className="flex justify-between items-start gap-3 mb-4">
          <h1 className="font-display text-xl font-extrabold">{t('orders.detail_title')}</h1>
          <Button variant="outline" onClick={goBack}>{t('common.back')}</Button>
        </div>

        <div className="space-y-4">
          {/* Order number and date */}
          <div className="text-right text-sm text-ink-500">
            <p>{t('orders.order_number')}:</p>
            <p className="font-semibold">{order.orderNumber}</p>
          </div>
          <div className="text-right text-sm text-ink-500">
            <p>{t('orders.date')}:</p>
            <p className="font-semibold">{formatDate(order.createdAt)}</p>
          </div>

          {/* Customer info */}
          <div className="border-t border-ink-line/60 pt-4">
            <p className="font-semibold text-ink-900 mb-2">{t('orders.customer_info')}</p>
            <div className="space-y-1 text-sm">
              <p><strong>{t('common.name')}:</strong> {customer?.name ?? '—'}</p>
              <p><strong>{t('common.phone')}:</strong> {customer?.phone ?? '—'}</p>
            </div>
          </div>

          {/* Items */}
          <div className="border-t border-ink-line/60 pt-4">
            <p className="font-semibold text-ink-900 mb-2">{t('orders.items')}</p>
            <div className="space-y-2">
              {order.items.map((item, idx) => (
                <div key={`${dishIdOf(item.dish)}-${idx}`} className="flex justify-between gap-3 text-sm">
                  <span>{item.name}</span>
                  <span className="whitespace-nowrap">{item.quantity} × {formatPrice(item.price)} = {formatPrice(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="border-t border-ink-line/60 pt-4">
            <p className="font-semibold text-ink-900 mb-2">{t('orders.totals')}</p>
            <div className="space-y-1 text-sm">
              <p><strong>{t('orders.subtotal')}:</strong> {formatPrice(order.subtotal)}</p>
              {order.discount > 0 && (
                <p><strong>{t('orders.discount')}:</strong> -{formatPrice(order.discount)}</p>
              )}
              {order.deliveryFee > 0 && (
                <p><strong>{t('orders.delivery_fee')}:</strong> {formatPrice(order.deliveryFee)}</p>
              )}
              <div className="border-t border-ink-line/40 pt-2 pb-2">
                <p className="font-bold text-xl">{t('orders.total')}:</p>
                <p className="font-bold text-xl text-primary-600">{formatPrice(order.total)}</p>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="border-t border-ink-line/60 pt-4">
            <p className="font-semibold text-ink-900 mb-2">{t('orders.status')}</p>
            <p className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusClass(order.status)}`}>
              {t(`status.${order.status}`)}
            </p>
            {canCancel && (
              <Button
                variant="danger"
                className="mt-3 w-full"
                disabled={cancelMutation.isPending}
                onClick={() => {
                  if (window.confirm(t('orders.cancel_confirm'))) cancelMutation.mutate();
                }}
              >
                {cancelMutation.isPending ? t('common.saving') : t('orders.cancel')}
              </Button>
            )}
          </div>

          {order.statusHistory?.length > 0 && (
            <div className="border-t border-ink-line/60 pt-4">
              <p className="font-semibold text-ink-900 mb-2">{t('orders.timeline')}</p>
              <ol className="space-y-2">
                {order.statusHistory.map((entry, idx) => (
                  <li key={`${entry.status}-${idx}`} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-ink-700">{t(`status.${entry.status}`)}</span>
                    <span className="shrink-0 text-xs text-ink-300">{formatDate(entry.timestamp)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Address (if delivery) */}
          {order.deliveryType === 'delivery' && order.address && (
            <div className="border-t border-ink-line/60 pt-4">
              <p className="font-semibold text-ink-900 mb-2">{t('orders.address')}</p>
              <div className="space-y-1 text-sm">
                <p><strong>{t('common.label')}:</strong> {order.address.label ?? '—'}</p>
                <p><strong>{t('common.address')}:</strong> {order.address.address ?? '—'}</p>
              </div>
            </div>
          )}

          {order.taxi && (order.taxi.driver || order.taxi.carNumber || order.taxi.service) && (
            <div className="border-t border-ink-line/60 pt-4">
              <p className="font-semibold text-ink-900 mb-2">{t('orders.taxi')}</p>
              <div className="space-y-1 text-sm">
                {order.taxi.driver && <p><strong>{t('orders.driver')}:</strong> {order.taxi.driver}</p>}
                {order.taxi.carNumber && <p><strong>{t('orders.car_number')}:</strong> {order.taxi.carNumber}</p>}
                {order.taxi.service && <p><strong>{t('orders.taxi_service')}:</strong> {order.taxi.service}</p>}
              </div>
            </div>
          )}

          {/* Payment method */}
          <div className="border-t border-ink-line/60 pt-4">
            <p className="font-semibold text-ink-900 mb-2">{t('orders.payment_method')}</p>
            <p className="text-sm">{t(`payment.${order.paymentMethod}`)}</p>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="border-t border-ink-line/60 pt-4">
              <p className="font-semibold text-ink-900 mb-2">{t('orders.notes')}</p>
              <p className="text-sm text-ink-500">{order.notes}</p>
            </div>
          )}

          {canReview && (
            <div className="border-t border-ink-line/60 pt-4">
              <p className="font-semibold text-ink-900">{t('orders.review_title')}</p>
              <p className="mt-1 text-sm text-ink-300">{t('orders.review_hint')}</p>
              <div className="mt-3 space-y-4">
                {order.items.map((item) => {
                  const dishId = dishIdOf(item.dish);
                  const value = ratings[dishId];
                  return (
                    <div key={`review-${dishId}`}>
                      <p className="text-sm font-medium text-ink-700">{item.name}</p>
                      <div className="mt-1 flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            aria-label={`${n} ★`}
                            onClick={() => setRating(dishId, n)}
                            className="rounded p-0.5"
                          >
                            <Star
                              className={`h-6 w-6 ${n <= (value?.rating ?? 0) ? 'fill-[#FDAB12] text-[#FDAB12]' : 'text-ink-300'}`}
                            />
                          </button>
                        ))}
                      </div>
                      {(value?.rating ?? 0) > 0 && (
                        <input
                          value={value?.comment ?? ''}
                          onChange={(e) => setComment(dishId, e.target.value)}
                          placeholder={t('orders.review_comment')}
                          maxLength={1000}
                          className="mt-2 h-10 w-full rounded-xl border border-ink-line bg-surface px-3 text-sm outline-none focus:border-primary-500"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <Button
                className="mt-4 w-full"
                disabled={!hasRating || reviewMutation.isPending}
                onClick={() => reviewMutation.mutate()}
              >
                {reviewMutation.isPending ? t('common.sending') : t('orders.review_send')}
              </Button>
            </div>
          )}

          {order.status === 'delivered' && reviewSent && (
            <p className="border-t border-ink-line/60 pt-4 text-sm font-medium text-success">
              {t('orders.reviewed')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function getStatusClass(status: string): string {
  switch (status) {
    case 'pending': return 'bg-surface-raised text-ink-700';
    case 'confirmed': return 'bg-primary-100 text-primary-800';
    case 'packing': return 'bg-primary-50 text-primary-800';
    case 'handed_to_taxi': return 'bg-primary-100 text-primary-800';
    case 'delivered': return 'bg-success/10 text-success';
    case 'cancelled': return 'bg-danger/10 text-danger';
    default: return 'bg-surface text-ink-700';
  }
}