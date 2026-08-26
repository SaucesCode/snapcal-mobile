import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { MealType } from '../types';
import { hapticFeedback } from '../utils/haptics';

interface QuickLogActionSheetProps {
  visible: boolean;
  mealType: MealType;
  categoryTitle: string;
  categoryIcon: keyof typeof MaterialCommunityIcons.glyphMap;
  categoryColor: string;
  categoryBadgeBg: string;
  onClose: () => void;
  onSelectCamera: (type: MealType) => void;
  onSelectText: (type: MealType) => void;
  onSelectBarcode: (type: MealType) => void;
  onSelectGallery: (type: MealType) => void;
}

export function QuickLogActionSheet({
  visible,
  mealType,
  categoryTitle,
  categoryIcon,
  categoryColor,
  categoryBadgeBg,
  onClose,
  onSelectCamera,
  onSelectText,
  onSelectBarcode,
  onSelectGallery,
}: QuickLogActionSheetProps) {
  if (!visible) return null;

  return (
    <View className="absolute inset-0 z-50 justify-end bg-black/75">
      <View className="bg-zinc-900 border-t border-zinc-800 rounded-t-3xl p-6 pb-10 shadow-2xl">
        {/* Header with Category Badge */}
        <View className="flex-row items-center justify-between mb-5">
          <View className="flex-row items-center gap-2.5">
            <View
              className={`w-9 h-9 rounded-xl ${categoryBadgeBg} items-center justify-center border`}
            >
              <MaterialCommunityIcons name={categoryIcon} size={18} color={categoryColor} />
            </View>
            <View>
              <Text
                style={{ fontFamily: 'Outfit_700Bold' }}
                className="text-white text-lg"
              >
                Log {categoryTitle}
              </Text>
              <Text className="text-zinc-500 text-xs font-semibold">
                Choose your input method
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => {
              hapticFeedback.light();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-zinc-800 items-center justify-center"
          >
            <Ionicons name="close" size={16} color="#a1a1aa" />
          </TouchableOpacity>
        </View>

        {/* Action Grid Options */}
        <View className="gap-2.5 mb-2">
          {/* 1. AI Vision Camera */}
          <TouchableOpacity
            onPress={() => {
              hapticFeedback.medium();
              onClose();
              onSelectCamera(mealType);
            }}
            activeOpacity={0.8}
            className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-emerald-500/20 items-center justify-center">
                <Ionicons name="camera" size={20} color="#10b981" />
              </View>
              <View>
                <Text className="text-white font-bold text-sm">AI Food Photo Scan</Text>
                <Text className="text-zinc-400 text-xs">Instant meal analysis via camera</Text>
              </View>
            </View>
            <View className="bg-emerald-500/20 px-2 py-0.5 rounded-md">
              <Text className="text-emerald-400 text-[10px] font-black uppercase">Fastest</Text>
            </View>
          </TouchableOpacity>

          {/* 2. Photo Library Upload */}
          <TouchableOpacity
            onPress={() => {
              hapticFeedback.medium();
              onClose();
              onSelectGallery(mealType);
            }}
            activeOpacity={0.8}
            className="bg-zinc-950/80 border border-zinc-800/80 p-4 rounded-2xl flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-blue-500/15 items-center justify-center">
                <Ionicons name="images-outline" size={20} color="#60a5fa" />
              </View>
              <View>
                <Text className="text-white font-bold text-sm">Photo Library Upload</Text>
                <Text className="text-zinc-400 text-xs">Select food photo from album</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#71717a" />
          </TouchableOpacity>

          {/* 3. Barcode Scan */}
          <TouchableOpacity
            onPress={() => {
              hapticFeedback.medium();
              onClose();
              onSelectBarcode(mealType);
            }}
            activeOpacity={0.8}
            className="bg-zinc-950/80 border border-zinc-800/80 p-4 rounded-2xl flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-amber-500/15 items-center justify-center">
                <Ionicons name="barcode-outline" size={20} color="#fbbf24" />
              </View>
              <View>
                <Text className="text-white font-bold text-sm">Barcode Scanner</Text>
                <Text className="text-zinc-400 text-xs">Scan packaged foods & nutrition labels</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#71717a" />
          </TouchableOpacity>

          {/* 4. Natural Text Log */}
          <TouchableOpacity
            onPress={() => {
              hapticFeedback.medium();
              onClose();
              onSelectText(mealType);
            }}
            activeOpacity={0.8}
            className="bg-zinc-950/80 border border-zinc-800/80 p-4 rounded-2xl flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-purple-500/15 items-center justify-center border border-purple-500/30">
                <Ionicons name="sparkles-outline" size={20} color="#c084fc" />
              </View>
              <View>
                <Text className="text-white font-bold text-sm">Text Description</Text>
                <Text className="text-zinc-400 text-xs">Type what you ate in natural language</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#71717a" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
