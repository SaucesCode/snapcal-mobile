import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../lib/supabase';
import { AnalyzeMealResponse } from '../types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
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
 * Compresses an image strictly according to technical constraints:
 * - Max width/height of 512px
 * - JPEG quality 0.5
 * - Base64 encoded output
 */
export async function compressImage(uri: string): Promise<{ base64: string; uri: string }> {
  const manipResult = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 512 } }],
    {
      compress: 0.5,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    }
  );

  if (!manipResult.base64) {
    throw new Error('Failed to generate base64 representation of image');
  }

  return {
    base64: manipResult.base64,
    uri: manipResult.uri,
  };
}

async function extractErrorMessage(error: any): Promise<string> {
  let errorMsg = error?.message || 'Failed to communicate with AI';
  if (error && 'context' in error && error.context) {
    try {
      const errorJson = await error.context.json();
      errorMsg =
        errorJson.error ||
        errorJson.message ||
        errorJson.details ||
        JSON.stringify(errorJson);
    } catch {
      try {
        const errorText = await error.context.text();
        if (errorText) errorMsg = errorText;
      } catch {}
    }
  }
  return errorMsg;
}

/**
 * Sends compressed image base64 to Supabase Edge Function 'analyze-meal'
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
 * Sends conversation and user context to Supabase Edge Function 'analyze-meal'
 * Uses unified payload matching both updated and previous deployed Edge Function specs
 */
export async function sendNutritionCoachMessage(
  messages: { role: 'user' | 'assistant'; content: string }[],
  userContext: UserNutritionContext
): Promise<string> {
  const lastUserMessage =
    [...messages].reverse().find((m) => m.role === 'user')?.content ||
    'Suggest meals according to my macros';

  const telemetryContext = `[NUTRITION COACH QUERY: Athlete has ${userContext.remainingCalories ?? 2000} kcal and ${userContext.remainingProtein ?? 150}g protein remaining today for ${userContext.goal || 'Fitness'}. User asks: "${lastUserMessage}"]`;

  try {
    const { data, error } = await supabase.functions.invoke('analyze-meal', {
      body: {
        mode: 'chat',
        messages,
        userContext,
        textDescription: telemetryContext,
      },
    });

    if (error) {
      const detailedMessage = await extractErrorMessage(error);
      console.error('Chat Coach Edge Function error:', detailedMessage);
      throw new Error(detailedMessage);
    }

    if (data?.reply) {
      return data.reply;
    }

    if (data?.meal_name || data?.calories !== undefined) {
      const title = data.meal_name || 'Nutrition Recommendation';
      const cals = data.calories || 0;
      const p = data.protein_g || 0;
      const c = data.carbs_g || 0;
      const f = data.fat_g || 0;
      const items =
        Array.isArray(data.ingredients) && data.ingredients.length > 0
          ? data.ingredients.map((item: string) => `• ${item}`).join('\n')
          : '';

      return `💡 **${title}**\n\n📊 **Nutrient Breakdown:**\n• **${cals} kcal** | **${p}g Protein** | **${c}g Carbs** | **${f}g Fat**\n\n${
        items ? `📝 **Meal Components:**\n${items}` : ''
      }`;
    }

    return 'I am ready to help optimize your meals and macros.';
  } catch (err: any) {
    console.error('Chat Coach service error:', err);
    throw err;
  }
}
