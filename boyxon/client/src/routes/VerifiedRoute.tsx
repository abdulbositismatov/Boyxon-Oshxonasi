import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

/**
 * Faqat emaili tasdiqlangan foydalanuvchilarni o'tkazadi.
 *
 * Server tomonda ham tekshiriladi (login orqali), lekin bu qatlam foydalanuvchiga
 * tushunarli yo'naltirish beradi: tasdiqlash sahifasiga yuboriladi va qaytish
 * manzili saqlanadi.
 *
 * Admin hisoblari bundan mustasno — ular seed orqali tasdiqlangan yaratiladi.
 */
export function VerifiedRoute({ children }: { children: ReactNode }) {
  const { accessToken, user, sessionReady } = useAuthStore();
  const loc = useLocation();

  if (!sessionReady) return <>{children}</>;
  if (!accessToken) return <Navigate to="/auth" replace state={{ from: loc.pathname + loc.search }} />;
  // User hali yuklanmagan bo'lsa (refresh jarayoni) — kutamiz, sakrab ketmaymiz.
  if (user && user.emailVerified === false) {
    return <Navigate to={`/verify-email?email=${encodeURIComponent(user.email)}`} replace state={{ from: loc.pathname + loc.search }} />;
  }
  return <>{children}</>;
}
