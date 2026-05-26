import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import DashboardLayout from './components/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardHome from './pages/DashboardHome';
import PlannerPage from './pages/PlannerPage';
import TutorPage from './pages/TutorPage';
import TestsPage from './pages/TestsPage';
import FlashcardsPage from './pages/FlashcardsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import PhotoDoubtPage from './pages/PhotoDoubtPage';
import VoiceCallPage from './pages/VoiceCallPage';
import PYQPage from './pages/PYQPage';
import MotivationPage from './pages/MotivationPage';
import NCERTPage from './pages/NCERTPage';
import ExamStrategyPage from './pages/ExamStrategyPage';
import { useAuthStore } from './store/authStore';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const { fetchMe, token } = useAuthStore();

  // Rehydrate user from token on app load
  useEffect(() => {
    if (token) void fetchMe();
  }, [fetchMe, token]);

  return (
    <ErrorBoundary>
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        {/* Protected dashboard routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            {/* Student routes */}
            <Route path="/dashboard" element={<DashboardHome />} />
            <Route path="/dashboard/planner" element={<PlannerPage />} />
            <Route path="/dashboard/tutor" element={<TutorPage />} />
            <Route path="/dashboard/tests" element={<TestsPage />} />
            <Route path="/dashboard/flashcards" element={<FlashcardsPage />} />
            <Route path="/dashboard/analytics" element={<AnalyticsPage />} />
            <Route path="/dashboard/pyq" element={<PYQPage />} />
            <Route path="/dashboard/motivation" element={<MotivationPage />} />
            <Route path="/dashboard/photo-doubt" element={<PhotoDoubtPage />} />
            <Route path="/dashboard/voice" element={<VoiceCallPage />} />
            <Route path="/dashboard/ncert" element={<NCERTPage />} />
            <Route path="/dashboard/strategy" element={<ExamStrategyPage />} />
          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  );
}
