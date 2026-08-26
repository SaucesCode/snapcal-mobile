import { supabase } from '../lib/supabase';
import * as ImageManipulator from 'expo-image-manipulator';

export interface AnalyzeMealResponse {
  meal_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface UserNutritionContext {
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
}

/**
 * Compresses an image to max 512px dimension, JPEG quality 0.5, and returns { uri, base64 }.
 */
export async function compressImage(uri: string): Promise<{ uri: string; base64: string }> {
  try {
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 512 } }],
      { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    return {
      uri: manipResult.uri,
      base64: manipResult.base64 || '',
    };
  } catch (error) {
    console.error('Error compressing image:', error);
    throw new Error('Failed to process meal image. Please try again.');
  }
}

/**
 * Extracts a human-readable error message from various Supabase / Edge Function error formats.
 */
async function extractErrorMessage(error: any): Promise<string> {
  if (!error) return 'An unexpected error occurred';

  // 1. Check if error.context is a Response object (common in FunctionsHttpError)
  if (error.context && typeof error.context.json === 'function') {
    try {
      const body = await error.context.json();
      if (body.error) return body.error;
      if (body.message) return body.message;
    } catch {
      // Body might be text instead of json
      try {
        const text = await error.context.text();
        if (text) return text;
      } catch {
        // ignore
      }
    }
  }

  // 2. Standard error message
  if (error.message) {
    return error.message;
  }

  return String(error);
}

/**
 * Sends compressed base64 image to Supabase Edge Function 'analyze-meal'
 */
export async function analyzeMealPhoto(imageBase64: string): Promise<AnalyzeMealResponse> {
  const { data, error } = await supabase.functions.invoke('analyze-meal', {
    body: { imageBase64 },
  });

  if (error) {
    const detailedMessage = await extractErrorMessage(error);
    console.error('Edge Function detailed error:', detailedMessage);
    throw new Error(detailedMessage);
  }

  return data as AnalyzeMealResponse;
}

/**
 * Sends text description fallback to Supabase Edge Function 'analyze-meal'
 */
export async function analyzeMealText(textDescription: string): Promise<AnalyzeMealResponse> {
  const { data, error } = await supabase.functions.invoke('analyze-meal', {
    body: { textDescription },
  });

  if (error) {
    const detailedMessage = await extractErrorMessage(error);
    console.error('Edge Function detailed error:', detailedMessage);
    throw new Error(detailedMessage);
  }

  return data as AnalyzeMealResponse;
}

/**
 * Aggressively sanitizes AI Coach responses on the client side,
 * completely stripping any echoed metadata, telemetry dumps, thoughts,
 * role prefixes, and emojis.
 */
export function cleanCoachReply(raw: string): string {
  if (!raw) return '';
  let text = raw.trim();

  // 1. Remove XML/HTML style thought / reasoning tags
  text = text.replace(/<thought>[\s\S]*?<\/thought>/gi, '');
  text = text.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');

  // 2. If response was split by a template marker, extract text after the last marker
  const responseMarkers = [
    /Direct Spoken Response(?: from Sia)?\s*:/i,
    /Direct Response(?: from Sia)?\s*:/i,
    /Response from Sia\s*:/i,
    /Sia's Response\s*:/i,
    /Spoken Response\s*:/i,
  ];

  for (const marker of responseMarkers) {
    if (marker.test(text)) {
      const parts = text.split(marker);
      const after = parts[parts.length - 1]?.trim();
      if (after && after.length > 0) {
        text = after;
        break;
      }
    }
  }

  // 3. Remove metadata / telemetry lines (prefixed with bullets -, *, numbers, or bold **Label:**)
  const lines = text.split('\n');
  const cleanedLines: string[] = [];
  let skippingHeaderBlock = true;

  const metadataPattern = /^(?:[-*•]\s*)?(?:\*\*)?(?:User(?:\s*Name|\s*Message|\s*Profile|\s*Goal)?|Athlete(?:\s*Name|\s*Message|\s*Stats|\s*Goal)?|Fitness\s*Objective|Diet\s*Style|Diet\s*Type|Daily\s*Calorie\s*Target|Protein\s*Target|Carbs\s*Target|Fat\s*Target|Meals\s*Logged\s*Today|Tone(?:\s*Summary)?|Persona|Thinking\s*Process|Reasoning|Internal\s*Context|Current\s*Status|Telemetry|Objective|Scope|Context|Direct\s*Spoken\s*Response|Response|Output|Sia)(?:\*\*)?\s*:/i;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (!skippingHeaderBlock) {
        cleanedLines.push('');
      }
      continue;
    }

    // Check if line is a metadata header line
    if (metadataPattern.test(trimmed)) {
      continue;
    }

    // Check if line is a section title like "ATHLETE'S CURRENT STATS" or "OUTPUT RULES"
    if (/^(?:ATHLETE['’]?S\s*CURRENT\s*STATS|INTERNAL\s*CONTEXT|OUTPUT\s*RULES|CONVERSATIONAL\s*DYNAMICS|LIVE\s*USER\s*TELEMETRY|CURRENT\s*STATUS)/i.test(trimmed)) {
      continue;
    }

    // First real conversational line found
    skippingHeaderBlock = false;
    cleanedLines.push(line);
  }

  text = cleanedLines.join('\n').trim();

  // 4. Strip any leading role prefixes like "Sia:" or "Assistant:"
  text = text.replace(/^(?:Sia\s*\([^)]*\)|Sia|Assistant|Coach|Model)\s*:\s*/i, '').trim();

  // 5. Remove any unicode emojis
  text = text.replace(/[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/gu, '').trim();

  return text || 'I am ready to help with your meals and daily macronutrient targets.';
}

/**
 * Sends conversation and user context to Supabase Edge Function 'analyze-meal' (Chat Mode)
 */
export async function sendNutritionCoachMessage(
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
  userContext: UserNutritionContext
): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke('analyze-meal', {
      body: {
        mode: 'chat',
        messages,
        userContext,
      },
    });

    if (error) {
      const detailedMessage = await extractErrorMessage(error);
      console.error('Chat Coach Edge Function error:', detailedMessage);
      throw new Error(detailedMessage);
    }

    if (data?.reply) {
      return cleanCoachReply(data.reply);
    }

    return 'I am ready to help with your meals and daily macronutrient targets.';
  } catch (err: any) {
    console.error('Chat Coach service error:', err);
    throw err;
  }
}
