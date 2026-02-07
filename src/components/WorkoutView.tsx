import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../theme';

import { DailyLog, WorkoutEntry } from '../types/food';

import { WorkoutRoutine } from '../types/food';

type WorkoutViewProps = {
    dailyLog: DailyLog;
    savedRoutines: WorkoutRoutine[];
    onAddWorkout: () => void;
    onRemoveWorkout: (id: string, isRoutine: boolean) => void;
    onPressWorkout: (id: string, isRoutine: boolean) => void;
};

export const WorkoutView: React.FC<WorkoutViewProps> = ({
    dailyLog,
    savedRoutines,
    onAddWorkout,
    onRemoveWorkout,
    onPressWorkout
}) => {
    // Helper to normalize strings (remove extra spaces, case insensitive)
    const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

    // 1. Get today's completed workouts
    const todayWorkouts = dailyLog.workouts || [];
    // Map normalized names to workouts for easier lookup
    // Only map COMPLETED workouts (or legacy ones where completed is undefined)
    const completedMap = new Map<string, WorkoutEntry>();
    todayWorkouts.forEach(w => {
        if (w.completed !== false) {
            completedMap.set(normalize(w.name), w);
        }
    });

    // Display List
    const displayList: {
        id: string;
        name: string;
        exercisesCount: number;
        isCompleted: boolean;
        isRoutine: boolean
    }[] = [];

    // Track which completed workouts have been "claimed" by a routine
    const claimedWorkouts = new Set<string>();

    // Add all Saved Routines first
    savedRoutines.forEach(routine => {
        const normName = normalize(routine.name);
        // It is done if we found a match in our filtered completedMap
        const isDoneToday = completedMap.has(normName);

        if (isDoneToday) {
            // Mark the matched workout ID as claimed so we don't show it again
            const matchedWorkout = completedMap.get(normName);
            if (matchedWorkout) {
                claimedWorkouts.add(matchedWorkout.id);
            }
        }

        displayList.push({
            id: routine.id,
            name: routine.name,
            exercisesCount: routine.exercises.length,
            isCompleted: isDoneToday,
            isRoutine: true
        });
    });

    // Add any Today Workouts that were NOT claimed by a routine
    todayWorkouts.forEach(workout => {
        if (!claimedWorkouts.has(workout.id)) {
            // Double check name match just in case logic above missed it (e.g. routine loaded later?)
            // Actually relying on claimedWorkouts is safer if IDs are unique.
            // But let's also check if it matches ANY routine name to be safe (deduplication logic)
            const normName = normalize(workout.name);
            const routineExists = savedRoutines.some(r => normalize(r.name) === normName);

            if (!routineExists) {
                displayList.push({
                    id: workout.id,
                    name: workout.name,
                    exercisesCount: workout.exercises?.length || 0,
                    isCompleted: workout.completed !== false,
                    isRoutine: false
                });
            }
        }
    });

    // Sort: Uncompleted first? Or Alphabetical? Let's keep order stable.

    return (
        <View style={styles.container}>
            {displayList.length > 0 ? (
                displayList.map((item, index) => (
                    <TouchableOpacity
                        key={`${item.id}-${index}`}
                        style={[styles.workoutCard, item.isCompleted && styles.completedCard]}
                        onPress={() => {
                            // If completed, we should ideally open the COMPLETED version ID
                            // If completed, we should ideally open the COMPLETED version ID
                            if (item.isCompleted) {
                                const completedVersion = todayWorkouts.find(w => normalize(w.name) === normalize(item.name));
                                if (completedVersion) {
                                    onPressWorkout(completedVersion.id, false); // Open existing
                                    return;
                                }
                            }
                            // Otherwise use item's type
                            onPressWorkout(item.id, item.isRoutine);
                        }}
                    >
                        <View style={styles.entryInfo}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={styles.entryName}>{item.name}</Text>
                                {item.isCompleted && (
                                    <View style={styles.tickBadge}>
                                        <Text style={styles.tickText}>✓</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.entryDetails}>
                                {item.exercisesCount} exercises
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => onRemoveWorkout(item.id, item.isRoutine)}
                            style={styles.removeButton}
                        >
                            <Text style={styles.removeButtonText}>✕</Text>
                        </TouchableOpacity>
                    </TouchableOpacity>
                ))
            ) : (
                <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>No workouts logged today.</Text>
                </View>
            )}

            <TouchableOpacity
                style={styles.standaloneAddButton}
                onPress={onAddWorkout}
            >
                <Text style={styles.standaloneAddButtonText}>+ Add Workout</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: theme.spacing.l,
        paddingTop: theme.spacing.m,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: theme.colors.text.primary,
        marginBottom: theme.spacing.m,
    },
    workoutCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.l,
        padding: theme.spacing.l,
        marginBottom: theme.spacing.m,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        ...theme.shadows.medium,
    },
    entryInfo: {
        flex: 1,
    },
    entryName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text.primary,
    },
    entryDetails: {
        fontSize: 14,
        color: theme.colors.text.secondary,
        marginTop: 4,
    },
    removeButton: {
        padding: theme.spacing.s,
        marginLeft: theme.spacing.s,
    },
    removeButtonText: {
        color: theme.colors.text.tertiary,
        fontSize: 18,
    },
    emptyCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.l,
        padding: theme.spacing.xl,
        marginBottom: theme.spacing.l,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderStyle: 'dashed',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 15,
        color: theme.colors.text.tertiary,
        fontStyle: 'italic',
    },
    standaloneAddButton: {
        marginVertical: theme.spacing.m,
        padding: theme.spacing.l,
        borderRadius: theme.borderRadius.l,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.primary,
        borderStyle: 'dashed',
        alignItems: 'center',
        ...theme.shadows.soft,
        maxHeight: 200,
    },
    standaloneAddButtonText: {
        color: theme.colors.primary,
        fontWeight: '700',
        fontSize: 17,
    },
    tickBadge: {
        marginLeft: 8,
        backgroundColor: theme.colors.success,
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tickText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
    completedCard: {
        borderColor: theme.colors.success,
        borderWidth: 1,
    }
});
