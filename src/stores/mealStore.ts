import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { uploadMealPhotoToSupabase } from '../lib/storage';
import { Meal, MealType } from '../types';

export interface DayStat {
  date: string; // 'YYYY-MM-DD'
  dayLabel: string; // 'Mon', 'Tue', etc.
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  mealCount: number;
}

export interface WeeklySummary {
  days: DayStat[];
  streakDays: number;
  avgCalories: number;
  avgProtein: number;
  avgCarbs: number;
  avgFat: number;
  daysLogged: number;
  weekOffset?: number;
  weekLabel?: string;
}

interface MealState {
  meals: Meal[];
  selectedDate: string; // 'YYYY-MM-DD'
  weeklySummary: WeeklySummary | null;
  draftMeal: {
    name: string;
    meal_type?: MealType;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    food_items: string[];
    image_url?: string | null;
  } | null;
  isLoading: boolean;
  setSelectedDate: (date: string) => void;
  setDraftMeal: (draft: MealState['draftMeal']) => void;
  fetchMealsForDate: (dateStr?: string) => Promise<void>;
  fetchWeeklyStats: (targetCalories?: number, weekOffset?: number) => Promise<WeeklySummary | null>;
  logMeal: (mealData: {
    name: string;
    meal_type?: MealType;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    food_items: string[];
    image_url?: string | null;
    logged_at?: string;
  }) => Promise<Meal>;
  updateMeal: (id: string, updates: Partial<Meal>) => Promise<Meal>;
  deleteMeal: (id: string) => Promise<void>;
}

const getTodayString = () => new Date().toISOString().split('T')[0];

export const useMealStore = create<MealState>((set, get) => ({
  meals: [],
  selectedDate: getTodayString(),
  weeklySummary: null,
  draftMeal: null,
  isLoading: false,

  setSelectedDate: (date: string) => {
    set({ selectedDate: date });
  },

  setDraftMeal: (draft) => {
    set({ draftMeal: draft });
  },

  fetchMealsForDate: async (dateStr) => {
    const targetDate = dateStr || get().selectedDate;
    set({ isLoading: true });

    try {
      const startOfDay = new Date(`${targetDate}T00:00:00.000Z`).toISOString();
      const endOfDay = new Date(`${targetDate}T23:59:59.999Z`).toISOString();

      const { data, error } = await supabase
        .from('meals')
        .select('*')
        .gte('logged_at', startOfDay)
        .lte('logged_at', endOfDay)
        .order('logged_at', { ascending: false });

      if (error) {
        console.error('Error fetching meals:', error);
        return;
      }

      set({ meals: (data as Meal[]) || [] });
    } catch (err) {
      console.error('Error in fetchMealsForDate:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchWeeklyStats: async (targetCalories = 2000, weekOffset = 0) => {
    try {
      const now = new Date();
      const past7Days: { dateStr: string; label: string; fullDate: Date }[] = [];

      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - (i + weekOffset * 7));
        const dateStr = d.toISOString().split('T')[0];
        const label = d.toLocaleDateString(undefined, { weekday: 'short' });
        past7Days.push({ dateStr, label, fullDate: d });
      }

      const startDateIso = new Date(`${past7Days[0].dateStr}T00:00:00.000Z`).toISOString();
      const endDateIso = new Date(`${past7Days[6].dateStr}T23:59:59.999Z`).toISOString();

      const startFormatted = past7Days[0].fullDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const endFormatted = past7Days[6].fullDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const weekLabel = weekOffset === 0 ? 'Current Week' : `${startFormatted} – ${endFormatted}`;

      const { data, error } = await supabase
        .from('meals')
        .select('*')
        .gte('logged_at', startDateIso)
        .lte('logged_at', endDateIso);

      if (error) {
        console.error('Error fetching weekly meals:', error);
        return null;
      }

      const allMeals: Meal[] = (data as Meal[]) || [];

      // Group by date
      const days: DayStat[] = past7Days.map(({ dateStr, label }) => {
        const dayMeals = allMeals.filter((m) => m.logged_at.startsWith(dateStr));
        const calories = Math.round(
          dayMeals.reduce((sum, m) => sum + (Number(m.calories) || 0), 0)
        );
        const protein_g = Math.round(
          dayMeals.reduce((sum, m) => sum + (Number(m.protein_g) || 0), 0)
        );
        const carbs_g = Math.round(
          dayMeals.reduce((sum, m) => sum + (Number(m.carbs_g) || 0), 0)
        );
        const fat_g = Math.round(
          dayMeals.reduce((sum, m) => sum + (Number(m.fat_g) || 0), 0)
        );

        return {
          date: dateStr,
          dayLabel: label,
          calories,
          protein_g,
          carbs_g,
          fat_g,
          mealCount: dayMeals.length,
        };
      });

      // Calculate streak: consecutive days with mealCount > 0 starting from today or yesterday
      let streakDays = 0;
      const todayDateStr = getTodayString();
      const todayIndex = days.findIndex((d) => d.date === todayDateStr);

      if (todayIndex !== -1) {
        const startIndex = days[todayIndex].mealCount > 0 ? todayIndex : todayIndex - 1;
        for (let i = startIndex; i >= 0; i--) {
          if (days[i].mealCount > 0) {
            streakDays++;
          } else {
            break;
          }
        }
      }

      const loggedDaysList = days.filter((d) => d.mealCount > 0);
      const daysLogged = loggedDaysList.length;

      const totalCal = loggedDaysList.reduce((sum, d) => sum + d.calories, 0);
      const totalProt = loggedDaysList.reduce((sum, d) => sum + d.protein_g, 0);
      const totalCarb = loggedDaysList.reduce((sum, d) => sum + d.carbs_g, 0);
      const totalFat = loggedDaysList.reduce((sum, d) => sum + d.fat_g, 0);

      const summary: WeeklySummary = {
        days,
        streakDays,
        avgCalories: daysLogged > 0 ? Math.round(totalCal / daysLogged) : 0,
        avgProtein: daysLogged > 0 ? Math.round(totalProt / daysLogged) : 0,
        avgCarbs: daysLogged > 0 ? Math.round(totalCarb / daysLogged) : 0,
        avgFat: daysLogged > 0 ? Math.round(totalFat / daysLogged) : 0,
        daysLogged,
        weekOffset,
        weekLabel,
      };

      set({ weeklySummary: summary });
      return summary;
    } catch (err) {
      console.error('Error in fetchWeeklyStats:', err);
      return null;
    }
  },

  logMeal: async (mealData) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    let finalImageUrl = mealData.image_url || null;
    if (finalImageUrl && !finalImageUrl.startsWith('http')) {
      const uploaded = await uploadMealPhotoToSupabase(finalImageUrl, user.id);
      if (uploaded) {
        finalImageUrl = uploaded;
      }
    }

    const newMeal = {
      user_id: user.id,
      name: mealData.name.trim() || 'Meal',
      meal_type: mealData.meal_type || 'snack',
      calories: Number(mealData.calories) || 0,
      protein_g: Number(mealData.protein_g) || 0,
      carbs_g: Number(mealData.carbs_g) || 0,
      fat_g: Number(mealData.fat_g) || 0,
      food_items: mealData.food_items || [],
      image_url: finalImageUrl,
      logged_at: mealData.logged_at || new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('meals')
      .insert(newMeal)
      .select()
      .single();

    if (error) {
      throw error;
    }

    const createdMeal = data as Meal;
    set((state) => ({
      meals: [createdMeal, ...state.meals],
      draftMeal: null,
    }));

    // Refresh weekly stats
    get().fetchWeeklyStats();

    return createdMeal;
  },

  updateMeal: async (id: string, updates: Partial<Meal>) => {
    const { data, error } = await supabase
      .from('meals')
      .update({
        name: updates.name?.trim(),
        meal_type: updates.meal_type,
        calories: updates.calories !== undefined ? Number(updates.calories) : undefined,
        protein_g: updates.protein_g !== undefined ? Number(updates.protein_g) : undefined,
        carbs_g: updates.carbs_g !== undefined ? Number(updates.carbs_g) : undefined,
        fat_g: updates.fat_g !== undefined ? Number(updates.fat_g) : undefined,
        food_items: updates.food_items,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    const updatedMeal = data as Meal;
    set((state) => ({
      meals: state.meals.map((m) => (m.id === id ? updatedMeal : m)),
    }));

    get().fetchWeeklyStats();
    return updatedMeal;
  },

  deleteMeal: async (id: string) => {
    const { error } = await supabase.from('meals').delete().eq('id', id);
    if (error) throw error;

    set((state) => ({
      meals: state.meals.filter((m) => m.id !== id),
    }));

    // Refresh weekly stats
    get().fetchWeeklyStats();
  },
}));
