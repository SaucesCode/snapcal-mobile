import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { performGoogleOAuth } from '../../utils/oauth';
import { useAuthStore } from '../../stores/authStore';
import { BrandLogo } from '../../components/BrandLogo';
import { Ionicons } from '@expo/vector-icons';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();
  const fetchProfile = useAuthStore((state) => state.fetchProfile);

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Missing Fields', 'Please complete all fields.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters long.');
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        Alert.alert('Registration Failed', error.message);
        return;
      }

      if (data.user) {
        if (data.session) {
          router.replace('/(auth)/onboarding' as any);
        } else {
          Alert.alert(
            'Check your email',
            'A confirmation link has been sent to your email address.',
            [{ text: 'OK', onPress: () => router.replace('/(auth)/login' as any) }]
          );
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      setGoogleLoading(true);
      const res: any = await performGoogleOAuth();
      if (res) {
        const profile = await fetchProfile();
        if (!profile || !profile.target_calories) {
          router.replace('/(auth)/onboarding' as any);
        } else {
          router.replace('/(tabs)' as any);
        }
      }
    } catch (err: any) {
      console.error('Google Sign Up error:', err);
      Alert.alert('Google Sign-Up', err.message || 'Could not authenticate with Google.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-zinc-950"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        className="px-6 py-12"
      >
        {/* Brand Header */}
        <View className="mb-8">
          <BrandLogo size="lg" />
        </View>

        {/* Form Card */}
        <View className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 mb-6">
          {/* Google OAuth Button */}
          <TouchableOpacity
            onPress={handleGoogleSignUp}
            disabled={googleLoading || loading}
            className="bg-zinc-950 border border-zinc-700/80 active:bg-zinc-800 rounded-2xl py-3.5 px-4 flex-row items-center justify-center gap-3 mb-5"
          >
            {googleLoading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color="#ffffff" />
                <Text className="text-white font-bold text-sm">Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View className="flex-row items-center gap-3 mb-5">
            <View className="flex-1 h-px bg-zinc-800" />
            <Text className="text-zinc-500 text-xs font-semibold uppercase">Or with email</Text>
            <View className="flex-1 h-px bg-zinc-800" />
          </View>

          <View className="mb-4">
            <Text className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2">
              Email Address
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#52525b"
              autoCapitalize="none"
              keyboardType="email-address"
              className="bg-zinc-950 border border-zinc-800 text-white rounded-2xl px-4 py-3.5 text-base"
            />
          </View>

          <View className="mb-4">
            <Text className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2">
              Password
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Minimum 6 characters"
              placeholderTextColor="#52525b"
              secureTextEntry
              className="bg-zinc-950 border border-zinc-800 text-white rounded-2xl px-4 py-3.5 text-base"
            />
          </View>

          <View className="mb-6">
            <Text className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2">
              Confirm Password
            </Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter password"
              placeholderTextColor="#52525b"
              secureTextEntry
              className="bg-zinc-950 border border-zinc-800 text-white rounded-2xl px-4 py-3.5 text-base"
            />
          </View>

          <TouchableOpacity
            onPress={handleRegister}
            disabled={loading || googleLoading}
            className="bg-emerald-500 active:bg-emerald-600 rounded-2xl py-4 items-center justify-center"
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white font-bold text-base">Sign Up</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View className="flex-row justify-center items-center">
          <Text className="text-zinc-400 text-sm">Already have an account? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text className="text-emerald-400 font-bold text-sm">Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
