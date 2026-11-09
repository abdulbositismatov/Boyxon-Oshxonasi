import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Home, MapPin, Plus, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { MapPicker, type MapPick } from '../map/MapPicker';
import { usersApi } from '../../api/users.api';
import { useAuthStore } from '../../store/auth.store';
import type { Address } from '../../types';

/**
 * Sozlamalar → Manzillarim.
 * Manzil CRUD (qo'shish / asosiy qilish / o'chirish) — checkout shu ro'yxatdan o'qiydi.
 * Har bir muvaffaqiyatli amaldan keyin auth store'dagi user.addresses yangilanadi.
 */
export function AddressManager() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const qc = useQueryClient();

  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<MapPick | null>(null);
  const [isDefault, setIsDefault] = useState(false);
  const [adding, setAdding] = useState(false);

  const addresses = user?.addresses ?? [];

  /** Serverdan qaytgan yangi manzillar ro'yxatini store + cache ga yozadi. */
  const applyAddresses = (list: Address[]): void => {
    if (user) setUser({ ...user, addresses: list });
    void qc.invalidateQueries({ queryKey: ['me'] });
  };

  const onError = (): void => {
    toast.error(t('settings.save_error'));
  };

  const addM = useMutation({
    mutationFn: () =>
      usersApi.addAddress({
        label: label.trim(),
        address: address.trim(),
        isDefault,
        ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
      }),
    onSuccess: (r) => {
      applyAddresses(r.data);
      setLabel('');
      setAddress('');
      setCoords(null);
      setIsDefault(false);
      setAdding(false);
      toast.success(t('settings.address_added'));
    },
    onError,
  });

  const defaultM = useMutation({
    mutationFn: (id: string) => usersApi.updateAddress(id, { isDefault: true }),
    onSuccess: (r) => {
      applyAddresses(r.data);
      toast.success(t('settings.saved'));
    },
    onError,
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => usersApi.deleteAddress(id),
    onSuccess: (r) => {
      applyAddresses(r.data);
      toast.success(t('settings.address_deleted'));
    },
    onError,
  });

  const submitAdd = (): void => {
    if (!label.trim() || !address.trim()) {
      toast.error(t('settings.address_required'));
      return;
    }
    addM.mutate();
  };

  return (
    <div className="space-y-3 px-1 pb-1">
      {addresses.length === 0 && !adding && (
        <Card className="p-4 text-center">
          <MapPin className="mx-auto h-8 w-8 text-ink-300" />
          <p className="mt-2 text-sm text-ink-300">{t('cart.no_address')}</p>
        </Card>
      )}

      {addresses.map((a) => (
        <Card key={a._id ?? `${a.label}|${a.address}`} className="flex items-center gap-3 p-3.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-600">
            <Home className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              {a.label}
              {a.isDefault && (
                <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold uppercase text-success">
                  {t('settings.address_default')}
                </span>
              )}
            </p>
            <p className="truncate text-xs text-ink-300">{a.address}</p>
          </div>
          {!a.isDefault && (
            <Button
              onClick={() => a._id && defaultM.mutate(a._id)}
              disabled={defaultM.isPending}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-300 hover:bg-surface-raised hover:text-fg-muted"
              aria-label={t('settings.address_set_default')}
              title={t('settings.address_set_default')}
            >
              <Star className="h-4 w-4" />
            </button>
          )}
          <Button
            onClick={() => {
              if (a._id && window.confirm(t('settings.address_delete_confirm'))) deleteM.mutate(a._id);
            }}
            disabled={deleteM.isPending}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-300 hover:bg-danger/10 hover:text-danger"
            aria-label={t('settings.address_delete')}
            title={t('settings.address_delete')}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </Card>
      ))}

      {adding ? (
        <Card className="space-y-2.5 p-3.5">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={50}
            placeholder={t('settings.address_label_ph')}
            className="w-full rounded-xl border border-ink-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary-500"
          />
          <MapPicker
            value={coords}
            onPick={(p, text) => {
              setCoords(p);
              if (text) setAddress(text);
            }}
          />
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder={t('settings.address_text_ph')}
            className="w-full resize-none rounded-xl border border-ink-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary-500"
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 accent-primary-500"
            />
            {t('settings.address_set_default')}
          </label>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => setAdding(false)} disabled={addM.isPending}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" className="flex-1" onClick={submitAdd} disabled={addM.isPending}>
              {addM.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </Card>
      ) : (
        <Button size="sm" variant="outline" className="w-full" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" />
          {t('settings.address_add')}
        </Button>
      )}
    </div>
  );
}
