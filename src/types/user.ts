export type ActivityLevel = 'none' | 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Gender = 'male' | 'female';
export type Goal = 'lose' | 'maintain' | 'gain';
export type DietPace = 'slow' | 'normal' | 'fast';
export type UserType = 'casual' | 'athletic';

export interface UserProfile {
    id: string;
    name: string;
    username?: string;
    gender: Gender;
    age: number;
    height: number; // in cm
    weight: number; // in kg
    targetWeight: number; // in kg
    activityLevel: ActivityLevel;
    goal: Goal;
    dietPace: DietPace;
    userType: UserType;
    tdee: number; // Calculated Total Daily Energy Expenditure
    targetMacros: {
        calories: number;
        protein: number;
        carbs: number;
        fats: number;
    };
    dateOfBirth?: string; // ISO Date String (YYYY-MM-DD)
    language?: 'en' | 'ja' | 'es' | 'zh';
    createdAt: string;
    personalRecords?: Record<string, number>; // Map of exercise name to 1RM weight

    // Subscription
    isPremium?: boolean;
    isAdmin?: boolean; // Manual override for premium access
    subscriptionStatus?: 'active' | 'expired' | 'grace_period' | 'none';
}
