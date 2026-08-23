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
      return data.reply;
    }

    return 'Paws up! 🐾 I am ready to help with your meals and macros today!';
  } catch (err: any) {
    console.error('Chat Coach service error:', err);
    throw err;
  }
}
