import React, { useState, useCallback, useEffect, useRef, useLayoutEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TextInput,
    TouchableOpacity,
    Alert,
    Modal,
    FlatList,
    ActivityIndicator,
    BackHandler,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { getWorkoutById, getLastExercisePerformance, updatePersonalRecord, incrementWorkoutPrCount, getExerciseHistory } from '../services/storage';
import { calculateOneRepMax } from '../utils/fitness';
import { WorkoutEntry, SetPerformance, WorkoutExercise } from '../types/food';
import { theme } from '../theme';
import { useSubscription } from '../context/SubscriptionContext';
import { WorkoutSummaryView } from '../components/WorkoutSummaryView';

type Props = NativeStackScreenProps<RootStackParamList, 'ExerciseLog'>;

interface SetLog {
    setNumber: number;
    weight: string;
    reps: string;
    completed: boolean;
}

export const ExerciseLogScreen: React.FC<Props> = ({ route, navigation }) => {
    // Initial params come from navigation, but we'll track active index locally
    const { date, workoutId, exerciseId: initialExerciseId, exerciseName: initialExerciseName, sets: initialSets, restTime: initialRestTime, exerciseIndex: initialIndex, totalExercises, startTime } = route.params;
    const { isPremium } = useSubscription();

    // -- State --
    const [activeExerciseIndex, setActiveExerciseIndex] = useState(initialIndex);
    const [workout, setWorkout] = useState<WorkoutEntry | null>(null);
    const [completedExercises, setCompletedExercises] = useState<Set<number>>(new Set());

    // Current Exercise Data (Derived from workout + index)
    const [currentExercise, setCurrentExercise] = useState<WorkoutExercise | null>(null);

    // Logs for the current exercise
    const [setLogs, setSetLogs] = useState<SetLog[]>([]);

    // UI State
    const [currentSetIndex, setCurrentSetIndex] = useState(0);
    const [isResting, setIsResting] = useState(false);
    const [restTimeRemaining, setRestTimeRemaining] = useState(0);
    const [editableRestMinutes, setEditableRestMinutes] = useState(0);
    const [editableRestSeconds, setEditableRestSeconds] = useState(0);

    // History State
    const [showHistory, setShowHistory] = useState(false);
    const [historyLogs, setHistoryLogs] = useState<{ date: string; performance: SetPerformance[] }[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Session Timer State
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    const restIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const touchStartX = useRef<number>(0);
    const touchStartY = useRef<number>(0);

    // -- Back Button Handling --
    const handleBackPress = useCallback(() => {
        Alert.alert(
            'End Workout?',
            'Are you sure you want to exit the workout? Your progress is saved, but the session will be closed.',
            [
                { text: 'Cancel', style: 'cancel', onPress: () => { } },
                {
                    text: 'End Workout',
                    style: 'destructive',
                    onPress: () => {
                        // Go back to Home -> Workout Tab
                        navigation.navigate('Home', { date, activeTab: 'workout' });
                    }
                },
            ]
        );
        return true; // Return true to prevent default back action
    }, [navigation, date]);

    useFocusEffect(
        useCallback(() => {
            const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
            return () => subscription.remove();
        }, [handleBackPress])
    );

    useLayoutEffect(() => {
        navigation.setOptions({
            headerLeft: () => (
                <TouchableOpacity onPress={handleBackPress} style={{ paddingRight: 16 }}>
                    <Text style={{ fontSize: 18, color: '#ffffff', fontWeight: '600' }}>‹ Exit</Text>
                </TouchableOpacity>
            ),
            title: currentExercise ? currentExercise.name : 'Log Set',
        });
    }, [navigation, handleBackPress, currentExercise]);


    // -- Load Workout & Init --
    const loadWorkout = useCallback(async () => {
        const data = await getWorkoutById(date, workoutId);
        if (data) {
            setWorkout(data);

            // Check which exercises are completed
            const completed = new Set<number>();
            data.exercises.forEach((ex, idx) => {
                if (ex.completed) completed.add(idx);
            });
            setCompletedExercises(completed);
        }
    }, [date, workoutId]);

    useFocusEffect(
        useCallback(() => {
            loadWorkout();
        }, [loadWorkout])
    );

    // -- Effect: Switch Exercise --
    useEffect(() => {
        if (!workout) return;

        // If index is summary
        if (activeExerciseIndex >= totalExercises) {
            setCurrentExercise(null);
            return;
        }

        const targetEx = workout.exercises[activeExerciseIndex];
        if (targetEx) {
            setCurrentExercise(targetEx);

            // Initialize Logs based on existing performance OR default sets
            let initialLogs: SetLog[] = [];

            if (targetEx.performance && targetEx.performance.length > 0) {
                // Load existing data
                initialLogs = targetEx.performance.map(p => ({
                    setNumber: p.setNumber,
                    weight: p.weight.toString(),
                    reps: p.reps.toString(),
                    completed: true // Mark as completed if loaded from DB? Or maybe user is editing. Let's assume completed if saved.
                }));
            } else {
                // New default logs
                const numSets = targetEx.sets || 3;
                initialLogs = Array.from({ length: numSets }, (_, i) => ({
                    setNumber: i + 1,
                    weight: '',
                    reps: '',
                    completed: false,
                }));
            }
            setSetLogs(initialLogs);

            // Reset UI for new exercise
            setCurrentSetIndex(0); // Optionally could jump to first incomplete set
            setIsResting(false);
            setRestTimeRemaining(0);

            const rTime = targetEx.restTime || 90;
            setEditableRestMinutes(Math.floor(rTime / 60));
            setEditableRestSeconds(rTime % 60);

            // Auto-fill previous history if empty
            if (!targetEx.performance || targetEx.performance.length === 0) {
                loadHistoryForAutoFill(targetEx.name, initialLogs);
            }
        }
    }, [workout, activeExerciseIndex, totalExercises]);

    const loadHistoryForAutoFill = async (exName: string, currentLogs: SetLog[]) => {
        const lastPerf = await getLastExercisePerformance(exName, date);
        if (lastPerf && lastPerf.length > 0) {
            setSetLogs(prev => prev.map((log, index) => {
                const perfSet = lastPerf[index] || lastPerf[lastPerf.length - 1];
                return {
                    ...log,
                    weight: perfSet.weight.toString(),
                    reps: perfSet.reps.toString(),
                };
            }));
        }
    };


    // -- History Modal --
    const handleOpenHistory = async () => {
        if (!currentExercise) return;
        setShowHistory(true);
        setLoadingHistory(true);
        try {
            const history = await getExerciseHistory(currentExercise.name, 10);

            if (isPremium) {
                setHistoryLogs(history);
            } else {
                if (history.length > 0) {
                    let bestSession = history[0];
                    let max1RM = 0;
                    history.forEach(session => {
                        session.performance.forEach(set => {
                            const oneRM = calculateOneRepMax(set.weight, set.reps);
                            if (oneRM > max1RM) {
                                max1RM = oneRM;
                                bestSession = session;
                            }
                        });
                    });
                    setHistoryLogs([bestSession]);
                } else {
                    setHistoryLogs([]);
                }
            }
        } catch (error) {
            console.error('Failed to load history:', error);
            Alert.alert('Error', 'Failed to load history');
        } finally {
            setLoadingHistory(false);
        }
    };

    // Rest timer countdown
    useEffect(() => {
        if (isResting && restTimeRemaining > 0) {
            restIntervalRef.current = setInterval(() => {
                setRestTimeRemaining((prev) => {
                    if (prev <= 1) {
                        setIsResting(false);
                        if (restIntervalRef.current) clearInterval(restIntervalRef.current);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (restIntervalRef.current) clearInterval(restIntervalRef.current);
        };
    }, [isResting, restTimeRemaining]);

    // Session Timer Effect
    useEffect(() => {
        if (startTime) {
            setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
            const interval = setInterval(() => {
                setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [startTime]);

    const updateSetLog = (index: number, field: 'weight' | 'reps', value: string) => {
        const updated = [...setLogs];
        updated[index][field] = value;
        setSetLogs(updated);
    };

    // -- Navigation Helpers --
    const changeExercise = (index: number) => {
        if (index < 0 || index > totalExercises) return;
        setActiveExerciseIndex(index);
    };

    const navigateToNextExercise = () => {
        if (activeExerciseIndex < totalExercises) {
            setActiveExerciseIndex(prev => prev + 1);
        }
    };

    const navigateToPreviousExercise = () => {
        if (activeExerciseIndex > 0) {
            setActiveExerciseIndex(prev => prev - 1);
        }
    };


    const handleLogSet = async () => {
        if (!currentExercise) return;
        const currentSet = setLogs[currentSetIndex];

        if (!currentSet.weight || !currentSet.reps) {
            Alert.alert('Missing Data', 'Please enter weight and reps');
            return;
        }

        const weight = parseFloat(currentSet.weight);
        const reps = parseInt(currentSet.reps);

        if (weight > 0 && reps > 0) {
            const oneRepMax = calculateOneRepMax(weight, reps);
            const isNewRecord = await updatePersonalRecord(currentExercise.name, oneRepMax);
            if (isNewRecord) {
                incrementWorkoutPrCount(date, workoutId);
                Alert.alert('New Personal Record! 🎉', `You hit a new 1RM of ${oneRepMax.toFixed(1)} kg!`);
            }
        }

        const updated = [...setLogs];
        updated[currentSetIndex].completed = true;
        setSetLogs(updated);

        const isLastSet = currentSetIndex === setLogs.length - 1;

        if (isLastSet) {
            // Save Exercise
            const performanceData = setLogs.map(log => ({
                setNumber: log.setNumber,
                weight: parseFloat(log.weight) || 0,
                reps: parseInt(log.reps) || 0,
            }));

            try {
                const { completeWorkout } = await import('../services/storage');
                await completeWorkout(date, workoutId, currentExercise.id, performanceData, false); // Don't sync to log until full workout finished
            } catch (error) {
                console.error('Error saving exercise performance:', error);
            }

            // Mark completed locally
            const newCompleted = new Set(completedExercises);
            newCompleted.add(activeExerciseIndex);
            setCompletedExercises(newCompleted);

            navigateToNextExercise();
        } else {
            // Rest Timer
            const totalRestTime = editableRestMinutes * 60 + editableRestSeconds;
            if (totalRestTime > 0) {
                setRestTimeRemaining(totalRestTime);
                setIsResting(true);
            }
            setCurrentSetIndex(currentSetIndex + 1);
        }
    };

    const addSet = () => {
        const newSet: SetLog = {
            setNumber: setLogs.length + 1,
            weight: '',
            reps: '',
            completed: false,
        };
        setSetLogs([...setLogs, newSet]);
    };

    const removeSet = () => {
        if (setLogs.length > 1 && currentSetIndex < setLogs.length - 1) {
            const updated = setLogs.filter((_, index) => index !== setLogs.length - 1);
            setSetLogs(updated);
        }
    };

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const buttonText = 'Log Set';
    const currentWeight = parseFloat(setLogs[currentSetIndex]?.weight || '0');
    const currentReps = parseInt(setLogs[currentSetIndex]?.reps || '0');
    const current1RM = calculateOneRepMax(currentWeight, currentReps);

    const handleTouchStart = (e: any) => {
        touchStartX.current = e.nativeEvent.pageX;
        touchStartY.current = e.nativeEvent.pageY;
    };

    const handleTouchEnd = (e: any) => {
        const touchEndX = e.nativeEvent.pageX;
        const touchEndY = e.nativeEvent.pageY;
        const deltaX = touchEndX - touchStartX.current;
        const deltaY = touchEndY - touchStartY.current;

        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
            if (deltaX > 0) {
                navigateToPreviousExercise();
            } else if (deltaX < 0) {
                navigateToNextExercise();
            }
        }
    };

    // --- RENDER: Summary ---
    if (activeExerciseIndex >= totalExercises) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.progressBarContainer}>
                    <View style={styles.progressBar}>
                        {Array.from({ length: totalExercises + 1 }).map((_, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.progressSegment,
                                    index < totalExercises && completedExercises.has(index) && styles.completedSegment,
                                    index === activeExerciseIndex && styles.activeSegment,
                                ]}
                                onPress={() => changeExercise(index)}
                                activeOpacity={0.7}
                            />
                        ))}
                    </View>
                </View>
                <WorkoutSummaryView
                    date={date}
                    workoutId={workoutId}
                    startTime={startTime}
                    onFinish={() => navigation.navigate('Home', { date, activeTab: 'workout' })}
                />
            </SafeAreaView>
        );
    }

    // --- RENDER: Exercise ---
    if (!currentExercise) {
        // Loading state or error state if index is valid but no workout loaded yet
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 50 }} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Progress Bar */}
            <View style={styles.progressBarContainer}>
                <View style={styles.progressBar}>
                    {Array.from({ length: totalExercises + 1 }).map((_, index) => (
                        <TouchableOpacity
                            key={index}
                            style={[
                                styles.progressSegment,
                                index < totalExercises && completedExercises.has(index) && styles.completedSegment,
                                index === activeExerciseIndex && styles.activeSegment,
                            ]}
                            onPress={() => changeExercise(index)}
                            activeOpacity={0.7}
                        />
                    ))}
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                {/* Exercise Header */}
                <View style={styles.header}>
                    <View style={styles.headerTopRow}>
                        <Text style={styles.title}>{currentExercise.name}</Text>
                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                            <TouchableOpacity
                                style={styles.historyBtn}
                                onPress={handleOpenHistory}
                            >
                                <Text style={styles.historyBtnText}>History</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    {startTime && (
                        <View style={styles.sessionTimerBadge}>
                            <Text style={styles.sessionTimerText}>
                                {formatTime(elapsedSeconds)}
                            </Text>
                        </View>
                    )}
                    <Text style={styles.subtitle}>
                        Exercise {activeExerciseIndex + 1} of {totalExercises} • Set {currentSetIndex + 1} of {setLogs.length}
                    </Text>
                </View>

                {/* Table */}
                <View style={styles.tableContainer}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.headerCell, styles.setCell]}>Set</Text>
                        <Text style={[styles.headerCell, styles.weightCell]}>kg</Text>
                        <Text style={[styles.headerCell, styles.repsCell]}>Reps</Text>
                    </View>
                    {setLogs.map((setLog, index) => (
                        <View
                            key={index}
                            style={[
                                styles.tableRow,
                                index === currentSetIndex && styles.activeRow,
                                setLog.completed && styles.completedRow,
                            ]}
                        >
                            <View style={[styles.cell, styles.setCell]}>
                                <Text style={styles.setCellText}>{setLog.setNumber}</Text>
                            </View>
                            <View style={[styles.cell, styles.weightCell]}>
                                <TextInput
                                    style={[styles.input, index !== currentSetIndex && styles.disabledInput]}
                                    placeholder="0"
                                    keyboardType="numeric"
                                    value={setLog.weight}
                                    onChangeText={(text) => updateSetLog(index, 'weight', text.replace(/[^0-9.]/g, ''))}
                                    editable={index === currentSetIndex}
                                    maxLength={5}
                                />
                            </View>
                            <View style={[styles.cell, styles.repsCell]}>
                                <TextInput
                                    style={[styles.input, index !== currentSetIndex && styles.disabledInput]}
                                    placeholder="0"
                                    keyboardType="numeric"
                                    value={setLog.reps}
                                    onChangeText={(text) => updateSetLog(index, 'reps', text.replace(/[^0-9]/g, ''))}
                                    editable={index === currentSetIndex}
                                    maxLength={3}
                                />
                            </View>
                        </View>
                    ))}
                </View>

                <TouchableOpacity style={styles.saveBtn} onPress={handleLogSet}>
                    <Text style={styles.saveBtnText}>{buttonText}</Text>
                </TouchableOpacity>

                {/* Rest Timer */}
                {!isResting ? (
                    <View style={styles.timerConfigContainer}>
                        <Text style={styles.timerConfigLabel}>Rest Timer</Text>
                        <View style={styles.timerControls}>
                            <View style={styles.timerControlGroup}>
                                <TouchableOpacity
                                    style={styles.timerArrow}
                                    onPress={() => setEditableRestMinutes(prev => Math.max(0, prev + 1))}
                                >
                                    <Text style={styles.timerArrowText}>▲</Text>
                                </TouchableOpacity>
                                <Text style={styles.timerValue}>{editableRestMinutes}m</Text>
                                <TouchableOpacity
                                    style={styles.timerArrow}
                                    onPress={() => setEditableRestMinutes(prev => Math.max(0, prev - 1))}
                                >
                                    <Text style={styles.timerArrowText}>▼</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.timerSeparator}>:</Text>

                            <View style={styles.timerControlGroup}>
                                <TouchableOpacity
                                    style={styles.timerArrow}
                                    onPress={() => setEditableRestSeconds(prev => {
                                        const next = prev + 15;
                                        return next >= 60 ? 0 : next;
                                    })}
                                >
                                    <Text style={styles.timerArrowText}>▲</Text>
                                </TouchableOpacity>
                                <Text style={styles.timerValue}>{editableRestSeconds.toString().padStart(2, '0')}s</Text>
                                <TouchableOpacity
                                    style={styles.timerArrow}
                                    onPress={() => setEditableRestSeconds(prev => {
                                        const next = prev - 15;
                                        return next < 0 ? 45 : next;
                                    })}
                                >
                                    <Text style={styles.timerArrowText}>▼</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                ) : (
                    <View style={styles.activeRestTimerContainer}>
                        <Text style={styles.activeRestTimerLabel}>Resting...</Text>
                        <Text style={styles.activeRestTimerValue}>{formatTime(restTimeRemaining)}</Text>
                        <TouchableOpacity
                            style={styles.skipRestBtn}
                            onPress={() => {
                                setIsResting(false);
                                setRestTimeRemaining(0);
                                if (restIntervalRef.current) clearInterval(restIntervalRef.current);
                            }}
                        >
                            <Text style={styles.skipRestText}>Skip Rest</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.prContainer}>
                    {current1RM > 0 && (
                        <Text style={styles.prText}>
                            Est. 1RM: {current1RM.toFixed(1)} kg
                        </Text>
                    )}
                </View>

                <View style={styles.setControls}>
                    <TouchableOpacity onPress={addSet} style={styles.setControlBtn}>
                        <Text style={styles.setControlText}>Add Set</Text>
                    </TouchableOpacity>
                    {setLogs.length > 1 && (
                        <TouchableOpacity onPress={removeSet} style={[styles.setControlBtn, styles.removeSetBtn]}>
                            <Text style={[styles.setControlText, styles.removeSetText]}>Remove Set</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* History Modal */}
                <Modal
                    visible={showHistory}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setShowHistory(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>History</Text>
                                <TouchableOpacity onPress={() => setShowHistory(false)}>
                                    <Text style={styles.closeBtnText}>Close</Text>
                                </TouchableOpacity>
                            </View>

                            {loadingHistory ? (
                                <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginVertical: 20 }} />
                            ) : (
                                <FlatList
                                    data={historyLogs}
                                    keyExtractor={(item, index) => `${item.date}-${index}`}
                                    style={{ maxHeight: 400 }}
                                    renderItem={({ item }) => (
                                        <View style={styles.historyItem}>
                                            <Text style={styles.historyDate}>
                                                {new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
                                            </Text>
                                            <View style={styles.historySets}>
                                                {item.performance.map((set, idx) => (
                                                    <Text key={idx} style={styles.historySetText}>
                                                        {set.weight}kg x {set.reps}
                                                    </Text>
                                                ))}
                                            </View>
                                            <Text style={styles.history1RM}>
                                                1RM: {Math.max(...item.performance.map(p => calculateOneRepMax(p.weight, p.reps))).toFixed(1)}kg
                                            </Text>
                                        </View>
                                    )}
                                    ListEmptyComponent={
                                        <Text style={styles.emptyHistoryText}>No history found.</Text>
                                    }
                                />
                            )}
                            {!isPremium && historyLogs.length > 0 && (
                                <TouchableOpacity
                                    style={styles.upgradeBanner}
                                    onPress={() => {
                                        setShowHistory(false);
                                        navigation.navigate('Paywall');
                                    }}
                                >
                                    <Text style={styles.upgradeText}>See full exercise history with Stamina Pro!</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </Modal>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    progressBarContainer: {
        backgroundColor: theme.colors.surface,
        paddingVertical: theme.spacing.m,
        paddingHorizontal: theme.spacing.l,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    progressBar: {
        flexDirection: 'row',
        gap: 4,
    },
    progressSegment: {
        flex: 1,
        height: 6,
        backgroundColor: theme.colors.border,
        borderRadius: 3,
    },
    completedSegment: {
        backgroundColor: theme.colors.primary,
    },
    activeSegment: {
        backgroundColor: theme.colors.primary,
        opacity: 0.6,
    },
    scrollContent: {
        padding: theme.spacing.l,
    },
    header: {
        marginBottom: theme.spacing.xl,
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.xs,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: theme.colors.text.primary,
        flex: 1,
        marginRight: theme.spacing.m,
    },
    sessionTimerBadge: {
        backgroundColor: theme.colors.surface,
        paddingHorizontal: theme.spacing.m,
        paddingVertical: 4,
        borderRadius: theme.borderRadius.l,
        borderWidth: 1,
        borderColor: theme.colors.primary,
        alignSelf: 'flex-start',
        marginBottom: 8,
    },
    sessionTimerText: {
        color: theme.colors.primary,
        fontWeight: 'bold',
        fontVariant: ['tabular-nums'],
    },
    subtitle: {
        fontSize: 16,
        color: theme.colors.text.secondary,
    },
    tableContainer: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.m,
        overflow: 'hidden',
        ...theme.shadows.soft,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: theme.colors.primary,
        paddingVertical: theme.spacing.m,
        paddingHorizontal: theme.spacing.s,
    },
    headerCell: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#FFF',
        textAlign: 'center',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        paddingVertical: theme.spacing.s,
        paddingHorizontal: theme.spacing.s,
    },
    activeRow: {
        backgroundColor: theme.colors.primary + '15',
    },
    completedRow: {
        opacity: 0.5,
    },
    cell: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    setCell: {
        flex: 1,
    },
    weightCell: {
        flex: 2,
    },
    repsCell: {
        flex: 2,
    },
    setCellText: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text.primary,
    },
    input: {
        backgroundColor: theme.colors.background,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.borderRadius.s,
        padding: theme.spacing.s,
        fontSize: 16,
        color: theme.colors.text.primary,
        textAlign: 'center',
        width: '100%',
    },
    disabledInput: {
        backgroundColor: theme.colors.border + '30',
        color: theme.colors.text.tertiary,
    },
    saveBtn: {
        backgroundColor: theme.colors.primary,
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        alignItems: 'center',
        marginTop: theme.spacing.l,
        ...theme.shadows.soft,
    },
    saveBtnText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    timerConfigContainer: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.m,
        padding: theme.spacing.l,
        marginTop: theme.spacing.l,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: theme.colors.border,
    },
    timerConfigLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.text.secondary,
        marginBottom: theme.spacing.m,
    },
    timerControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    timerControlGroup: {
        alignItems: 'center',
        gap: 4,
    },
    timerArrow: {
        padding: 8,
    },
    timerArrowText: {
        fontSize: 18,
        color: theme.colors.primary,
    },
    timerValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.colors.text.primary,
        fontVariant: ['tabular-nums'],
    },
    timerSeparator: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.colors.text.tertiary,
        marginTop: -4,
    },
    activeRestTimerContainer: {
        backgroundColor: theme.colors.primary,
        borderRadius: theme.borderRadius.m,
        padding: theme.spacing.l,
        marginTop: theme.spacing.l,
        alignItems: 'center',
        ...theme.shadows.medium,
    },
    activeRestTimerLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.9)',
        marginBottom: theme.spacing.xs,
    },
    activeRestTimerValue: {
        fontSize: 42,
        fontWeight: 'bold',
        color: '#ffffff',
        fontVariant: ['tabular-nums'],
        marginBottom: theme.spacing.m,
    },
    skipRestBtn: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: theme.spacing.l,
        paddingVertical: theme.spacing.s,
        borderRadius: theme.borderRadius.l,
    },
    skipRestText: {
        color: '#ffffff',
        fontWeight: '600',
        fontSize: 14,
    },
    prContainer: {
        alignItems: 'center',
        marginTop: theme.spacing.m,
        height: 24,
    },
    prText: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.gold,
    },
    setControls: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: theme.spacing.m,
        marginTop: theme.spacing.l,
        marginBottom: theme.spacing.xl,
    },
    setControlBtn: {
        paddingVertical: theme.spacing.s,
        paddingHorizontal: theme.spacing.l,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.l,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    setControlText: {
        color: theme.colors.text.primary,
        fontSize: 14,
        fontWeight: '500',
    },
    removeSetBtn: {
        borderColor: theme.colors.error + '50',
    },
    removeSetText: {
        color: theme.colors.error,
    },
    historyBtn: {
        backgroundColor: theme.colors.surface,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    historyBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.colors.primary,
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
        padding: 20,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.l,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        paddingBottom: theme.spacing.s,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text.primary,
    },
    closeBtnText: {
        fontSize: 16,
        color: theme.colors.primary,
        fontWeight: '600',
    },
    historyItem: {
        marginBottom: theme.spacing.l,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        paddingBottom: theme.spacing.s,
    },
    historyDate: {
        fontSize: 14,
        color: theme.colors.text.secondary,
        marginBottom: 4,
    },
    historySets: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 4,
    },
    historySetText: {
        fontSize: 16,
        color: theme.colors.text.primary,
        fontWeight: '500',
    },
    history1RM: {
        fontSize: 14,
        color: theme.colors.gold,
        fontWeight: '600',
        marginTop: 4,
    },
    emptyHistoryText: {
        textAlign: 'center',
        color: theme.colors.text.secondary,
        marginTop: 20,
        fontSize: 16,
    },
    upgradeBanner: {
        backgroundColor: theme.colors.primary + '15',
        padding: 12,
        borderRadius: 8,
        marginTop: 16,
        alignItems: 'center',
    },
    upgradeText: {
        color: theme.colors.primary,
        fontWeight: 'bold',
        fontSize: 14,
    },
});
