import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform,
    Alert,
    FlatList,
    TouchableWithoutFeedback,
    Keyboard,
    Modal,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { RouteProp } from '@react-navigation/native';
import { theme } from '../theme';
import { addExerciseToLog, getTodayDate, getUserProfile, getDailyLog } from '../services/storage';
import { EXERCISE_OPTIONS, ExerciseOption, ALL_EXERCISES } from '../data/exercises';
import { WorkoutEntry } from '../types/food';
import { useSubscription } from '../context/SubscriptionContext';


type AddExerciseScreenProps = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'AddExercise'>;
    route: RouteProp<RootStackParamList, 'AddExercise'>;
};

export const AddExerciseScreen: React.FC<AddExerciseScreenProps> = ({ navigation, route }) => {
    // Form Selection
    const [selectedExercise, setSelectedExercise] = useState<ExerciseOption | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);

    // Inputs
    const [duration, setDuration] = useState('');
    const [calories, setCalories] = useState('');
    const [userWeight, setUserWeight] = useState<number>(70); // Default 70kg fallback
    const { isPremium } = useSubscription();

    const [submitting, setSubmitting] = useState(false);

    // Sync Workout State
    const [workouts, setWorkouts] = useState<WorkoutEntry[]>([]);
    const [showSyncModal, setShowSyncModal] = useState(false);

    // Initial Load: Get User Weight
    useEffect(() => {
        const loadWeight = async () => {
            const profile = await getUserProfile();
            if (profile?.weight) {
                setUserWeight(profile.weight);
            }
        };
        loadWeight();
    }, []);

    // Load Workouts for Sync
    useEffect(() => {
        const loadWorkouts = async () => {
            const date = route.params?.date || getTodayDate();
            const log = await getDailyLog(date);
            if (log.workouts) {
                setWorkouts(log.workouts);
            }
        };
        loadWorkouts();
    }, [route.params?.date]);

    // Flag to disable auto-calc for synced workouts
    const [isSynced, setIsSynced] = useState(false);
    const [syncedWorkoutId, setSyncedWorkoutId] = useState<string | null>(null);

    // Effect: Recalculate Calories when Duration or Exercise changes
    useEffect(() => {
        // Skip if this is a synced workout (Free user manual entry)
        if (isSynced) return;

        if (selectedExercise && duration) {
            const mins = parseFloat(duration);
            if (!isNaN(mins) && mins > 0) {
                // Formula: MET * Weight(kg) * Duration(hours)
                // 1 MET = 1 kcal/kg/hour
                const hours = mins / 60;
                const calculated = selectedExercise.met * userWeight * hours;
                setCalories(Math.round(calculated).toString());
            } else {
                setCalories('');
            }
        }
    }, [selectedExercise, duration, userWeight, isSynced]);

    const handleSelectExercise = (exercise: ExerciseOption) => {
        const localizedName = exercise.name;
        setSelectedExercise(exercise);
        setSearchQuery(localizedName);
        setShowDropdown(false);
        Keyboard.dismiss();
        setIsSynced(false); // Reset sync flag
        setSyncedWorkoutId(null);
    };

    const handleSearchChange = (text: string) => {
        setSearchQuery(text);
        if (selectedExercise && text !== selectedExercise.name) {
            setSelectedExercise(null); // Clear selection if user modifies text
            setCalories('');
        }
        setShowDropdown(true);
        setIsSynced(false); // Reset sync flag if user types
        setSyncedWorkoutId(null);
    };

    const handleSave = async () => {
        if (!selectedExercise && !isSynced) {
            Alert.alert('Required', 'Please select a valid exercise.');
            return;
        }
        if (!duration || isNaN(Number(duration))) {
            Alert.alert('Required', 'Please enter a valid duration.');
            return;
        }
        // Allow saving even if calories is 0, but usually it should be > 0
        if (!calories || isNaN(Number(calories))) {
            Alert.alert('Required', 'Please enter valid calories.');
            return;
        }

        setSubmitting(true);
        const logDate = route.params?.date || getTodayDate();
        try {
            // Determine the ID to use
            // If synced, adhere to 'sync-ID' format if possible
            const exerciseId = isSynced && syncedWorkoutId
                ? `sync-${syncedWorkoutId}`
                : (isSynced ? `sync-${Date.now()}` : selectedExercise!.id);

            await addExerciseToLog(
                logDate,
                isSynced ? searchQuery : selectedExercise!.name, // Use query for synced name
                Number(calories),
                Number(duration),
                exerciseId
            );
            // Redirect to Nutrition page for manual adds/syncs
            // requested: exact same animation as back button
            navigation.goBack();
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to save exercise.');
        } finally {
            setSubmitting(false);
        }
    };

    const handlePremiumSync = async () => {
        setSubmitting(true);
        const logDate = route.params?.date || getTodayDate();
        try {
            const log = await getDailyLog(logDate);
            const todaysWorkouts = log.workouts || [];
            const existingExercises = log.exercises || [];

            if (todaysWorkouts.length === 0) {
                Alert.alert('No Workouts', 'No completed workouts found for today.');
                setSubmitting(false);
                return;
            }

            let syncCount = 0;
            // Sync all of them
            for (const workout of todaysWorkouts) {
                // Check if already synced using ID OR Name
                // This prevents duplicates even if the ID was generated differently (legacy)
                const syncId = `sync-${workout.id}`;
                const targetName = `Workout: ${workout.name}`;

                const alreadySynced = existingExercises.some(ex =>
                    ex.id === syncId ||
                    ex.name === targetName ||
                    ex.name === workout.name // Check for exact name match just in case
                );

                if (alreadySynced) continue;

                // Determine duration/calories. If missing, default to 0
                if (workout.name) {
                    await addExerciseToLog(
                        logDate,
                        targetName,
                        workout.caloriesBurned || 0,
                        workout.durationMinutes || 0,
                        syncId
                    );
                    syncCount++;
                }
            }

            if (syncCount === 0) {
                Alert.alert('Info', 'All workouts are already synced!', [
                    { text: 'OK', onPress: () => navigation.goBack() }
                ]);
            } else {
                Alert.alert('Success', `Synced ${syncCount} workout(s) to your nutrition log!`, [
                    { text: 'OK', onPress: () => navigation.goBack() }
                ]);
            }

        } catch (error) {
            console.error('Auto-sync error:', error);
            Alert.alert('Error', 'Failed to auto-sync workouts.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSyncWorkout = async (workout: WorkoutEntry) => {
        // Free: Manual Entry Setup (Premium uses handlePremiumSync now)
        setSearchQuery(`Workout: ${workout.name}`);
        setDuration(workout.durationMinutes?.toString() || '');
        setCalories(''); // Clear for manual entry

        // Set special state for manual sync
        setSelectedExercise({ id: 'synced', name: workout.name, met: 0 }); // Dummy
        setIsSynced(true);
        setSyncedWorkoutId(workout.id); // Save ID for consistency

        setShowSyncModal(false);
        Alert.alert('Synced', 'Workout details loaded. Please inspect duration and enter calories.');
    };

    // Filter Logic
    const filteredExercises = ALL_EXERCISES.filter(ex =>
        ex.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <TouchableWithoutFeedback onPress={() => { setShowDropdown(false); Keyboard.dismiss(); }}>
            <SafeAreaView style={styles.container}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <View style={styles.content}>
                        <Text style={styles.title}>Log Exercise</Text>

                        {/* Sync Workout Button - Behavior depends on Subscription */}
                        <TouchableOpacity
                            style={styles.syncButton}
                            onPress={() => {
                                if (isPremium) {
                                    handlePremiumSync();
                                } else {
                                    setShowSyncModal(true);
                                }
                            }}
                        >
                            <Text style={styles.syncButtonText}>
                                {isPremium ? '⚡ Auto-Sync Workouts' : '🔄 Sync from Workout'}
                            </Text>
                        </TouchableOpacity>

                        {/* Exercise Search Dropdown */}
                        <View style={[styles.inputGroup, { zIndex: 10 }]}>
                            <Text style={styles.label}>Exercise Type</Text>
                            <View>
                                <TextInput
                                    style={styles.input}
                                    value={searchQuery}
                                    onChangeText={handleSearchChange}
                                    onFocus={() => setShowDropdown(true)}
                                    placeholder="Search exercises..."
                                    placeholderTextColor={theme.colors.text.tertiary}
                                    maxLength={50}
                                />
                                {showDropdown && (searchQuery.length > 0 || filteredExercises.length > 0) && (
                                    <View style={styles.dropdownList}>
                                        <FlatList
                                            data={filteredExercises}
                                            keyExtractor={item => item.id}
                                            keyboardShouldPersistTaps="handled"
                                            nestedScrollEnabled={true}
                                            renderItem={({ item }) => (
                                                <TouchableOpacity
                                                    style={styles.optionItem}
                                                    onPress={() => handleSelectExercise(item)}
                                                >
                                                    <Text style={styles.optionText}>{item.name}</Text>
                                                </TouchableOpacity>
                                            )}
                                            style={{ maxHeight: 200 }}
                                        />
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* Data Row */}
                        <View style={[styles.row, { zIndex: 1 }]}>
                            <View style={[styles.inputGroup, { flex: 1, marginRight: theme.spacing.m }]}>
                                <Text style={styles.label}>Duration (min)</Text>
                                <TextInput
                                    style={styles.input}
                                    value={duration}
                                    onChangeText={(text) => setDuration(text.replace(/[^0-9]/g, ''))}
                                    keyboardType="numeric"
                                    placeholder="30"
                                    placeholderTextColor={theme.colors.text.tertiary}
                                    maxLength={3}
                                />
                            </View>
                            <View style={[styles.inputGroup, { flex: 1 }]}>
                                <Text style={styles.label}>{isSynced ? 'Calories (Manual)' : 'Calories (Auto)'}</Text>
                                <TextInput
                                    style={[styles.input, !isSynced && styles.readOnlyInput]}
                                    value={calories}
                                    onChangeText={isSynced ? (text) => setCalories(text.replace(/[^0-9]/g, '')) : undefined}
                                    editable={isSynced} // Editable ONLY if synced
                                    placeholder="0"
                                    placeholderTextColor={theme.colors.text.tertiary}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        <Text style={styles.helperText}>
                            Calories calculated based on METs and your weight ({userWeight}kg).
                        </Text>

                        <TouchableOpacity
                            style={[styles.saveButton, submitting && styles.saveButtonDisabled]}
                            onPress={handleSave}
                            disabled={submitting}
                        >
                            <Text style={styles.saveButtonText}>
                                {submitting ? 'Saving...' : 'Add Exercise'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>

                {/* Sync Workout Modal */}
                <Modal
                    visible={showSyncModal}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setShowSyncModal(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Select Workout</Text>
                            {workouts.length > 0 ? (
                                <FlatList
                                    data={workouts}
                                    keyExtractor={item => item.id}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            style={styles.workoutItem}
                                            onPress={() => handleSyncWorkout(item)}
                                        >
                                            <Text style={styles.workoutName}>{item.name}</Text>
                                            <Text style={styles.workoutDetail}>
                                                {item.durationMinutes} min • {item.caloriesBurned} kcal
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                />
                            ) : (
                                <Text style={styles.emptyText}>No workouts logged for today.</Text>
                            )}

                            {/* Premium Upsell Link */}
                            {!isPremium && (
                                <TouchableOpacity
                                    style={styles.upsellContainer}
                                    onPress={() => {
                                        setShowSyncModal(false);
                                        navigation.navigate('Paywall');
                                    }}
                                >
                                    <Text style={styles.upsellText}>
                                        Want instant one-click syncing? <Text style={{ fontWeight: 'bold' }}>Get Premium</Text>
                                    </Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => setShowSyncModal(false)}
                            >
                                <Text style={styles.closeButtonText}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </SafeAreaView>
        </TouchableWithoutFeedback>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    keyboardView: {
        flex: 1,
    },
    content: {
        padding: theme.spacing.l,
    },
    title: {
        ...theme.typography.h1,
        marginBottom: theme.spacing.l,
        color: theme.colors.text.primary,
    },
    inputGroup: {
        marginBottom: theme.spacing.l,
        position: 'relative',
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: theme.spacing.s,
        color: theme.colors.text.secondary,
    },
    input: {
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.borderRadius.m,
        padding: theme.spacing.m,
        fontSize: 16,
        color: theme.colors.text.primary,
    },
    readOnlyInput: {
        backgroundColor: theme.colors.background, // visually slightly darker/disabled
        color: theme.colors.text.secondary,
        borderColor: theme.colors.border,
    },

    // Inline Dropdown Styles
    dropdownList: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderBottomLeftRadius: theme.borderRadius.m,
        borderBottomRightRadius: theme.borderRadius.m,
        // Shadow for elevation
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
        zIndex: 1000,
    },
    optionItem: {
        padding: theme.spacing.m,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    optionText: {
        fontSize: 16,
        color: theme.colors.text.primary,
    },

    row: {
        flexDirection: 'row',
    },
    helperText: {
        fontSize: 14,
        color: theme.colors.text.tertiary,
        marginBottom: theme.spacing.xl,
        fontStyle: 'italic',
    },
    saveButton: {
        backgroundColor: theme.colors.primary,
        padding: theme.spacing.l,
        borderRadius: theme.borderRadius.l,
        alignItems: 'center',
        ...theme.shadows.medium,
    },
    saveButtonDisabled: {
        backgroundColor: theme.colors.text.tertiary,
    },
    saveButtonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    syncButton: {
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        borderWidth: 1,
        borderColor: theme.colors.primary,
        marginBottom: theme.spacing.l,
        alignItems: 'center',
    },
    syncButtonText: {
        color: theme.colors.primary,
        fontWeight: 'bold',
        fontSize: 16,
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: theme.spacing.l,
    },
    modalContent: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.l,
        padding: theme.spacing.l,
        maxHeight: '80%',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: theme.spacing.m,
        color: theme.colors.text.primary,
        textAlign: 'center',
    },
    workoutItem: {
        padding: theme.spacing.m,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    workoutName: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text.primary,
    },
    workoutDetail: {
        fontSize: 14,
        color: theme.colors.text.secondary,
        marginTop: 4,
    },
    emptyText: {
        textAlign: 'center',
        color: theme.colors.text.secondary,
        marginVertical: theme.spacing.l,
    },
    upsellContainer: {
        marginTop: theme.spacing.m,
        padding: theme.spacing.m,
        backgroundColor: theme.colors.primaryLight,
        borderRadius: theme.borderRadius.m,
        alignItems: 'center',
    },
    upsellText: {
        color: theme.colors.primaryDark,
        fontSize: 14,
        textAlign: 'center',
    },
    closeButton: {
        marginTop: theme.spacing.m,
        alignItems: 'center',
        padding: theme.spacing.s,
    },
    closeButtonText: {
        color: theme.colors.text.secondary,
        fontSize: 16,
    },
});
