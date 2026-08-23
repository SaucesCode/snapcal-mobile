import React from 'react';
import { View, Text, Dimensions, TouchableOpacity } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Line } from 'react-native-svg';
import { WeightEntry } from '../stores/weightStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 72; // Padding accounting
const CHART_HEIGHT = 130;

interface WeightTrendChartProps {
  entries: WeightEntry[];
  unit: 'kg' | 'lbs';
  targetWeight?: number;
}

export function WeightTrendChart({ entries, unit, targetWeight }: WeightTrendChartProps) {
  if (!entries || entries.length === 0) {
    return (
      <View className="h-32 bg-zinc-950/60 rounded-2xl items-center justify-center border border-zinc-800/60">
        <Text className="text-zinc-500 text-xs font-semibold">
          No weight entries recorded yet
        </Text>
        <Text className="text-zinc-600 text-[10px] mt-1">
          Log your morning weigh-in to render your trend line
        </Text>
      </View>
    );
  }

  // Convert values if lbs
  const displayFactor = unit === 'lbs' ? 2.20462 : 1;
  const recentEntries = entries.slice(-14); // Last 14 entries max for crisp rendering

  const weights = recentEntries.map((e) => e.weight_kg * displayFactor);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const paddingY = Math.max(1, (maxWeight - minWeight) * 0.2);
  const chartMin = Math.max(0, minWeight - paddingY);
  const chartMax = maxWeight + paddingY;
  const range = chartMax - chartMin || 1;

  const points = weights.map((w, index) => {
    const x = recentEntries.length === 1
      ? CHART_WIDTH / 2
      : (index / (recentEntries.length - 1)) * (CHART_WIDTH - 30) + 15;
    const y = CHART_HEIGHT - ((w - chartMin) / range) * (CHART_HEIGHT - 30) - 15;
    return { x, y, weight: w };
  });

  // Build SVG Path
  let pathD = '';
  let fillD = '';
  if (points.length === 1) {
    pathD = `M ${points[0].x - 10} ${points[0].y} L ${points[0].x + 10} ${points[0].y}`;
  } else {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpX1 = prev.x + (curr.x - prev.x) / 2;
      const cpY1 = prev.y;
      const cpX2 = prev.x + (curr.x - prev.x) / 2;
      const cpY2 = curr.y;
      pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${curr.x} ${curr.y}`;
    }
    // Gradient fill area
    fillD = `${pathD} L ${points[points.length - 1].x} ${CHART_HEIGHT} L ${points[0].x} ${CHART_HEIGHT} Z`;
  }

  const latestWeight = weights[weights.length - 1];
  const firstWeight = weights[0];
  const delta = Math.round((latestWeight - firstWeight) * 10) / 10;

  return (
    <View>
      {/* Chart Header Vitals */}
      <View className="flex-row items-baseline justify-between mb-2 px-1">
        <View className="flex-row items-baseline gap-1.5">
          <Text
            style={{ fontFamily: 'Outfit_900Black' }}
            className="text-white text-2xl tracking-tight"
          >
            {latestWeight.toFixed(1)}
          </Text>
          <Text className="text-zinc-500 text-xs font-bold uppercase">{unit}</Text>
        </View>

        <View className="flex-row items-center gap-1.5">
          <Text className="text-zinc-500 text-[10px] font-bold uppercase">Change:</Text>
          <Text
            style={{ fontFamily: 'Outfit_800ExtraBold' }}
            className={`text-xs ${
              delta < 0 ? 'text-emerald-400' : delta > 0 ? 'text-amber-400' : 'text-zinc-400'
            }`}
          >
            {delta > 0 ? `+${delta.toFixed(1)}` : `${delta.toFixed(1)}`} {unit}
          </Text>
        </View>
      </View>

      {/* SVG Canvas */}
      <View style={{ width: CHART_WIDTH, height: CHART_HEIGHT }} className="self-center my-1">
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
          <Defs>
            <LinearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
              <Stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </LinearGradient>
          </Defs>

          {/* Background Grid Lines */}
          <Line
            x1="10"
            y1={CHART_HEIGHT / 2}
            x2={CHART_WIDTH - 10}
            y2={CHART_HEIGHT / 2}
            stroke="#27272a"
            strokeDasharray="4 4"
            strokeWidth="1"
          />

          {/* Gradient Fill Under Curve */}
          {fillD ? <Path d={fillD} fill="url(#chartGradient)" /> : null}

          {/* Smooth Trend Curve */}
          <Path
            d={pathD}
            fill="none"
            stroke="#10b981"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Points */}
          {points.map((p, idx) => (
            <Circle
              key={idx}
              cx={p.x}
              cy={p.y}
              r={idx === points.length - 1 ? 5 : 3.5}
              fill={idx === points.length - 1 ? '#34d399' : '#10b981'}
              stroke="#09090b"
              strokeWidth="2"
            />
          ))}
        </Svg>
      </View>
    </View>
  );
}
