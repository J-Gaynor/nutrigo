import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    SafeAreaView,
    StatusBar,
    Alert,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MacroCard } from '../components/MacroCard';
import { MealSection } from '../components/MealSection';
import { ExerciseSection } from '../components/ExerciseSection';
import { WorkoutView } from '../components/WorkoutView';
import {
    getDailyLog,
    getTodayDate,
    getUserGoals,
    getUserProfile,
    removeEntryFromLog,
    removeExerciseFromLog,
    getMealSections,
    saveMealSections,
    removeMealSectionEntries,
    saveUserProfile,
    saveUserGoals,
    getLastMealEntries,
    bulkAddFoodsToLog,
    removeWorkoutFromLog,
    getRecentWorkouts
} from '../services/storage';
import { calculateBMR, calculateTDEE, calculateMacroTargets } from '../utils/calculations';
import { DailyLog, UserGoals, DailyLogEntry, WorkoutRoutine } from '../types/food';
import { UserProfile, UserType } from '../types/user';
import { RootStackParamList } from '../navigation/types';
import { Toast } from '../components/Toast';
import { RouteProp } from '@react-navigation/native';
import { theme } from '../theme';
import { useSubscription } from '../context/SubscriptionContext';
import { useToast } from '../context/ToastContext';

type HomeScreenProps = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
    route: RouteProp<RootStackParamList, 'Home'>;
};

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation, route }) => {
    const { isPremium } = useSubscription();
    const [dailyLog, setDailyLog] = useState<DailyLog | null>(null);
    const [userGoals, setUserGoals] = useState<UserGoals | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [mealSections, setMealSections] = useState<string[]>([]);
    const [savedRoutines, setSavedRoutines] = useState<WorkoutRoutine[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    // Date Navigation State - Initialized from params if available, otherwise Today
    const [selectedDate, setSelectedDate] = useState<string>(route.params?.date || getTodayDate());

    // Tab switcher state
    const [activeTab, setActiveTab] = useState<'nutrition' | 'workout'>(route.params?.activeTab || 'nutrition');

    // Active Meal Category state
    const [activeMealCategory, setActiveMealCategory] = useState<string | null>(null);

    // Weight Update Modal State
    const [showWeightModal, setShowWeightModal] = useState(false);
    const [userType, setUserType] = useState<UserType>('casual');
    const [availableRepeats, setAvailableRepeats] = useState<Record<string, boolean>>({});
    const [lastMealsData, setLastMealsData] = useState<Record<string, { date: string; count: number }>>({});
    const [newWeight, setNewWeight] = useState('');
    const { incrementPending, decrementPending } = useToast();

    // Persistence: If we returned from a screen with a specific date, stay on that date
    useEffect(() => {
        if (route.params?.date && route.params.date !== selectedDate) {
            setSelectedDate(route.params.date);
        }
        if (route.params?.activeTab && route.params.activeTab !== activeTab) {
            setActiveTab(route.params.activeTab);
        }
    }, [route.params?.date, route.params?.activeTab, selectedDate, activeTab]);

    const loadData = useCallback(async () => {
        // Use selectedDate instead of always Today
        const [log, goals, profile, meals] = await Promise.all([
            getDailyLog(selectedDate),
            getUserGoals(),
            getUserProfile(),
            getMealSections()
        ]);

        setDailyLog(log);
        setUserGoals(goals);
        setUserProfile(profile);
        setMealSections(meals);
        if (profile) {
            setNewWeight(profile.weight.toString());
        }

        // BACKGROUND LOADING of repeat meal data to keep app load fast
        // We do this AFTER the main data load is set
        setTimeout(async () => {
            const daysBack = isPremium ? 30 : 1;
            const repeatResults = await Promise.all(
                meals.map(async (cat) => {
                    const last = await getLastMealEntries(cat, selectedDate, daysBack);
                    return { cat, last };
                })
            );

            const newAvailable: Record<string, boolean> = {};
            const newData: Record<string, { date: string; count: number }> = {};

            repeatResults.forEach(({ cat, last }) => {
                newAvailable[cat] = !!last;
                if (last) {
                    newData[cat] = {
                        date: last.date,
                        count: last.entries.length
                    };
                }
            });

            setAvailableRepeats(newAvailable);
            setLastMealsData(newData);
        }, 0);
    }, [selectedDate, isPremium]);

    // Load workout routines only when workout tab is active
    useEffect(() => {
        if (activeTab === 'workout') {
            const { getWorkoutRoutines } = require('../services/storage');
            getWorkoutRoutines().then(setSavedRoutines);
        }
    }, [activeTab]);

    useFocusEffect(
        useCallback(() => {
            loadData();
            // Reload routines when returning to the screen (e.g. after saving a new one)
            if (activeTab === 'workout') {
                const { getWorkoutRoutines } = require('../services/storage');
                getWorkoutRoutines().then(setSavedRoutines);
            }
        }, [loadData, activeTab])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    // Date Navigation Handlers
    const changeDate = (days: number) => {
        const current = new Date(selectedDate);
        current.setDate(current.getDate() + days);
        const newDate = current.toISOString().split('T')[0];

        const today = getTodayDate();

        // Limit: Max = Today
        if (newDate > today) return;

        // Limit: Min = 7 days ago
        const minDateObj = new Date(today);
        minDateObj.setDate(minDateObj.getDate() - 7);
        const minDate = minDateObj.toISOString().split('T')[0];

        if (newDate < minDate) {
            return;
        }

        setSelectedDate(newDate);
        navigation.setParams({ date: newDate, activeTab });
    };

    const getDisplayDate = () => {
        const today = getTodayDate();
        if (selectedDate === today) return 'Today';

        const dateObj = new Date(selectedDate);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (selectedDate === yesterday.toISOString().split('T')[0]) return 'Yesterday';

        return dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    const handleRemoveEntry = async (entryId: string) => {
        if (!dailyLog) return;

        incrementPending('remove');
        await removeEntryFromLog(selectedDate, entryId);
        await loadData();
        decrementPending('remove');
    };

    const handleAddMealSection = async () => {
        // Generate new meal name (Meal X)
        const newMealNumber = mealSections.filter(m => m.startsWith('Meal')).length + 1;
        const newMealName = `Meal ${newMealNumber}`;

        // Insert before "Snacks & Drinks"
        const newSections = [...mealSections];
        const snackIndex = newSections.indexOf('Snacks & Drinks');
        if (snackIndex !== -1) {
            newSections.splice(snackIndex, 0, newMealName);
        } else {
            newSections.push(newMealName);
        }

        await saveMealSections(newSections);
        await loadData();
    };

    const handleDeleteMealSection = async (sectionToRemove: string) => {
        Alert.alert(
            'Remove Meal',
            `Are you sure you want to remove ${sectionToRemove}? All entries in this meal will be deleted.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        const newSections = mealSections.filter(s => s !== sectionToRemove);
                        await saveMealSections(newSections);

                        // Clean up entries
                        if (dailyLog) {
                            await removeMealSectionEntries(selectedDate, sectionToRemove); // Use selectedDate
                        }

                        await loadData();
                    }
                }
            ]
        );
    };

    const handleRemoveExercise = async (id: string) => {
        if (!dailyLog) return;
        await removeExerciseFromLog(selectedDate, id); // Use selectedDate
        await loadData();
    };

    const handleRemoveWorkout = async (id: string, isRoutine: boolean) => {
        if (!dailyLog) return;

        const title = isRoutine ? "Delete Saved Routine" : "Delete Workout";
        const message = isRoutine
            ? "This will permanently delete this saved workout template."
            : "This will permanently remove this workout from your log.";

        Alert.alert(
            title,
            message,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        if (isRoutine) {
                            const { deleteWorkoutRoutine } = require('../services/storage');
                            await deleteWorkoutRoutine(id);

                            // Also remove any "logged" version of this routine from today's list
                            // so it doesn't "reappear" as an ad-hoc workout
                            // We find it by matching name
                            const routineToCheck = savedRoutines.find(r => r.id === id);
                            if (routineToCheck && dailyLog?.workouts) {
                                const matchingLog = dailyLog.workouts.find(
                                    w => w.name.trim().toLowerCase() === routineToCheck.name.trim().toLowerCase()
                                );
                                if (matchingLog) {
                                    await removeWorkoutFromLog(selectedDate, matchingLog.id);
                                }
                            }
                        } else {
                            await removeWorkoutFromLog(selectedDate, id);
                        }
                        await loadData();
                        // Also reload routines if we deleted one
                        if (isRoutine && activeTab === 'workout') {
                            const { getWorkoutRoutines } = require('../services/storage');
                            getWorkoutRoutines().then(setSavedRoutines);
                        }
                    }
                }
            ]
        );
    };

    const handleUpdateWeight = async () => {
        if (!userProfile || !newWeight) return;

        const weightNum = parseFloat(newWeight);
        if (isNaN(weightNum) || weightNum <= 0) {
            Alert.alert('Invalid Weight', 'Please enter a valid weight.');
            return;
        }

        try {
            let currentGoal = userProfile.goal;
            let currentTargetWeight = userProfile.targetWeight;
            let goalReached = false;

            // Check if goal is reached
            if (currentGoal === 'lose' && weightNum <= currentTargetWeight) {
                goalReached = true;
            } else if (currentGoal === 'gain' && weightNum >= currentTargetWeight) {
                goalReached = true;
            }

            if (goalReached) {
                Alert.alert('Congratulations!', 'You have reached your goal!');
                currentGoal = 'maintain';
                currentTargetWeight = weightNum;
            } else if (currentGoal === 'maintain') {
                // If already maintaining, keep target aligned with current
                currentTargetWeight = weightNum;
            }

            // Recalculate everything
            const bmr = calculateBMR(weightNum, userProfile.height, userProfile.age, userProfile.gender);
            const tdee = calculateTDEE(bmr, userProfile.activityLevel);

            const targets = calculateMacroTargets(tdee, currentGoal, currentTargetWeight, weightNum, userProfile.gender, userProfile.dietPace, userProfile.userType);

            const updatedProfile: UserProfile = {
                ...userProfile,
                weight: weightNum,
                targetWeight: currentTargetWeight,
                goal: currentGoal,
                tdee,
                targetMacros: targets,
            };

            await saveUserProfile(updatedProfile);

            // Update Goals too
            const updatedGoals = {
                dailyCalories: targets.calories,
                dailyProtein: targets.protein,
                dailyCarbs: targets.carbs,
                dailyFats: targets.fats,
            };
            await saveUserGoals(updatedGoals);

            await loadData(); // Reload UI
            setShowWeightModal(false);
            if (!goalReached) {
                Alert.alert('Updated', 'Your weight and daily targets have been updated.');
            }

        } catch (error) {
            console.error('Error updating weight:', error);
            Alert.alert('Error', 'Failed to update weight.');
        }
    };

    const handleRepeatLast = async (category: string) => {
        try {
            const daysBack = isPremium ? 30 : 1;
            const lastData = await getLastMealEntries(category, selectedDate, daysBack);
            if (!lastData || !lastData.entries || lastData.entries.length === 0) {
                Alert.alert('Not Found', 'No previous entries found for this meal.');
                return;
            }

            const { entries } = lastData;

            // GENERATE IDS UPFRONT (Fixes Deletion Bug)
            const newEntries = entries.map(entry => ({
                ...entry,
                id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
                timestamp: new Date().toISOString(),
                mealCategory: category
            }));

            // OPTIMISTIC UPDATE: Add to local state immediately with KNOWN IDs
            if (dailyLog) {
                const updatedLogEntries = [...dailyLog.entries, ...newEntries];
                const newLog = {
                    ...dailyLog,
                    entries: updatedLogEntries,
                    totals: calculateTotals(updatedLogEntries) // Recalc totals immediately
                };
                setDailyLog(newLog);
            }

            // Hide the repeat button immediately to prevent double-click
            const newLastMealsData = { ...lastMealsData };
            delete newLastMealsData[category];
            setLastMealsData(newLastMealsData);
            const newAvailableRepeats = { ...availableRepeats };
            delete newAvailableRepeats[category];
            setAvailableRepeats(newAvailableRepeats);

            // Database write in background (using identical IDs)
            const { addEntriesToLog } = require('../services/storage');
            addEntriesToLog(selectedDate, newEntries).catch((error: any) => {
                console.error('Error repeating last meal:', error);
                Alert.alert('Error', 'Failed to repeat last meal.');
                // On error, reload to restore correct state
                loadData();
            });
        } catch (error) {
            console.error('Error repeating last meal:', error);
            Alert.alert('Error', 'Failed to repeat last meal.');
        }
    };

    // Helper to calculate totals locally for optimistic update
    const calculateTotals = (entries: DailyLogEntry[]) => {
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

    // Helper for 1dp validation
    const handleWeightInput = (text: string) => {
        // Allow decimal point but no more than 1 decimal place
        if (/^\d*\.?\d{0,1}$/.test(text)) {
            setNewWeight(text);
        }
    };

    const handleSaveMeal = async (category: string) => {
        if (!isPremium) {
            navigation.navigate('Paywall');
            return;
        }

        const entries = getEntriesForMeal(category);
        if (entries.length === 0) {
            Alert.alert('Empty Meal', 'Add foods to this meal before saving.');
            return;
        }

        // Prompt for name
        Alert.prompt(
            'Save Meal',
            'Enter a name for this meal (e.g. "Breakfast Special")',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Save',
                    onPress: async (name?: string) => {
                        if (!name) return;
                        try {
                            const { saveSavedMeal } = require('../services/storage');
                            const savedMeal = {
                                id: Date.now().toString(),
                                name,
                                items: entries,
                                totalNutrition: {
                                    calories: getMealCalories(entries),
                                    ...getMealMacros(entries)
                                },
                                createdAt: new Date().toISOString()
                            };
                            await saveSavedMeal(savedMeal);
                            Alert.alert('Success', `Saved "${name}" to your meals.`);
                        } catch (error) {
                            console.error(error);
                            Alert.alert('Error', 'Failed to save meal.');
                        }
                    }
                }
            ],
            'plain-text'
        );
    };

    const openAddFoodModal = (category: string) => {
        // Historical Gating check
        if (selectedDate !== getTodayDate() && !isPremium) {
            navigation.navigate('Paywall');
            return;
        }
        navigation.navigate('SearchFood', { mealCategory: category, date: selectedDate });
    };

    if (!dailyLog || !userGoals || !userProfile) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
        );
    }

    const exerciseCalories = (dailyLog.exercises?.reduce((acc, curr) => acc + curr.caloriesBurned, 0) || 0) +
        (dailyLog.workouts?.reduce((acc, curr) => acc + curr.caloriesBurned, 0) || 0);
    const caloriesRemaining = Math.max(0, (userGoals.dailyCalories + exerciseCalories) - dailyLog.totals.calories);
    const progress = Math.min(1, dailyLog.totals.calories / (userGoals.dailyCalories + exerciseCalories));

    // Filter entries by meal category
    const getEntriesForMeal = (category: string) => {
        return dailyLog.entries.filter(e => {
            // If undefined, default to Snacks & Drinks if that's the category, 
            // or "Snacks & Drinks" is the catch-all
            if (!e.mealCategory) return category === 'Snacks & Drinks';
            return e.mealCategory === category;
        });
    };

    const getMealCalories = (entries: DailyLogEntry[]) => {
        return entries.reduce((acc, curr) => acc + curr.nutrition.calories, 0);
    };

    const getMealMacros = (entries: DailyLogEntry[]) => {
        return entries.reduce((acc, curr) => ({
            protein: acc.protein + curr.nutrition.protein,
            carbs: acc.carbs + curr.nutrition.carbs,
            fats: acc.fats + curr.nutrition.fats,
        }), { protein: 0, carbs: 0, fats: 0 });
    };

    // Greeting
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    return (
        <View style={styles.mainContainer}>
            <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />

            <SafeAreaView style={styles.safeArea}>
                <ScrollView
                    style={styles.scrollView}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
                    }
                    contentContainerStyle={styles.contentContainer}
                >
                    {/* Header Background within ScrollView */}
                    <View style={styles.scrollingHeaderBackground} />

                    {/* Header Section */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.greeting}>{getGreeting()},</Text>
                            <Text style={styles.userName}>{userProfile.name}</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.profileButton}
                            onPress={() => navigation.navigate('Profile')}
                        >
                            <Text style={styles.profileButtonText}>
                                {userProfile.name.charAt(0)}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Date Navigation */}
                    <View style={styles.dateNavContainer}>
                        {(() => {
                            const today = getTodayDate();
                            const minDateObj = new Date(today);
                            minDateObj.setDate(minDateObj.getDate() - 7);
                            const minDate = minDateObj.toISOString().split('T')[0];
                            const isMinDate = selectedDate <= minDate;

                            return (
                                <TouchableOpacity
                                    style={[styles.dateNavButton, isMinDate && styles.disabledButton]}
                                    onPress={() => changeDate(-1)}
                                    disabled={isMinDate}
                                >
                                    <Text style={[styles.dateNavArrow, isMinDate && styles.disabledText]}>‹</Text>
                                </TouchableOpacity>
                            );
                        })()}

                        <View style={styles.dateDisplay}>
                            <Text style={styles.dateText}>{getDisplayDate()}</Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.dateNavButton, selectedDate === getTodayDate() && styles.disabledButton]}
                            onPress={() => changeDate(1)}
                            disabled={selectedDate === getTodayDate()}
                        >
                            <Text style={[styles.dateNavArrow, selectedDate === getTodayDate() && styles.disabledText]}>›</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Main Content Areas */}
                    {activeTab === 'nutrition' ? (
                        <>
                            {/* Calorie & Macro Summary Card */}
                            <View style={styles.summaryCard}>
                                <View style={styles.calorieRow}>
                                    <View>
                                        <Text style={styles.calorieLabel}>Calories Remaining</Text>
                                        <Text style={styles.calorieValue}>
                                            {Math.round(caloriesRemaining)}
                                            <Text style={styles.calorieUnit}> kcal</Text>
                                        </Text>
                                    </View>

                                </View>

                                <View style={styles.progressBarContainer}>
                                    <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
                                </View>

                                <View style={styles.progressStats}>
                                    <Text style={styles.eatenText}>{Math.round(dailyLog.totals.calories)} eaten</Text>
                                    <Text style={styles.percentageText}>{Math.round(progress * 100)}%</Text>
                                </View>

                                {/* Consolidated Macros */}
                                <View style={styles.miniMacrosContainer}>
                                    <View style={styles.miniMacroItem}>
                                        <Text style={[styles.miniMacroLabel, { color: theme.colors.secondary }]}>Protein</Text>
                                        <Text style={styles.miniMacroValue}>{Math.round(dailyLog.totals.protein)} / {Math.round(userGoals.dailyProtein)}g</Text>
                                        <View style={styles.miniProgressBar}>
                                            <View style={{ width: `${Math.min(100, (dailyLog.totals.protein / userGoals.dailyProtein) * 100)}%`, backgroundColor: theme.colors.secondary, height: '100%' }} />
                                        </View>
                                    </View>
                                    <View style={styles.miniMacroItem}>
                                        <Text style={[styles.miniMacroLabel, { color: theme.colors.success }]}>Carbs</Text>
                                        <Text style={styles.miniMacroValue}>{Math.round(dailyLog.totals.carbs)} / {Math.round(userGoals.dailyCarbs)}g</Text>
                                        <View style={styles.miniProgressBar}>
                                            <View style={{ width: `${Math.min(100, (dailyLog.totals.carbs / userGoals.dailyCarbs) * 100)}%`, backgroundColor: theme.colors.success, height: '100%' }} />
                                        </View>
                                    </View>
                                    <View style={styles.miniMacroItem}>
                                        <Text style={[styles.miniMacroLabel, { color: theme.colors.warning }]}>Fats</Text>
                                        <Text style={styles.miniMacroValue}>{Math.round(dailyLog.totals.fats)} / {Math.round(userGoals.dailyFats)}g</Text>
                                        <View style={styles.miniProgressBar}>
                                            <View style={{ width: `${Math.min(100, (dailyLog.totals.fats / userGoals.dailyFats) * 100)}%`, backgroundColor: theme.colors.warning, height: '100%' }} />
                                        </View>
                                    </View>
                                </View>
                            </View>

                            {/* Weight Update Bar */}
                            <TouchableOpacity style={styles.weightUpdateBar} onPress={() => setShowWeightModal(true)}>
                                <View style={styles.weightInfo}>
                                    <Text style={styles.weightLabel}>Current Weight</Text>
                                    <Text style={styles.weightValue}>{userProfile.weight} kg</Text>

                                    {/* Goal Proximity Badge */}
                                    {userProfile.goal === 'lose' && (
                                        <>
                                            {userProfile.weight > userProfile.targetWeight ? (
                                                <View style={styles.weightGoalBadge}>
                                                    <Text style={styles.weightGoalText}>
                                                        {(userProfile.weight - userProfile.targetWeight).toFixed(1)} kg to lose
                                                    </Text>
                                                </View>
                                            ) : (
                                                <View style={styles.weightGoalBadge}>
                                                    <Text style={[styles.weightGoalText, { color: theme.colors.primary }]}>Goal Reached! 🎉</Text>
                                                </View>
                                            )}
                                        </>
                                    )}

                                    {userProfile.goal === 'gain' && (
                                        <>
                                            {userProfile.weight < userProfile.targetWeight ? (
                                                <View style={styles.weightGoalBadge}>
                                                    <Text style={styles.weightGoalText}>
                                                        {(userProfile.targetWeight - userProfile.weight).toFixed(1)} kg to gain
                                                    </Text>
                                                </View>
                                            ) : (
                                                <View style={styles.weightGoalBadge}>
                                                    <Text style={[styles.weightGoalText, { color: theme.colors.primary }]}>Goal Reached! 🎉</Text>
                                                </View>
                                            )}
                                        </>
                                    )}

                                    {userProfile.goal === 'maintain' && (
                                        <View style={styles.weightGoalBadge}>
                                            <Text style={styles.weightGoalText}>Maintenance Goal</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.weightActionText}>Update</Text>
                            </TouchableOpacity>

                            {/* Meal Sections */}
                            <View style={styles.mealsContainer}>
                                {mealSections.map((sectionName) => {
                                    const entries = getEntriesForMeal(sectionName);
                                    const cals = getMealCalories(entries);
                                    const macros = getMealMacros(entries);

                                    // Add Meal Button goes ABOVE Snacks & Drinks
                                    if (sectionName === 'Snacks & Drinks') {
                                        return (
                                            <View key={sectionName}>
                                                <TouchableOpacity style={styles.addMealButton} onPress={handleAddMealSection}>
                                                    <Text style={styles.addMealButtonText}>+ Add Meal</Text>
                                                </TouchableOpacity>

                                                <MealSection
                                                    title={sectionName}
                                                    entries={entries}
                                                    calories={cals}
                                                    macros={macros}
                                                    onAddFood={() => openAddFoodModal(sectionName)}
                                                    onRepeatLast={availableRepeats[sectionName] ? () => handleRepeatLast(sectionName) : undefined}
                                                    lastMealDate={lastMealsData[sectionName]?.date || null}
                                                    lastMealCount={lastMealsData[sectionName]?.count || 0}
                                                    isPremium={isPremium}
                                                    onRemoveEntry={handleRemoveEntry}
                                                    isRemovable={false} // Snacks always stays
                                                    onSaveMeal={() => handleSaveMeal(sectionName)}
                                                />
                                            </View>
                                        );
                                    }

                                    return (
                                        <MealSection
                                            key={sectionName}
                                            title={sectionName}
                                            entries={entries}
                                            calories={cals}
                                            macros={macros}
                                            onAddFood={() => openAddFoodModal(sectionName)}
                                            onRepeatLast={availableRepeats[sectionName] ? () => handleRepeatLast(sectionName) : undefined}
                                            lastMealDate={lastMealsData[sectionName]?.date || null}
                                            lastMealCount={lastMealsData[sectionName]?.count || 0}
                                            isPremium={isPremium}
                                            onRemoveEntry={handleRemoveEntry}
                                            onDeleteSection={() => handleDeleteMealSection(sectionName)}
                                            isRemovable={true}
                                            onSaveMeal={() => handleSaveMeal(sectionName)}
                                        />
                                    );
                                })}
                            </View>

                            {/* Exercise Section (Also visible in Nutrition for calorie context) */}
                            <View style={styles.mealsContainer}>
                                <ExerciseSection
                                    exercises={dailyLog.exercises || []}
                                    onAddExercise={() => navigation.navigate('AddExercise', { date: selectedDate })}
                                    onRemoveExercise={handleRemoveExercise}
                                />
                            </View>
                        </>
                    ) : (
                        <WorkoutView
                            dailyLog={dailyLog}
                            savedRoutines={savedRoutines}
                            onAddWorkout={() => navigation.navigate('AddWorkout', { date: selectedDate })}
                            onRemoveWorkout={handleRemoveWorkout}
                            onPressWorkout={(id, isRoutine) => {
                                // Check if it's a routine (either flag or starts with 'hist') or a logged workout
                                if (isRoutine || id.startsWith('hist')) {
                                    // Start new from routine
                                    const routine = savedRoutines.find(r => r.id === id);
                                    if (routine) {
                                        navigation.push('WorkoutExecute', {
                                            date: selectedDate,
                                            routine: routine
                                        });
                                    }
                                } else {
                                    // View/Resume existing workout
                                    navigation.navigate('WorkoutExecute', { date: selectedDate, workoutId: id });
                                }
                            }}
                        />
                    )}
                </ScrollView>

                {/* Bottom View Switcher */}
                <View style={styles.bottomTabSwitcher}>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'nutrition' && styles.tabButtonActive]}
                        onPress={() => {
                            setActiveTab('nutrition');
                            navigation.setParams({ activeTab: 'nutrition' });
                        }}
                    >
                        <Text style={styles.tabIcon}>🥗</Text>
                        <Text style={[styles.tabLabel, activeTab === 'nutrition' && styles.tabLabelActive]}>
                            Nutrition
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'workout' && styles.tabButtonActive]}
                        onPress={() => {
                            setActiveTab('workout');
                            navigation.setParams({ activeTab: 'workout' });
                        }}
                    >
                        <Text style={styles.tabIcon}>💪</Text>
                        <Text style={[styles.tabLabel, activeTab === 'workout' && styles.tabLabelActive]}>
                            Workout
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>


            {/* Weight Update Modal */}
            <Modal
                visible={showWeightModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowWeightModal(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View style={[styles.modalContent, { borderRadius: theme.borderRadius.l }]}>
                        <Text style={styles.modalTitle}>Update Weight</Text>
                        <Text style={{ textAlign: 'center', marginBottom: theme.spacing.m, color: theme.colors.text.secondary }}>
                            Update your weight to recalculate daily targets
                        </Text>

                        <View style={{ alignItems: 'center', marginVertical: theme.spacing.l }}>
                            <TextInput
                                style={{
                                    fontSize: 40,
                                    fontWeight: 'bold',
                                    color: theme.colors.primary,
                                    borderBottomWidth: 2,
                                    borderBottomColor: theme.colors.primary,
                                    width: 120,
                                    textAlign: 'center',
                                    marginBottom: theme.spacing.s
                                }}
                                value={newWeight}
                                onChangeText={handleWeightInput}
                                keyboardType="numeric"
                                autoFocus
                            />
                            <Text style={{ fontSize: 16, color: theme.colors.text.tertiary }}>kg</Text>
                        </View>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalCancelBtn, { flex: 1, marginRight: theme.spacing.m }]}
                                onPress={() => { setShowWeightModal(false); setNewWeight(userProfile?.weight.toString() || ''); }}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalConfirmBtn, { flex: 1 }]}
                                onPress={handleUpdateWeight}
                            >
                                <Text style={styles.modalConfirmText}>Update</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

        </View>
    );
};

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        backgroundColor: theme.colors.primary, // Set to primary so swipe-bounce/status bar shows green
    },
    scrollingHeaderBackground: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 280,
        backgroundColor: theme.colors.primary,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    safeArea: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    scrollView: {
        flex: 1,
        backgroundColor: theme.colors.background, // Bottom part shows background color
    },
    contentContainer: {
        paddingBottom: 40,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.primary,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: theme.spacing.l,
        paddingTop: theme.spacing.m,
        marginBottom: theme.spacing.l,
    },
    greeting: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.9)',
        fontWeight: '600',
    },
    userName: {
        fontSize: 28,
        color: '#ffffff',
        fontWeight: 'bold',
    },
    profileButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.4)',
    },
    profileButtonText: {
        fontSize: 20,
        color: '#ffffff',
    },

    // Date Navigation
    dateNavContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: theme.spacing.m,
        paddingHorizontal: theme.spacing.l,
    },
    dateNavButton: {
        padding: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 20,
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    disabledButton: {
        opacity: 0.3,
    },
    dateNavArrow: {
        fontSize: 24,
        color: '#ffffff',
        lineHeight: 24,
        marginTop: -4, // Optical refinement
    },
    disabledText: {
        color: 'rgba(255, 255, 255, 0.5)',
    },
    dateDisplay: {
        marginHorizontal: theme.spacing.l,
        minWidth: 100,
        alignItems: 'center',
    },
    dateText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#ffffff',
    },

    // Summary Card
    summaryCard: {
        backgroundColor: theme.colors.surface,
        marginHorizontal: theme.spacing.l,
        borderRadius: theme.borderRadius.l,
        padding: theme.spacing.l,
        ...theme.shadows.medium,
        marginBottom: theme.spacing.l,
    },
    calorieRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: theme.spacing.m,
    },
    calorieLabel: {
        fontSize: 14,
        color: theme.colors.text.secondary,
        fontWeight: '600',
    },
    calorieValue: {
        fontSize: 32,
        fontWeight: 'bold',
        color: theme.colors.text.primary,
    },
    calorieUnit: {
        fontSize: 16,
        color: theme.colors.text.secondary,
        fontWeight: 'normal',
    },

    progressBarContainer: {
        height: 12,
        backgroundColor: theme.colors.background, // lighter gray
        borderRadius: 6,
        marginBottom: theme.spacing.s,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: theme.colors.primary,
        borderRadius: 6,
    },
    progressStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: theme.spacing.l,
    },
    eatenText: {
        fontSize: 14,
        color: theme.colors.text.secondary,
    },
    percentageText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: theme.colors.primary,
    },

    // Consolidated Macros
    miniMacrosContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: theme.spacing.m,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
    },
    miniMacroItem: {
        flex: 1,
        alignItems: 'center',
    },
    miniMacroLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 2,
    },
    miniMacroValue: {
        fontSize: 10,
        color: theme.colors.text.secondary,
        marginBottom: 4,
    },
    miniProgressBar: {
        width: '80%',
        height: 4,
        backgroundColor: theme.colors.background,
        borderRadius: 2,
        overflow: 'hidden',
    },

    // Weight Update Bar
    weightUpdateBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        marginHorizontal: theme.spacing.l,
        marginBottom: theme.spacing.l,
        padding: theme.spacing.l, // Increased padding
        borderRadius: theme.borderRadius.l, // Larger radius
        ...theme.shadows.medium, // Stronger shadow
        borderLeftWidth: 4,
        borderLeftColor: theme.colors.primary,
    },
    weightInfo: {
        flexDirection: 'column',
    },
    weightLabel: {
        fontSize: 13,
        color: theme.colors.text.secondary,
        marginBottom: 4,
        fontWeight: '500',
    },
    weightValue: {
        fontSize: 24, // Larger font
        fontWeight: 'bold',
        color: theme.colors.text.primary,
        marginBottom: 2,
    },
    weightGoalBadge: {
        backgroundColor: theme.colors.background,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    weightGoalText: {
        fontSize: 12,
        color: theme.colors.text.tertiary,
        fontWeight: '600',
    },
    weightActionText: {
        fontSize: 14,
        color: theme.colors.primary,
        fontWeight: '600',
        backgroundColor: 'rgba(74, 222, 128, 0.1)', // Subtle primary bg
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        overflow: 'hidden',
    },

    // Meals
    mealsContainer: {
        paddingHorizontal: theme.spacing.l,
    },
    addMealButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: theme.colors.primary,
        borderStyle: 'dashed',
        borderRadius: theme.borderRadius.m,
        padding: theme.spacing.m,
        alignItems: 'center',
        marginBottom: theme.spacing.l,
    },
    addMealButtonText: {
        color: theme.colors.primary,
        fontWeight: '600',
        fontSize: 16,
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: theme.colors.surface,
        borderTopLeftRadius: theme.borderRadius.l,
        borderTopRightRadius: theme.borderRadius.l,
        padding: theme.spacing.l,
    },
    modalTitle: {
        ...theme.typography.h2,
        marginBottom: theme.spacing.s,
        textAlign: 'center',
    },
    modalSubtitle: {
        fontSize: 16,
        color: theme.colors.text.secondary,
        textAlign: 'center',
        marginBottom: theme.spacing.l,
    },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing.m,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    modalOptionEmoji: {
        fontSize: 24,
        marginRight: theme.spacing.m,
    },
    modalOptionText: {
        fontSize: 18,
        color: theme.colors.text.primary,
    },
    modalCancel: {
        marginTop: theme.spacing.l,
        paddingVertical: theme.spacing.m,
        alignItems: 'center',
    },
    modalCancelText: {
        fontSize: 18,
        color: theme.colors.error,
        fontWeight: '600',
    },

    // Custom Modal Buttons
    modalButtons: {
        flexDirection: 'row',
        marginTop: theme.spacing.m,
    },
    modalCancelBtn: {
        alignItems: 'center',
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    modalConfirmBtn: {
        alignItems: 'center',
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        backgroundColor: theme.colors.primary,
    },
    modalConfirmText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 16
    },

    // Bottom Switcher
    bottomTabSwitcher: {
        flexDirection: 'row',
        backgroundColor: theme.colors.surface,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        height: 80,
        paddingBottom: 20,
        ...theme.shadows.medium,
    },
    tabButton: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 10,
    },
    tabButtonActive: {
        backgroundColor: 'rgba(76, 175, 80, 0.05)', // Subtle primary highlight
    },
    tabIcon: {
        fontSize: 24,
        marginBottom: 4,
    },
    tabLabel: {
        fontSize: 12,
        color: theme.colors.text.tertiary,
        fontWeight: '600',
    },
    tabLabelActive: {
        color: theme.colors.primary,
    },
});
