import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    SafeAreaView,
    FlatList,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';
import { EXERCISE_OPTIONS } from '../data/exercises';
import { addExerciseToWorkout } from '../services/storage';
import { useSubscription } from '../context/SubscriptionContext';

type Props = NativeStackScreenProps<RootStackParamList, 'AddWorkoutExercise'>;

export const AddWorkoutExerciseScreen: React.FC<Props> = ({ navigation, route }) => {
    const { date, workoutId, workoutName } = route.params;
    const { isPremium } = useSubscription();

    const [searchQuery, setSearchQuery] = useState('');
    const [sets, setSets] = useState('3');
    const [restMinutes, setRestMinutes] = useState('1');
    const [restSeconds, setRestSeconds] = useState('30');
    const [showDropdown, setShowDropdown] = useState(false);

    const filteredExercises = EXERCISE_OPTIONS.filter(ex =>
        ex.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelectExercise = (exerciseName: string) => {
        setSearchQuery(exerciseName);
        setShowDropdown(false);
    };

    const handleAdd = async () => {
        if (!searchQuery.trim()) {
            Alert.alert('Required', 'Enter exercise name');
            return;
        }

        const exercise = {
            id: Date.now().toString(),
            name: searchQuery.trim(),
            sets: parseInt(sets) || 3,
            reps: 0,
            weight: 0,
            restTime: (parseInt(restMinutes) || 1) * 60 + (parseInt(restSeconds) || 30),
        };

        try {
            if (workoutId) {
                // Existing workout: Save to database
                await addExerciseToWorkout(date, workoutId, exercise, isPremium);
                navigation.goBack();
            } else {
                // Draft mode: Use callback pattern
                if (route.params.onSubmit) {
                    route.params.onSubmit(exercise);
                    navigation.goBack();
                } else {
                    // Fallback (should not happen with new flow)
                    console.warn('No onSubmit callback provided for draft workout');
                    navigation.navigate({
                        name: 'WorkoutDetail',
                        params: {
                            date,
                            workoutId: undefined,
                            workoutName: route.params.workoutName
                        },
                        merge: true
                    });
                }
            }
        } catch (error) {
            console.error('Failed to add exercise:', error);
            Alert.alert('Error', 'Failed to add exercise to workout');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={styles.content}>
                    <Text style={styles.title}>Add Exercise</Text>

                    {/* Exercise Search */}
                    <View style={[styles.inputGroup, { zIndex: 10 }]}>
                        <Text style={styles.label}>Exercise Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Search exercises..."
                            value={searchQuery}
                            onChangeText={(text) => {
                                setSearchQuery(text);
                                setShowDropdown(true);
                            }}
                            onFocus={() => setShowDropdown(true)}
                            autoFocus
                            maxLength={50}
                        />
                        {showDropdown && searchQuery.length > 0 && (
                            <View style={styles.dropdownContainer}>
                                <FlatList
                                    data={filteredExercises}
                                    keyExtractor={item => item.id}
                                    keyboardShouldPersistTaps="handled"
                                    style={{ maxHeight: 200 }}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            style={styles.dropdownItem}
                                            onPress={() => handleSelectExercise(item.name)}
                                        >
                                            <Text style={styles.dropdownText}>{item.name}</Text>
                                        </TouchableOpacity>
                                    )}
                                />
                            </View>
                        )}
                    </View>

                    {/* Sets and Rest Time Row */}
                    <View style={styles.inputGroup}>
                        <View style={[styles.row, { gap: theme.spacing.m }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Sets</Text>
                                <TextInput
                                    style={[styles.input, { maxWidth: 80 }]}
                                    placeholder="3"
                                    keyboardType="numeric"
                                    value={sets}
                                    onChangeText={(text) => setSets(text.replace(/[^0-9]/g, ''))}
                                    maxLength={2}
                                />
                            </View>

                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Rest Time</Text>
                                <View style={styles.restControlsRow}>
                                    <View style={styles.restValueBox}>
                                        <TouchableOpacity
                                            onPress={() => setRestMinutes(prev => Math.max(0, (parseInt(prev) || 0) + 1).toString())}
                                            style={styles.restArrow}
                                        >
                                            <Text style={styles.arrowText}>▲</Text>
                                        </TouchableOpacity>
                                        <Text style={styles.restValue}>{restMinutes}m</Text>
                                        <TouchableOpacity
                                            onPress={() => setRestMinutes(prev => Math.max(0, (parseInt(prev) || 0) - 1).toString())}
                                            style={styles.restArrow}
                                        >
                                            <Text style={styles.arrowText}>▼</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <Text style={styles.restSeparator}>:</Text>

                                    <View style={styles.restValueBox}>
                                        <TouchableOpacity
                                            onPress={() => setRestSeconds(prev => {
                                                const current = parseInt(prev) || 0;
                                                const next = current + 15;
                                                return (next >= 60 ? 0 : next).toString();
                                            })}
                                            style={styles.restArrow}
                                        >
                                            <Text style={styles.arrowText}>▲</Text>
                                        </TouchableOpacity>
                                        <Text style={styles.restValue}>{restSeconds.padStart(2, '0')}s</Text>
                                        <TouchableOpacity
                                            onPress={() => setRestSeconds(prev => {
                                                const current = parseInt(prev) || 0;
                                                const next = current - 15;
                                                return (next < 0 ? 45 : next).toString();
                                            })}
                                            style={styles.restArrow}
                                        >
                                            <Text style={styles.arrowText}>▼</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
                        <Text style={styles.addButtonText}>Add Exercise</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
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
        fontSize: 28,
        fontWeight: 'bold',
        color: theme.colors.text.primary,
        marginBottom: theme.spacing.xl,
    },
    inputGroup: {
        marginBottom: theme.spacing.l,
        position: 'relative',
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text.secondary,
        marginBottom: theme.spacing.s,
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
    dropdownContainer: {
        position: 'absolute',
        top: '100%',
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
    restControlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    restValueBox: {
        backgroundColor: theme.colors.surface,
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
    addButton: {
        backgroundColor: theme.colors.primary,
        padding: theme.spacing.l,
        borderRadius: theme.borderRadius.m,
        alignItems: 'center',
        marginTop: theme.spacing.xl,
        ...theme.shadows.soft,
    },
    addButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 18,
    },
});
