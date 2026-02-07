import React, { useState, useCallback, useLayoutEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { useSubscription } from '../context/SubscriptionContext';
import { getWorkoutById, addWorkoutFromRoutine, removeWorkoutFromLog, removeExerciseFromWorkout } from '../services/storage';
import { WorkoutEntry, WorkoutRoutine } from '../types/food';
import { theme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'WorkoutExecute'>;

export const WorkoutExecuteScreen: React.FC<Props> = ({ route, navigation }) => {
    const { date, workoutId: paramsWorkoutId, routine } = route.params;
    const { isPremium } = useSubscription();

    const [workoutId, setWorkoutId] = useState<string | undefined>(paramsWorkoutId);
    const [workout, setWorkout] = useState<WorkoutEntry | null>(null);
    const [loading, setLoading] = useState(true);

    // Load workout logic
    const loadWorkout = useCallback(async (id: string) => {
        setLoading(true);
        const data = await getWorkoutById(date, id);
        if (data) {
            setWorkout(data);
        }
        setLoading(false);
    }, [date]);

    // Initial load logic
    useFocusEffect(
        useCallback(() => {
            const init = async () => {
                setLoading(true);
                if (workoutId) {
                    // Load existing workout
                    await loadWorkout(workoutId);
                } else if (routine) {
                    // Initialize from routine (not saved yet)
                    const tempWorkout: WorkoutEntry = {
                        id: 'temp-' + Date.now(),
                        name: routine.name,
                        durationMinutes: routine.defaultDurationMinutes || 0,
                        caloriesBurned: routine.defaultCaloriesBurned || 0,
                        timestamp: new Date().toISOString(),
                        exercises: (routine.exercises || []).map((ex, index) => ({
                            ...ex,
                            id: `${Date.now()}-${index}`
                        }))
                    };
                    setWorkout(tempWorkout);
                    setLoading(false);
                } else {
                    setLoading(false);
                }
            };
            init();
        }, [workoutId, routine, date, loadWorkout])
    );

    // Reload workout when returning from AddWorkoutExerciseScreen
    useFocusEffect(
        useCallback(() => {
            if (workoutId) {
                loadWorkout(workoutId);
            }
        }, [workoutId, loadWorkout])
    );

    // Helper to ensure workout exists in DB before action
    const ensureWorkoutPersisted = async (): Promise<string | null> => {
        if (workoutId) return workoutId;
        if (!routine) return null;

        try {
            const newId = await addWorkoutFromRoutine(date, routine, isPremium);
            setWorkoutId(newId);
            return newId;
        } catch (error) {
            console.error('Failed to persist workout:', error);
            Alert.alert('Error', 'Failed to start workout session');
            return null;
        }
    };



    const handleStartWorkout = async () => {
        const currentWorkoutId = await ensureWorkoutPersisted();
        if (!currentWorkoutId) return;

        if (!workout?.exercises || workout.exercises.length === 0) {
            Alert.alert('Empty', 'Add exercises first!');
            return;
        }
        const firstExercise = workout.exercises[0];
        const startTime = Date.now();
        navigation.navigate('ExerciseLog', {
            date,
            workoutId: currentWorkoutId,
            exerciseId: firstExercise.id,
            exerciseName: firstExercise.name,
            sets: firstExercise.sets || 3,
            restTime: firstExercise.restTime,
            exerciseIndex: 0,
            totalExercises: workout.exercises.length,
            startTime,
        });
    };

    const handleDeleteWorkout = () => {
        Alert.alert(
            'Delete Workout',
            'Are you sure you want to delete this workout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        if (!workoutId) return;
                        try {
                            await removeWorkoutFromLog(date, workoutId);
                            // Navigate back to home with workout tab
                            navigation.navigate('Home', { date, activeTab: 'workout' });
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete workout');
                        }
                    }
                }
            ]
        );
    };

    // Set header with back button and delete button
    useLayoutEffect(() => {
        navigation.setOptions({
            title: 'Perform Workout',
            headerLeft: () => (
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 16 }}>
                    <Text style={{ fontSize: 18, color: '#ffffff', fontWeight: '600' }}>‹ Back</Text>
                </TouchableOpacity>
            ),
            headerRight: () => (
                <TouchableOpacity onPress={handleDeleteWorkout} style={{ paddingLeft: 16 }}>
                    <Text style={{ fontSize: 16, color: '#ff6b6b', fontWeight: '600' }}>Delete</Text>
                </TouchableOpacity>
            ),
        });
    }, [navigation, workoutId, date]);

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    if (!workout) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centered}>
                    <Text style={styles.errorText}>Workout not found</Text>
                </View>
            </SafeAreaView>
        );
    }

    const totalDuration = workout.durationMinutes || 0;
    const exercises = workout.exercises || [];

    const handleRemoveExercise = async (exerciseId: string) => {
        if (!workout) return;

        // Optimistic update
        setWorkout(current => {
            if (!current) return null;
            return {
                ...current,
                exercises: (current.exercises || []).filter(ex => ex.id !== exerciseId)
            };
        });

        // Persist
        if (workoutId) {
            try {
                await removeExerciseFromWorkout(date, workoutId, exerciseId);
            } catch (error) {
                console.error('Failed to remove exercise from storage:', error);
                Alert.alert('Error', 'Failed to delete exercise.');
            }
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.title}>{workout.name}</Text>
                    <Text style={styles.subtitle}>{exercises.length} Exercises • {totalDuration} min</Text>
                </View>

                <TouchableOpacity style={styles.finishBtn} onPress={handleStartWorkout}>
                    <Text style={styles.finishBtnText}>Start Workout</Text>
                </TouchableOpacity>

                <View style={styles.exerciseList}>
                    {workout.exercises.map((exercise, index) => (
                        <View
                            key={exercise.id}
                            style={styles.exerciseCard}
                        >
                            <TouchableOpacity
                                style={styles.exerciseInfo}
                                onPress={() => { /* Consider if tapping should do something, e.g. edit */ }}
                                activeOpacity={1}
                            >
                                <Text style={styles.exerciseName}>{exercise.name}</Text>
                                <Text style={styles.exerciseMeta}>
                                    {exercise.sets || 0} Sets
                                    {exercise.restTime ? ` • Rest: ${Math.floor(exercise.restTime / 60)}:${(exercise.restTime % 60).toString().padStart(2, '0')}` : ''}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => handleRemoveExercise(exercise.id)}
                                style={styles.removeBtn}
                            >
                                <Text style={styles.removeBtnText}>✕</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>

                <TouchableOpacity style={styles.addExerciseBtn} onPress={() => {
                    const handleAddDraft = (exercise: any) => {
                        setWorkout(current => {
                            if (!current) return null;
                            const newEx = { ...exercise, id: Date.now().toString() };
                            return {
                                ...current,
                                exercises: [...(current.exercises || []), newEx]
                            };
                        });
                    };

                    navigation.navigate('AddWorkoutExercise', {
                        date,
                        workoutId,
                        onSubmit: !workoutId ? handleAddDraft : undefined
                    });
                }}>
                    <Text style={styles.addExerciseBtnText}>+ Add Exercise</Text>
                </TouchableOpacity>
            </ScrollView>


        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        padding: theme.spacing.l,
    },
    header: {
        marginBottom: theme.spacing.xl,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: theme.colors.text.primary,
        marginBottom: theme.spacing.xs,
    },
    subtitle: {
        fontSize: 16,
        color: theme.colors.text.secondary,
    },
    exerciseList: {
        marginBottom: theme.spacing.s,
    },
    exerciseCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.m,
        padding: theme.spacing.m,
        marginBottom: theme.spacing.m,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...theme.shadows.soft,
    },
    exerciseInfo: {
        flex: 1,
    },
    exerciseName: {
        fontSize: 18,
        fontWeight: '600',
        color: theme.colors.text.primary,
        marginBottom: 4,
    },
    exerciseMeta: {
        fontSize: 14,
        color: theme.colors.text.secondary,
    },
    chevron: {
        fontSize: 24,
        color: theme.colors.text.tertiary,
        marginLeft: theme.spacing.m,
    },
    finishBtn: {
        backgroundColor: theme.colors.primary,
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        alignItems: 'center',
        marginTop: theme.spacing.l,
        marginBottom: theme.spacing.xl, // Added spacing
        ...theme.shadows.soft,
    },
    finishBtnText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    errorText: {
        fontSize: 16,
        color: theme.colors.text.secondary,
    },
    addExerciseBtn: {
        marginTop: theme.spacing.m, // Kept small margin
        padding: theme.spacing.m,
        alignItems: 'center',
    },
    addExerciseBtnText: {
        color: theme.colors.primary,
        fontWeight: '600',
        fontSize: 16,
    },
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
        paddingBottom: theme.spacing.xxl,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text.primary,
        marginBottom: theme.spacing.l,
        textAlign: 'center',
    },
    input: {
        backgroundColor: theme.colors.background,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.borderRadius.m,
        padding: theme.spacing.m,
        fontSize: 16,
        color: theme.colors.text.primary,
        marginBottom: theme.spacing.m,
    },
    dropdownContainer: {
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.m,
        borderWidth: 1,
        borderColor: theme.colors.border,
        zIndex: 1000,
        ...theme.shadows.medium,
        maxHeight: 200,
    },
    dropdownItem: {
        padding: theme.spacing.m,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    dropdownText: {
        fontSize: 16,
        color: theme.colors.text.primary,
    },
    row: {
        flexDirection: 'row',
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.text.secondary,
        marginBottom: theme.spacing.xs,
    },
    restControlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    restValueBox: {
        backgroundColor: theme.colors.background,
        borderRadius: theme.borderRadius.m,
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingHorizontal: theme.spacing.s,
        paddingVertical: theme.spacing.xs,
        alignItems: 'center',
        minWidth: 70,
    },
    restArrow: {
        paddingVertical: 2,
        paddingHorizontal: 10,
    },
    arrowText: {
        fontSize: 12,
        color: theme.colors.primary,
    },
    restValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text.primary,
        marginVertical: 2,
    },
    restSeparator: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text.tertiary,
        marginHorizontal: theme.spacing.s,
    },
    modalButtons: {
        flexDirection: 'row',
        marginTop: theme.spacing.m,
    },
    modalBtn: {
        flex: 1,
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        alignItems: 'center',
    },
    cancelBtn: {
        backgroundColor: theme.colors.background,
        marginRight: theme.spacing.m,
    },
    cancelBtnText: {
        color: theme.colors.text.secondary,
        fontWeight: '600',
    },
    saveBtn: {
        backgroundColor: theme.colors.primary,
    },
    saveBtnText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    inputGroup: {
        flex: 1,
    },
    smallInput: {
        backgroundColor: theme.colors.background,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.borderRadius.m,
        padding: theme.spacing.m,
        fontSize: 16,
        color: theme.colors.text.primary,
        textAlign: 'center',
    },
    removeBtn: {
        padding: theme.spacing.s,
        marginLeft: theme.spacing.s,
    },
    removeBtnText: {
        fontSize: 20,
        color: theme.colors.text.tertiary,
    },
});
