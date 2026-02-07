import { NutritionInfo, WorkoutEntry, WorkoutRoutine, DailyLogEntry } from '../types/food';
import { UserProfile } from '../types/user';
import { DummyFood } from '../data/dummyFoods';

export type RootStackParamList = {
    // Auth Stack
    Login: undefined;
    ProfileSetup: undefined;
    EmailVerification: undefined;
    Success: { metrics: UserProfile };
    Tutorial: { fromProfile: boolean };

    // App Stack
    Paywall: undefined;
    Home: { date?: string; activeTab?: 'nutrition' | 'workout' } | undefined;
    SearchFood: { mealCategory: string; date: string; addedEntry?: DailyLogEntry };
    FoodDetail: { food: DummyFood; mealCategory: string; date: string };
    Scanner: { barcode?: string; mealCategory?: string; date?: string } | undefined;
    ManualEntry: {
        nutrition?: NutritionInfo;
        foodName?: string;
        barcode?: string;
        source?: 'user_scanned' | 'user_manual';
        language?: string;
        mealCategory?: string;
        date?: string;
        confidence?: 'high' | 'medium' | 'low';
    };
    FoodList: { mealCategory?: string; date?: string } | undefined;
    BarcodeScanner: { mealCategory?: string; date?: string } | undefined;
    ProductResult: { product: any; mealCategory?: string; date?: string };
    Profile: undefined;
    AddExercise: { date?: string } | undefined;
    AddWorkout: { date?: string } | undefined;
    AddWorkoutExercise: { date: string; workoutId?: string; newExercise?: any; workoutName?: string; onSubmit?: (exercise: any) => void };
    WorkoutDetail: { date: string; workoutId?: string; workoutName?: string; newExercise?: any };
    WorkoutExecute: { date: string; workoutId?: string; routine?: WorkoutRoutine };
    ExerciseLog: {
        date: string;
        workoutId: string;
        exerciseId: string;
        exerciseName: string;
        sets: number;
        restTime?: number;
        exerciseIndex: number;
        totalExercises: number;
        startTime?: number;
    };
    WorkoutSummary: {
        date: string;
        workoutId: string;
        startTime?: number;
    };
    ParserTest: undefined;
};
