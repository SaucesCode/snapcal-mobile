import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface MacroRadialPillProps {
  label: string;
  consumed: number;
  target: number;
  strokeColor: string;
  badgeBg: string;
  badgeText: string;
  gradientId: string;
  gradStart: string;
  gradEnd: string;
}

function MacroRadialPill({
  label,
  consumed,
  target,
  badgeBg,
  badgeText,
  gradientId,
  gradStart,
  gradEnd,
}: MacroRadialPillProps) {
  const percentage = target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0;
  const isOver = consumed > target;
  const remaining = Math.max(0, target - consumed);

  // SVG Mini Ring Dimensions
  const size = 58;
  const strokeWidth = 5.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const animatedStroke = useRef(new Animated.Value(circumference)).current;

  useEffect(() => {
    const strokeOffset = circumference - (percentage / 100) * circumference;
    Animated.timing(animatedStroke, {
      toValue: strokeOffset,
      duration: 850,
      useNativeDriver: false,
    }).start();
  }, [percentage, circumference]);

  return (
    <View className="flex-1 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-3 items-center">
      {/* Category Pill Tag */}
      <View className={`px-2 py-0.5 rounded-md border ${badgeBg} mb-2`}>
        <Text className={`text-[9px] font-black uppercase tracking-wider ${badgeText}`}>
          {label}
        </Text>
      </View>

      {/* Mini SVG Progress Ring with Centered Grams */}
      <View className="items-center justify-center my-1">
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={gradStart} />
                <Stop offset="100%" stopColor={gradEnd} />
              </LinearGradient>
            </Defs>

            {/* Background Ring Track */}
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#18181b"
              strokeWidth={strokeWidth}
              fill="transparent"
            />

            {/* Animated Active Ring */}
            <AnimatedCircle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={isOver ? '#fb7185' : `url(#${gradientId})`}
              strokeWidth={strokeWidth}
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={animatedStroke}
              strokeLinecap="round"
              fill="transparent"
              rotation="-90"
              origin={`${size / 2}, ${size / 2}`}
            />
          </Svg>

          {/* Centered Consumed Value */}
          <Text
            style={{ fontFamily: 'Outfit_900Black' }}
            className="text-white text-sm"
          >
            {Math.round(consumed)}g
          </Text>
        </View>
      </View>

      {/* Target & Percentage */}
      <Text
        style={{ fontFamily: 'Outfit_700Bold' }}
        className="text-zinc-300 text-[11px] mt-1"
      >
        {percentage}% <Text className="text-zinc-500 font-normal">of {Math.round(target)}g</Text>
      </Text>

      {/* Remaining / Over */}
      <Text
        numberOfLines={1}
        className={`text-[9px] font-bold mt-0.5 ${
          isOver ? 'text-rose-400' : 'text-zinc-500'
        }`}
      >
        {isOver ? `+${Math.round(consumed - target)}g over` : `${Math.round(remaining)}g left`}
      </Text>
    </View>
  );
}

interface DailySummaryCardProps {
  targetCalories: number;
  consumedCalories: number;
  protein: { consumed: number; target: number };
  carbs: { consumed: number; target: number };
  fat: { consumed: number; target: number };
}

export function DailyMacroSummary({
  targetCalories,
  consumedCalories,
  protein,
  carbs,
  fat,
}: DailySummaryCardProps) {
  const isOverCalories = consumedCalories > targetCalories;
  const overCaloriesAmount = Math.max(0, consumedCalories - targetCalories);
  const remainingCalories = Math.max(0, targetCalories - consumedCalories);

  const caloriePercentage =
    targetCalories > 0 ? Math.min(100, Math.round((consumedCalories / targetCalories) * 100)) : 0;

  // SVG Dial Dimensions
  const size = 175;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Animated Ring Sweep
  const animatedStroke = useRef(new Animated.Value(circumference)).current;

  useEffect(() => {
    const strokeOffset = circumference - (caloriePercentage / 100) * circumference;
    Animated.timing(animatedStroke, {
      toValue: strokeOffset,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [caloriePercentage, circumference]);

  return (
    <View
      className={`rounded-3xl p-5 mb-4 border ${
        isOverCalories
          ? 'bg-zinc-900/95 border-rose-500/40 shadow-xl shadow-rose-500/10'
          : 'bg-zinc-900/95 border-zinc-800/90 shadow-xl shadow-black/50'
      }`}
    >
      {/* Top Header Tag Row */}
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-2">
          <View
            className={`w-2.5 h-2.5 rounded-full ${
              isOverCalories ? 'bg-rose-500' : 'bg-emerald-500'
            }`}
          />
          <Text className="text-zinc-400 text-[10px] font-extrabold uppercase tracking-widest">
            {isOverCalories ? 'Energy Limit Exceeded' : 'Energy Blueprint'}
          </Text>
        </View>

        <View className="bg-zinc-950 px-2.5 py-1 rounded-xl border border-zinc-800 flex-row items-center gap-1.5">
          <Ionicons
            name="flame"
            size={12}
            color={isOverCalories ? '#fb7185' : '#10b981'}
          />
          <Text
            style={{ fontFamily: 'Outfit_700Bold' }}
            className={`text-[10px] uppercase ${
              isOverCalories ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {isOverCalories ? 'Over Target' : 'Deficit Active'}
          </Text>
        </View>
      </View>

      {/* Hero Concentric Ring Dial & Readout */}
      <View className="items-center justify-center my-2">
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="emeraldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#10b981" />
                <Stop offset="100%" stopColor="#059669" />
              </LinearGradient>
              <LinearGradient id="roseGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#fb7185" />
                <Stop offset="100%" stopColor="#e11d48" />
              </LinearGradient>
            </Defs>

            {/* Background Track Ring */}
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#18181b"
              strokeWidth={strokeWidth}
              fill="transparent"
            />

            {/* Animated Active Progress Ring */}
            <AnimatedCircle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={isOverCalories ? 'url(#roseGradient)' : 'url(#emeraldGradient)'}
              strokeWidth={strokeWidth}
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={animatedStroke}
              strokeLinecap="round"
              fill="transparent"
              rotation="-90"
              origin={`${size / 2}, ${size / 2}`}
            />
          </Svg>

          {/* Central Radial Content */}
          <View className="items-center justify-center">
            <Text
              style={{ fontFamily: 'Outfit_900Black' }}
              className={`text-3xl tracking-tight ${
                isOverCalories ? 'text-rose-400' : 'text-white'
              }`}
            >
              {isOverCalories
                ? `+${Math.round(overCaloriesAmount)}`
                : Math.round(remainingCalories).toLocaleString()}
            </Text>
            <Text
              style={{ fontFamily: 'Outfit_700Bold' }}
              className={`text-[10px] uppercase tracking-wider mt-0.5 ${
                isOverCalories ? 'text-rose-400/90' : 'text-emerald-400'
              }`}
            >
              {isOverCalories ? 'kcal over' : 'kcal remaining'}
            </Text>
            <Text className="text-zinc-500 text-[9px] font-semibold mt-1">
              {caloriePercentage}% of {Math.round(targetCalories)}
            </Text>
          </View>
        </View>
      </View>

      {/* Dual Stats Footer Strip */}
      <View className="flex-row items-center justify-between bg-zinc-950/60 py-2.5 px-4 rounded-2xl border border-zinc-800/50 mb-3.5">
        <View className="flex-row items-center gap-1.5">
          <View className="w-2 h-2 rounded-full bg-emerald-500" />
          <Text className="text-zinc-400 text-xs font-semibold">
            Logged: <Text className="text-white font-bold">{Math.round(consumedCalories).toLocaleString()} kcal</Text>
          </Text>
        </View>

        <View className="flex-row items-center gap-1.5">
          <View className="w-2 h-2 rounded-full bg-zinc-600" />
          <Text className="text-zinc-400 text-xs font-semibold">
            Target: <Text className="text-zinc-300 font-bold">{Math.round(targetCalories).toLocaleString()} kcal</Text>
          </Text>
        </View>
      </View>

      {/* 3 Balanced Animated Macro Rings */}
      <View className="flex-row gap-2.5">
        <MacroRadialPill
          label="Protein"
          consumed={protein.consumed}
          target={protein.target}
          badgeBg="bg-blue-950/60 border-blue-800/50"
          badgeText="text-blue-400"
          strokeColor="#38bdf8"
          gradientId="blueMacroGrad"
          gradStart="#38bdf8"
          gradEnd="#0284c7"
        />

        <MacroRadialPill
          label="Carbs"
          consumed={carbs.consumed}
          target={carbs.target}
          badgeBg="bg-amber-950/60 border-amber-800/50"
          badgeText="text-amber-400"
          strokeColor="#f59e0b"
          gradientId="amberMacroGrad"
          gradStart="#fbbf24"
          gradEnd="#d97706"
        />

        <MacroRadialPill
          label="Fat"
          consumed={fat.consumed}
          target={fat.target}
          badgeBg="bg-rose-950/60 border-rose-800/50"
          badgeText="text-rose-400"
          strokeColor="#fb7185"
          gradientId="roseMacroGrad"
          gradStart="#fb7185"
          gradEnd="#e11d48"
        />
      </View>
    </View>
  );
}
