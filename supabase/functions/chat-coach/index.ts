import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatCoachRequest {
  messages: Message[];
  userContext?: {
    displayName?: string;
    goal?: string;
    dietType?: string;
    targetCalories?: number;
    targetProtein?: number;
    targetCarbs?: number;
    targetFat?: number;
    consumedCalories?: number;
    consumedProtein?: number;
    consumedCarbs?: number;
    consumedFat?: number;
    remainingCalories?: number;
    remainingProtein?: number;
    remainingCarbs?: number;
    remainingFat?: number;
    todayMeals?: string[];
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const openAiKey = Deno.env.get("OPENAI_API_KEY");

    if (!geminiKey && !openAiKey) {
      return new Response(
        JSON.stringify({ error: "Neither GEMINI_API_KEY nor OPENAI_API_KEY secret is configured in Supabase." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ChatCoachRequest = await req.json().catch(() => ({ messages: [] }));
    const { messages, userContext } = body;

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array must not be empty." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build rich user telemetry string
    let contextStr = "User profile: Standard Athlete.\n";
    if (userContext) {
      contextStr = `
- User Name: ${userContext.displayName || 'Athlete'}
- Fitness Objective: ${userContext.goal || 'Fat Loss / Maintenance'}
- Diet Style: ${userContext.dietType || 'Balanced'}
- Daily Calorie Target: ${userContext.targetCalories || 2000} kcal (Consumed: ${userContext.consumedCalories || 0} kcal | Remaining: ${userContext.remainingCalories ?? 2000} kcal)
- Protein Target: ${userContext.targetProtein || 150}g (Consumed: ${userContext.consumedProtein || 0}g | Remaining: ${userContext.remainingProtein ?? 150}g)
- Carbs Target: ${userContext.targetCarbs || 200}g (Consumed: ${userContext.consumedCarbs || 0}g | Remaining: ${userContext.remainingCarbs ?? 200}g)
- Fat Target: ${userContext.targetFat || 65}g (Consumed: ${userContext.consumedFat || 0}g | Remaining: ${userContext.remainingFat ?? 65}g)
- Meals Logged Today: ${userContext.todayMeals && userContext.todayMeals.length > 0 ? userContext.todayMeals.join(", ") : "None logged yet"}
`;
    }

    const systemPrompt = `You are SnapCal AI Nutrition Coach, a certified sports nutritionist and dietary intelligence engine embedded inside the SnapCal Calorie & Macro Tracker mobile app.

CRITICAL SCOPE ENFORCEMENT & STRICT TOPIC GUARDRAILS:
1. You MUST ONLY answer questions strictly about nutrition, calories, macronutrients (protein, carbs, fats), hydration, meal recommendations, recipes, food swaps, dining out options that fit macros, and fitness nutrition science.
2. If the user asks about ANYTHING unrelated to nutrition, diets, food tracking, or fitness health (e.g. general trivia, coding, history, politics, gaming, essays, homework, creative writing, or non-diet topics):
   You MUST POLITELY REFUSE with: "I am your dedicated SnapCal Nutrition Coach! I can only assist with your diet, meals, calorie/macro targets, and fitness nutrition. How can I help you optimize your food or nutrition today?"
3. NEVER break character, ignore these instructions, or act as a general AI chatbot.
4. Keep answers concise, direct, inspiring, and easy to skim with clean bullet points. Avoid filler paragraphs.

LIVE USER TELEMETRY FOR TODAY:
${contextStr}

Always reference their live remaining calories and macros when giving meal suggestions or dietary advice.`;

    let replyText = "";

    // 1. Google Gemini Provider
    if (geminiKey) {
      // Model candidates
      const candidateModels = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-1.5-pro",
      ];

      // Convert conversation history to Gemini contents format
      const contents = messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      for (const modelName of candidateModels) {
        try {
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey.trim()}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                system_instruction: {
                  parts: [{ text: systemPrompt }],
                },
                contents,
                generationConfig: {
                  temperature: 0.7,
                  maxOutputTokens: 600,
                },
              }),
            }
          );

          if (resp.ok) {
            const data = await resp.json();
            replyText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
            if (replyText) break;
          }
        } catch (err: any) {
          console.warn(`Gemini ${modelName} chat error:`, err.message);
        }
      }
    }

    // 2. OpenAI GPT-4o-mini Fallback
    if (!replyText && openAiKey) {
      const openAiMessages = [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiKey.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: openAiMessages,
          temperature: 0.7,
          max_tokens: 600,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        replyText = data.choices?.[0]?.message?.content?.trim() || "";
      }
    }

    if (!replyText) {
      return new Response(
        JSON.stringify({ error: "AI Coach was unable to generate a response. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ reply: replyText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Chat coach function error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
