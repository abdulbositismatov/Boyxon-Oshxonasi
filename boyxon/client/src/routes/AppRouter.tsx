import { Suspense, lazy, type ReactNode } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '../components/layout/Layout';
import { PrivateSeo } from '../components/seo/PrivateSeo';
import { ProtectedRoute } from './ProtectedRoute';
import { AdminRoute } from './AdminRoute';
import { VerifiedRoute } from './VerifiedRoute';
// Bosh sahifa eng ko'p tashrif buyuriladigan sahifa: uni alohida chunk qilib
// yuborish LCP'ni ~250ms kechiktiradi (index → HomePage waterfall). Shuning
// uchun to'g'ridan-to'g'ri import qilamiz — Vite uning statik bog'liqliklarini
// HTML'da modulepreload qiladi.
import HomePage from '../pages/home/HomePage';

const DishPage = lazy(() => import('../pages/dish/DishPage'));
const CategoryPage = lazy(() => import('../pages/category/CategoryPage'));
const CartPage = lazy(() => import('../pages/cart/CartPage'));
const SettingsPage = lazy(() => import('../pages/settings/SettingsPage'));
const AuthPage = lazy(() => import('../pages/auth/AuthPage'));
const AuthCallback = lazy(() => import('../pages/auth/AuthCallback'));
const VerifyEmailPage = lazy(() => import('../pages/auth/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('../pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('../pages/auth/ResetPasswordPage'));
const AdminLayout = lazy(() => import('../pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'));
const AdminDishes = lazy(() => import('../pages/admin/AdminDishes'));
const AdminOrders = lazy(() => import('../pages/admin/AdminOrders'));
const AdminUsers = lazy(() => import('../pages/admin/AdminUsers'));
const AdminCategories = lazy(() => import('../pages/admin/AdminCategories'));
const AdminPromos = lazy(() => import('../pages/admin/AdminPromos'));
const AdminPush = lazy(() => import('../pages/admin/AdminPush'));
const AdminChat = lazy(() => import('../pages/admin/AdminChat'));
const OrderDetailPage = lazy(() => import('../pages/order/OrderDetailPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

function Fallback() {
  return (
    <div className="min-h-screen grid place-items-center bg-bg">
      <div className="h-9 w-9 animate-spin rounded-full border-3 border-primary-500 border-t-transparent" />
    </div>
  );
}

/** Shaxsiy sahifalar uchun noindex meta + sarlavha. */
function NoIndexRoute({
  title,
  path,
  children,
}: {
  title: string;
  path: string;
  children: ReactNode;
}) {
  return (
    <>
      <PrivateSeo title={title} path={path} />
      {children}
    </>
  );
}

export function AppRouter() {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<Fallback />}>
      <Routes>
        <Route path="/auth" element={<NoIndexRoute title={t('auth.welcome')} path="/auth"><AuthPage /></NoIndexRoute>} />
        <Route path="/auth/callback" element={<NoIndexRoute title={t('auth.signing_in')} path="/auth/callback"><AuthCallback /></NoIndexRoute>} />
        {/* Email tasdiqlash: token bilan (havoladan) yoki tokensiz (kutish ekrani). */}
        <Route path="/verify-email" element={<NoIndexRoute title={t('auth.verify_title')} path="/verify-email"><VerifyEmailPage /></NoIndexRoute>} />
        <Route path="/verify-email/:token" element={<NoIndexRoute title={t('auth.verify_title')} path="/verify-email"><VerifyEmailPage /></NoIndexRoute>} />
        {/* Parolni tiklash: email kiritish + havoladagi token bilan yangi parol. */}
        <Route path="/forgot-password" element={<NoIndexRoute title={t('auth.reset_title')} path="/forgot-password"><ForgotPasswordPage /></NoIndexRoute>} />
        <Route path="/reset-password/:token" element={<NoIndexRoute title={t('auth.reset_new_title')} path="/reset-password"><ResetPasswordPage /></NoIndexRoute>} />
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/dish/:slug" element={<DishPage />} />
          <Route path="/category/:slug" element={<CategoryPage />} />
          <Route path="/cart" element={<NoIndexRoute title={t('cart.title')} path="/cart"><ProtectedRoute><VerifiedRoute><CartPage /></VerifiedRoute></ProtectedRoute></NoIndexRoute>} />
          <Route path="/settings" element={<NoIndexRoute title={t('settings.title')} path="/settings"><ProtectedRoute><VerifiedRoute><SettingsPage /></VerifiedRoute></ProtectedRoute></NoIndexRoute>} />
          <Route path="/orders/:id" element={<NoIndexRoute title={t('orders.detail_title')} path="/orders"><ProtectedRoute><VerifiedRoute><OrderDetailPage /></VerifiedRoute></ProtectedRoute></NoIndexRoute>} />
        </Route>
        <Route path="/admin" element={<NoIndexRoute title={t('admin.title')} path="/admin"><AdminRoute><AdminLayout /></AdminRoute></NoIndexRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="dishes" element={<AdminDishes />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="promos" element={<AdminPromos />} />
          <Route path="push" element={<AdminPush />} />
          <Route path="chat" element={<AdminChat />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}