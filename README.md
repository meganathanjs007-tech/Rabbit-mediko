# Rabbit Mediko — Family Health Vault & Smart Meal Planner

Rabbit Mediko helps Indian families manage health vitals (BP & fasting blood sugar), medical reports, doctor visits, medicine reminders, health-aware meal planning with Tamil safety warnings, public Emergency QR cards, AI health insights, and smart grocery checklists.

## Features
- **Authentication**: Google Sign-In and Indian `+91` Phone OTP via Firebase Auth, with automatic routing to `/setup` or `/dashboard`.
- **Family Health Vault**: Member profiles, Chart.js BP (`90–120 / 60–80`) & Sugar (`70–100 mg/dL`) trend graphs, Firebase Storage report uploads, and doctor visit logs.
- **Smart Meal Planner**: 7-day × 4-slot weekly planner with real-time Firestore sync, instant Tamil/English warnings for Diabetes (high sugar), BP (high salt), Heart (high oil), and Allergies, plus Gemini AI Tamil meal suggestions.
- **Medicine Reminders**: Daily dose tracking with SVG progress ring, 7-day expiry alerts, and Browser Notification API reminders.
- **Emergency QR Card**: Scannable QR cards (`react-qr-code`), PDF card download (`html2canvas` + `jsPDF`), Web Share API, and a **no-login** `/emergency/:memberId` responder view with 1-tap `tel:` call button.
- **AI Health Insights**: 30-day vitals, meals, and medicines analysis in warm Tamil via server-side `@google/genai` (`gemini-4-hydrogen`), cached in Firestore.
- **Smart Grocery List**: Auto-generates categorized ingredients (`Vegetables`, `Grains`, `Dairy`, `Others`) from weekly meals with WhatsApp sharing (`wa.me`).
- **Bilingual**: Instant English / தமிழ் (Tamil) toggle across all pages.

## Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables in `.env` (see `.env.example`):
   - `GEMINI_API_KEY`: Required for server-side Gemini AI meal suggestions and health insights.
   - Firebase config is automatically loaded from `firebase-applet-config.json` (or `VITE_FIREBASE_*` overrides).
3. Start development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000`.

## Demo Seed Data (Sharma Family)
Sign in and click **Load Demo Family (Sharma Family)** on the `/setup` or `/settings` page to automatically populate:
- **Ramesh Sharma** (58, M, `B+`, Diabetes + BP) with 7 BP readings and 5 sugar readings
- **Lakshmi Sharma** (54, F, `O+`, Thyroid)
- **Priya Sharma** (24, F, `A+`, Peanut allergy)
- 7 days of Indian meal plans, 3 active medicines, sample grocery list, and public Emergency QR cards.

## Deployment (Firebase + Vercel)

1. Deploy Firestore security rules (`firestore.rules`):
   ```bash
   firebase deploy --only firestore:rules
   ```
2. Build production bundle:
   ```bash
   npm run build
   ```
3. Run production server (`server.ts` serves both `/api/gemini/*` and `dist/`):
   ```bash
   NODE_ENV=production npm start
   ```
4. For Vercel, add `GEMINI_API_KEY` and `VITE_FIREBASE_*` in Project Environment Variables and deploy with `npm run build`.
