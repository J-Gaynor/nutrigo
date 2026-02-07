// Food and nutrition data types

export interface NutritionInfo {
  calories: number;
  protein: number; // grams
  carbs: number; // grams
  fats: number; // grams
  servingSize?: string;
  servingQuantity?: number; // e.g. 1
  servingUnit?: string; // e.g. "cup"
  servingWeight?: number; // e.g. 100 (The nutritional reference amount)
  servingWeightUnit?: string; // e.g. "g"
}

export interface FoodProfile {
  id: string;
  name: string;
  nutrition: NutritionInfo;
  createdAt: string;
  imageUri?: string;
  barcode?: string | null; // Product barcode if scanned
  source: 'user_scanned' | 'user_manual' | 'openfoodfacts' | 'USDA'; // Data source
  isLocalOnly: boolean; // True for user-generated data (privacy)
  language?: string | null; // Language of the nutrition label
  brand?: string | null; // Product brand
}

export interface DailyLogEntry {
  id: string;
  foodId: string;
  foodName: string;
  nutrition: NutritionInfo;
  timestamp: string;
  servings: number;
  mealCategory?: string; // e.g., 'Meal 1', 'Snacks & Drinks'
}

export interface ExerciseEntry {
  id: string;
  exerciseId?: string; // Optional ID for dynamic translation
  name: string;
  caloriesBurned: number;
  durationMinutes: number;
  timestamp: string;
  workoutId?: string; // Links this entry back to a workout session
}

export interface SetPerformance {
  setNumber: number;
  weight: number;
  reps: number;
}

export interface WorkoutExercise {
  id: string;
  name: string;
  sets?: number;
  reps?: number;
  weight?: number;
  durationMinutes?: number;
  restTime?: number; // Rest time between sets in seconds
  performance?: SetPerformance[]; // Actual performance data from workout
  completed?: boolean; // Whether this exercise was completed
}

export interface WorkoutEntry {
  id: string;
  name: string;
  durationMinutes: number;
  caloriesBurned: number;
  timestamp: string;
  exercises: WorkoutExercise[];
  newPrs?: number; // Number of new Personal Records achieving in this workout
  completed?: boolean; // Whether the full workout session was completed
}

export interface WorkoutRoutine {
  id: string;
  name: string;
  exercises: Omit<WorkoutExercise, 'id'>[]; // Exercises as templates
  defaultDurationMinutes?: number;
  defaultCaloriesBurned?: number;
  createdAt: string;
}

export interface DailyLog {
  date: string; // YYYY-MM-DD format
  entries: DailyLogEntry[];
  exercises: ExerciseEntry[];
  workouts: WorkoutEntry[];
  totals: NutritionInfo;
}

export interface UserGoals {
  dailyCalories: number;
  dailyProtein: number;
  dailyCarbs: number;
  dailyFats: number;
}

export interface SavedMeal {
  id: string;
  name: string;
  items: DailyLogEntry[]; // Snapshot of items
  totalNutrition: NutritionInfo;
  createdAt: string;
}
