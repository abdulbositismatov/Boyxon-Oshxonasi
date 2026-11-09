import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { API_URL } from '../lib/api-url';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  /** Refresh cookie orqali sessiya tiklash tugaguncha false — ProtectedRoute /auth ga sakramasligi uchun. */
  sessionReady: boolean;
  setUser: (u: User | null) => void;
  setToken: (t: string | null) => void;
  setSessionReady: (ready: boolean) => void;
  logout: () => void;
  logoutServer: () => Promise<void>;
}

const DEFAULT_PREFS: User['preferences'] = { language: 'uz', theme: 'dark', fontSize: 'medium' };
const DEFAULT_NOTIF: User['notificationPrefs'] = {
  pushEnabled: true,
};

/** Eski localStorage dagi user'da preferences/notificationPrefs bo'lmasa default bilan to'ldiradi. */
function normalizeUser(u: User | null): User | null {
  if (!u) return null;
  return {
    ...u,
    addresses: u.addresses ?? [],
    favorites: u.favorites ?? [],
    bonusBalance: u.bonusBalance ?? 0,
    notificationPrefs: { ...DEFAULT_NOTIF, ...(u.notificationPrefs ?? {}) },
    preferences: { ...DEFAULT_PREFS, ...(u.preferences ?? {}) },
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      sessionReady: false,
      setUser: (user) => set({ user: normalizeUser(user) }),
      setToken: (accessToken) => set({ accessToken }),
      setSessionReady: (sessionReady) => set({ sessionReady }),
      logout: () => set({ user: null, accessToken: null }),
      // Full logout: local + server cookie + push obuna. Server chaqiruvini AXIOS SIZ bajaramiz
      // (fetch + credentials:include) — chunki axios'ning o'zi 401 refresh logikasi
      // bilan poygaga kirishib "authda ushlab turadi" effektini beradi.
      logoutServer: async () => {
        // 0) Tokenni avval ushlaymiz — push/unsubscribe uchun Bearer kerak
        //    (server requireAuth talab qiladi).
        const token = useAuthStore.getState().accessToken;
        // 1) Avval local tozalaymiz — 401 interceptor refresh loop qilmasligi uchun
        set({ user: null, accessToken: null });
        try {
          // Push obunani ham bekor qilamiz — keyingi user eski obunaga push olmasligi uchun.
          if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.ready.catch(() => null);
            const sub = await reg?.pushManager.getSubscription().catch(() => null);
            if (sub?.endpoint) {
              await fetch(`${API_URL}/push/unsubscribe`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ endpoint: sub.endpoint }),
              }).catch(() => undefined);
              await sub.unsubscribe().catch(() => undefined);
            }
          }
        } catch {
          // Push tozalash ixtiyoriy — xato logout'ni to'xtatmaydi.
        }
        try {
          await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
        } catch {
          // Server o'chiq bo'lsa ham local tozalanadi
        }
      },
    }),
    {
      name: 'boyxon-auth',
      /**
       * Xavfsizlik: access token `sessionStorage`da saqlanadi (localStorage emas).
       *
       * Sabab: localStorage qiymatlari cheksiz yashaydi va har qanday XSS bir marta
       * ishlashi bilan tokenni doimiy o'g'irlash imkonini beradi. sessionStorage esa
       * tab yopilishi bilan tozalanadi, ya'ni o'g'irlangan token umri qisqa bo'ladi.
       * Uzoq muddatli sessiya httpOnly cookie (refresh token) orqali tiklanadi —
       * uni JavaScript umuman o'qiy olmaydi.
       */
      storage: {
        getItem: (name) => {
          /**
           * Buzilgan/yaroqsiz JSON (masalan quota tugab yarim yozilgan qiymat,
           * eski format yoki foydalanuvchi qo'lda o'zgartirgani) butun ilovani
           * oq ekranga aylantirardi — `JSON.parse` istisno tashlab, React
           * render bo'lishidan oldin yiqilardi. Endi xato bo'lsa qiymat
           * tozalanadi va sessiya oddiy "mehmon" holatidan boshlanadi.
           */
          const parse = (raw: string): never | null => {
            try {
              return JSON.parse(raw) as never;
            } catch {
              sessionStorage.removeItem(name);
              localStorage.removeItem(name);
              return null;
            }
          };
          const value = sessionStorage.getItem(name);
          if (value) return parse(value);
          // Eski localStorage yozuvini bir marta ko'chirib olamiz (migratsiya).
          const legacy = localStorage.getItem(name);
          if (legacy) {
            sessionStorage.setItem(name, legacy);
            localStorage.removeItem(name);
            return parse(legacy);
          }
          return null;
        },
        setItem: (name, value) => sessionStorage.setItem(name, JSON.stringify(value)),
        removeItem: (name) => {
          sessionStorage.removeItem(name);
          localStorage.removeItem(name);
        },
      },
      // Persist'dan qaytgan eski user'ni ham normalize qilish (migratsiya)
      merge: (persisted, current) => {
        const p = persisted as Partial<AuthState> | undefined;
        const user = normalizeUser((p?.user as User | null) ?? null);
        const accessToken = (p?.accessToken as string | null | undefined) ?? null;
        return {
          ...current,
          ...p,
          user,
          accessToken,
          // Token bor bo'lsa darhol tayyor; yo'q bo'lsa App refresh cookie ni sinaydi.
          sessionReady: Boolean(accessToken),
        };
      },
    },
  ),
);
