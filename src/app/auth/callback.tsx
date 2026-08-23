import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; access_token?: string; refresh_token?: string; error?: string }>();
  const fetchProfile = useAuthStore((state) => state.fetchProfile);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function handleAuth() {
      try {
        if (params.error) {
          setErrorMsg(params.error);
          setTimeout(() => router.replace('/(auth)/login' as any), 2000);
          return;
        }

        // 1. PKCE code exchange
        if (params.code) {
          console.log('[Auth Callback] Exchanging code for session...');
          const { error } = await supabase.auth.exchangeCodeForSession(params.code);
          if (error) throw error;
        }
        // 2. Implicit token session
        else if (params.access_token && params.refresh_token) {
          console.log('[Auth Callback] Setting session from tokens...');
          const { error } = await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          });
          if (error) throw error;
        }

        // 3. Check profile and navigate
        const profile = await fetchProfile();
        if (!profile || !profile.target_calories) {
          router.replace('/(auth)/onboarding' as any);
        } else {
          router.replace('/(tabs)' as any);
        }
      } catch (err: any) {
        console.error('[Auth Callback] Error handling callback:', err);
        setErrorMsg(err.message || 'Authentication failed');
        setTimeout(() => router.replace('/(auth)/login' as any), 2500);
      }
    }

    handleAuth();
  }, [params]);

  return (
    <View className="flex-1 bg-zinc-950 items-center justify-center px-6">
      <ActivityIndicator size="large" color="#10b981" />
      <Text className="text-white font-bold text-base mt-4 text-center">
        {errorMsg ? errorMsg : 'Completing sign in...'}
      </Text>
      <Text className="text-zinc-500 text-xs mt-1 text-center">
        {errorMsg ? 'Redirecting back to login...' : 'Connecting your SnapCal account'}
      </Text>
    </View>
  );
}
