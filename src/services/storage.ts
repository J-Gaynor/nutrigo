import { FoodProfile, DailyLog, DailyLogEntry, NutritionInfo, UserGoals, WorkoutEntry, ExerciseEntry, WorkoutExercise, WorkoutRoutine, SetPerformance, SavedMeal } from '../types/food';
import { UserProfile } from '../types/user';
import { auth, db } from '../config/firebase';
import {
    doc, // Kept doc as it's used extensively and not explicitly removed by the provided Code Edit
    setDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    collection,
    query,
    where,
    orderBy, // Added as per instruction
    limit, // Added as per instruction
    getDocs,
    Timestamp, // Added as per instruction
    orderBy as firestoreOrderBy // Added as per instruction
} from "firebase/firestore";

// Helper to get today's date in YYYY-MM-DD format
export const getTodayDate = (): string => {
    const today = new Date();
    return today.toISOString().split('T')[0];
};

// --- Helpers ---
const getUserId = () => {
    const user = auth.currentUser;
    if (!user) {
        console.warn('No authenticated user found while accessing storage.');
        return null;
    }
    return user.uid;
};

// --- Food Profiles ---
// Stored in users/{uid}/foods/{foodId} for custom foods
// Global cache could be done, but for now stick to user-specific + global lookup
export const saveFoodProfile = async (food: FoodProfile): Promise<void> => {
    const uid = getUserId();
    if (!uid) return;

    try {
        await setDoc(doc(db, "users", uid, "foods", food.id), food);
    } catch (error) {
        console.error('Error saving food profile:', error);
        throw error;
    }
};

export const getAllFoodProfiles = async (): Promise<FoodProfile[]> => {
    const uid = getUserId();
    if (!uid) return [];

    try {
        const q = query(collection(db, "users", uid, "foods"));
        const querySnapshot = await getDocs(q);
        const foods: FoodProfile[] = [];
        querySnapshot.forEach((doc) => {
            foods.push(doc.data() as FoodProfile);
        });
        return foods;
    } catch (error) {
        console.error('Error getting food profiles:', error);
        return [];
    }
};

export const getFoodByBarcode = async (barcode: string): Promise<FoodProfile | null> => {
    const uid = getUserId();
    if (!uid) return null;

    try {
        const q = query(
            collection(db, "users", uid, "foods"),
            where("barcode", "==", barcode),
            limit(1)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            return querySnapshot.docs[0].data() as FoodProfile;
        }
        return null;
    } catch (error) {
        console.error('Error getting food by barcode:', error);
        return null;
    }
};

export const searchUserFoods = async (searchQuery: string): Promise<FoodProfile[]> => {
    const uid = getUserId();
    if (!uid) return [];

    try {
        // Firestore doesn't support substring search natively.
        // For a small personal database, fetching all and filtering in-memory is acceptable and fast.
        const allFoods = await getAllFoodProfiles();
        const lowerQuery = searchQuery.toLowerCase();

        return allFoods.filter(food =>
            food.name.toLowerCase().includes(lowerQuery) ||
            (food.brand && food.brand.toLowerCase().includes(lowerQuery))
        );
    } catch (error) {
        console.error('Error searching user foods:', error);
        return [];
    }
};

export const deleteFoodProfile = async (id: string): Promise<void> => {
    const uid = getUserId();
    if (!uid) return;

    try {
        await deleteDoc(doc(db, "users", uid, "foods", id));
    } catch (error) {
        console.error('Error deleting food profile:', error);
        throw error;
    }
};

// --- Saved Meals (Premium) ---
// Stored in users/{uid}/saved_meals/{id}
export const saveSavedMeal = async (meal: SavedMeal): Promise<void> => {
    const uid = getUserId();
    if (!uid) return;

    try {
        await setDoc(doc(db, "users", uid, "saved_meals", meal.id), meal);
    } catch (error) {
        console.error('Error saving meal:', error);
        throw error;
    }
};

export const getSavedMeals = async (): Promise<SavedMeal[]> => {
    const uid = getUserId();
    if (!uid) return [];

    try {
        const q = query(collection(db, "users", uid, "saved_meals"));
        const querySnapshot = await getDocs(q);
        const meals: SavedMeal[] = [];
        querySnapshot.forEach((doc) => {
            meals.push(doc.data() as SavedMeal);
        });
        return meals;
    } catch (error) {
        console.error('Error getting saved meals:', error);
        return [];
    }
};

export const deleteSavedMeal = async (id: string): Promise<void> => {
    const uid = getUserId();
    if (!uid) return;

    try {
        await deleteDoc(doc(db, "users", uid, "saved_meals", id));
    } catch (error) {
        console.error('Error deleting saved meal:', error);
        throw error;
    }
};

// --- Daily Logs ---
// Stored in users/{uid}/logs/{date}
export const getDailyLog = async (date: string): Promise<DailyLog> => {
    const uid = getUserId();
    if (!uid) {
        // Return empty log if no user (safety fallbacks)
        return {
            date,
            entries: [],
            exercises: [],
            workouts: [],
            totals: { calories: 0, protein: 0, carbs: 0, fats: 0 },
        };
    }

    try {
        const docRef = doc(db, "users", uid, "logs", date);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data() as DailyLog;
        }

        return {
            date,
            entries: [],
            exercises: [],
            workouts: [],
            totals: { calories: 0, protein: 0, carbs: 0, fats: 0 },
        };
    } catch (error) {
        console.error('Error getting daily log:', error);
        return {
            date,
            entries: [],
            exercises: [],
            workouts: [],
            totals: { calories: 0, protein: 0, carbs: 0, fats: 0 },
        };
    }
};

// Helper for saving full log
const saveDailyLog = async (date: string, log: DailyLog): Promise<void> => {
    const uid = getUserId();
    if (!uid) return;
    try {
        await setDoc(doc(db, "users", uid, "logs", date), log);
    } catch (error) {
        console.error('Error saving daily log:', error);
        throw error;
    }
};

export const addExerciseToLog = async (
    date: string,
    name: string,
    caloriesBurned: number,
    durationMinutes: number,
    exerciseId?: string
): Promise<void> => {
    try {
        const log = await getDailyLog(date);
        const entry = {
            id: Date.now().toString(),
            exerciseId,
            name,
            caloriesBurned,
            durationMinutes,
            timestamp: new Date().toISOString(),
        };
        if (!log.exercises) log.exercises = [];
        log.exercises.push(entry);

        await saveDailyLog(date, log);
    } catch (error) {
        console.error('Error adding exercise to log:', error);
        throw error;
    }
};

export const removeExerciseFromLog = async (date: string, exerciseId: string): Promise<void> => {
    try {
        const log = await getDailyLog(date);
        if (log.exercises) {
            log.exercises = log.exercises.filter(e => e.id !== exerciseId);
        }
        await saveDailyLog(date, log);
    } catch (error) {
        console.error('Error removing exercise from log:', error);
        throw error;
    }
};

export const saveFullWorkoutToLog = async (
    date: string,
    workout: WorkoutEntry,
    syncExercises: boolean = false
): Promise<void> => {
    try {
        const log = await getDailyLog(date);
        if (!log.workouts) log.workouts = [];

        // Check if workout already exists (update) or is new (add)
        const existingIdx = log.workouts.findIndex(w => w.id === workout.id);
        if (existingIdx !== -1) {
            log.workouts[existingIdx] = workout;
        } else {
            log.workouts.push(workout);
        }

        // Always ensure log.exercises is initialized
        if (!log.exercises) log.exercises = [];

        // REMOVE any existing synced exercises for this workoutId first
        // This ensures if syncExercises is FALSE (e.g. non-premium), we clean up any accidental syncs
        log.exercises = log.exercises.filter(ex => ex.workoutId !== workout.id);

        // Only sync exercises to nutrition page if explicitly requested
        if (syncExercises) {
            // Then, add a single entry for the entire workout session if it has calories
            if (workout.caloriesBurned && workout.caloriesBurned > 0) {
                const syncedEntry: ExerciseEntry = {
                    id: `sync-${workout.id}`,
                    name: `Workout: ${workout.name}`,
                    caloriesBurned: workout.caloriesBurned,
                    durationMinutes: workout.durationMinutes || 0,
                    timestamp: new Date().toISOString(),
                    workoutId: workout.id
                };
                log.exercises.push(syncedEntry);
            }
        }

        await saveDailyLog(date, log);
    } catch (error) {
        console.error('Error saving full workout to log:', error);
        throw error;
    }
};

export const completeWorkout = async (
    date: string,
    workoutId: string,
    exerciseId: string,
    performance: SetPerformance[],
    syncToLog: boolean = false
): Promise<void> => {
    try {
        const log = await getDailyLog(date);
        const workout = log.workouts?.find(w => w.id === workoutId);

        if (!workout) {
            throw new Error('Workout not found');
        }

        // Find and update the exercise with performance data
        const exercise = workout.exercises.find(ex => ex.id === exerciseId);
        if (exercise) {
            exercise.performance = performance;
            exercise.completed = true;
        }

        // Save the updated workout (and respect sync setting)
        await saveFullWorkoutToLog(date, workout, syncToLog);
    } catch (error) {
        console.error('Error completing workout exercise:', error);
        throw error;
    }
};

export const finishWorkout = async (
    date: string,
    workoutId: string
): Promise<void> => {
    try {
        const log = await getDailyLog(date);
        const workout = log.workouts?.find(w => w.id === workoutId);

        if (!workout) {
            throw new Error('Workout not found');
        }

        // Mark as completed
        workout.completed = true;

        // Now sync exercises to nutrition page
        await saveFullWorkoutToLog(date, workout, true);
    } catch (error) {
        console.error('Error finishing workout:', error);
        throw error;
    }
};

export const addWorkoutToLog = async (
    date: string,
    name: string,
    caloriesBurned: number,
    durationMinutes: number
): Promise<string> => {
    try {
        const log = await getDailyLog(date);
        const entry: WorkoutEntry = {
            id: Date.now().toString(),
            name,
            caloriesBurned,
            durationMinutes,
            timestamp: new Date().toISOString(),
            exercises: [],
            completed: false, // Start as incomplete
        };
        if (!log.workouts) log.workouts = [];
        log.workouts.push(entry);

        await saveDailyLog(date, log);
        return entry.id;
    } catch (error) {
        console.error('Error adding workout to log:', error);
        throw error;
    }
};

export const removeWorkoutFromLog = async (date: string, workoutId: string): Promise<void> => {
    try {
        const log = await getDailyLog(date);

        // Remove the workout session
        if (log.workouts) {
            log.workouts = log.workouts.filter(w => w.id !== workoutId);
        }

        // Remove all synced exercises that belonged to this workout
        if (log.exercises) {
            log.exercises = log.exercises.filter(ex => ex.workoutId !== workoutId);
        }

        await saveDailyLog(date, log);
    } catch (error) {
        console.error('Error removing workout from log:', error);
        throw error;
    }
};

export const getWorkoutById = async (date: string, workoutId: string): Promise<WorkoutEntry | null> => {
    try {
        const log = await getDailyLog(date);
        if (!log || !log.workouts) {
            console.log(`No workouts found for date ${date}`);
            return null;
        }
        const workout = log.workouts.find(w => w.id === workoutId);
        if (!workout) {
            console.log(`Workout ${workoutId} not found in log for ${date}. Available IDs: ${log.workouts.map(w => w.id).join(', ')}`);
        }
        return workout || null;
    } catch (error) {
        console.error('Error getting workout by id:', error);
        return null;
    }
};

export const addExerciseToWorkout = async (
    date: string,
    workoutId: string,
    exercise: Omit<WorkoutExercise, 'id'>,
    syncToLog: boolean = false
): Promise<void> => {
    try {
        const log = await getDailyLog(date);
        const workout = log.workouts?.find(w => w.id === workoutId);
        if (workout) {
            const exerciseId = Date.now().toString();
            const newExercise: WorkoutExercise = {
                ...exercise,
                id: exerciseId,
            };
            if (!workout.exercises) workout.exercises = [];
            workout.exercises.push(newExercise);

            // Sync to the daily log's exercise list for nutrition/calorie tracking IF requested
            if (syncToLog) {
                const syncedExercise: ExerciseEntry = {
                    id: `sync-${exerciseId}`, // Unique ID for the synced entry
                    name: exercise.name,
                    caloriesBurned: 0, // Calories are tracked at the Workout session level
                    durationMinutes: exercise.durationMinutes || 0,
                    timestamp: new Date().toISOString(),
                    workoutId: workoutId // Link it to the session
                };
                if (!log.exercises) log.exercises = [];
                log.exercises.push(syncedExercise);
            }

            await saveDailyLog(date, log);
        }
    } catch (error) {
        console.error('Error adding exercise to workout:', error);
        throw error;
    }
};

export const removeExerciseFromWorkout = async (
    date: string,
    workoutId: string,
    exerciseId: string
): Promise<void> => {
    try {
        const log = await getDailyLog(date);
        const workout = log.workouts?.find(w => w.id === workoutId);
        if (workout && workout.exercises) {
            workout.exercises = workout.exercises.filter(e => e.id !== exerciseId);

            // Also remove from synced exercises
            if (log.exercises) {
                log.exercises = log.exercises.filter(ex => ex.id !== `sync-${exerciseId}`);
            }

            await saveDailyLog(date, log);
        }
    } catch (error) {
        console.error('Error removing exercise from workout:', error);
        throw error;
    }
};

export const updateExerciseInWorkout = async (
    date: string,
    workoutId: string,
    exerciseId: string,
    updatedData: Partial<WorkoutExercise>
): Promise<void> => {
    try {
        const log = await getDailyLog(date);
        const workout = log.workouts?.find(w => w.id === workoutId);
        if (workout && workout.exercises) {
            const exerciseIndex = workout.exercises.findIndex(e => e.id === exerciseId);
            if (exerciseIndex !== -1) {
                workout.exercises[exerciseIndex] = {
                    ...workout.exercises[exerciseIndex],
                    ...updatedData,
                };

                // Update synced exercise in the daily log
                if (log.exercises) {
                    const syncedIndex = log.exercises.findIndex(ex => ex.id === `sync-${exerciseId}`);
                    if (syncedIndex !== -1) {
                        log.exercises[syncedIndex] = {
                            ...log.exercises[syncedIndex],
                            name: updatedData.name || log.exercises[syncedIndex].name,
                            durationMinutes: updatedData.durationMinutes !== undefined
                                ? updatedData.durationMinutes
                                : log.exercises[syncedIndex].durationMinutes,
                        };
                    }
                }

                await saveDailyLog(date, log);
            }
        }
    } catch (error) {
        console.error('Error updating exercise in workout:', error);
        throw error;
    }
};

export const incrementWorkoutPrCount = async (date: string, workoutId: string): Promise<void> => {
    try {
        const log = await getDailyLog(date);
        const workout = log.workouts?.find(w => w.id === workoutId);
        if (workout) {
            workout.newPrs = (workout.newPrs || 0) + 1;
            await saveDailyLog(date, log);
        }
    } catch (error) {
        console.error('Error incrementing workout PR count:', error);
        // Don't throw, just log. Non-critical.
    }
};


export const addFoodToLog = async (
    date: string,
    food: FoodProfile,
    servings: number = 1,
    mealCategory: string = 'Snacks & Drinks'
): Promise<void> => {
    try {
        const log = await getDailyLog(date);

        const entry: DailyLogEntry = {
            id: Date.now().toString(),
            foodId: food.id,
            foodName: food.name,
            nutrition: {
                calories: food.nutrition.calories * servings,
                protein: food.nutrition.protein * servings,
                carbs: food.nutrition.carbs * servings,
                fats: food.nutrition.fats * servings,
            },
            timestamp: new Date().toISOString(),
            servings,
            mealCategory,
        };

        log.entries.push(entry);
        log.totals = calculateTotals(log.entries);
        await saveDailyLog(date, log);
    } catch (error) {
        console.error('Error adding food to log:', error);
        throw error;
    }
};

export const removeEntryFromLog = async (date: string, entryId: string): Promise<void> => {
    try {
        const log = await getDailyLog(date);
        log.entries = log.entries.filter(e => e.id !== entryId);
        log.totals = calculateTotals(log.entries);
        await saveDailyLog(date, log);
    } catch (error) {
        console.error('Error removing entry from log:', error);
        throw error;
    }
};

export const removeMealSectionEntries = async (date: string, mealCategory: string): Promise<void> => {
    try {
        const log = await getDailyLog(date);
        log.entries = log.entries.filter(e => e.mealCategory !== mealCategory);
        log.totals = calculateTotals(log.entries);
        await saveDailyLog(date, log);
    } catch (error) {
        console.error('Error removing meal section entries:', error);
        throw error;
    }
};

/**
 * Finds the most recent log (within last 30 days) that has entries for a specific category.
 */
export const getLastMealEntries = async (category: string, beforeDate: string, maxDaysBack: number = 30): Promise<{ date: string, entries: DailyLogEntry[] } | null> => {
    const uid = getUserId();
    if (!uid) return null;

    try {
        const logsRef = collection(db, "users", uid, "logs");

        // INDEX-FREE QUERY: Get all logs, no query constraints
        // This is 100% guaranteed not to require any indexes
        const querySnapshot = await getDocs(logsRef);

        // Calculate the cutoff date for maxDaysBack
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - maxDaysBack);
        const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

        // Get all logs and sort by date descending in memory
        const sortedLogs = querySnapshot.docs
            .map(doc => ({ id: doc.id, data: doc.data() as DailyLog }))
            .sort((a, b) => b.id.localeCompare(a.id)); // Sort by date descending

        // Find the first log that matches our criteria
        for (const { id: date, data: log } of sortedLogs) {
            // Must be strictly before the target date
            if (date >= beforeDate) continue;

            // Must be within the allowed history window
            if (date < cutoffDateStr) break; // Can stop here since sorted descending

            if (log && log.entries) {
                const entries = log.entries.filter(e => e.mealCategory === category);
                if (entries.length > 0) {
                    return { date, entries };
                }
            }
        }
        return null;
    } catch (error) {
        console.error('Error getting last meal entries:', error);
        return null;
    }
};

/**
 * Sets the admin status for the current user. (Used for recovery)
 */
export const setAdminStatus = async (isAdmin: boolean): Promise<void> => {
    const uid = getUserId();
    if (!uid) return;

    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().userProfile) {
            const currentProfile = docSnap.data().userProfile as UserProfile;
            await updateDoc(docRef, {
                userProfile: {
                    ...currentProfile,
                    isAdmin
                }
            });
        }
    } catch (error) {
        console.error('Error setting admin status:', error);
        throw error;
    }
};

/**
 * Adds multiple food entries to a specific log.
 * REFACTOR: Legacy wrapper that generates IDs for backward compatibility.
 * Use addEntriesToLog for direct control over IDs.
 */
export const bulkAddFoodsToLog = async (
    date: string,
    entriesToClone: DailyLogEntry[],
    mealCategory: string
): Promise<void> => {
    // Generate IDs here
    const newEntries: DailyLogEntry[] = entriesToClone.map(entry => ({
        ...entry,
        id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
        timestamp: new Date().toISOString(),
        mealCategory // Ensure category stays consistent
    }));

    return addEntriesToLog(date, newEntries);
};

/**
 * Direct write of entries to log. IDs must be pre-generated.
 * Use this when you need optimistic updates to match DB exactly.
 */
export const addEntriesToLog = async (
    date: string,
    newEntries: DailyLogEntry[]
): Promise<void> => {
    try {
        const log = await getDailyLog(date);
        log.entries.push(...newEntries);
        log.totals = calculateTotals(log.entries);
        await saveDailyLog(date, log);
    } catch (error) {
        console.error('Error adding entries to log:', error);
        throw error;
    }
};

// Helper to calculate totals
const calculateTotals = (entries: DailyLogEntry[]): NutritionInfo => {
    return entries.reduce(
        (totals, entry) => ({
            calories: totals.calories + entry.nutrition.calories,
            protein: totals.protein + entry.nutrition.protein,
            carbs: totals.carbs + entry.nutrition.carbs,
            fats: totals.fats + entry.nutrition.fats,
        }),
        { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );
};

// --- Meal Configuration ---
// Stored in users/{uid} document under 'mealSections' field (or separate, but doc is easier)
const DEFAULT_MEALS = ['Meal 1', 'Meal 2', 'Meal 3', 'Snacks & Drinks'];

export const getMealSections = async (): Promise<string[]> => {
    const uid = getUserId();
    if (!uid) return DEFAULT_MEALS;

    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().mealSections) {
            return docSnap.data().mealSections;
        }
        return DEFAULT_MEALS;
    } catch (error) {
        return DEFAULT_MEALS;
    }
};

export const saveMealSections = async (sections: string[]): Promise<void> => {
    const uid = getUserId();
    if (!uid) return;
    try {
        await setDoc(doc(db, "users", uid), { mealSections: sections }, { merge: true });
    } catch (error) {
        console.error('Error saving meal config:', error);
    }
};

// --- User Goals ---
// Stored in users/{uid}/goals/current (or just inside user doc)
// Let's store inside user doc for simplicity: users/{uid} -> field: userGoals
export const getUserGoals = async (): Promise<UserGoals> => {
    const uid = getUserId();
    const defaultGoals = {
        dailyCalories: 2000,
        dailyProtein: 150,
        dailyCarbs: 200,
        dailyFats: 65,
    };

    if (!uid) return defaultGoals;

    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().userGoals) {
            return docSnap.data().userGoals;
        }
        return defaultGoals;
    } catch (error) {
        console.error('Error getting user goals:', error);
        return defaultGoals;
    }
};

export const saveUserGoals = async (goals: UserGoals): Promise<void> => {
    const uid = getUserId();
    if (!uid) return;
    try {
        await setDoc(doc(db, "users", uid), { userGoals: goals }, { merge: true });
    } catch (error) {
        console.error('Error saving user goals:', error);
        throw error;
    }
};

// --- Username Management ---
// Collection: usernames/{username} -> { uid: string }
export const checkUsernameAvailable = async (username: string): Promise<boolean> => {
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) return false;

    try {
        const docRef = doc(db, "usernames", cleanUsername);
        const docSnap = await getDoc(docRef);
        return !docSnap.exists();
    } catch (error) {
        console.error('Error checking username:', error);
        throw error;
    }
};

export const reserveUsername = async (username: string, uid: string): Promise<void> => {
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) return;

    try {
        await setDoc(doc(db, "usernames", cleanUsername), { uid });
    } catch (error) {
        console.error('Error reserving username:', error);
        throw error;
    }
};

export const releaseUsername = async (username: string): Promise<void> => {
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) return;

    try {
        await deleteDoc(doc(db, "usernames", cleanUsername));
    } catch (error) {
        console.error('Error releasing username:', error);
        // Don't throw, just log
    }
};

// --- User Profile ---
// Stored in users/{uid} -> field: userProfile
export const getUserProfile = async (): Promise<UserProfile | null> => {
    const uid = getUserId();
    if (!uid) return null;

    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().userProfile) {
            return docSnap.data().userProfile;
        }
        return null;
    } catch (error) {
        console.error('Error getting user profile:', error);
        return null;
    }
};

export const saveUserProfile = async (profile: UserProfile): Promise<void> => {
    const uid = getUserId();
    if (!uid) return;

    try {
        const goals: UserGoals = {
            dailyCalories: profile.targetMacros.calories,
            dailyProtein: profile.targetMacros.protein,
            dailyCarbs: profile.targetMacros.carbs,
            dailyFats: profile.targetMacros.fats,
        };

        // Save both profile and goals atomically
        await setDoc(doc(db, "users", uid), {
            userProfile: profile,
            userGoals: goals
        }, { merge: true });


    } catch (error) {
        console.error('Error saving user profile:', error);
        throw error;
    }
};

export const updatePersonalRecord = async (exerciseName: string, oneRepMax: number): Promise<boolean> => {
    const uid = getUserId();
    if (!uid) return false;

    try {
        const profile = await getUserProfile();
        if (!profile) return false;

        const currentRecords = profile.personalRecords || {};
        const currentPr = currentRecords[exerciseName] || 0;

        // If new 1RM is higher, update it
        if (oneRepMax > currentPr) {
            const updatedProfile = {
                ...profile,
                personalRecords: {
                    ...currentRecords,
                    [exerciseName]: oneRepMax
                }
            };
            await saveUserProfile(updatedProfile);
            return true;
        }

        return false;
    } catch (error) {
        console.error('Error updating personal record:', error);
        return false;
    }
};

export const clearUserProfile = async (): Promise<void> => {
    // For cloud, we might delete the user doc, but usually we just sign out.
    // Implementing delete if needed:
    const uid = getUserId();
    if (!uid) return;
    try {
        // Just clear fields or delete doc? Let's sign out mostly handles this on client
        // await deleteDoc(doc(db, "users", uid));
        await auth.signOut();
    } catch (error) {
        console.error('Error clearing user profile:', error);
        throw error;
    }
};

// --- Workout Routines ---

export const saveWorkoutAsRoutine = async (workout: WorkoutEntry): Promise<void> => {
    const uid = getUserId();
    if (!uid) return;

    try {
        const routinesRef = collection(db, "users", uid, "workoutRoutines");
        const querySnapshot = await getDocs(routinesRef);
        let existingRoutineId = null;

        // Check if routine with same name exists
        querySnapshot.forEach((doc) => {
            const data = doc.data() as WorkoutRoutine;
            if (data.name.trim().toLowerCase() === workout.name.trim().toLowerCase()) {
                existingRoutineId = doc.id;
            }
        });

        const routineId = existingRoutineId || Date.now().toString();
        // Remove exercise IDs from the template so they get new ones when instantiated
        const routineExercises = workout.exercises.map(({ id, ...rest }) => rest);

        const routine: WorkoutRoutine = {
            id: routineId,
            name: workout.name,
            exercises: routineExercises,
            defaultDurationMinutes: workout.durationMinutes,
            defaultCaloriesBurned: workout.caloriesBurned,
            createdAt: new Date().toISOString(),
        };

        const routineRef = doc(db, "users", uid, "workoutRoutines", routineId);
        await setDoc(routineRef, routine);
    } catch (error) {
        console.error('Error saving workout as routine:', error);
        throw error;
    }
};

export const getWorkoutRoutines = async (): Promise<WorkoutRoutine[]> => {
    const uid = getUserId();
    if (!uid) return [];

    try {
        const routinesRef = collection(db, "users", uid, "workoutRoutines");
        const q = query(routinesRef);
        const querySnapshot = await getDocs(q);

        return querySnapshot.docs.map(doc => doc.data() as WorkoutRoutine);
    } catch (error) {
        console.error('Error getting workout routines:', error);
        return [];
    }
};

export const deleteWorkoutRoutine = async (routineId: string): Promise<void> => {
    const uid = getUserId();
    if (!uid) return;

    try {
        const routineRef = doc(db, "users", uid, "workoutRoutines", routineId);
        await deleteDoc(routineRef);
    } catch (error) {
        console.error('Error deleting workout routine:', error);
        throw error;
    }
};

export const addWorkoutFromRoutine = async (date: string, routine: WorkoutRoutine, syncToLog: boolean = false): Promise<string> => {
    try {
        const log = await getDailyLog(date);

        const workoutId = Date.now().toString();
        const newWorkout: WorkoutEntry = {
            id: workoutId,
            name: routine.name,
            durationMinutes: routine.defaultDurationMinutes || 0,
            caloriesBurned: routine.defaultCaloriesBurned || 0,
            timestamp: new Date().toISOString(),
            exercises: (routine.exercises || []).map((ex, index) => ({
                ...ex,
                id: `${Date.now()}-${index}`
            })),
            completed: false, // Start as incomplete
        };

        if (!log.workouts) log.workouts = [];
        log.workouts.push(newWorkout);

        // Sync all exercises from the routine to the nutrition log IF requested
        if (syncToLog) {
            if (!log.exercises) log.exercises = [];
            newWorkout.exercises.forEach(ex => {
                log.exercises!.push({
                    id: `sync-${ex.id}`,
                    name: ex.name,
                    caloriesBurned: 0,
                    durationMinutes: ex.durationMinutes || 0,
                    timestamp: new Date().toISOString(),
                    workoutId: workoutId
                });
            });
        }

        await saveDailyLog(date, log);
        return newWorkout.id;
    } catch (error) {
        console.error('Error adding workout from routine:', error);
        throw error;
    }
};

// --- Helper to find last performance of an exercise ---
export const getLastExercisePerformance = async (exerciseName: string, beforeDate: string): Promise<SetPerformance[] | null> => {
    const uid = getUserId();
    if (!uid) return null;

    try {
        // Look back 60 days
        const beforeDateObj = new Date(beforeDate);

        for (let i = 0; i <= 60; i++) {
            const checkDateObj = new Date(beforeDateObj);
            checkDateObj.setDate(checkDateObj.getDate() - i);
            const checkDate = checkDateObj.toISOString().split('T')[0];

            const log = await getDailyLog(checkDate);

            // Check workouts first (iterate in reverse to get latest)
            if (log.workouts && log.workouts.length > 0) {
                for (let j = log.workouts.length - 1; j >= 0; j--) {
                    const workout = log.workouts[j];
                    if (workout.exercises) {
                        const exercise = workout.exercises.find(
                            ex => ex.name.trim().toLowerCase() === exerciseName.trim().toLowerCase() && ex.completed && ex.performance
                        );
                        if (exercise && exercise.performance && exercise.performance.length > 0) {
                            return exercise.performance;
                        }
                    }
                }
            }
        }
        return null;
    } catch (error) {
        console.error('Error getting last exercise performance:', error);
        return null;
    }
};

// --- Get Exercise History ---
export const getExerciseHistory = async (exerciseName: string, limit: number = 10): Promise<{ date: string; performance: SetPerformance[] }[]> => {
    const uid = getUserId();
    if (!uid) return [];

    try {
        const history: { date: string; performance: SetPerformance[] }[] = [];
        const today = new Date(); // Start from today

        // Look back up to 90 days
        for (let i = 0; i <= 90; i++) {
            if (history.length >= limit) break;

            const checkDateObj = new Date(today);
            checkDateObj.setDate(checkDateObj.getDate() - i);
            const checkDate = checkDateObj.toISOString().split('T')[0];

            const log = await getDailyLog(checkDate);

            if (log.workouts && log.workouts.length > 0) {
                // Check workouts in reverse order (latest first)
                for (let j = log.workouts.length - 1; j >= 0; j--) {
                    const workout = log.workouts[j];
                    if (workout.exercises) {
                        const exercise = workout.exercises.find(
                            ex => ex.name.trim().toLowerCase() === exerciseName.trim().toLowerCase() && ex.completed && ex.performance
                        );
                        if (exercise && exercise.performance && exercise.performance.length > 0) {
                            history.push({
                                date: checkDate,
                                performance: exercise.performance
                            });
                            if (history.length >= limit) break;
                        }
                    }
                }
            }
        }
        return history;
    } catch (error) {
        console.error('Error getting exercise history:', error);
        return [];
    }
};

export const getRecentWorkouts = async (limitDays: number = 7): Promise<WorkoutRoutine[]> => {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];

    try {
        const recentLogs: DailyLog[] = [];
        const today = new Date();

        // Fetch logs for the last N days
        for (let i = 0; i < limitDays; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const log = await getDailyLog(dateStr);
            if (log.workouts && log.workouts.length > 0) {
                recentLogs.push(log);
            }
        }

        const history: WorkoutRoutine[] = [];
        const seenNames = new Set<string>();

        // Extract unique workout templates from logs
        recentLogs.forEach(log => {
            log.workouts?.forEach(w => {
                const nameKey = w.name.trim().toLowerCase();
                if (!seenNames.has(nameKey) && w.exercises && w.exercises.length > 0) {
                    seenNames.add(nameKey);
                    history.push({
                        id: `hist-${w.id}`,
                        name: w.name,
                        exercises: w.exercises.map(({ id, ...rest }) => rest),
                        defaultDurationMinutes: w.durationMinutes,
                        defaultCaloriesBurned: w.caloriesBurned,
                        createdAt: w.timestamp
                    });
                }
            });
        });

        return history;
    } catch (error) {
        console.error('Error getting recent workouts:', error);
        return [];
    }
};

