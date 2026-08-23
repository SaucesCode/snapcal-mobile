import { supabase } from './supabase';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Uploads a compressed meal photo to Supabase Storage bucket 'meal-images'
 * and returns the permanent public URL. Falls back to local URI if upload fails.
 */
export async function uploadMealPhotoToSupabase(
  localUri: string,
  userId: string
): Promise<string | null> {
  if (!localUri) return null;

  // If already a remote URL, return as is
  if (localUri.startsWith('http://') || localUri.startsWith('https://')) {
    return localUri;
  }

  try {
    const filename = `${userId}/${Date.now()}.jpg`;

    // Read image as base64
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const arrayBuffer = decode(base64);

    const { data, error } = await supabase.storage
      .from('meal-images')
      .upload(filename, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      console.warn('Supabase storage upload error, keeping local URI fallback:', error.message);
      return localUri;
    }

    const { data: publicUrlData } = supabase.storage
      .from('meal-images')
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.warn('Failed to upload meal photo to Supabase storage:', err);
    return localUri;
  }
}
