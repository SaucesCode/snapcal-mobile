import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { WeeklySummary, DayStat } from '../stores/mealStore';
import { Ionicons } from '@expo/vector-icons';
import { hapticFeedback } from '../utils/haptics';

interface WeeklyAdherenceChartProps {
  summary: WeeklySummary | null;
  targetCalories: number;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  weekOffset: number;
  onChangeWeekOffset: (newOffset: number) => void;
}

export function WeeklyAdherenceChart({
  summary,
  targetCalories,
  selectedDate,
  onSelectDate,
  weekOffset,
  onChangeWeekOffset,
}: WeeklyAdherenceChartProps) {
  if (!summary) return null;

  const maxCalories = Math.max(
    targetCalories * 1.25,
    ...summary.days.map((d) => d.calories),
    1800
  );

  const adherenceRate = summary.daysLogged > 0
    ? Math.round(
        (summary.days.filter((d) => d.calories > 0 && d.calories <= targetCalories * 1.08).length /
          Math.max(1, summary.daysLogged)) *
          100
      )
    : 0;

  const netWeeklyDeficit = Math.round(
    targetCalories * 7 - summary.days.reduce((sum, d) => sum + d.calories, 0)
  );

  return (
    <View className="bg-zinc-900/95 border border-zinc-800/90 rounded-3xl p-5 mb-4 shadow-xl shadow-black/50">
      {/* Week Navigation Stepper */}
      <View className="flex-row items-center justify-between mb-4 pb-3 border-b border-zinc-800/70">
        <TouchableOpacity
          onPress={() => {
            hapticFeedback.selection();
            onChangeWeekOffset(weekOffset + 1);
          }}
          activeOpacity={0.7}
          className="w-8 h-8 rounded-xl bg-zinc-950 border border-zinc-800 items-center justify-center"
        >
          <Ionicons name="chevron-back" size={16} color="#e4e4e7" />
        </TouchableOpacity>

        <View className="items-center">
          <Text
            style={{ fontFamily: 'Outfit_700Bold' }}
            className="text-white text-sm"
          >
            {summary.weekLabel || (weekOffset === 0 ? 'Current Rolling 7 Days' : `Week -${weekOffset}`)}
          </Text>
          <Text className="text-zinc-500 text-[10px] font-semibold mt-0.5">
            {summary.daysLogged} of 7 days recorded
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => {
            if (weekOffset > 0) {
              hapticFeedback.selection();
              onChangeWeekOffset(weekOffset - 1);
            }
          }}
          disabled={weekOffset === 0}
          activeOpacity={0.7}
          className={`w-8 h-8 rounded-xl bg-zinc-950 border border-zinc-800 items-center justify-center ${
            weekOffset === 0 ? 'opacity-30' : 'opacity-100'
          }`}
        >
          <Ionicons name="chevron-forward" size={16} color="#e4e4e7" />
        </TouchableOpacity>
      </View>

      {/* 7-Day Interactive Bar Chart */}
      <View className="mb-4">
        <View className="flex-row items-center justify-between mb-3 px-1">
          <Text className="text-zinc-400 text-[10px] font-extrabold uppercase tracking-widest">
            Daily Energy Intake
          </Text>
          <View className="flex-row items-center gap-1.5">
            <View className="w-2 h-2 rounded-full bg-emerald-500" />
            <Text className="text-zinc-400 text-[10px] font-semibold">
              Target: {Math.round(targetCalories).toLocaleString()} kcal
            </Text>
          </View>
        </View>

        {/* Bar Columns Container */}
        <View className="flex-row items-end justify-between h-40 pt-4 pb-1">
          {summary.days.map((day: DayStat) => {
            const isSelected = selectedDate === day.date;
            const isLogged = day.calories > 0;
            const barHeightPct = isLogged
              ? Math.min(100, Math.max(12, Math.round((day.calories / maxCalories) * 100)))
              : 8;

            const isOverBudget = day.calories > targetCalories * 1.08;

            const barFillColor = !isLogged
              ? '#27272a'
              : isOverBudget
              ? '#f43f5e'
              : '#10b981';

            return (
              <TouchableOpacity
                key={day.date}
                onPress={() => {
                  hapticFeedback.selection();
                  onSelectDate(day.date);
                }}
                activeOpacity={0.75}
                className="items-center flex-1 mx-1"
              >
                {/* Calories Readout on Top */}
                <Text
                  className={`text-[9px] font-extrabold mb-1.5 ${
                    isSelected ? 'text-emerald-400 font-black' : 'text-zinc-500'
                  }`}
                >
                  {isLogged ? `${Math.round(day.calories / 100) / 10}k` : '-'}
                </Text>

                {/* Vertical Bar Capsule */}
                <View
                  style={{
                    height: 100,
                    width: '100%',
                    borderRadius: 16,
                    justifyContent: 'flex-end',
                    padding: 2,
                    overflow: 'hidden',
                    backgroundColor: '#09090b',
                    borderWidth: 1.5,
                    borderColor: isSelected ? '#10b981' : '#27272a',
                  }}
                >
                  <View
                    style={{
                      height: `${barHeightPct}%`,
                      width: '100%',
                      borderRadius: 12,
                      backgroundColor: barFillColor,
                    }}
                  />
                </View>

                {/* Day Label */}
                <Text
                  style={{ fontFamily: isSelected ? 'Outfit_700Bold' : 'Outfit_600SemiBold' }}
                  className={`text-[11px] mt-2 ${
                    isSelected ? 'text-emerald-400 font-bold' : 'text-zinc-400'
                  }`}
                >
                  {day.dayLabel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 3 Telemetry Metrics Strip */}
      <View className="flex-row gap-2 pt-3 border-t border-zinc-800/70">
        {/* Weekly Avg */}
        <View className="flex-1 bg-zinc-950/70 border border-zinc-800/70 p-2.5 rounded-2xl items-center">
          <Text className="text-zinc-500 text-[9px] font-bold uppercase tracking-wider">
            Avg Intake
          </Text>
          <Text
            style={{ fontFamily: 'Outfit_800ExtraBold' }}
            className="text-white text-sm mt-0.5"
          >
            {summary.avgCalories} <Text className="text-[10px] text-zinc-500 font-normal">kcal</Text>
          </Text>
        </View>

        {/* Adherence */}
        <View className="flex-1 bg-zinc-950/70 border border-zinc-800/70 p-2.5 rounded-2xl items-center">
          <Text className="text-zinc-500 text-[9px] font-bold uppercase tracking-wider">
            Adherence
          </Text>
          <Text
            style={{ fontFamily: 'Outfit_800ExtraBold' }}
            className={`text-sm mt-0.5 ${adherenceRate >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}
          >
            {adherenceRate}%
          </Text>
        </View>

        {/* Net Deficit */}
        <View className="flex-1 bg-zinc-950/70 border border-zinc-800/70 p-2.5 rounded-2xl items-center">
          <Text className="text-zinc-500 text-[9px] font-bold uppercase tracking-wider">
            Weekly Net
          </Text>
          <Text
            style={{ fontFamily: 'Outfit_800ExtraBold' }}
            className={`text-sm mt-0.5 ${netWeeklyDeficit >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}
          >
            {netWeeklyDeficit >= 0 ? `-${netWeeklyDeficit}` : `+${Math.abs(netWeeklyDeficit)}`} <Text className="text-[10px] text-zinc-500 font-normal">kcal</Text>
          </Text>
        </View>
      </View>
    </View>
  );
}
