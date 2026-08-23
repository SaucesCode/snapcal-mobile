import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

export function BrandLogo({ size = 'md', showTagline = true }: BrandLogoProps) {
  const iconBoxSize = size === 'lg' ? 'w-16 h-16 rounded-3xl' : size === 'md' ? 'w-12 h-12 rounded-2xl' : 'w-9 h-9 rounded-xl';
  const iconSize = size === 'lg' ? 32 : size === 'md' ? 24 : 18;
  const titleSize = size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-2xl' : 'text-lg';

  return (
    <View className="items-center">
      {/* Cool Icon Badge */}
      <View
        className={`${iconBoxSize} bg-zinc-900 border border-emerald-500/40 items-center justify-center mb-2.5 shadow-lg shadow-emerald-500/20 relative`}
      >
        <View className="absolute inset-0 bg-emerald-500/10 rounded-2xl" />
        <Ionicons name="camera" size={iconSize} color="#10b981" />
        <View className="absolute -top-1 -right-1 bg-emerald-500 w-3 h-3 rounded-full border-2 border-zinc-950" />
      </View>

      {/* Styled Brand Title with Cool Modern Font */}
      <View className="flex-row items-baseline">
        <Text
          style={{ fontFamily: 'Outfit_900Black' }}
          className={`${titleSize} text-white tracking-tight`}
        >
          Snap
        </Text>
        <Text
          style={{ fontFamily: 'Outfit_900Black' }}
          className={`${titleSize} text-emerald-400 tracking-tight ml-0.5`}
        >
          Cal
        </Text>
        <View className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-1 mb-1" />
      </View>

      {showTagline && (
        <Text
          style={{ fontFamily: 'PlusJakartaSans_500Medium' }}
          className="text-zinc-400 text-xs mt-1 font-medium tracking-wide"
        >
          AI Photo-First Nutrition & Macros
        </Text>
      )}
    </View>
  );
}
