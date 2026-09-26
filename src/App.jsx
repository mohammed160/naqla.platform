import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import PublicLayout from './components/PublicLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ADMIN_ROUTE_SEGMENT } from './config/adminPortal';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import VerifyEmail from './pages/VerifyEmail';
import ResetPassword from './pages/ResetPassword';
import UpdatePassword from './pages/UpdatePassword';
import StudentDashboard from './pages/StudentDashboard';
import WatchLecture from './pages/WatchLecture';
import Faq from './pages/Faq';
import CoursesPage from './pages/CoursesPage';
import Join from './pages/Join';
import Checkout from './pages/Checkout';
import PaymentReturn from './pages/PaymentReturn';
import NotFound from './pages/NotFound';
import LoadingScreen from './components/LoadingScreen';

// Admin screens load only when an admin opens them, keeping the student bundle small.
const AdminLayout = lazy(() => import('./components/AdminLayout'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview'));
const AdminCourses = lazy(() => import('./pages/admin/AdminCourses'));
const AdminLectures = lazy(() => import('./pages/admin/AdminLectures'));
const AdminCodes = lazy(() => import('./pages/admin/AdminCodes'));
const AdminContent = lazy(() => import('./pages/admin/AdminContent'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminPayments = lazy(() => import('./pages/admin/AdminPayments'));
const AdminReviews = lazy(() => import('./pages/admin/AdminReviews'));
const AdminPlan = lazy(() => import('./pages/admin/AdminPlan'));

export default function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="courses" element={<CoursesPage />} />
          <Route path="join" element={<Join />} />
          <Route path="join/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
          <Route path="faq" element={<Faq />} />
          <Route path="projects/*" element={<Navigate to="/faq" replace />} />
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<Signup />} />
          <Route path="verify-email" element={<VerifyEmail />} />
          <Route path="reset-password" element={<ResetPassword />} />
          <Route path="update-password" element={<UpdatePassword />} />
          <Route path="watch/:lectureId" element={<WatchLecture />} />
          <Route path="checkout/:courseId" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
          <Route path="payment-return" element={<ProtectedRoute><PaymentReturn /></ProtectedRoute>} />
          <Route path="dashboard" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
        </Route>

        <Route path={`${ADMIN_ROUTE_SEGMENT}/login`} element={<AdminLogin />} />
        <Route
          path={ADMIN_ROUTE_SEGMENT}
          element={<ProtectedRoute requireAdmin><AdminLayout /></ProtectedRoute>}
        >
          <Route index element={<AdminOverview />} />
          <Route path="courses" element={<AdminCourses />} />
          <Route path="lectures" element={<AdminLectures />} />
          <Route path="codes" element={<AdminCodes />} />
          <Route path="payments" element={<AdminPayments />} />
          <Route path="reviews" element={<AdminReviews />} />
          <Route path="plan" element={<AdminPlan />} />
          <Route path="content" element={<AdminContent />} />
          <Route path="users" element={<AdminUsers />} />
        </Route>

        {/* Fallback aliases for admin portal to guarantee no 404 */}
        {['admin', 'admin1', 'admin.1', 'naqla-studio-x7k'].filter(alias => alias !== ADMIN_ROUTE_SEGMENT).flatMap(alias => [
          <Route key={`${alias}-root`} path={alias} element={<Navigate to={`/${ADMIN_ROUTE_SEGMENT}`} replace />} />,
          <Route key={`${alias}-wildcard`} path={`${alias}/*`} element={<Navigate to={`/${ADMIN_ROUTE_SEGMENT}`} replace />} />,
        ])}

        <Route path="404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </Suspense>
  );
}
