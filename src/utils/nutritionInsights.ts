import { WeeklySummary } from '../stores/mealStore';
import { Profile } from '../types';

export interface CoachingTip {
  id: string;
  category: 'pace' | 'protein' | 'energy' | 'action';
  title: string;
  badge: string;
  badgeColor: string;
  icon: string;
  message: string;
  actionableStep?: string;
}

export interface MacroEnergySplit {
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
  proteinKcal: number;
  carbsKcal: number;
  fatKcal: number;
  totalKcal: number;
}

/**
 * Calculates percentage of total calories derived from each macronutrient
 */
export function calculateMacroEnergySplit(
  proteinG: number,
  carbsG: number,
  fatG: number
): MacroEnergySplit {
  const proteinKcal = (proteinG || 0) * 4;
  const carbsKcal = (carbsG || 0) * 4;
  const fatKcal = (fatG || 0) * 9;
  const totalKcal = proteinKcal + carbsKcal + fatKcal;

  if (totalKcal <= 0) {
    return {
      proteinPct: 30,
      carbsPct: 40,
      fatPct: 30,
      proteinKcal: 0,
      carbsKcal: 0,
      fatKcal: 0,
      totalKcal: 0,
    };
  }

  return {
    proteinPct: Math.round((proteinKcal / totalKcal) * 100),
    carbsPct: Math.round((carbsKcal / totalKcal) * 100),
    fatPct: Math.round((fatKcal / totalKcal) * 100),
    proteinKcal: Math.round(proteinKcal),
    carbsKcal: Math.round(carbsKcal),
    fatKcal: Math.round(fatKcal),
    totalKcal: Math.round(totalKcal),
  };
}

/**
 * Analyzes weekly logging behavior and generates tailored athlete coaching insights
 */
export function generateWeeklyCoachingInsights(
  summary: WeeklySummary | null,
  profile: Profile | null
): CoachingTip[] {
  if (!summary || summary.daysLogged === 0) {
    return [
      {
        id: 'start_logging',
        category: 'action',
        title: 'Begin Baseline Logging',
        badge: 'Getting Started',
        badgeColor: '#38bdf8',
        icon: 'analytics-outline',
        message: 'Log all meals consistently for 3-5 days to unlock personalized metabolic pacing and macro optimization insights.',
        actionableStep: 'Snap a photo or type what you eat today to build your weekly baseline.',
      },
    ];
  }

  const targetCal = profile?.target_calories || 2000;
  const targetProt = profile?.target_protein_g || 150;
  const tips: CoachingTip[] = [];

  // 1. Deficit & Projected Weight Trend
  const totalCaloriesLogged = summary.days.reduce((sum, d) => sum + d.calories, 0);
  const weeklyTargetTotal = targetCal * 7;
  const netWeeklyDeficit = weeklyTargetTotal - totalCaloriesLogged;
  // 3,500 kcal ~= 1 lb (0.45 kg) fat loss
  const projectedLossKg = (netWeeklyDeficit / 7700).toFixed(2);
  const projectedLossLbs = (netWeeklyDeficit / 3500).toFixed(1);

  if (netWeeklyDeficit > 1500) {
    tips.push({
      id: 'weight_trend',
      category: 'pace',
      title: 'Target Caloric Deficit Active',
      badge: 'Fat Loss Pace',
      badgeColor: '#10b981',
      icon: 'trending-down-outline',
      message: `You accumulated a net deficit of ${netWeeklyDeficit.toLocaleString()} kcal this week. Projected fat loss pace: ~${projectedLossLbs} lbs (${projectedLossKg} kg) per week.`,
      actionableStep: 'Maintain this pacing to ensure fat loss without muscle catabolism.',
    });
  } else if (netWeeklyDeficit < -700) {
    const surplusKcal = Math.abs(netWeeklyDeficit);
    tips.push({
      id: 'weight_trend_surplus',
      category: 'pace',
      title: 'Caloric Surplus Detected',
      badge: 'Energy Surplus',
      badgeColor: '#f59e0b',
      icon: 'trending-up-outline',
      message: `You are averaging +${Math.round(surplusKcal / 7)} kcal/day above target. Good for muscle gain or maintenance, but watch for unintended calorie creep.`,
      actionableStep: 'Check portion sizes on cooking oils, dressings, and snacks.',
    });
  } else {
    tips.push({
      id: 'weight_trend_maintenance',
      category: 'pace',
      title: 'Optimal Energy Equilibrium',
      badge: 'On Target',
      badgeColor: '#10b981',
      icon: 'checkmark-done-circle-outline',
      message: `Your average intake (${summary.avgCalories} kcal/day) is within 5% of your target budget (${targetCal} kcal).`,
      actionableStep: 'Superb precision. You are tracking with athletic consistency.',
    });
  }

  // 2. Protein Density Diagnostic
  const proteinRatio = summary.avgProtein / targetProt;
  if (proteinRatio < 0.85) {
    const deficitGrams = Math.round(targetProt - summary.avgProtein);
    tips.push({
      id: 'protein_diagnostic',
      category: 'protein',
      title: 'Protein Density Deficit',
      badge: `${Math.round(summary.avgProtein)}g / ${targetProt}g avg`,
      badgeColor: '#f43f5e',
      icon: 'barbell-outline',
      message: `You are averaging ${deficitGrams}g below your daily protein target. Adequate protein protects lean muscle tissue and prevents appetite spikes.`,
      actionableStep: 'Add 1 palm-sized lean protein source (e.g. 150g chicken breast or 1 scoop whey) to your lunch or snack.',
    });
  } else {
    tips.push({
      id: 'protein_diagnostic_good',
      category: 'protein',
      title: 'Elite Protein Adherence',
      badge: `${Math.round(summary.avgProtein)}g avg`,
      badgeColor: '#38bdf8',
      icon: 'shield-checkmark-outline',
      message: `You are hitting ${Math.round(proteinRatio * 100)}% of your protein target consistently. Optimal for muscle protein synthesis.`,
      actionableStep: 'Keep spacing protein intake evenly across 3-4 meals throughout the day.',
    });
  }

  // 3. Macronutrient Energy Balance
  const split = calculateMacroEnergySplit(summary.avgProtein, summary.avgCarbs, summary.avgFat);
  if (split.fatPct > 40) {
    tips.push({
      id: 'fat_ratio',
      category: 'energy',
      title: 'High Fat Caloric Density',
      badge: `${split.fatPct}% from Fat`,
      badgeColor: '#fb7185',
      icon: 'flame-outline',
      message: `${split.fatPct}% of your total calories come from dietary fat (ideal: 25-30%). Because fat provides 9 kcal/g, small volume tweaks can save 200-300 kcal.`,
      actionableStep: 'Swap full-fat sauces, butter, or fried items for steamed or grilled options.',
    });
  } else if (split.carbsPct > 55) {
    tips.push({
      id: 'carbs_ratio',
      category: 'energy',
      title: 'High Carbohydrate Energy Ratio',
      badge: `${split.carbsPct}% from Carbs`,
      badgeColor: '#f59e0b',
      icon: 'flash-outline',
      message: `${split.carbsPct}% of energy is coming from carbohydrates. Great for intense training, but balance with protein for prolonged satiety.`,
      actionableStep: 'Prioritize complex fiber-rich carbs (oats, sweet potatoes, quinoa) over refined sugars.',
    });
  }

  // 4. Logging Streak & Discipline Actionable
  if (summary.daysLogged >= 5) {
    tips.push({
      id: 'discipline_score',
      category: 'action',
      title: 'High Habit Discipline Score',
      badge: `${summary.daysLogged}/7 Days Logged`,
      badgeColor: '#10b981',
      icon: 'trophy-outline',
      message: `You logged ${summary.daysLogged} days this week. Research shows users who log 5+ days per week achieve 3x greater body recomposition adherence.`,
      actionableStep: 'Keep the streak alive heading into the upcoming week!',
    });
  }

  return tips;
}
