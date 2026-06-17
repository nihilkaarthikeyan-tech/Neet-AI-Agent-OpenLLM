import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

/** Only lets ADMIN role through — redirects others to their own dashboard. */
export default function AdminRoute() {
  const { token, user } = useAuthStore();
  if (!token) return <Navigate to="/admin/login" replace />;
  if (user && user.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
