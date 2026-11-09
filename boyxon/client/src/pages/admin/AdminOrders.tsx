import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../api/admin.api';
import { OrdersTable } from '../../components/admin/OrdersTable';

const FILTERS = [
  { v: '', k: 'common.all' },
  { v: 'pending', k: 'status.pending' },
  { v: 'confirmed', k: 'status.confirmed' },
  { v: 'packing', k: 'status.packing' },
  { v: 'handed_to_taxi', k: 'status.handed_to_taxi' },
  { v: 'delivered', k: 'status.delivered' },
  { v: 'cancelled', k: 'status.cancelled' },
];

export default function AdminOrders() {
  const { t } = useTranslation();
  const [status, setStatus] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['admin-orders', status],
    queryFn: () => adminApi.orders({ status: status || undefined, limit: 50 }),
    refetchInterval: 15_000,
  });

  return (
    <div className="space-y-4">
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <Button
            key={f.v}
            onClick={() => setStatus(f.v)}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium ${
              status === f.v ? 'border-primary-500 bg-primary-700 text-white' : 'border-ink-line bg-surface text-ink-700'
            }`}
          >
            {t(f.k)}
          </button>
        ))}
      </div>
      <OrdersTable orders={data?.data ?? []} loading={isLoading} />
    </div>
  );
}
