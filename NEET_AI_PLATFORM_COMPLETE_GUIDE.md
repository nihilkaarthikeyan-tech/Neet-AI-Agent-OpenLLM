# NEET Preparation AI Platform: Complete Development Guide

This is the ultimate, end-to-end blueprint for building the NEET AI platform. It consolidates all requirements, architecture decisions, and phase-by-phase task breakdowns into a single, comprehensive guide.

## 1. Architecture & Tech Stack
- **Frontend**: React 18, Vite, React Router v6, TailwindCSS v4, Zustand (state), React Query (fetching), Recharts (graphs).
- **Backend**: Node.js, Express, TypeScript, JWT Authentication.
- **Database**: PostgreSQL (via Prisma ORM).
- **AI Layer**: Anthropic Claude API (Text, Planner, MCQs), OpenAI API (Vision for photos, Realtime for Voice capability).
- **Design Aesthetic**: Premium dark mode, glassmorphism UI, Inter font, highly dynamic transitions.

---

## 2. Phase-by-Phase Task Breakdown

### Phase 1: Foundation & UI Shell (Weeks 1-2)
**Goal**: Build the core application skeleton, authentication, and database connection.
- [ ] **Backend Initialization**: Set up Express server with TypeScript and configure CORS/Helmet.
- [ ] **Database Setup**: Initialize Prisma. Create the `User` schema (id, email, password_hash, created_at).
- [ ] **Auth Routes**: Write `/api/auth/register`, `/api/auth/login`, and `/api/auth/me` endpoints using bcrypt and jsonwebtoken.
- [ ] **Frontend Initialization**: Set up React + Vite + TailwindCSS.
- [ ] **Authentication UI**: Build the Login and Register pages.
- [ ] **State Management**: Connect Zustand to store the JWT securely and manage user sessions.
- [ ] **UI Shell Layout**: Implement the premium Dashboard layout (Sidebar for navigation, Top bar for profile).
- [ ] **Stub Pages**: Create empty React components for all future modules (Planner, Tutor, Tests, Analytics, Voice Call).

### Phase 2: AI Study Planner & Text Tutor (Weeks 3-4)
**Goal**: Implement the core text-based AI value propositions.
- [ ] **Database Setup**: Add `StudyPlan` and `DoubtHistory` schemas to Prisma.
- [ ] **Planner Backend**: Build `/api/planner/generate` calling Anthropic to create a JSON schedule based on the student's exam date and weak subjects.
- [ ] **Planner UI**: Build an onboarding form to collect data, and a Calendar/Timeline view to display the generated schedule.
- [ ] **Tutor Backend**: Build `/api/tutor/chat` with Anthropic API utilizing Server-Sent Events (SSE) to stream responses.
- [ ] **Prompt Engineering**: Write strict system prompts for Physics, Chemistry, and Biology to act as expert Indian NEET coaches.
- [ ] **Tutor UI**: Build a modern chat interface with subject selectors and typing indicators.

### Phase 3: Mock Tests & Flashcards (Weeks 5-6)
**Goal**: Enable high-fidelity exam simulation and rapid revision.
- [ ] **Database Setup**: Add `TestAttempt`, `QuestionResponse`, and `FlashcardProgress` schemas.
- [ ] **Test Generation**: Build `/api/tests/generate`. Ask Claude to output strict JSON arrays containing 45/90 questions with 4 options and hidden explanations.
- [ ] **Test Engine UI**: Build a timed test interface with a countdown timer, question navigator grid, and auto-submit features.
- [ ] **Test Results**: Build the post-test summary screen showing breakdowns and AI explanations for wrong choices.
- [ ] **Flashcards API**: Build endpoints to generate topic-specific flashcards via Claude.
- [ ] **Flashcards UI**: Build interactive flipping cards with Easy/Medium/Hard buttons for spaced repetition.

### Phase 4: Analytics & Insights Dashboard (Weeks 7-8)
**Goal**: Turn raw data into actionable learning insights.
- [ ] **Analytics API**: Build `/api/analytics/summary` to aggregate test scores and speed across subjects.
- [ ] **Dashboard UI**: Implement Recharts to show Score Progression lines and Subject Accuracy radar charts.
- [ ] **Weak Area Detector**: Build an AI cron job to analyze recent test mistakes, identify the top 3 weak chapters, and recommend them to the Planner.
- [ ] **PYQ Analyzer**: Add a database of Previous Year Questions, categorized by frequency/weightage.

### Phase 5: Photo Doubt Solver & Launch (Weeks 9-10)
**Goal**: Handle image-based doubts and deploy the MVP.
- [ ] **Image Upload**: Configure `multer` on the backend to accept image uploads up to 5MB.
- [ ] **Vision API**: Build `/api/doubt-solver/photo` connecting to OpenAI GPT-4o Vision to read uploaded textbook photos and return step-by-step math/science solutions.
- [ ] **Visual UI**: Build the image upload component with drag-and-drop and a 3-8s loading skeleton.
- [ ] **Deployment**: Push backend to Railway, PostgreSQL to Supabase, and frontend to Vercel/Cloudflare. Security and Lighthouse QA testing.

### Phase 6: Real-time AI Voice Interaction (Post-Launch)
**Goal**: The ultimate 1-to-1 Ultra-Realistic Voice Tutor.
- [ ] **OpenAI Realtime API Integration**: Configure WebRTC or WebSocket connections securely from the frontend to a backend proxy, linking to OpenAI's Realtime Audio API.
- [ ] **Voice UI Base**: Build a "Call AI Tutor" interface inside the dashboard (similar to a phone call screen with mute/speaker buttons and audio visualizers).
- [ ] **Voice Agent Prompting**: Inject the student's study plan and current weak areas into the initial Voice connection prompt so the AI greets them contextually (e.g., "Hi Rahul, ready to discuss Organic Chemistry today?").
- [ ] **Latency Optimization**: Ensure audio latency stays under 500ms using edge functions.

### Phase 7: Native Mobile Expansion
**Goal**: Port the React web application to React Native for iOS/Android.
- [ ] **React Native Shell**: Initialize Expo/React Native. Share Zustand and React Query logic from the web app.
- [ ] **Push Notifications**: Integrate Firebase Cloud Messaging for Daily Motivation and Study Plan reminders.
- [ ] **Offline Mode**: Cache active Flashcards and Study Plans locally using AsyncStorage or SQLite for offline commutes.

### Phase 8: B2B Institutional Suite
**Goal**: Allow offline coaching centers to track their students using the platform.
- [ ] **Role-Based Access**: Expand `User` schema to include `ROLE: STUDENT | TEACHER | ADMIN`.
- [ ] **Teacher Dashboard**: Build aggregate views showing performance averages across an entire batch of 100+ students.
- [ ] **Custom Tests**: Allow teachers to input their own questions overriding the AI generation engine.
- [ ] **White-labeling**: Dynamic CSS variables permitting coaching centers to inject their own logos and brand colors into the UI.

---
*Created by Antigravity in April 2026. This document acts as the definitive roadmap.*
