import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { saveFoodProfile, addFoodToLog, getTodayDate } from '../services/storage';
import { FoodProfile, NutritionInfo } from '../types/food';
import { theme } from '../theme';

// RootStackParamList imported from navigation/AppNavigator

type ManualEntryScreenProps = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'ManualEntry'>;
    route: RouteProp<RootStackParamList, 'ManualEntry'>;
};

export const ManualEntryScreen: React.FC<ManualEntryScreenProps> = ({
    navigation,
    route,
}) => {
    const prefilledNutrition = route.params?.nutrition;
    const prefilledName = route.params?.foodName;
    const barcode = route.params?.barcode;
    const source = route.params?.source || 'user_manual';
    const language = route.params?.language;

    const [foodName, setFoodName] = useState(prefilledName || '');
    const [calories, setCalories] = useState(
        prefilledNutrition?.calories?.toString() || ''
    );
    const [protein, setProtein] = useState(
        prefilledNutrition?.protein?.toString() || ''
    );
    const [carbs, setCarbs] = useState(
        prefilledNutrition?.carbs?.toString() || ''
    );
    const [fats, setFats] = useState(
        prefilledNutrition?.fats?.toString() || ''
    );
    const [standardAmount, setStandardAmount] = useState('');
    const [standardUnit, setStandardUnit] = useState('');
    const [nutritionAmount, setNutritionAmount] = useState('');
    const [nutritionUnit, setNutritionUnit] = useState('');
    const [brand, setBrand] = useState('');
    const [saving, setSaving] = useState(false);

    const validateInputs = (): boolean => {
        if (!foodName.trim()) {
            Alert.alert('Missing Info', 'Please enter a food name.');
            return false;
        }

        if (!standardAmount || !standardUnit || !nutritionAmount || !nutritionUnit) {
            Alert.alert('Missing Info', 'Please fill in all size and unit fields.');
            return false;
        }

        if (!calories || parseFloat(calories) < 0) {
            Alert.alert('Invalid Input', 'Please enter a valid calorie amount.');
            return false;
        }

        return true;
    };

    const handleSave = async () => {
        if (!validateInputs()) return;

        setSaving(true);

        try {
            const food: FoodProfile = {
                id: Date.now().toString(),
                name: foodName.trim(),
                brand: brand.trim() || null, // Firestore doesn't like undefined
                nutrition: {
                    calories: parseFloat(calories) || 0,
                    protein: parseFloat(protein) || 0,
                    carbs: parseFloat(carbs) || 0,
                    fats: parseFloat(fats) || 0,
                    servingSize: `${standardAmount} ${standardUnit}`,
                    servingQuantity: parseFloat(standardAmount) || 1,
                    servingUnit: standardUnit.trim(),
                    servingWeight: parseFloat(nutritionAmount) || 100,
                    servingWeightUnit: nutritionUnit.trim(),
                },
                createdAt: new Date().toISOString(),
                barcode: barcode || null, // Ensure no undefined here either
                source: source,
                isLocalOnly: true, // User created data is always local-only
                language: language || null,
            };

            await saveFoodProfile(food);

            Alert.alert(
                'Food Saved',
                'Would you like to add this to your daily log?',
                [
                    {
                        text: 'Not Now',
                        onPress: () => navigation.navigate('Home', { date: route.params?.date }),
                    },
                    {
                        text: 'Add to Log',
                        onPress: async () => {
                            const logDate = route.params?.date || getTodayDate();
                            const finalFood = food; // Use the 'food' object created above
                            const numServings = 1; // Default to 1 serving, adjust if a serving input is added
                            await addFoodToLog(
                                logDate,
                                finalFood,
                                numServings,
                                route.params?.mealCategory // Pass the category
                            );
                            navigation.navigate('Home', { date: logDate });
                        },
                    },
                ]
            );
        } catch (error) {
            console.error('Error saving food:', error);
            Alert.alert('Error', 'Failed to save food.');
        } finally {
            setSaving(false);
        }
    };

    const handleNumberInput = (text: string, setter: (val: string) => void, decimals: number) => {
        // Allow empty string to let user clear input
        if (text === '') {
            setter('');
            return;
        }

        // Replace comma with dot for consistency
        const normalized = text.replace(',', '.');

        // Regex to validate: optional decimal part based on 'decimals'
        // If decimals is 0, only integers allowed
        let regex;
        if (decimals === 0) {
            regex = /^\d+$/;
        } else {
            // Allows digits, optional dot, and up to 'decimals' digits after dot
            regex = new RegExp(`^\\d+(\\.\\d{0,${decimals}})?$`);
        }

        // Also allow just "0." or "12." (trailing dot) while typing
        if (decimals > 0 && normalized.endsWith('.')) {
            // Check if it already has a dot before the last char
            if (normalized.slice(0, -1).includes('.')) {
                return; // reject double dots
            }
            setter(normalized);
            return;
        }

        if (regex.test(normalized)) {
            setter(normalized);
        }
    };

    const renderUnitPicker = (
        currentValue: string,
        onSelect: (val: string) => void,
        options: string[]
    ) => {
        return (
            <View>
                <TouchableOpacity
                    style={styles.pickerButton}
                    onPress={() =>
                        Alert.alert(
                            'Select Unit',
                            undefined,
                            [
                                ...options.map((opt) => ({
                                    text: opt,
                                    onPress: () => onSelect(opt),
                                })),
                                { text: 'Cancel', style: 'cancel' },
                            ],
                            { cancelable: true }
                        )
                    }
                >
                    <Text style={[styles.pickerText, !currentValue && styles.placeholderText]}>
                        {currentValue || 'Select'}
                    </Text>
                    <Text style={styles.dropdownArrow}>▼</Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView style={styles.scrollView}>
                <View style={styles.content}>
                    <Text style={styles.title}>Add Food</Text>

                    {prefilledNutrition && (
                        <View style={[
                            styles.infoBox,
                            route.params?.confidence === 'low' && styles.warningBox,
                            route.params?.confidence === 'medium' && styles.warningBox
                        ]}>
                            <Text style={[
                                styles.infoText,
                                (route.params?.confidence === 'low' || route.params?.confidence === 'medium') && styles.warningText
                            ]}>
                                {route.params?.confidence === 'low'
                                    ? '⚠️ Low confidence scan. Please verify all numbers carefully.'
                                    : route.params?.confidence === 'medium'
                                        ? '⚠️ Some values might be missing. Please verify.'
                                        : 'Scanned data pre-filled. Please verify accuracy.'}
                            </Text>
                        </View>
                    )}

                    {source === 'user_scanned' && (
                        <View style={styles.privateBadge}>
                            <Text style={styles.privateText}>Private Data</Text>
                        </View>
                    )}

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Food Name *</Text>
                        <TextInput
                            style={styles.input}
                            value={foodName}
                            onChangeText={setFoodName}
                            placeholder="e.g. Banana"
                            placeholderTextColor="#adb5bd"
                            maxLength={100}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Brand (Optional)</Text>
                        <TextInput
                            style={styles.input}
                            value={brand}
                            onChangeText={setBrand}
                            placeholder="e.g. Acme"
                            placeholderTextColor="#adb5bd"
                            maxLength={50}
                        />
                    </View>

                    {/* Standard Size Row */}
                    <View style={styles.macrosRow}>
                        <View style={[styles.inputGroup, styles.macroInput]}>
                            <Text style={styles.label}>Standard Size *</Text>
                            <TextInput
                                style={styles.input}
                                value={standardAmount}
                                onChangeText={(text) => handleNumberInput(text, setStandardAmount, 0)}
                                placeholder="1"
                                keyboardType="numeric"
                                placeholderTextColor="#adb5bd"
                                maxLength={6}
                            />
                        </View>
                        <View style={[styles.inputGroup, styles.macroInput]}>
                            <Text style={styles.label}>Unit *</Text>
                            {renderUnitPicker(
                                standardUnit,
                                setStandardUnit,
                                ['cup', 'pcs', 'slice', 'oz', 'bottle', 'can', 'jar', 'g', 'ml']
                            )}
                        </View>
                    </View>

                    {/* Nutritional Label Size Row */}
                    <View style={styles.macrosRow}>
                        <View style={[styles.inputGroup, styles.macroInput]}>
                            <Text style={styles.label}>Label Size *</Text>
                            <TextInput
                                style={styles.input}
                                value={nutritionAmount}
                                onChangeText={(text) => handleNumberInput(text, setNutritionAmount, 0)}
                                placeholder="100"
                                keyboardType="numeric"
                                placeholderTextColor="#adb5bd"
                                maxLength={6}
                            />
                        </View>
                        <View style={[styles.inputGroup, styles.macroInput]}>
                            <Text style={styles.label}>Unit (g/ml) *</Text>
                            {renderUnitPicker(
                                nutritionUnit,
                                setNutritionUnit,
                                ['g', 'ml']
                            )}
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Calories *</Text>
                        <TextInput
                            style={styles.input}
                            value={calories}
                            onChangeText={(text) => handleNumberInput(text, setCalories, 1)}
                            placeholder="0"
                            keyboardType="numeric"
                            placeholderTextColor="#adb5bd"
                            maxLength={6}
                        />
                    </View>

                    <View style={styles.macrosRow}>
                        <View style={[styles.inputGroup, styles.macroInput]}>
                            <Text style={styles.label}>Protein (g)</Text>
                            <TextInput
                                style={styles.input}
                                value={protein}
                                onChangeText={(text) => handleNumberInput(text, setProtein, 1)}
                                placeholder="0"
                                keyboardType="numeric"
                                placeholderTextColor="#adb5bd"
                                maxLength={6}
                            />
                        </View>

                        <View style={[styles.inputGroup, styles.macroInput]}>
                            <Text style={styles.label}>Carbs (g)</Text>
                            <TextInput
                                style={styles.input}
                                value={carbs}
                                onChangeText={(text) => handleNumberInput(text, setCarbs, 1)}
                                placeholder="0"
                                keyboardType="numeric"
                                placeholderTextColor="#adb5bd"
                                maxLength={6}
                            />
                        </View>

                        <View style={[styles.inputGroup, styles.macroInput]}>
                            <Text style={styles.label}>Fats (g)</Text>
                            <TextInput
                                style={styles.input}
                                value={fats}
                                onChangeText={(text) => handleNumberInput(text, setFats, 1)}
                                placeholder="0"
                                keyboardType="numeric"
                                placeholderTextColor="#adb5bd"
                                maxLength={6}
                            />
                        </View>
                    </View>

                    {barcode && (
                        <View style={styles.barcodeInfo}>
                            <Text style={styles.barcodeLabel}>Barcode Linked:</Text>
                            <Text style={styles.barcodeValue}>{barcode}</Text>
                        </View>
                    )}

                    <TouchableOpacity
                        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                        onPress={handleSave}
                        disabled={saving}
                    >
                        <Text style={styles.saveButtonText}>
                            {saving ? 'Saving...' : 'Save Food'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 20,
        paddingTop: 60,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#212529',
        marginBottom: 20,
    },
    infoBox: {
        backgroundColor: '#e3f2fd',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    infoText: {
        color: '#0d47a1',
        fontSize: 14,
    },
    warningBox: {
        backgroundColor: '#fff3cd',
        borderColor: '#ffeeba',
        borderWidth: 1,
    },
    warningText: {
        color: '#856404',
        fontWeight: 'bold',
    },
    privateBadge: {
        backgroundColor: '#fff3cd',
        padding: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ffeeba',
        marginBottom: 20,
        alignSelf: 'flex-start',
    },
    privateText: {
        color: '#856404',
        fontSize: 12,
        fontWeight: '600',
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#495057',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#ced4da',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: '#212529',
    },
    macrosRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    macroInput: {
        flex: 1,
        marginBottom: 0,
    },
    saveButton: {
        backgroundColor: theme.colors.primary,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 20,
    },
    saveButtonDisabled: {
        backgroundColor: '#6c757d',
    },
    saveButtonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '600',
    },
    barcodeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#e9ecef',
        borderRadius: 8,
        marginBottom: 20,
    },
    barcodeLabel: {
        fontSize: 14,
        color: '#6c757d',
        marginRight: 8,
    },
    barcodeValue: {
        fontSize: 14,
        color: '#212529',
        fontFamily: 'monospace',
        fontWeight: '600',
    },
    pickerButton: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#ced4da',
        borderRadius: 8,
        padding: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    pickerText: {
        fontSize: 16,
        color: '#212529',
    },
    placeholderText: {
        color: '#adb5bd',
    },
    dropdownArrow: {
        fontSize: 12,
        color: '#6c757d',
    },
});
