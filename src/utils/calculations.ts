import { ActivityLevel, Gender, Goal, DietPace, UserType } from '../types/user';

/**
 * Calculate Basal Metabolic Rate (BMR) using Mifflin-St Jeor Equation
 */
export const calculateBMR = (
    weight: number, // kg
    height: number, // cm
    age: number, // years
    gender: Gender
): number => {
    // Mifflin-St Jeor Equation
    let bmr = 10 * weight + 6.25 * height - 5 * age;

    if (gender === 'male') {
        bmr += 5;
    } else {
        bmr -= 161;
    }

    return bmr;
};

/**
 * Calculate Total Daily Energy Expenditure (TDEE) based on activity level
 */
export const calculateTDEE = (bmr: number, activityLevel: ActivityLevel): number => {
    const multipliers: Record<ActivityLevel, number> = {
        none: 1.2,           // No activity (Sedentary/Do not include)
        sedentary: 1.2,      // (Legacy)
        light: 1.35,         // Light activity
        moderate: 1.55,      // Moderate activity
        active: 1.75,        // High activity
        very_active: 1.9,    // (Legacy)
    };

    return bmr * multipliers[activityLevel];
};

/**
 * Calculate macro targets based on goal and TDEE
 */
export const calculateMacroTargets = (
    tdee: number,
    goal: Goal,
    targetWeight: number, // Required for protein calculation
    currentWeight: number, // Required for safe protein clamping
    gender: Gender,
    pace: DietPace = 'normal',
    userType: UserType = 'casual'
): { calories: number; protein: number; carbs: number; fats: number } => {
    // 1. Set Calorie Target with Fixed Factors
    let targetCalories = tdee;

    if (goal === 'lose') {
        // Cut: 80% of TDEE (20% deficit)
        targetCalories = tdee * 0.80;
    } else if (goal === 'gain') {
        // Bulk: 115% of TDEE (15% surplus)
        targetCalories = tdee * 1.15;
    } else {
        // Maintain: 100% of TDEE
        targetCalories = tdee;
    }

    // Safety floor removed to strictly follow TDEE multiplier formulas as requested
    // const calorieFloor = gender === 'male' ? 1500 : 1200;
    // targetCalories = Math.max(targetCalories, calorieFloor);


    // 2. Protein First (Based on Clamped Goal Weight)
    // Base Factors:
    // User Type Modifiers: Athletic users get slightly higher protein
    const typeMod = userType === 'athletic' ? 0.2 : 0.0;

    // Factors: 
    // Lose: Base 2.0 (High retention) + mod
    // Gain: Base 2.0 (Hypertrophy) + mod (Note: previously 2.2, now base 2.0 + 0.2 athletic = 2.2)
    // Maintain: Base 1.6 + mod

    let baseFactor = 1.6;
    if (goal === 'lose') baseFactor = 2.0;
    if (goal === 'gain') baseFactor = 2.0; // Athletic will bump to 2.2

    const proteinFactor = baseFactor + typeMod;

    // Safety Clamp: Prevent protein from being too low (dieting from high weight) or too high (gaining from low weight)
    const proteinWeight =
        goal === 'lose'
            ? Math.max(targetWeight, currentWeight * 0.8)
            : goal === 'gain'
                ? Math.min(targetWeight, currentWeight * 1.2)
                : targetWeight;

    // Absolute Ceiling: Prevent unrealistic protein targets for very large users
    const maxProteinGrams = gender === 'male' ? 260 : 220;

    const proteinGrams = Math.min(
        Math.round(proteinWeight * proteinFactor),
        maxProteinGrams
    );
    const proteinCals = proteinGrams * 4;


    // 3. Fat (Adaptive Percentage of calories, with minimum safety floor)
    // Low cals (<1600) -> 30% (Prioritize hormones/satiety)
    // High cals (>2800) -> 20% (Prioritize carbs for performance)
    // Standard -> 25%
    const fatPercentage =
        targetCalories < 1600 ? 0.30 :
            targetCalories > 2800 ? 0.20 :
                0.25;

    let fatCals = targetCalories * fatPercentage;
    let fatGrams = Math.round(fatCals / 9);

    // Safety floor: Minimum 0.6g per kg of goal weight to regulate hormones
    const minFatGrams = Math.round(targetWeight * 0.6);
    if (fatGrams < minFatGrams) {
        fatGrams = minFatGrams;
        fatCals = fatGrams * 9; // Adjust calories reserved for fat
    }

    // 4. Carbs (Fill the rest)
    // Remaining calories go to carbs
    let carbCals = targetCalories - (proteinCals + fatCals);

    // Safety check: ensure carbs don't go negative (edge case with very low TDEE + high protein)
    if (carbCals < 0) {
        carbCals = 0;
        // In this rare edge case, total calories might strictly exceed target slightly
        // to meet protein/fat minimums. Usually acceptable.
        targetCalories = proteinCals + fatCals;
    }

    const carbGrams = Math.round(carbCals / 4);

    return {
        calories: Math.round(targetCalories),
        protein: proteinGrams,
        carbs: carbGrams,
        fats: fatGrams,
    };
};

/**
 * Calculate age from Date of Birth string (YYYY-MM-DD or partial ISO)
 */
export const calculateAge = (dobString: string): number => {
    if (!dobString) return 0;

    const birthDate = new Date(dobString);
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();

    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    return age;
};

export const validateTargetWeight = (
    currentWeightKg: number,
    targetWeightKg: number,
    heightCm: number
): { isValid: boolean; error?: string; min: number; max: number } => {
    const heightM = heightCm / 100;

    // Min: BMI 18
    const minWeight = 18 * (heightM * heightM);

    // Max: Lesser of (BMI 40) OR (Current * 1.3)
    const bmi40 = 40 * (heightM * heightM);
    const maxGain = currentWeightKg * 1.3;

    // If current weight is already > bmi40, cap at current weight (no gain allowed)
    // Otherwise, cap at the lesser of bmi40 or maxGain
    const maxWeight = currentWeightKg > bmi40 ? currentWeightKg : Math.min(bmi40, maxGain);

    if (targetWeightKg < minWeight) {
        return {
            isValid: false,
            error: `Target weight is too low (BMI < 18).\nMinimum safe weight for your height is ${minWeight.toFixed(1)}kg.`,
            min: minWeight,
            max: maxWeight
        };
    }

    if (targetWeightKg > maxWeight) {
        // Customize error based on which limit was hit
        const isBmiLimit = maxWeight === bmi40;
        const msg = isBmiLimit
            ? `Target weight is too high (BMI > 40).\nMaximum safe weight for your height is ${maxWeight.toFixed(1)}kg.`
            : `Target gain is too aggressive (>30%).\nMaximum recommended target is ${maxWeight.toFixed(1)}kg.`;

        return {
            isValid: false,
            error: msg,
            min: minWeight,
            max: maxWeight
        };
    }

    return { isValid: true, min: minWeight, max: maxWeight };
};
