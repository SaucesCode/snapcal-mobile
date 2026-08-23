# AI Calorie Tracker - Source of Truth

## Project Overview
We are building a high-performance, precision mobile AI Calorie Tracker and Nutrition Intelligence platform with a cloud backend. Users calculate their daily macro targets, snap photos of meals, and an AI Vision engine estimates the macronutrients. The application code and UI copy must be concise, intentional, and strictly avoid generic "AI slop" or boilerplate filler.

*   **Framework:** React Native (Expo SDK 57 Managed Workflow)
*   **Styling:** NativeWind / Tailwind CSS (Dark-Tech Obsidian Theme)
*   **Navigation:** Expo Router (Tabs: Dashboard, Water, Camera, Analytics/History, Profile)
*   **State Management:** Zustand (Local UI state & AsyncStorage persistence)
*   **Backend & Database:** Supabase (PostgreSQL, GoTrue Auth)
*   **Serverless Logic:** Supabase Edge Functions (Deno)
*   **Vision & Chat Models:** Google Gemini (`gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-1.5-flash`) & OpenAI `gpt-4o-mini`

---

## 📱 CORE FEATURES & ARCHITECTURE

1.  **Photo-First Food Scanning:**
    *   Point-and-shoot camera (`expo-camera`) and gallery upload.
    *   AI identifies food, estimates portions, and returns structured calories and macronutrients.
2.  **The "Review & Edit" Screen:**
    *   Mandatory intervention step (`/review`). Users review AI estimates, tweak portions/ingredients, and choose category before saving.
3.  **Dynamic Daily Dashboard (`/`):**
    *   Hardware-accelerated animated SVG macro rings (Calories, Protein, Carbs, Fat).
    *   Meal categories (Breakfast, Lunch, Dinner, Snack) with macro breakdowns and deletion modals.
    *   Dynamic Island Toast HUD for instant feedback.
4.  **Natural Language Text Logging (`TextLogModal.tsx`):**
    *   Crash-proof in-tree overlay with quick suggestion chips (`[🍳 Eggs & toast]`, `[🍗 Chicken & rice]`).
5.  **Hydration Command Center (`/water`):**
    *   Animated SVG Cyan Radial Dial with gradient sweep.
    *   3 Athletic telemetry pods (`Remaining ml`, `Intakes count`, `Hydration Pace`).
    *   4 Rapid vessel pods (`Glass +250ml`, `Bottle +500ml`, `Flask +750ml`, `Pitcher +1.0L`).
    *   Custom fluid intake modal with quick presets and chronological timeline.
6.  **Performance Analytics Suite (`/history`):**
    *   7-Day interactive adherence bar chart with a **Historical Week Stepper (`[ ◀ Prev ] [ Next ▶ ]`)**. Data is permanently stored and never resets.
    *   **1-by-1 Horizontal Swiping AI Coaching Carousel** with magnetic snapping and progress dots.
    *   7-Day Macro Energy Split distribution.
7.  **Body Weight Velocity Lab (`WeightTrackerSheet.tsx`, `WeightTrendChart.tsx`):**
    *   14-Day hardware-accelerated SVG Bezier curve with Emerald gradient area fill.
    *   Tactile steppers (`-0.5`, `-0.1`, `+0.1`, `+0.5`), direct typing, and `KG`/`LBS` switcher.
    *   Auto-recalculation of Mifflin-St Jeor TDEE and macro targets upon saving.
8.  **Context-Aware AI Nutrition Coach Assistant (`FloatingCoachWidget.tsx`, `AiNutritionCoachModal.tsx`):**
    *   Pulsing floating action bubble (FAB) on bottom-right corner.
    *   **Strict Scope Lock:** System prompt strictly bounded to nutrition, macros, meal ideas, and food tracking (politely refuses off-topic queries).
    *   **Live Context Injection:** Sends user's remaining calories, protein, carbs, fat, and logged meals for hyper-personalized advice.
    *   **Clean Markdown Renderer:** Formats `**bold text**` without displaying raw asterisks.
    *   **Dynamic Keyboard Pinning:** Listens to native `keyboardDidShow` events to keep the input bar locked directly above the keyboard.

---

## 🛑 STRICT TECHNICAL CONSTRAINTS 

### 1. API Security (The Edge Function Rule)
*   **NEVER** store `OPENAI_API_KEY` or `GEMINI_API_KEY` in the React Native codebase or `.env` file. 
*   **ALWAYS** route AI requests through Supabase Edge Functions (`analyze-meal`). The mobile app sends compressed payloads; the Edge Function securely interfaces with the AI providers.

### 2. Payload Optimization (The Free Tier Rule)
*   **NEVER** send raw, high-resolution images from the camera to the backend.
*   **ALWAYS** pass captured images through `expo-image-manipulator` before the network request.
*   **Compression Spec:** Resize images to a maximum width/height of `512px`, set JPEG quality to `0.5`, and convert to a base64 string.

### 3. Edge Function Dual-Mode Architecture
Inside `supabase/functions/analyze-meal/index.ts`:
*   **Analyze Mode:** Structured JSON output with `meal_name`, `calories`, `protein_g`, `carbs_g`, `fat_g`, `ingredients`.
*   **Chat Mode:** Nutrition coaching with live telemetry context, dynamic Gemini model discovery, and OpenAI fallback.

### 4. Data Flow & Database Schema
*   **No Blind Trust:** Never save AI data directly to Supabase without the "Review & Edit" screen intervening.
*   **Schema Mapping:** Maps to `meals` (`calories`, `protein_g`, `carbs_g`, `fat_g`, `food_items`, `logged_at`, `meal_type`) and `profiles` tables.

### 5. Onboarding & Math Engine
*   **TDEE Calculation:** Mifflin-St Jeor equation. 
    *   Men: `(10 × weight in kg) + (6.25 × height in cm) - (5 × age) + 5`
    *   Women: `(10 × weight in kg) + (6.25 × height in cm) - (5 × age) - 161`
*   **Deficit & Macros:** Multiplied by Physical Activity Level (PAL), adjusted for deficit/surplus pace, and distributed across calibrated protein/carb/fat macro ratios.

---

## 🗂️ COMPONENT & STORE DIRECTORY

*   **Stores (`src/stores/`):**
    *   `authStore.ts` — Authentication session, profile biometrics, and target synchronization.
    *   `mealStore.ts` — Meal logging, deletion, daily grouping, and rolling 7-day stats with `weekOffset`.
    *   `waterStore.ts` — Daily fluid intakes, quick vessels, timestamped logs, and AsyncStorage persistence.
    *   `weightStore.ts` — Weigh-in logs, chronological history, and profile weight synchronization.
*   **Components (`src/components/`):**
    *   `AiNutritionCoachModal.tsx` — In-tree AI Nutrition Coach with keyboard-pinned input and clean markdown formatting.
    *   `FloatingCoachWidget.tsx` — Pulsing floating circular bubble on bottom-right.
    *   `WeightTrendChart.tsx` — 14-Day SVG Bezier trend curve.
    *   `WeightTrackerSheet.tsx` — Tactile weight logging sheet with unit toggle.
    *   `WeeklyAdherenceChart.tsx` — 7-Day adherence chart with Week Stepper.
    *   `MacroCard.tsx` — Hardware-accelerated SVG daily macro rings.
    *   `TextLogModal.tsx` — Natural language text meal logging.
    *   `QuickLogActionSheet.tsx` — Rapid 4-category logging sheet.
    *   `ToastBanner.tsx` — Dynamic Island HUD toast notifications.
*   **Utilities (`src/utils/`):**
    *   `nutrition.ts` — Mifflin-St Jeor math, macro split algorithms, PAL multipliers.
    *   `nutritionInsights.ts` — Projected fat loss velocity, protein density diagnostics, macro energy splits.
    *   `haptics.ts` — Tactile sensory feedback helpers.

---

## 🤖 AGENT EXECUTION MODES (PRAR Workflow)

You are operating within the Google Antigravity IDE. You must follow this Gated Execution workflow exactly. Do not skip gates.

### <Plan_Mode>
1. Do NOT write code yet.
2. Analyze the request against the Technical Constraints and User Flow above.
3. Output a step-by-step implementation plan.
4. Wait for user approval before moving to Implement Mode.
### </Plan_Mode>

### <Implement_Mode>
1. Execute the approved steps one by one.
2. Keep UI components cleanly structured and copy intentional. Avoid verbose filler.
3. If writing backend logic, output the Edge Function code (`index.ts`) in an isolated block.
4. Stop and ask for verification after completing the core logic of a step before moving to the next.
### </Implement_Mode>

### <Refine_Mode>
1. Read the error log or user feedback.
2. Do not blindly guess. Add `console.log` statements if ambiguous and ask the user for reproduction steps.
3. Implement the fix and verify against the Technical Constraints.
### </Refine_Mode>