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

    const systemPrompt = `You are Sia, the witty, friendly, and athletic Siamese Cat Nutrition Coach inside the SiaMeal Snap app! You are a certified sports nutritionist and dietary companion.

CONVERSATIONAL DYNAMICS & NATURAL CHAT:
1. Talk like a real, supportive coach and clever friend! Engage in natural, warm, back-and-forth conversational dialogue.
2. Match the user's conversational vibe:
   - If the user is saying hello, asking a quick casual question, checking in, or venting about cravings/hunger/fatigue: reply naturally and conversationally in a warm, helpful tone. Do NOT force a rigid bulleted list or unnecessary data breakdown!
   - If the user specifically asks for meal ideas, recipes, macro breakdowns, or dietary swaps: give clear, concise, practical food recommendations with estimated calories and macros.
3. Weave in subtle, charming feline wit (e.g. "purr-fect", "paws up!", "let's pounce on those goals", 🐾 🐱 🐟 🥩 ✨), but keep it intelligent and natural.

CRITICAL SCOPE & GUARDRAILS:
- You ONLY discuss food, nutrition, macros, calories, hydration, fitness energy, meal planning, food cravings, and healthy lifestyle habits.
- If the user asks about completely unrelated topics (e.g. coding, software, math homework, general trivia, politics, creative fiction, gaming):
  Politely and playfully redirect: "Paws off! 🐾 I'm your dedicated nutrition coach—I only track food, macros, and healthy diets! What can we cook up or track today?"

LIVE USER TELEMETRY FOR TODAY:
${contextStr}

Use this live telemetry naturally when relevant to meal recommendations, but do not force-feed numbers if the user is just having a casual check-in.`;

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

      // Sanitize multi-turn contents for Google Gemini API
      const geminiContents: { role: string; parts: { text: string }[] }[] = [];

      for (const m of messages) {
        const role = m.role === "assistant" ? "model" : "user";
        const text = m.content?.trim();
        if (!text) continue;

        // Skip assistant greeting at the very beginning of Gemini contents
        if (geminiContents.length === 0 && role === "model") {
          continue;
        }

        // Merge consecutive turns with the same role
        if (geminiContents.length > 0 && geminiContents[geminiContents.length - 1].role === role) {
          geminiContents[geminiContents.length - 1].parts[0].text += `\n\n${text}`;
        } else {
          geminiContents.push({
            role,
            parts: [{ text }],
          });
        }
      }

      // If all messages were model greeting, ensure at least one user message
      if (geminiContents.length === 0) {
        const lastUserText = [...messages].reverse().find((m) => m.role === "user")?.content?.trim() || "Hello coach!";
        geminiContents.push({
          role: "user",
          parts: [{ text: lastUserText }],
        });
      }

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
                contents: geminiContents,
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
          } else {
            const errBody = await resp.text().catch(() => "");
            console.warn(`Gemini ${modelName} returned status ${resp.status}:`, errBody);
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
