import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface RequestPayload {
  mode?: "analyze" | "chat";
  // Meal analysis params
  imageBase64?: string;
  textDescription?: string;
  // Chat Coach params
  messages?: Message[];
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

    const body: RequestPayload = await req.json().catch(() => ({}));

    // =========================================================================
    // HANDLER 1: AI NUTRITION COACH (CHAT MODE)
    // =========================================================================
    if (body.mode === "chat" || (body.messages && body.messages.length > 0)) {
      const messages = body.messages || [];
      const userContext = body.userContext;

      if (messages.length === 0) {
        return new Response(
          JSON.stringify({ error: "Messages array must not be empty." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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

      const coachSystemPrompt = `You are SnapCal AI Nutrition Coach, a certified sports nutritionist and dietary intelligence engine embedded inside the SnapCal Calorie & Macro Tracker mobile app.

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

      // 1. Google Gemini Provider for Chat
      if (geminiKey) {
        const candidateModels = [
          "gemini-2.5-flash",
          "gemini-2.0-flash",
          "gemini-1.5-flash",
          "gemini-1.5-pro",
        ];

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
                  system_instruction: { parts: [{ text: coachSystemPrompt }] },
                  contents,
                  generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
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

      // 2. OpenAI GPT-4o-mini Fallback for Chat
      if (!replyText && openAiKey) {
        const openAiMessages = [
          { role: "system", content: coachSystemPrompt },
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
    }

    // =========================================================================
    // HANDLER 2: MEAL PHOTO & TEXT ANALYSIS
    // =========================================================================
    const { imageBase64, textDescription } = body;

    if (!imageBase64 && !textDescription) {
      return new Response(
        JSON.stringify({ error: "Either imageBase64 or textDescription must be provided." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are an expert nutritional AI analyzer.
Analyze the provided meal photo or text description and estimate the nutritional content.
You MUST output ONLY a valid JSON object matching this exact schema:
{
  "meal_name": "A concise title of the dish",
  "calories": number (total kcal),
  "protein_g": number (grams of protein),
  "carbs_g": number (grams of carbohydrates),
  "fat_g": number (grams of fat),
  "ingredients": ["ingredient 1 with estimated portion", "ingredient 2 with estimated portion"]
}
Be realistic, accurate, and concise. Return ONLY raw JSON without markdown code blocks.`;

    let parsedData: any = null;

    if (geminiKey) {
      const parts: any[] = [];
      parts.push({
        text: textDescription
          ? `Analyze this meal: "${textDescription}". Estimate calories, protein, carbs, fat, and ingredients.`
          : "Analyze this meal photo. Identify all foods, portion sizes, calories, macronutrients (protein, carbs, fat), and individual ingredients.",
      });

      if (imageBase64) {
        const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");
        parts.push({
          inline_data: {
            mime_type: "image/jpeg",
            data: cleanBase64,
          },
        });
      }

      let candidateModels: string[] = [];
      try {
        const listResp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey.trim()}`
        );
        if (listResp.ok) {
          const listData = await listResp.json();
          candidateModels = (listData.models || [])
            .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
            .map((m: any) => m.name.replace(/^models\//, ""));
        }
      } catch (e: any) {
        console.warn("Model discovery error:", e.message);
      }

      if (candidateModels.length === 0) {
        candidateModels = [
          "gemini-2.5-flash",
          "gemini-2.0-flash",
          "gemini-1.5-flash",
          "gemini-1.5-pro",
        ];
      }

      candidateModels.sort((a, b) => {
        if (a.includes("flash") && !b.includes("flash")) return -1;
        if (!a.includes("flash") && b.includes("flash")) return 1;
        return 0;
      });

      let lastError = "";

      for (const modelName of candidateModels) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey.trim()}`;
          const geminiResponse = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts }],
              system_instruction: { parts: [{ text: systemPrompt }] },
              generationConfig: {
                response_mime_type: "application/json",
                temperature: 0.2,
              },
            }),
          });

          if (geminiResponse.ok) {
            const geminiData = await geminiResponse.json();
            const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
            parsedData = JSON.parse(rawText || "{}");
            break;
          } else {
            lastError = await geminiResponse.text();
          }
        } catch (e: any) {
          lastError = e.message;
        }
      }

      if (!parsedData && !openAiKey) {
        return new Response(
          JSON.stringify({ error: `Gemini Error: ${lastError}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!parsedData && openAiKey) {
      const userContent: any[] = [];
      userContent.push({
        type: "text",
        text: textDescription
          ? `Analyze this meal description: "${textDescription}" and return the estimated nutrients and ingredients.`
          : "Analyze this meal photo and return the estimated calories, protein, carbs, fat, and ingredients.",
      });

      if (imageBase64) {
        const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");
        userContent.push({
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${cleanBase64}`,
            detail: "low",
          },
        });
      }

      const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiKey.trim()}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          temperature: 0.2,
        }),
      });

      if (!openAiResponse.ok) {
        const errorText = await openAiResponse.text();
        return new Response(
          JSON.stringify({ error: `OpenAI error (${openAiResponse.status}): ${errorText}` }),
          { status: openAiResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const openAiData = await openAiResponse.json();
      const rawContent = openAiData.choices?.[0]?.message?.content;
      parsedData = JSON.parse(rawContent || "{}");
    }

    const sanitizedResult = {
      meal_name: String(parsedData?.meal_name || "Logged Meal"),
      calories: Math.round(Number(parsedData?.calories) || 0),
      protein_g: Math.round(Number(parsedData?.protein_g) || 0),
      carbs_g: Math.round(Number(parsedData?.carbs_g) || 0),
      fat_g: Math.round(Number(parsedData?.fat_g) || 0),
      ingredients: Array.isArray(parsedData?.ingredients)
        ? parsedData.ingredients.map(String)
        : [],
    };

    return new Response(JSON.stringify(sanitizedResult), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Edge Function error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
