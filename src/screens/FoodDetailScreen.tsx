
// ... (imports)
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    SafeAreaView,
    ScrollView,
    Alert,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';

// import { Feather } from '@expo/vector-icons'; // Using emojis instead
import { NutritionInfo, FoodProfile, DailyLogEntry } from '../types/food';
import { addFoodToLog } from '../services/storage';
import { useToast } from '../context/ToastContext';

type Props = NativeStackScreenProps<RootStackParamList, 'FoodDetail'>;

export const FoodDetailScreen = ({ navigation, route }: Props) => {
    const { food, mealCategory, date } = route.params;

    // Local State
    const [amount, setAmount] = useState<string>(food.baseWeight.toString());
    const [calculatedMacros, setCalculatedMacros] = useState({
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fats: food.fats,
    });
    const { incrementPending, decrementPending } = useToast();

    // Set header options
    React.useLayoutEffect(() => {
        navigation.setOptions({
            headerLeft: () => (
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 16 }}>
                    <Text style={{ fontSize: 24, color: '#ffffff' }}>✕</Text>
                </TouchableOpacity>
            ),
        });
    }, [navigation]);



    useEffect(() => {
        const weight = parseFloat(amount);
        if (!isNaN(weight) && weight > 0) {
            const ratio = weight / food.baseWeight;
            setCalculatedMacros({
                calories: Math.round(food.calories * ratio),
                protein: parseFloat((food.protein * ratio).toFixed(1)),
                carbs: parseFloat((food.carbs * ratio).toFixed(1)),
                fats: parseFloat((food.fats * ratio).toFixed(1)),
            });
        }
    }, [amount]);

    const handleAddFood = async () => {
        const weight = parseFloat(amount);
        if (isNaN(weight) || weight <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
            return;
        }

        // Show toast notification
        incrementPending('add');

        try {
            // Construct NutritionInfo object for one serving (1g base for calculation or just standard serving)
            // The addFoodToLog service takes a FoodProfile and calculates multiplication based on servings.
            // We want to add the calculated macros directly.
            // Since `addFoodToLog` multiplies by `servings`, if we pass servings=1, it uses nutrition as is.
            // So we construct a transient FoodProfile with the *calculated* values as its base.

            const nutrition: NutritionInfo = {
                calories: calculatedMacros.calories,
                protein: calculatedMacros.protein,
                carbs: calculatedMacros.carbs,
                fats: calculatedMacros.fats,
                servingSize: `${weight}g`,
            };

            const foodProfile: FoodProfile = {
                id: food.id, // Use dummy ID or generate new? Doesn't matter heavily for log entry
                name: food.name,
                brand: food.brand || 'Generic',
                nutrition: nutrition,
                // mealCategory: mealCategory,
                createdAt: new Date().toISOString(),
                source: 'user_manual', // Closest fit
                isLocalOnly: true, // It's transient
            };

            await addFoodToLog(date, foodProfile, 1, mealCategory);
            decrementPending('add');

            // Go back to SearchFoodScreen
            navigation.goBack();

        } catch (error) {
            console.error('Error adding food:', error);
            Alert.alert('Error', 'Failed to save food.');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardAvoid}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.foodHeader}>
                        <Text style={styles.foodName}>{food.name}</Text>
                        <Text style={styles.brandName}>{food.brand || 'Generic'}</Text>
                        <View style={styles.caloriesBadge}>
                            <Text style={styles.caloriesText}>{calculatedMacros.calories}</Text>
                            <Text style={styles.caloriesLabel}>kcal</Text>
                        </View>
                    </View>

                    <View style={styles.inputSection}>
                        <Text style={styles.inputLabel}>Amount (g)</Text>
                        <TextInput
                            style={styles.input}
                            value={amount}
                            onChangeText={setAmount}
                            keyboardType="numeric"
                            placeholder="Enter amount in grams"
                            autoFocus
                            maxLength={5}
                        />
                    </View>

                    <View style={styles.macroCard}>
                        <View style={styles.macroItem}>
                            <Text style={[styles.macroValue, { color: theme.colors.secondary }]}>{calculatedMacros.protein}g</Text>
                            <Text style={styles.macroLabel}>Protein</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.macroItem}>
                            <Text style={[styles.macroValue, { color: theme.colors.success }]}>{calculatedMacros.carbs}g</Text>
                            <Text style={styles.macroLabel}>Carbs</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.macroItem}>
                            <Text style={[styles.macroValue, { color: theme.colors.warning }]}>{calculatedMacros.fats}g</Text>
                            <Text style={styles.macroLabel}>Fats</Text>
                        </View>
                    </View>

                    <View style={styles.infoBox}>
                        <Text style={styles.infoText}>
                            Base nutrition calculated for {food.baseWeight}g ({food.servingSize})
                        </Text>
                    </View>

                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity style={styles.addButton} onPress={handleAddFood}>
                        <Text style={styles.addButtonText}>Add Food</Text>
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
    keyboardAvoid: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'flex-end', // Align close button to right
        paddingHorizontal: theme.spacing.m,
        paddingTop: theme.spacing.m,
        backgroundColor: theme.colors.background, // Blend with bg
        zIndex: 10,
    },
    closeButton: {
        padding: theme.spacing.s,
        backgroundColor: theme.colors.surface,
        borderRadius: 20,
    },
    closeButtonText: {
        fontSize: 20,
        color: theme.colors.text.secondary,
        fontWeight: 'bold',
    },
    scrollContent: {
        padding: theme.spacing.l,
    },
    foodHeader: {
        alignItems: 'center',
        marginBottom: theme.spacing.xl,
    },
    foodName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.colors.text.primary,
        textAlign: 'center',
        marginBottom: 4,
    },
    brandName: {
        fontSize: 16,
        color: theme.colors.text.secondary,
        marginBottom: theme.spacing.l,
    },
    caloriesBadge: {
        backgroundColor: 'rgba(74, 222, 128, 0.1)',
        paddingHorizontal: theme.spacing.xl,
        paddingVertical: theme.spacing.m,
        borderRadius: 20,
        alignItems: 'center',
        minWidth: 120,
    },
    caloriesText: {
        fontSize: 32,
        fontWeight: 'bold',
        color: theme.colors.primary,
    },
    caloriesLabel: {
        fontSize: 14,
        color: theme.colors.text.secondary,
        fontWeight: '600',
    },
    inputSection: {
        marginBottom: theme.spacing.xl,
    },
    inputLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text.primary,
        marginBottom: theme.spacing.s,
    },
    input: {
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.borderRadius.m,
        padding: theme.spacing.m,
        fontSize: 18,
        color: theme.colors.text.primary,
    },
    macroCard: {
        flexDirection: 'row',
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.l,
        padding: theme.spacing.l,
        justifyContent: 'space-between',
        alignItems: 'center',
        ...theme.shadows.soft, // use soft shadow if small doesn't exist, verify theme. but keeping simple
        marginBottom: theme.spacing.l,
    },
    macroItem: {
        alignItems: 'center',
        flex: 1,
    },
    macroValue: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    macroLabel: {
        fontSize: 14,
        color: theme.colors.text.secondary,
    },
    divider: {
        width: 1,
        height: 40,
        backgroundColor: theme.colors.border,
    },
    infoBox: {
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        alignItems: 'center',
    },
    infoText: {
        color: theme.colors.text.secondary,
        fontSize: 14,
        textAlign: 'center',
    },
    footer: {
        padding: theme.spacing.l,
        backgroundColor: theme.colors.surface,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
    },
    addButton: {
        backgroundColor: theme.colors.primary,
        paddingVertical: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        alignItems: 'center',
    },
    addButtonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
