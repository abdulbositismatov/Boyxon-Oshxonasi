import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  const sessionReady = useAuthStore((s) => s.sessionReady);
  const loc = useLocation();
  if (!sessionReady) {
    return <div className="min-h-screen grid place-items-center text-ink-300 font-medium">Yuklanmoqda...</div>;
  }
  if (!token) return <Navigate to="/auth" replace state={{ from: loc.pathname + loc.search }} />;
  return <>{children}</>;
}
