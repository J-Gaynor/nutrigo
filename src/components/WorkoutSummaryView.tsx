import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Dimensions,
    PanResponder,
    ActivityIndicator
} from 'react-native';
import { theme } from '../theme';
import { getWorkoutById, saveFullWorkoutToLog, saveWorkoutAsRoutine } from '../services/storage';
import { WorkoutEntry } from '../types/food';
import { useSubscription } from '../context/SubscriptionContext';


const SCREEN_WIDTH = Dimensions.get('window').width;

type WorkoutSummaryViewProps = {
    date: string;
    workoutId: string;
    startTime?: number;
    onFinish: () => void;
    onBack?: () => void; // Optional if we want a back button behavior inside the view
};

export const WorkoutSummaryView: React.FC<WorkoutSummaryViewProps> = ({
    date,
    workoutId,
    startTime,
    onFinish,
    onBack
}) => {
    const { isPremium } = useSubscription();
    const [workout, setWorkout] = useState<WorkoutEntry | null>(null);
    const [intensity, setIntensity] = useState(6);
    const [userWeight, setUserWeight] = useState(70);
    const [sliderWidth, setSliderWidth] = useState(0);
    const sliderWidthRef = useRef(0);

    // Calculate duration once on mount (or use workout.durationMinutes if already set)
    const [duration, setDuration] = useState(0);

    useEffect(() => {
        if (workout?.durationMinutes) {
            setDuration(workout.durationMinutes);
        } else if (startTime) {
            const mins = Math.max(1, Math.round((Date.now() - startTime) / 60000));
            setDuration(mins);
        }
    }, [workout, startTime]);

    // Calculate calories dynamically based on intensity
    const calculateCalories = useCallback(() => {
        if (!workout) return 0;

        // 1. Intensity Value (RPE)
        let intensityValue = 3.5;
        if (intensity <= 5) intensityValue = 3.5;
        else if (intensity === 6) intensityValue = 4.5;
        else if (intensity === 7) intensityValue = 5.5;
        else if (intensity === 8) intensityValue = 6.5;
        else if (intensity === 9) intensityValue = 7.5;
        if (intensity >= 10) intensityValue = 8.5;

        // 2. Active Training Time (1 min per set)
        const totalSets = workout.exercises.reduce((sum, ex) => {
            if (ex.performance && ex.performance.length > 0) return sum + ex.performance.length;
            return sum;
        }, 0);

        let activeHours = totalSets / 60;

        // Fallback: If sets are 0 (missing data?) but duration exists, assume 50% active duty cycle
        if (totalSets === 0 && duration > 0) {
            activeHours = (duration / 60) * 0.5;
        }

        // 3. Formula: Intensity * Weight * Hours
        let cals = Math.round(intensityValue * userWeight * activeHours);

        // 4. Sanity Check
        if (cals > 600) cals = 600;

        return cals;
    }, [intensity, userWeight, workout]);

    const calories = calculateCalories();

    useEffect(() => {
        let retries = 0;
        const loadData = async () => {
            let data = await getWorkoutById(date, workoutId);

            // Check if we retrieved data but it seems incomplete (no performance recorded)
            // indicating a potential race condition with the last save
            const hasPerformance = data?.exercises?.some(ex => ex.performance && ex.performance.length > 0);

            if ((!data || !hasPerformance) && retries < 2) {
                retries++;
                setTimeout(loadData, 500 * retries); // Backoff retry
                return;
            }

            setWorkout(data);
            const { getUserProfile } = await import('../services/storage');
            const profile = await getUserProfile();
            if (profile?.weight) {
                setUserWeight(profile.weight);
            }
        };
        loadData();
    }, [date, workoutId]);

    // Update ref whenever state changes
    useEffect(() => {
        sliderWidthRef.current = sliderWidth;
    }, [sliderWidth]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt) => updateIntensity(evt.nativeEvent.locationX),
            onPanResponderMove: (evt) => updateIntensity(evt.nativeEvent.locationX),
        })
    ).current;

    const updateIntensity = (x: number) => {
        const width = sliderWidthRef.current;
        if (width === 0) return;
        const clampedX = Math.max(0, Math.min(x, width));
        const newIntensity = Math.min(10, Math.max(1, Math.ceil((clampedX / width) * 10)));
        setIntensity(newIntensity);
    };

    const handleFinish = async () => {
        if (!workout) return;

        const finalCalories = calories;
        const finalDuration = duration;

        try {
            const updatedWorkout = {
                ...workout,
                caloriesBurned: finalCalories,
                durationMinutes: finalDuration
            };

            // Auto-save as routine
            try {
                await saveWorkoutAsRoutine(updatedWorkout);
            } catch (err) {
                console.warn('Failed to auto-save routine:', err);
            }

            // Sync calories only if Premium (legacy thought, but actually syncToLog handles it)
            // Call finishWorkout to mark as completed and sync
            const { finishWorkout } = await import('../services/storage');

            // First save the updated stats (duration/calories) to the log entry
            // We use saveFullWorkoutToLog with false to just update the entry without syncing "exercises" yet (though finishWorkout will do that)
            // Actually finishWorkout RE-SAVES. So we should just update the local object then pass to storage?
            // Storage.ts finishWorkout loads from DB. So we MUST save to DB first.
            workout.caloriesBurned = finalCalories;
            workout.durationMinutes = finalDuration;

            await saveFullWorkoutToLog(date, workout, false); // Save stats, don't sync exercises yet
            await finishWorkout(date, workout.id); // Mark complete and sync exercises if needed

            const message = isPremium
                ? `Well done! You burned ${finalCalories} kcal.`
                : `Great job! You burned ${finalCalories} kcal.`;

            Alert.alert('Workout Complete!', message, [
                {
                    text: 'OK',
                    onPress: onFinish,
                },
            ]);
        } catch (error) {
            console.error('Error finishing workout:', error);
            Alert.alert('Error', 'Failed to finish workout');
        }
    };

    if (!workout) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.title}>Workout Summary</Text>
                <Text style={styles.subtitle}>{workout.name}</Text>

                <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{duration}</Text>
                        <Text style={styles.statLabel}>MINUTES</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{workout.exercises.length}</Text>
                        <Text style={styles.statLabel}>EXERCISES</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{calories}</Text>
                        <Text style={styles.statLabel}>CALORIES</Text>
                    </View>
                    {(workout.newPrs || 0) > 0 && (
                        <>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={[styles.statValue, { color: theme.colors.primary }]}>
                                    {workout.newPrs}
                                </Text>
                                <Text style={[styles.statLabel, { color: theme.colors.primary }]}>
                                    NEW PRs
                                </Text>
                            </View>
                        </>
                    )}
                </View>

                <View style={styles.exercisesList}>
                    {workout.exercises.map((ex, idx) => (
                        <View key={ex.id} style={styles.exerciseItem}>
                            <View style={styles.exerciseInfo}>
                                <Text style={styles.exerciseName}>{idx + 1}. {ex.name}</Text>
                                <Text style={styles.exerciseMeta}>
                                    {ex.performance ? `${ex.performance.length} Sets` : 'Skipped'}
                                </Text>
                            </View>
                            {ex.completed && <Text style={styles.check}>✓</Text>}
                        </View>
                    ))}
                </View>

                <View style={styles.intensityContainer}>
                    <Text style={styles.intensityTitle}>Dataset Intensity: {intensity}/10</Text>
                    <View
                        style={styles.sliderTrack}
                        onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
                    >
                        <View
                            style={[
                                styles.sliderFill,
                                { width: sliderWidth ? (intensity / 10) * sliderWidth : 0 }
                            ]}
                        />
                        {Array.from({ length: 10 }).map((_, i) => (
                            <View key={i} style={styles.sliderSegment} />
                        ))}
                        <View
                            style={styles.touchOverlay}
                            {...panResponder.panHandlers}
                        />
                    </View>
                    <View style={styles.intensityLabels}>
                        <Text style={styles.intensityLabel}>1 (Easy)</Text>
                        <Text style={styles.intensityLabel}>10 (Max)</Text>
                    </View>
                </View>

                <TouchableOpacity style={styles.finishBtn} onPress={handleFinish}>
                    <Text style={styles.finishBtnText}>Finish Workout</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    scrollContent: {
        padding: theme.spacing.l,
        paddingBottom: 40,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: theme.colors.text.primary,
        marginBottom: theme.spacing.xs,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 18,
        color: theme.colors.text.secondary,
        textAlign: 'center',
        marginBottom: theme.spacing.xl,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: theme.spacing.l,
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        ...theme.shadows.soft,
    },
    statItem: {
        alignItems: 'center',
    },
    statDivider: {
        width: 1,
        height: '80%',
        backgroundColor: theme.colors.border,
        alignSelf: 'center',
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.colors.text.primary,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.colors.text.secondary,
        textTransform: 'uppercase',
    },
    exercisesList: {
        marginBottom: theme.spacing.xl,
    },
    exerciseItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing.m,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    exerciseInfo: {
        flex: 1,
    },
    exerciseName: {
        fontSize: 16,
        color: theme.colors.text.primary,
        fontWeight: '500',
    },
    exerciseMeta: {
        fontSize: 12,
        color: theme.colors.text.secondary,
        marginTop: 2,
    },
    check: {
        color: theme.colors.success,
        fontSize: 18,
        fontWeight: 'bold',
    },
    finishBtn: {
        backgroundColor: theme.colors.primary,
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        alignItems: 'center',
        marginBottom: theme.spacing.xl,
        ...theme.shadows.soft,
    },
    finishBtnText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 18,
    },
    intensityContainer: {
        marginBottom: theme.spacing.xl,
    },
    intensityTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text.primary,
        marginBottom: theme.spacing.m,
        textAlign: 'center',
    },
    sliderTrack: {
        height: 40,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.m,
        borderWidth: 1,
        borderColor: theme.colors.border,
        overflow: 'hidden',
        position: 'relative',
        flexDirection: 'row',
    },
    sliderFill: {
        backgroundColor: theme.colors.primary,
        height: '100%',
        position: 'absolute',
        left: 0,
        top: 0,
    },
    sliderSegment: {
        flex: 1,
        borderRightWidth: 1,
        borderRightColor: 'rgba(0,0,0,0.05)',
        zIndex: 1,
    },
    intensityLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: theme.spacing.s,
    },
    intensityLabel: {
        fontSize: 14,
        color: theme.colors.text.secondary,
    },
    touchOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10,
    },
});
