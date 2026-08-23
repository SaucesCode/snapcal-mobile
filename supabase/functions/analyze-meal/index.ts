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

      const coachSystemPrompt = `You are Sia, the witty, friendly, and athletic Siamese Cat Nutrition Coach inside the SiaMeal Snap app! You are a certified sports nutritionist and dietary companion.

OUTPUT RULES (CRITICAL):
- Output ONLY your direct spoken conversational response to the user.
- NEVER output reasoning, metadata, tone summaries, user info summaries, or role prefixes (like "User:", "Sia:", "Athlete:", "Tone:", "Current Status:").
- Speak directly, naturally, and warmly to the athlete.

CONVERSATIONAL DYNAMICS:
1. Match the user's conversational vibe:
   - If the user says hello, asks how you are, or shares a feeling: reply warmly and conversationally in 1-2 friendly sentences like a supportive friend.
   - If the user asks for food/meal ideas or macros: give clear, practical food options with estimated calories and macros.
2. Weave in subtle feline charm (e.g. "purr-fect", "paws up!", "let's pounce on those goals", 🐾 🐱 🐟 🥩 ✨), but keep it natural and intelligent.

SCOPE GUARDRAILS:
- You ONLY discuss food, nutrition, macros, calories, hydration, fitness energy, meal planning, and healthy lifestyle habits.
- If asked about off-topic subjects (coding, politics, general trivia, gaming, essays):
  Politely redirect: "Paws off! 🐾 I'm your dedicated nutrition coach—I only talk food, macros, and diet goals! What can we cook up or track today?"

ATHLETE'S CURRENT STATS (INTERNAL CONTEXT ONLY - DO NOT REPEAT THIS LIST TO THE USER):
${contextStr}`;

      let replyText = "";
      const debugErrors: string[] = [];

      if (!geminiKey && !openAiKey) {
        debugErrors.push("No GEMINI_API_KEY or OPENAI_API_KEY secret configured");
      }

      // 1. Google Gemini Provider for Chat with Dynamic Model Discovery
      if (geminiKey) {
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
          console.warn("Model discovery error in Chat:", e.message);
        }

        if (candidateModels.length === 0) {
          candidateModels = [
            "gemini-1.5-flash-latest",
            "gemini-1.5-pro-latest",
            "gemini-pro",
            "gemini-2.0-flash-exp",
          ];
        }

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
            // Attempt 1: Multi-turn format
            let resp = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey.trim()}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  system_instruction: { parts: [{ text: coachSystemPrompt }] },
                  contents: geminiContents,
                  generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
                }),
              }
            );

            // Attempt 2: Single-turn universal fallback if multi-turn rejected
            if (!resp.ok) {
              const lastUserText = [...messages].reverse().find((m) => m.role === "user")?.content?.trim() || "Hi Sia!";
              const singlePrompt = `${coachSystemPrompt}\n\nUser Message: "${lastUserText}"\n\nDirect Spoken Response from Sia:`;

              resp = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey.trim()}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    contents: [{ parts: [{ text: singlePrompt }] }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
                  }),
                }
              );
            }

            if (resp.ok) {
              const data = await resp.json();
              let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

              if (rawText) {
                // Strip any accidental role prefixes
                rawText = rawText.replace(/^(Sia\s*\([^)]*\)|Sia|Coach|Assistant|Direct Spoken Response from Sia)\s*:\s*/i, "").trim();
                if (rawText.includes("Direct Spoken Response from Sia:")) {
                  rawText = rawText.split("Direct Spoken Response from Sia:").pop()?.trim() || rawText;
                }
                replyText = rawText;
                break;
              }
            } else {
              const errBody = await resp.text().catch(() => "");
              debugErrors.push(`${modelName} (${resp.status}): ${errBody.slice(0, 80)}`);
              console.warn(`Gemini ${modelName} returned status ${resp.status}:`, errBody);
            }
          } catch (err: any) {
            debugErrors.push(`${modelName} exception: ${err.message}`);
            console.warn(`Gemini ${modelName} chat error:`, err.message);
          }
        }
      }

      // 2. OpenAI GPT-4o-mini Fallback for Chat
      if (!replyText && openAiKey) {
        const openAiMessages = [
          { role: "system", content: coachSystemPrompt },
          ...messages.map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content || "",
          })),
        ];

        try {
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
          } else {
            const errBody = await resp.text().catch(() => "");
            debugErrors.push(`OpenAI (${resp.status}): ${errBody.slice(0, 120)}`);
            console.warn(`OpenAI chat returned status ${resp.status}:`, errBody);
          }
        } catch (err: any) {
          debugErrors.push(`OpenAI exception: ${err.message}`);
        }
      }

      if (!replyText) {
        return new Response(
          JSON.stringify({
            error: `AI Coach was unable to generate a response. [Details: ${debugErrors.join(" | ") || "No API response candidates"}]`,
          }),
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
