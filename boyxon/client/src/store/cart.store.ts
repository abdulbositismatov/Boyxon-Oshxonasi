import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartLine {
  dishId: string;
  name: string;
  price: number;
  image: string | null;
  quantity: number;
}

interface CartState {
  lines: CartLine[];
  promoCode?: string;
  discount: number;
  add: (line: Omit<CartLine, 'quantity'>, qty?: number) => void;
  remove: (dishId: string) => void;
  setQty: (dishId: string, qty: number) => void;
  clear: () => void;
  setPromo: (code: string | undefined, discount: number) => void;
  subtotal: () => number;
  count: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      promoCode: undefined,
      discount: 0,
      add: (line, qty = 1) => {
        const lines = [...get().lines];
        const i = lines.findIndex((l) => l.dishId === line.dishId);
        if (i === -1) lines.push({ ...line, quantity: Math.min(20, Math.max(1, qty)) });
        else lines[i] = { ...lines[i], quantity: Math.min(20, lines[i].quantity + qty) };
        set({ lines });
      },
      remove: (dishId) => set({ lines: get().lines.filter((l) => l.dishId !== dishId) }),
      setQty: (dishId, qty) => {
        if (qty <= 0) return get().remove(dishId);
        set({ lines: get().lines.map((l) => (l.dishId === dishId ? { ...l, quantity: Math.min(20, qty) } : l)) });
      },
      clear: () => set({ lines: [], promoCode: undefined, discount: 0 }),
      setPromo: (promoCode, discount) => set({ promoCode, discount }),
      subtotal: () => get().lines.reduce((s, l) => s + l.price * l.quantity, 0),
      count: () => get().lines.reduce((s, l) => s + l.quantity, 0),
    }),
    { name: 'boyxon-cart' },
  ),
);
