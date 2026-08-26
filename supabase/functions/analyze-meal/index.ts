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

      // ── Rich context block injected into every request ──────────────────────
      let contextBlock = "No athlete profile provided.";
      if (userContext) {
        const uc = userContext;
        const mealsStr = uc.todayMeals?.length
          ? uc.todayMeals.join(", ")
          : "Nothing logged yet";

        contextBlock = [
          `ATHLETE: ${uc.displayName || "Athlete"}`,
          `GOAL: ${uc.goal || "Maintenance"} | DIET: ${uc.dietType || "Balanced"}`,
          `TARGETS TODAY → Calories: ${uc.targetCalories ?? "?"}kcal | Protein: ${uc.targetProtein ?? "?"}g | Carbs: ${uc.targetCarbs ?? "?"}g | Fat: ${uc.targetFat ?? "?"}g`,
          `CONSUMED    → Calories: ${uc.consumedCalories ?? 0}kcal | Protein: ${uc.consumedProtein ?? 0}g | Carbs: ${uc.consumedCarbs ?? 0}g | Fat: ${uc.consumedFat ?? 0}g`,
          `REMAINING   → Calories: ${uc.remainingCalories ?? uc.targetCalories ?? "?"}kcal | Protein: ${uc.remainingProtein ?? uc.targetProtein ?? "?"}g | Carbs: ${uc.remainingCarbs ?? uc.targetCarbs ?? "?"}g | Fat: ${uc.remainingFat ?? uc.targetFat ?? "?"}g`,
          `MEALS LOGGED: ${mealsStr}`,
        ].join("\n");
      }

      const coachSystemPrompt = `You are Sia — a sharp, no-nonsense Siamese cat sports nutritionist inside the SiaMeal app. You have the knowledge of a certified sports dietitian and the directness of a high-performance coach.

━━ LIVE ATHLETE CONTEXT ━━
${contextBlock}

━━ EXPERTISE ━━
You are an expert in: calorie & macro tracking, body recomposition, muscle gain, fat loss, sports nutrition, meal timing, micronutrients, hydration, and food substitutions. You apply evidence-based principles (Mifflin-St Jeor TDEE, protein targets at 1.6–2.2g/kg for muscle, deficit/surplus pacing).

━━ COACHING BEHAVIOUR ━━
- Reference the athlete's ACTUAL remaining macros and logged meals when giving advice — make it personal.
- Always give specific, actionable answers. Never vague non-answers.
- If the athlete is low on protein, prioritise protein. If they are over calories, suggest light options.
- Suggest real whole foods first, not supplements.
- If a deficit is aggressive or a surplus is excessive, flag it once and move on — do not lecture.
- Never shame the athlete for food choices. Be encouraging but honest.
- When suggesting meals, include approximate macros (e.g., "~35g protein, ~400kcal").
- For lists of meal ideas, limit to 3–5 options — do not dump 10+ options.

━━ RESPONSE FORMAT ━━
- Keep replies concise: 2–5 sentences for simple questions, bullet points for meal lists or multi-step plans.
- Use **bold** only for food names, key numbers, or critical warnings.
- Always use numerals (27g, 2000kcal, 3 meals) — never spell out numbers as words.
- No emojis. No sign-offs like "Hope this helps!" or "Feel free to ask!".
- Do not start replies with "Great question" or any hollow filler phrase.
- Do not repeat back what the athlete just said.

━━ OUTPUT RULES (ABSOLUTE) ━━
- Output ONLY your direct spoken reply. Nothing else.
- NEVER include labels, headers, role tags, or internal metadata in your output.
- NEVER re-state the athlete's profile stats unless directly asked.
- NEVER break character.

━━ SCOPE GUARDRAIL ━━
- You only discuss: nutrition, food, macros, calories, hydration, meal planning, body composition, and food-related topics.
- If asked about anything outside this scope, reply with one short sentence declining and redirect to nutrition.`;



      function sanitizeCoachOutput(raw: string): string {
        if (!raw) return "";
        let text = raw.trim();

        text = text.replace(/<thought>[\s\S]*?<\/thought>/gi, "");
        text = text.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "");

        // If output contains a role split marker, take the text after the last one
        const markers = [
          /(?:Direct Spoken Response(?: from Sia)?|Response from Sia|Sia's Response|Sia:\s*)/i,
          /(?:Assistant:\s*|Model:\s*|Response:\s*|Output:\s*)/i,
        ];
        for (const m of markers) {
          if (m.test(text)) {
            const parts = text.split(m);
            const tail = parts[parts.length - 1]?.trim();
            if (tail) text = tail;
          }
        }

        // Filter out any metadata lines
        text = text
          .split("\n")
          .filter((line) => !/^(?:[-*•]\s*)?(?:\*\*)?(?:User|Athlete|Tone|Status|Telemetry|Context|Goal|Calories|Protein|Carbs|Fat|Meals|Scope|Sia)(?:\*\*)?\s*:/i.test(line.trim()))
          .filter((line) => !/^(?:ATHLETE|INTERNAL CONTEXT|OUTPUT RULES|CONVERSATIONAL)/i.test(line.trim()))
          .join("\n")
          .trim();

        text = text.replace(/^(?:Sia\s*\([^)]*\)|Sia|Assistant|Coach|Model)\s*:\s*/i, "").trim();
        return text;
      }

      let replyText = "";
      const debugErrors: string[] = [];

      // 1. Google Gemini Provider — dynamic model discovery (same as analyze handler)
      if (geminiKey) {
        let candidateModels: string[] = [];

        // Discover available models from the API first
        try {
          const listResp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey.trim()}`
          );
          if (listResp.ok) {
            const listData = await listResp.json();
            candidateModels = (listData.models || [])
              .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
              .map((m: any) => m.name.replace(/^models\//, ""))
              // Prefer flash models; skip embedding / aqa / etc.
              .filter((name: string) => /flash|pro/.test(name));
          }
        } catch (e: any) {
          console.warn("Chat model discovery error:", e.message);
        }

        // Fallback hardcoded list if discovery fails
        if (candidateModels.length === 0) {
          candidateModels = [
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-1.5-flash",
          ];
        }

        // Sort: flash first, newest first (higher version numbers first)
        candidateModels.sort((a, b) => {
          const aFlash = a.includes("flash");
          const bFlash = b.includes("flash");
          if (aFlash && !bFlash) return -1;
          if (!aFlash && bFlash) return 1;
          // Within same tier, sort descending by version string
          return b.localeCompare(a);
        });

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
            // Attempt 1: Multi-turn format with system_instruction
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

            // Attempt 2: Single-turn fallback if multi-turn rejected
            if (!resp.ok) {
              const lastUserText = [...messages].reverse().find((m) => m.role === "user")?.content?.trim() || "Hi Sia!";
              const singlePrompt = `${coachSystemPrompt}\n\nAthlete says: "${lastUserText}"\n\nRespond directly as Sia:`;

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
              const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
              const sanitized = sanitizeCoachOutput(rawText);

              if (sanitized) {
                replyText = sanitized;
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
            const rawContent = data.choices?.[0]?.message?.content || "";
            replyText = sanitizeCoachOutput(rawContent);
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
