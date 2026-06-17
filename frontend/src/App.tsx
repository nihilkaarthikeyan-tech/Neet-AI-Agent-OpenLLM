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
import AdminRoute from './components/AdminRoute';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
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
import SamacheerPage from './pages/SamacheerPage';
import WellbeingPage from './pages/WellbeingPage';
import ProgressPage from './pages/ProgressPage';
import NTASimulatorPage from './pages/NTASimulatorPage';
import MicroLessonPage from './pages/MicroLessonPage';
import CounsellingPage from './pages/CounsellingPage';
import CareerPage from './pages/CareerPage';
import TeacherPortalPage from './pages/TeacherPortalPage';
import DiagnosticPage from './pages/DiagnosticPage';
import OutcomesPage from './pages/OutcomesPage';
import KioskPage from './pages/KioskPage';
import KioskSessionPage from './pages/KioskSessionPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import SnapTextbookPage from './pages/SnapTextbookPage';
import VocabularyPage from './pages/VocabularyPage';
import NCERTExceptionsPage from './pages/NCERTExceptionsPage';
import LearningToolsPage from './pages/LearningToolsPage';
import RankPredictorPage from './pages/RankPredictorPage';
import PerformancePage from './pages/PerformancePage';
import GamificationPage from './pages/GamificationPage';
import ChapterTrackerPage from './pages/ChapterTrackerPage';
import NotesPage from './pages/NotesPage';
import HeatmapPage from './pages/HeatmapPage';
import QuickRevisePage from './pages/QuickRevisePage';
import PomodoroPage from './pages/PomodoroPage';
import CommunityPage from './pages/CommunityPage';
import StudyPodsPage from './pages/StudyPodsPage';
import ParentLinkPage from './pages/ParentLinkPage';
import ParentDashboardPage from './pages/ParentDashboardPage';
import { useAuthStore } from './store/authStore';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const { fetchMe, token, user } = useAuthStore();

  // Rehydrate user from token on app load
  useEffect(() => {
    if (token) void fetchMe();
  }, [fetchMe, token]);

  // GIGW: keep <html lang> in sync with selected language
  useEffect(() => {
    document.documentElement.lang = user?.language ?? 'en';
  }, [user?.language]);

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
        <Route path="/kiosk" element={<KioskPage />} />
        <Route path="/kiosk/session" element={<KioskSessionPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />

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
            <Route path="/dashboard/strategy"  element={<ExamStrategyPage />} />
            <Route path="/dashboard/samacheer"    element={<SamacheerPage />} />
            <Route path="/dashboard/wellbeing"    element={<WellbeingPage />} />
            <Route path="/dashboard/progress"     element={<ProgressPage />} />
            <Route path="/dashboard/nta"          element={<NTASimulatorPage />} />
            <Route path="/dashboard/microlesson"  element={<MicroLessonPage />} />
            <Route path="/dashboard/counselling"  element={<CounsellingPage />} />
            <Route path="/dashboard/career"       element={<CareerPage />} />
            <Route path="/dashboard/teacher"      element={<TeacherPortalPage />} />
            <Route path="/dashboard/diagnostic"   element={<DiagnosticPage />} />
            <Route path="/dashboard/outcomes"      element={<OutcomesPage />} />
            <Route path="/dashboard/snap"         element={<SnapTextbookPage />} />
            <Route path="/dashboard/vocabulary"   element={<VocabularyPage />} />
            <Route path="/dashboard/ncert-exceptions" element={<NCERTExceptionsPage />} />
            <Route path="/dashboard/learning-tools"  element={<LearningToolsPage />} />
            <Route path="/dashboard/rank-predictor"   element={<RankPredictorPage />} />
            <Route path="/dashboard/performance"      element={<PerformancePage />} />
            <Route path="/dashboard/gamification"     element={<GamificationPage />} />
            <Route path="/dashboard/chapter-tracker"  element={<ChapterTrackerPage />} />
            <Route path="/dashboard/notes"            element={<NotesPage />} />
            <Route path="/dashboard/heatmap"          element={<HeatmapPage />} />
            <Route path="/dashboard/quick-revise"     element={<QuickRevisePage />} />
            <Route path="/dashboard/pomodoro"         element={<PomodoroPage />} />
            <Route path="/dashboard/community"        element={<CommunityPage />} />
            <Route path="/dashboard/pods"             element={<StudyPodsPage />} />
            <Route path="/dashboard/parent-link"      element={<ParentLinkPage />} />
          </Route>
        </Route>

        {/* Public parent dashboard — no auth needed */}
        <Route path="/parent/:code" element={<ParentDashboardPage />} />

        {/* Admin routes — separate login, ADMIN role only */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route element={<AdminRoute />}>
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  );
}
