import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { FullPageLoading } from './feedback/FullPageLoading';
import { useAuth } from '../providers/AuthProvider';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoading />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
}
