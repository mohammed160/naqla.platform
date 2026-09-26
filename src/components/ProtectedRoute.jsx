import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ADMIN_LOGIN_PATH } from '../config/adminPortal';
import LoadingScreen from './LoadingScreen';

export function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to={requireAdmin ? ADMIN_LOGIN_PATH : '/login'} state={{ from: location }} replace />;
  if (!user.emailVerified) return <Navigate to="/verify-email" replace />;
  if (requireAdmin && !isAdmin) return <Navigate to={`${ADMIN_LOGIN_PATH}?denied=1`} replace />;
  return children;
}
