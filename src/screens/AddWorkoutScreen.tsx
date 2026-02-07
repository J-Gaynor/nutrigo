import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Alert,
    ScrollView,
    SafeAreaView,
    ActivityIndicator
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';
import {
    addWorkoutToLog,
    getTodayDate,
    getWorkoutRoutines,
    getRecentWorkouts,
    addWorkoutFromRoutine,
    deleteWorkoutRoutine
} from '../services/storage';
import { WorkoutRoutine } from '../types/food';
import { useSubscription } from '../context/SubscriptionContext';

type AddWorkoutScreenProps = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'AddWorkout'>;
    route: RouteProp<RootStackParamList, 'AddWorkout'>;
};

export const AddWorkoutScreen: React.FC<AddWorkoutScreenProps> = ({ navigation, route }) => {
    const { isPremium } = useSubscription();
    const selectedDate = route.params?.date || getTodayDate();
    const [name, setName] = useState('');
    const [selectedDay, setSelectedDay] = useState<string | null>(null); // Optional day of week
    const [selectedRoutine, setSelectedRoutine] = useState<WorkoutRoutine | null>(null);
    const [routines, setRoutines] = useState<WorkoutRoutine[]>([]);
    const [isLoadingRoutines, setIsLoadingRoutines] = useState(false);

    useFocusEffect(
        useCallback(() => {
            // Check gating
            if (selectedDate !== getTodayDate() && !isPremium) {
                navigation.goBack();
                navigation.navigate('Paywall');
                return;
            }

            loadRoutines();
        }, [selectedDate, isPremium])
    );

    const loadRoutines = async () => {
        setIsLoadingRoutines(true);
        try {
            const data = await getWorkoutRoutines();
            setRoutines(data);
        } catch (error) {
            console.error('Failed to load routines:', error);
        } finally {
            setIsLoadingRoutines(false);
        }
    };

    const handleSelectRoutine = (routine: WorkoutRoutine) => {
        setSelectedRoutine(routine);
        setName(routine.name);
    };

    const handleDeleteRoutine = async (routineId: string) => {
        Alert.alert(
            'Delete Routine',
            'Are you sure you want to delete this routine?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteWorkoutRoutine(routineId);
                            loadRoutines();
                            // Deselect if currently selected
                            if (selectedRoutine?.id === routineId) {
                                setSelectedRoutine(null);
                                setName('');
                            }
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete routine');
                        }
                    }
                }
            ]
        );
    };

    const handleStartRoutine = async (routine: WorkoutRoutine) => {
        try {
            // "Start Workout" flow for saved routines
            navigation.replace('WorkoutExecute', {
                date: selectedDate,
                routine: routine
            });
        } catch (error) {
            console.error('Error starting routine:', error);
            Alert.alert('Error', 'Failed to start routine');
        }
    };


    const DAYS_OF_WEEK = [
        { id: 'mon', label: 'Mon' },
        { id: 'tue', label: 'Tue' },
        { id: 'wed', label: 'Wed' },
        { id: 'thu', label: 'Thu' },
        { id: 'fri', label: 'Fri' },
        { id: 'sat', label: 'Sat' },
        { id: 'sun', label: 'Sun' },
    ];



    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert('Required', 'Please enter a workout name');
            return;
        }

        if (selectedRoutine) {
            // "Start Workout" flow for saved routines
            // "Start Workout" flow for saved routines
            try {
                navigation.replace('WorkoutExecute', {
                    date: selectedDate,
                    routine: selectedRoutine
                });
            } catch (error) {
                console.error('Error starting routine:', error);
                Alert.alert('Error', 'Failed to start routine');
            }
        } else {
            // Manual creation flow
            // Include day of week in the name if selected
            const finalName = selectedDay
                ? `${name.trim()} (${DAYS_OF_WEEK.find(d => d.id === selectedDay)?.label})`
                : name.trim();

            navigation.replace('WorkoutDetail', {
                date: selectedDate,
                workoutName: finalName
            });
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.form}>
                    <Text style={styles.sectionTitle}>Create New Workout</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Workout Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Upper Body"
                            value={name}
                            onChangeText={(text) => {
                                setName(text);
                                // Clear selection if user types manually
                                if (selectedRoutine && text !== selectedRoutine.name) {
                                    setSelectedRoutine(null);
                                }
                            }}
                            autoFocus
                            maxLength={50}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Day of Week (Optional)</Text>
                        <View style={styles.daySelector}>
                            {DAYS_OF_WEEK.map((day) => (
                                <TouchableOpacity
                                    key={day.id}
                                    style={[
                                        styles.dayCircle,
                                        selectedDay === day.id && styles.selectedDayCircle
                                    ]}
                                    onPress={() => setSelectedDay(selectedDay === day.id ? null : day.id)}
                                >
                                    <Text style={[
                                        styles.dayLabel,
                                        selectedDay === day.id && styles.selectedDayLabel
                                    ]}>
                                        {day.label[0]}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <Text style={styles.dateInfo}>
                        Date: {selectedDate}
                    </Text>

                    <TouchableOpacity
                        style={[styles.saveButton, !name.trim() && styles.disabledButton, selectedRoutine && styles.startRoutineButton]}
                        onPress={handleSave}
                        disabled={!name.trim()}
                    >
                        <Text style={styles.saveButtonText}>
                            {selectedRoutine ? 'Start Workout' : 'Create Workout'}
                        </Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    scrollContent: {
        padding: theme.spacing.l,
    },
    form: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.l,
        padding: theme.spacing.l,
        ...theme.shadows.soft,
        marginBottom: theme.spacing.l,
    },
    section: {
        marginBottom: theme.spacing.xl,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text.primary,
        marginBottom: theme.spacing.m,
    },
    inputGroup: {
        marginBottom: theme.spacing.m,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.text.secondary,
        marginBottom: theme.spacing.xs,
    },
    input: {
        backgroundColor: theme.colors.background,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.borderRadius.m,
        padding: theme.spacing.m,
        fontSize: 16,
        color: theme.colors.text.primary,
    },
    row: {
        flexDirection: 'row',
    },
    dateInfo: {
        fontSize: 14,
        color: theme.colors.text.secondary,
        marginTop: theme.spacing.s,
        marginBottom: theme.spacing.m,
        fontStyle: 'italic',
    },
    saveButton: {
        backgroundColor: theme.colors.primary,
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        alignItems: 'center',
        marginTop: theme.spacing.m,
        height: 54,
        justifyContent: 'center',
    },
    disabledButton: {
        backgroundColor: theme.colors.border,
    },
    saveButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    routinesList: {
        marginTop: theme.spacing.s,
    },
    routineCard: {
        flexDirection: 'row',
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.m,
        marginBottom: theme.spacing.s,
        alignItems: 'center',
        ...theme.shadows.soft,
    },
    routineBtn: {
        flex: 1,
        padding: theme.spacing.m,
    },
    routineName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text.primary,
        marginBottom: 2,
    },
    routineDesc: {
        fontSize: 14,
        color: theme.colors.text.secondary,
    },
    deleteRoutineBtn: {
        padding: theme.spacing.m,
    },
    deleteRoutineText: {
        color: theme.colors.text.tertiary,
        fontSize: 14,
    },
    daySelector: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: theme.spacing.s,
    },
    dayCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: theme.colors.background,
        borderWidth: 1,
        borderColor: theme.colors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    selectedDayCircle: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary,
    },
    dayLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: theme.colors.text.secondary,
    },
    selectedDayLabel: {
        color: '#FFF',
    },
    startRoutineButton: {
        backgroundColor: theme.colors.success,
    },
    selectedRoutineCard: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary,
    },
    selectedRoutineText: {
        color: '#FFF',
    },
    emptyText: {
        textAlign: 'center',
        color: theme.colors.text.secondary,
        fontStyle: 'italic',
        marginTop: theme.spacing.m,
    },
});
