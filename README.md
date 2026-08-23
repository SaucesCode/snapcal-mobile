# SiaMeal Snap

Mobile AI calorie tracker and nutrition intelligence platform. Snap meal photos or enter food in natural language to estimate calories, portions, and macronutrients in real time.

Built with **React Native (Expo SDK 57)** and **Supabase**.

---

## Highlights

* **AI Meal Scanner:** Point-and-shoot camera (`expo-camera`) and gallery upload. Images are compressed on-device to 512px before routing to Supabase Edge Functions to estimate calories, protein, carbs, fat, and ingredients.
* **Review & Edit Flow:** Dedicated adjustment screen (`/review`) before saving to the database so you can tweak portions or ingredients.
* **Text & Natural Language Entry:** In-tree natural language logger with quick suggestion chips (`TextLogModal`).
* **Daily Dashboard:** Hardware-accelerated SVG macro rings (Calories, Protein, Carbs, Fat) and categorized meal logs (Breakfast, Lunch, Dinner, Snacks).
* **Hydration Tracker:** Animated radial dial with gradient sweep, quick vessel pods (`+250ml`, `+500ml`, `+750ml`, `+1.0L`), custom volumes, and chronological intake history.
* **Analytics & Adherence:** 7-day adherence bar chart with historical week stepper, macro energy split percentage, and rolling dietary diagnostic cards.
* **Body Weight Velocity Lab:** 14-day SVG Bezier trend curve with automatic Mifflin-St Jeor TDEE and macro target recalculation on log.
* **Context-Aware AI Coach:** Floating companion widget connected to live telemetry (remaining daily calories/macros) with scope-locked nutrition system prompt and native keyboard docking.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | React Native (Expo SDK 57, Managed Workflow) |
| **Routing** | Expo Router (File-based navigation) |
| **Styling** | NativeWind / Tailwind CSS |
| **State** | Zustand + AsyncStorage persistence |
| **Backend & Auth** | Supabase (PostgreSQL, GoTrue Auth, Edge Functions in Deno) |
| **AI Models** | Google Gemini (`gemini-2.5-flash`, `gemini-2.0-flash`) & OpenAI `gpt-4o-mini` |
| **Graphics & Motion** | React Native SVG, React Native Reanimated |

---

## Architecture & Security

```
[ Mobile App ] 
      │  (On-device image compression: 512px max, 0.5 JPEG quality)
      ▼
[ Supabase Edge Function: analyze-meal ]
      ├── Mode: Analyze  ──► [ Gemini / OpenAI Vision ] ──► JSON (meal, macros, ingredients)
      └── Mode: Chat     ──► [ Gemini / OpenAI Chat ]   ──► Nutrition Advice + Live Telemetry
      │
      ▼
[ Supabase PostgreSQL ] (Row-Level Security)
```

* **No Client Keys:** API keys (`GEMINI_API_KEY`, `OPENAI_API_KEY`) are stored as Supabase Edge Function secrets and never exposed to the client bundle.
* **Bandwidth Optimization:** High-resolution camera captures are resized and compressed with `expo-image-manipulator` prior to transmission.
* **Intervention Step:** Estimates must be reviewed by the user on the Review screen before writing to the `meals` table.

---

## License

MIT
