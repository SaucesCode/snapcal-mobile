# 🥗 SnapCal — AI Calorie Tracker & Nutrition Intelligence

[![Expo](https://img.shields.io/badge/Expo-SDK_57-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React_Native-0.86.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/NativeWind-v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://nativewind.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Database_%26_Auth-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-Vision_%26_Chat-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![OpenAI](https://img.shields.io/badge/OpenAI-gpt--4o--mini-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com)

> **SnapCal** is a high-performance, precision mobile AI Calorie Tracker and Nutrition Intelligence platform built with **React Native (Expo SDK 57)** and **Supabase**. Users snap meal photos or describe meals in natural language, and an AI Vision engine calculates macronutrients, portion sizes, and calorie counts with zero boilerplate filler.

---

## 📱 Key Features

### 📸 1. Photo-First Food Scanning & AI Vision
* Point-and-shoot food photography with `expo-camera` or gallery picker.
* AI vision engine identifies foods, portions, calories, and macronutrient breakdowns (`protein_g`, `carbs_g`, `fat_g`, `ingredients`).
* **The "Review & Edit" Screen:** Mandatory intervention step ensuring zero unreviewed AI data is committed to the database.

### ✍️ 2. Natural Language Text Meal Logging
* In-tree natural language meal logging overlay (`TextLogModal`).
* Type freely (e.g. *"2 scrambled eggs with butter and 2 slices of sourdough toast"*).
* Rapid 1-tap suggestion chips for instant macro calculation.

### 📊 3. Dynamic Daily Dashboard
* Hardware-accelerated SVG macro rings (**Calories, Protein, Carbs, Fat**).
* 4 Meal Categories (**Breakfast, Lunch, Dinner, Snacks**) with item breakdowns and deletion modals.
* Real-time Dynamic Island Toast HUD notifications.

### 💧 4. Hydration Command Center
* 60fps hardware-accelerated animated SVG Cyan Radial Dial with linear gradient sweep.
* **3 Athletic Telemetry Pods:** Remaining volume, intakes counter, and hydration pace.
* **4 Rapid Vessel Pods:** Glass (+250ml), Bottle (+500ml), Flask (+750ml), Pitcher (+1.0L).
* Custom fluid volume logger and timestamped chronological timeline with 1-tap delete.

### 📈 5. Performance Analytics & 7-Day Adherence Suite
* **Interactive 7-Day Adherence Bar Chart** with a **Historical Week Stepper (`[ ◀ Prev ] [ Next ▶ ]`)**. All logged meals are permanently stored in Supabase and never reset.
* **1-by-1 Horizontal Swiping AI Coaching Carousel:** Magnetic card deck with progress indicator dots providing fat loss pace predictions, protein density diagnostics, and habit consistency scores.
* **7-Day Macro Energy Split:** Percentage distribution of calories across protein, carbs, and fats.

### ⚖️ 6. Body Weight Velocity Lab
* 14-Day hardware-accelerated SVG Bezier trend curve with emerald gradient fill.
* Tactile quick steppers (`-0.5`, `-0.1`, `+0.1`, `+0.5`), direct typing, and `KG`/`LBS` switcher.
* **Auto-Recalculation:** Updates scale weight and automatically recalculates Mifflin-St Jeor TDEE and macro targets in real-time.

### 🤖 7. Context-Aware AI Nutrition Coach Assistant
* **Pulsing Floating Action Bubble (FAB)** accessible across the dashboard and analytics.
* **Strict Nutrition Scope Lock:** System prompt bounded strictly to nutrition science, macros, meal recommendations, and diet tracking (politely refuses off-topic queries).
* **Live Telemetry Context Injection:** Automatically injects the user's remaining calories, protein, carbs, fat, and today's logged meals for hyper-accurate, personalized advice.
* **Clean Markdown Rendering:** Formats `**bold text**` with zero raw markdown asterisks.
* **Dynamic Keyboard Pinning:** Seamless zero-gap docking right above the native software keyboard.

---

## 🔒 Security & Architecture (The Edge Function Rule)

* **Zero API Key Leakage:** `OPENAI_API_KEY` and `GEMINI_API_KEY` are **never** stored in the client codebase or `.env` files. All AI operations route through Supabase Edge Functions (`analyze-meal`).
* **512px Free Tier Image Optimization:** Raw camera images are compressed on-device via `expo-image-manipulator` (max dimension 512px, JPEG 0.5 quality) before network transmission for maximum speed and minimal payload sizes.
* **Dual-Mode Backend Architecture:** Edge functions dynamically discover available Gemini models (`gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-1.5-flash`) with OpenAI `gpt-4o-mini` fallback.

---

## 🗂️ Project Structure

```
my-calorie-tracker/
├── assets/                       # App icons, splash screens, and vector images
├── src/
│   ├── app/                      # Expo Router File-Based Navigation
│   │   ├── (auth)/               # Login & Signup screens
│   │   ├── (tabs)/               # Tab Navigation
│   │   │   ├── index.tsx         # Daily Dashboard
│   │   │   ├── water.tsx         # Hydration Command Center
│   │   │   ├── camera.tsx        # AI Camera & Barcode Scanner
│   │   │   ├── history.tsx       # Performance Analytics & Historical Weeks
│   │   │   └── profile.tsx       # Biometrics, TDEE, & Weight Velocity Lab
│   │   ├── _layout.tsx           # Root Layout & Theme Configuration
│   │   ├── onboarding.tsx        # Mifflin-St Jeor Biometrics Setup
│   │   └── review.tsx            # AI Meal Review & Adjustment Screen
│   ├── components/               # UI Components
│   │   ├── AiNutritionCoachModal.tsx # Conversational AI Nutrition Coach
│   │   ├── FloatingCoachWidget.tsx   # Pulsing Floating Action Bubble
│   │   ├── MacroCard.tsx             # Animated SVG Macro Summary Rings
│   │   ├── MealItemCard.tsx          # Meal Log Cards with Delete Action
│   │   ├── TextLogModal.tsx          # Natural Language Text Logging
│   │   ├── ToastBanner.tsx           # Dynamic Island HUD Toast
│   │   ├── WeeklyAdherenceChart.tsx  # 7-Day Adherence Chart with Week Stepper
│   │   ├── WeightTrackerSheet.tsx    # Tactile Scale Weight Logging Sheet
│   │   └── WeightTrendChart.tsx      # 14-Day SVG Bezier Weight Curve
│   ├── lib/
│   │   └── supabase.ts           # Supabase Client Configuration
│   ├── services/
│   │   ├── aiService.ts          # Edge Function Client for Vision & Chat
│   │   └── barcodeService.ts     # OpenFoodFacts Barcode Lookup
│   ├── stores/                   # Zustand Global State Stores
│   │   ├── authStore.ts          # Auth, Profile, & Biometric Targets
│   │   ├── mealStore.ts          # Meals, Macros, & Rolling 7-Day Stats
│   │   ├── waterStore.ts         # Fluid Intakes & Persistent Storage
│   │   └── weightStore.ts        # Weigh-In History & Trend Records
│   ├── types/
│   │   └── index.ts              # TypeScript Domain Definitions
│   └── utils/
│       ├── haptics.ts            # Haptic Feedback Sensory Helpers
│       ├── nutrition.ts          # Mifflin-St Jeor TDEE & Macro Math
│       └── nutritionInsights.ts  # Coaching Diagnostics & Energy Splits
├── supabase/
│   ├── functions/
│   │   └── analyze-meal/         # Edge Function (Vision Analysis + Chat Coach)
│   └── schema.sql                # PostgreSQL Schema & RLS Policies
├── GEMINI.md                     # Technical Source of Truth & Architecture Constraints
└── package.json                  # Dependencies & Scripts
```

---

## 🚀 Getting Started

### 1. Prerequisites
* [Node.js](https://nodejs.org/) (v18 or higher)
* [Expo CLI](https://docs.expo.dev/get-started/installation/)
* [Expo Go](https://expo.dev/go) app on your iOS or Android physical device (or simulator/emulator).

### 2. Installation
Clone the repository and install project dependencies:

```bash
git clone https://github.com/your-username/my-calorie-tracker.git
cd my-calorie-tracker
npm install
```

### 3. Setup Supabase Backend
1. Create a project at [Supabase](https://supabase.com).
2. Run the SQL statements from [`supabase/schema.sql`](file:///C:/Users/ACER/Desktop/Mobile/my-calorie-tracker/supabase/schema.sql) in the **Supabase SQL Editor** to create the `profiles` and `meals` tables with Row Level Security (RLS).
3. Deploy the Edge Function:
   ```bash
   npx supabase functions deploy analyze-meal
   ```
4. Set your AI provider secret in Supabase:
   ```bash
   npx supabase secrets set GEMINI_API_KEY="your-gemini-api-key"
   # or
   npx supabase secrets set OPENAI_API_KEY="your-openai-api-key"
   ```

### 4. Configure Environment Variables
Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in your Supabase project credentials:
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 5. Launch the Development Server
Start Metro bundler:

```bash
npm start
```

Scan the QR code with **Expo Go** (Android) or the **Camera app** (iOS) to run the application on your physical device!

---

## 🧪 TypeScript Verification

Verify all types across the codebase:

```bash
npx tsc --noEmit
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
