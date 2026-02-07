import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    TextInput,
    Alert,
    Modal,
    ActivityIndicator
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';

import {
    getWorkoutById,
    addExerciseToWorkout,
    removeExerciseFromWorkout,
    updateExerciseInWorkout,
    removeWorkoutFromLog
} from '../services/storage';
import { WorkoutEntry, WorkoutExercise } from '../types/food';
import { EXERCISE_OPTIONS, ExerciseOption } from '../data/exercises';
import { FlatList } from 'react-native';

type WorkoutDetailScreenProps = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'WorkoutDetail'>;
    route: RouteProp<RootStackParamList, 'WorkoutDetail'>;
};

export const WorkoutDetailScreen: React.FC<WorkoutDetailScreenProps> = ({ navigation, route }) => {
    const { date, workoutId, newExercise } = route.params;
    const [workout, setWorkout] = useState<WorkoutEntry | null>(null);
    const [loading, setLoading] = useState(true);

    const loadWorkout = useCallback(async () => {
        if (!workoutId) {
            // Draft Mode: Initialize empty workout only if not already initialized
            setWorkout(current => {
                if (current) return current; // Perform check inside setter to access fresh state
                return {
                    id: Date.now().toString(),
                    name: route.params.workoutName || 'New Workout',
                    caloriesBurned: 0,
                    durationMinutes: 0,
                    timestamp: new Date().toISOString(),
                    exercises: []
                };
            });
            setLoading(false);
            return;
        }

        setLoading(true);
        const data = await getWorkoutById(date, workoutId);
        if (data) {
            setWorkout(data);
        } else {
            console.warn(`Workout not found for ID: ${workoutId}`);
            Alert.alert('Error', 'Workout not found. Returning to list.');
            navigation.goBack();
        }
        setLoading(false);
    }, [date, workoutId, navigation, route.params.workoutName]);

    // Callback for adding exercise in Draft Mode
    const handleAddExerciseDraft = (exercise: WorkoutExercise) => {
        setWorkout(current => {
            if (!current) return null;
            // Check for duplicates
            if (current.exercises?.some(ex => ex.id === exercise.id)) {
                return current;
            }
            return {
                ...current,
                exercises: [...(current.exercises || []), exercise]
            };
        });
    };

    useFocusEffect(
        useCallback(() => {
            loadWorkout();
        }, [loadWorkout])
    );

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

        // Persist if saved workout
        if (workoutId) {
            try {
                const { removeExerciseFromWorkout } = require('../services/storage');
                await removeExerciseFromWorkout(date, workoutId, exerciseId);
            } catch (error) {
                console.error('Failed to remove exercise from storage:', error);
                // Ideally revert optimistic update here, but for now we log it
                Alert.alert('Error', 'Failed to remove exercise from saved workout.');
            }
        }
    };

    const handleDeleteWorkout = () => {
        Alert.alert(
            'Delete Workout',
            'This will permanently remove this workout from your log.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        // If it's a draft (no ID in params), just discard and go back
                        if (!workoutId) {
                            navigation.goBack();
                            return;
                        }

                        // If it's a saved workout, delete from storage
                        try {
                            setLoading(true);
                            await removeWorkoutFromLog(date, workoutId);
                            navigation.navigate('Home', { date, activeTab: 'workout' });
                        } catch (error) {
                            console.error('Delete error:', error);
                            Alert.alert('Error', 'Failed to delete workout');
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleFinishWorkout = async () => {
        if (!workout?.exercises || workout.exercises.length === 0) {
            Alert.alert(
                'Empty Workout',
                'You haven\'t added any exercises yet. Do you want to discard this workout session?',
                [
                    { text: 'Add Exercises', style: 'cancel' },
                    {
                        text: 'Discard Session',
                        style: 'destructive',
                        onPress: async () => {
                            navigation.goBack();
                        }
                    }
                ]
            );
            return;
        }

        try {
            setLoading(true);
            const { saveWorkoutAsRoutine } = await import('../services/storage');
            await saveWorkoutAsRoutine(workout);
            // Use goBack() for correct "slide right" animation instead of navigate('Home')
            navigation.goBack();
        } catch (error) {
            Alert.alert('Error', 'Failed to save workout routine.');
        } finally {
            setLoading(false);
        }
    };

    const navigateToAddExercise = () => {
        navigation.navigate('AddWorkoutExercise', {
            date,
            workoutId,
            workoutName: workout?.name,
            onSubmit: !workoutId ? handleAddExerciseDraft : undefined
        });
    };

    if (loading && !workout) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    if (!workout) return null;

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.title}>{workout.name}</Text>
                    <Text style={styles.subtitle}>
                        {date} • {workout.durationMinutes}m • {workout.caloriesBurned}kcal
                    </Text>
                </View>

                <View style={styles.exerciseSection}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Exercises</Text>
                        <TouchableOpacity
                            style={styles.headerAddBtn}
                            onPress={navigateToAddExercise}
                        >
                            <Text style={styles.headerAddBtnText}>+ Add</Text>
                        </TouchableOpacity>
                    </View>

                    {workout.exercises && workout.exercises.length > 0 ? (
                        workout.exercises.map((ex) => (
                            <View
                                key={ex.id}
                                style={styles.exerciseCard}
                            >
                                <View style={styles.exerciseInfo}>
                                    <Text style={styles.exerciseName}>{ex.name}</Text>
                                    <Text style={styles.exerciseMeta}>
                                        {ex.sets || 0} Sets planned {ex.restTime ? `• Rest: ${Math.floor(ex.restTime / 60)}:${(ex.restTime % 60).toString().padStart(2, '0')}` : ''}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => handleRemoveExercise(ex.id)}
                                    style={styles.removeBtn}
                                >
                                    <Text style={styles.removeBtnText}>✕</Text>
                                </TouchableOpacity>
                            </View>
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No exercises added yet.</Text>
                            <TouchableOpacity
                                style={styles.mainAddBtn}
                                onPress={navigateToAddExercise}
                            >
                                <Text style={styles.mainAddBtnText}>Add First Exercise</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                <TouchableOpacity
                    style={[
                        styles.saveWorkoutBtn,
                        (!workout?.exercises || workout.exercises.length === 0) && styles.disabledSaveBtn
                    ]}
                    onPress={handleFinishWorkout}
                >
                    <Text style={styles.saveWorkoutBtnText}>Save Workout</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.deleteWorkoutBtn}
                    onPress={handleDeleteWorkout}
                >
                    <Text style={styles.deleteWorkoutBtnText}>Delete Workout</Text>
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
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: theme.colors.text.secondary,
        marginBottom: theme.spacing.s,
    },
    saveRoutineHeaderBtn: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        paddingHorizontal: theme.spacing.m,
        paddingVertical: theme.spacing.s,
        borderRadius: theme.borderRadius.m,
        marginTop: theme.spacing.s,
    },
    saveRoutineHeaderBtnText: {
        color: theme.colors.primary,
        fontWeight: '600',
        fontSize: 14,
    },
    exerciseSection: {
        marginBottom: theme.spacing.xl,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.m,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text.primary,
    },
    headerAddBtn: {
        backgroundColor: theme.colors.primaryLight,
        paddingHorizontal: theme.spacing.m,
        paddingVertical: theme.spacing.s,
        borderRadius: theme.borderRadius.m,
    },
    headerAddBtnText: {
        color: theme.colors.primary,
        fontWeight: '600',
    },
    exerciseCard: {
        flexDirection: 'row',
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.m,
        padding: theme.spacing.m,
        marginBottom: theme.spacing.s,
        alignItems: 'center',
        ...theme.shadows.soft,
    },
    exerciseInfo: {
        flex: 1,
    },
    exerciseName: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text.primary,
        marginBottom: 2,
    },
    exerciseMeta: {
        fontSize: 14,
        color: theme.colors.text.secondary,
    },
    removeBtn: {
        padding: theme.spacing.s,
    },
    removeBtnText: {
        color: theme.colors.text.tertiary,
        fontSize: 16,
    },
    emptyState: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.l,
        padding: theme.spacing.xl,
        alignItems: 'center',
        ...theme.shadows.soft,
    },
    emptyText: {
        fontSize: 16,
        color: theme.colors.text.secondary,
        marginBottom: theme.spacing.l,
    },
    mainAddBtn: {
        backgroundColor: theme.colors.primary,
        paddingHorizontal: theme.spacing.l,
        paddingVertical: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
    },
    mainAddBtnText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    deleteWorkoutBtn: {
        marginTop: theme.spacing.xl,
        padding: theme.spacing.m,
        alignItems: 'center',
    },
    deleteWorkoutBtnText: {
        color: theme.colors.error,
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
    row: {
        flexDirection: 'row',
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
    saveWorkoutBtn: {
        backgroundColor: theme.colors.primary,
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        alignItems: 'center',
        marginTop: theme.spacing.xl,
        ...theme.shadows.soft,
    },
    saveWorkoutBtnText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    disabledSaveBtn: {
        backgroundColor: theme.colors.border,
        opacity: 0.7,
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
    inputLabel: {
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
});
