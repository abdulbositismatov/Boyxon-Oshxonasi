import { api } from './axios';
import type { ApiOk, Category, Dish, Order, Paginated, Promo, User } from '../types';
import type { PublicSettings } from './settings.api';

export interface AdminStats {
  users: number;
  dishes: number;
  pendingOrders: number;
  revenue: number;
  ordersCount: number;
  recentOrders: Order[];
}

function toFormData(obj: Record<string, unknown>, file?: File | null): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    fd.append(k, Array.isArray(v) ? JSON.stringify(v) : String(v));
  }
  if (file) fd.append('image', file);
  return fd;
}

export const adminApi = {
  stats: () => api.get<ApiOk<AdminStats>>('/admin/stats').then((r) => r.data),

  updateSettings: (
    body: Partial<
      Pick<
        PublicSettings,
        | 'kitchenOpen'
        | 'cardNumber'
        | 'cardHolder'
        | 'deliveryBaseFee'
        | 'deliveryPerKm'
        | 'freeDeliveryFrom'
        | 'deliveryMaxKm'
        | 'prepTimeMin'
      >
    >,
  ) => api.patch<ApiOk<PublicSettings>>('/admin/settings', body).then((r) => r.data),

  dishes: (params: Record<string, unknown> = {}) =>
    api.get<Paginated<Dish>>('/admin/dishes', { params }).then((r) => r.data),
  createDish: (body: Record<string, unknown>, file?: File | null) =>
    api.post<ApiOk<Dish>>('/admin/dishes', toFormData(body, file), { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  updateDish: (id: string, body: Record<string, unknown>, file?: File | null) =>
    api.patch<ApiOk<Dish>>(`/admin/dishes/${id}`, toFormData(body, file), { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  deleteDish: (id: string) => api.delete(`/admin/dishes/${id}`).then((r) => r.data),
  toggleDish: (id: string) => api.patch(`/admin/dishes/${id}/toggle`).then((r) => r.data),

  categories: () => api.get<ApiOk<Category[]>>('/admin/categories').then((r) => r.data),
  createCategory: (body: Partial<Category>) => api.post<ApiOk<Category>>('/admin/categories', body).then((r) => r.data),
  updateCategory: (id: string, body: Partial<Category>) => api.patch<ApiOk<Category>>(`/admin/categories/${id}`, body).then((r) => r.data),
  deleteCategory: (id: string) => api.delete(`/admin/categories/${id}`).then((r) => r.data),
  restoreCategory: (id: string) => api.post(`/admin/categories/${id}/restore`).then((r) => r.data),

  orders: (params: Record<string, unknown> = {}) =>
    api.get<Paginated<Order>>('/admin/orders', { params }).then((r) => r.data),
  orderDetail: (id: string) => api.get<ApiOk<Order>>(`/admin/orders/${id}`).then((r) => r.data),
  updateStatus: (
    id: string,
    status: string,
    note?: string,
    taxi?: { driver?: string; carNumber?: string; service?: string; note?: string },
  ) => api.patch<ApiOk<Order>>(`/admin/orders/${id}/status`, { status, note, taxi }).then((r) => r.data),

  users: (params: Record<string, unknown> = {}) =>
    api.get<Paginated<User>>('/admin/users', { params }).then((r) => r.data),
  changeRole: (id: string, role: string) => api.patch(`/admin/users/${id}/role`, { role }).then((r) => r.data),
  toggleBlock: (id: string, block: boolean) => api.patch(`/admin/users/${id}/block`, { block }).then((r) => r.data),

  promos: () => api.get<ApiOk<Promo[]>>('/admin/promos').then((r) => r.data),
  createPromo: (body: Partial<Promo>) => api.post<ApiOk<Promo>>('/admin/promos', body).then((r) => r.data),
  updatePromo: (id: string, body: Partial<Promo>) => api.patch<ApiOk<Promo>>(`/admin/promos/${id}`, body).then((r) => r.data),
  deletePromo: (id: string) => api.delete(`/admin/promos/${id}`).then((r) => r.data),

  sendPush: (body: { title: string; message: string; audience: string }) =>
    api.post<ApiOk<{ recipients: number; sent: number }>>('/admin/push/send', body).then((r) => r.data),
};
