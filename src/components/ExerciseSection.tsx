import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useSubscription } from '../context/SubscriptionContext';
import { theme } from '../theme';
import { ExerciseEntry } from '../types/food';

type ExerciseSectionProps = {
    exercises: ExerciseEntry[];
    onAddExercise: () => void;
    onRemoveExercise: (id: string) => void;
};

export const ExerciseSection: React.FC<ExerciseSectionProps> = ({
    exercises,
    onAddExercise,
    onRemoveExercise,
}) => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { isPremium } = useSubscription();
    const totalBurned = exercises.reduce((sum, ex) => sum + ex.caloriesBurned, 0);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.titleContainer}>
                    <Text style={styles.title}>Exercise</Text>
                    <Text style={styles.calories}>{totalBurned} kcal</Text>
                </View>
            </View>

            {!isPremium && (
                <TouchableOpacity onPress={() => navigation.navigate('Paywall')} style={{ marginBottom: theme.spacing.m }}>
                    <Text style={{
                        color: theme.colors.primary,
                        fontSize: 12,
                        textDecorationLine: 'underline',
                        fontWeight: '600'
                    }}>
                        Auto-sync enabled with Stamina Pro!
                    </Text>
                </TouchableOpacity>
            )}

            <View style={styles.list}>
                {exercises.length === 0 ? (
                    <Text style={styles.emptyText}>No exercise logged today.</Text>
                ) : (
                    exercises.map((exercise) => (
                        <View key={exercise.id} style={styles.entry}>
                            <View style={styles.entryInfo}>
                                <Text style={styles.entryName}>
                                    {exercise.name}
                                </Text>
                            </View>
                            <View style={styles.entryRight}>
                                <TouchableOpacity
                                    onPress={() => onRemoveExercise(exercise.id)}
                                    style={styles.deleteButton}
                                >
                                    <Text style={styles.deleteButtonText}>✕</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
            </View>

            <TouchableOpacity style={styles.addButton} onPress={onAddExercise}>
                <Text style={styles.addButtonText}>+ Add Exercise</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: theme.spacing.l,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.l,
        padding: theme.spacing.m,
        ...theme.shadows.soft,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.m,
        paddingBottom: theme.spacing.s,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        justifyContent: 'space-between',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text.primary,
    },
    calories: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.success, // Use success color (green) for "earned" calories
    },
    list: {
        marginBottom: theme.spacing.m,
    },
    emptyText: {
        color: theme.colors.text.tertiary,
        textAlign: 'center',
        padding: theme.spacing.m,
        fontStyle: 'italic',
    },
    entry: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: theme.spacing.s,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.background,
    },
    entryInfo: {
        flex: 1,
    },
    entryName: {
        fontSize: 16,
        color: theme.colors.text.primary,
        fontWeight: '500',
    },
    entryDetails: {
        fontSize: 14,
        color: theme.colors.text.secondary,
    },
    entryRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    entryCalories: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text.primary,
        marginRight: theme.spacing.m,
    },
    deleteButton: {
        padding: 4,
    },
    deleteButtonText: {
        fontSize: 14,
        color: theme.colors.error,
        fontWeight: 'bold',
    },
    addButton: {
        alignItems: 'center',
        padding: theme.spacing.s,
    },
    addButtonText: {
        color: theme.colors.primary,
        fontWeight: '600',
        fontSize: 16,
    },
});
