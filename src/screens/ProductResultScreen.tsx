import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { saveFoodProfile, addFoodToLog, getTodayDate } from '../services/storage';
import { FoodProfile } from '../types/food';

type ProductResultScreenProps = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'ProductResult'>;
    route: RouteProp<RootStackParamList, 'ProductResult'>;
};

export const ProductResultScreen: React.FC<ProductResultScreenProps> = ({
    navigation,
    route,
}) => {
    const { product } = route.params;
    const [saving, setSaving] = useState(false);

    const handleAddToLog = async () => {
        setSaving(true);
        try {
            const foodProfile: FoodProfile = {
                id: `openfoodfacts_${product.barcode}_${Date.now()}`,
                name: product.name,
                brand: product.brand,
                barcode: product.barcode,
                nutrition: {
                    calories: product.nutrition.calories,
                    protein: product.nutrition.protein,
                    carbs: product.nutrition.carbs,
                    fats: product.nutrition.fats,
                    servingSize: product.servingSize,
                },
                source: 'openfoodfacts',
                isLocalOnly: false, // OpenFoodFacts data is verified and shareable
                createdAt: new Date().toISOString(),
                imageUri: product.imageUrl,
            };

            // Save to food database
            await saveFoodProfile(foodProfile);

            // Add to log
            await addFoodToLog(
                route.params?.date || getTodayDate(),
                foodProfile,
                1,
                route.params?.mealCategory
            );

            Alert.alert('Success', `${product.name} saved!`, [
                {
                    text: 'Done',
                    onPress: () => navigation.navigate('Home', { date: route.params?.date }),
                },
            ]);
        } catch (error) {
            console.error('Error adding product:', error);
            Alert.alert('Error', 'Failed to save food.');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveOnly = async () => {
        setSaving(true);
        try {
            const foodProfile: FoodProfile = {
                id: `openfoodfacts_${product.barcode}_${Date.now()}`,
                name: product.name,
                brand: product.brand,
                barcode: product.barcode,
                nutrition: {
                    calories: product.nutrition.calories,
                    protein: product.nutrition.protein,
                    carbs: product.nutrition.carbs,
                    fats: product.nutrition.fats,
                    servingSize: product.servingSize,
                },
                source: 'openfoodfacts',
                isLocalOnly: false,
                createdAt: new Date().toISOString(),
                imageUri: product.imageUrl,
            };

            await saveFoodProfile(foodProfile);

            Alert.alert('Success', 'Product saved to your library.', [
                {
                    text: 'Done',
                    onPress: () => navigation.navigate('Home', { date: route.params?.date }),
                },
            ]);
        } catch (error) {
            console.error('Error saving product:', error);
            Alert.alert('Error', 'Failed to save food.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.content}>
                {product.imageUrl && (
                    <Image
                        source={{ uri: product.imageUrl }}
                        style={styles.productImage}
                        resizeMode="contain"
                    />
                )}

                <View style={styles.badge}>
                    <Text style={styles.badgeText}>✓ Verified by OpenFoodFacts</Text>
                </View>

                <Text style={styles.productName}>{product.name}</Text>
                {product.brand && (
                    <Text style={styles.brandName}>{product.brand}</Text>
                )}

                <View style={styles.barcodeContainer}>
                    <Text style={styles.barcodeLabel}>Barcode:</Text>
                    <Text style={styles.barcodeValue}>{product.barcode}</Text>
                </View>

                {product.servingSize && (
                    <View style={styles.servingContainer}>
                        <Text style={styles.servingLabel}>Serving Size:</Text>
                        <Text style={styles.servingValue}>{product.servingSize}</Text>
                    </View>
                )}

                <View style={styles.nutritionSection}>
                    <Text style={styles.sectionTitle}>Nutrition Facts</Text>

                    <View style={styles.nutritionGrid}>
                        <View style={styles.nutritionItem}>
                            <Text style={styles.nutritionValue}>
                                {Math.round(product.nutrition.calories)}
                            </Text>
                            <Text style={styles.nutritionLabel}>Calories</Text>
                        </View>

                        <View style={styles.nutritionItem}>
                            <Text style={styles.nutritionValue}>
                                {Math.round(product.nutrition.protein)}g
                            </Text>
                            <Text style={styles.nutritionLabel}>Protein</Text>
                        </View>

                        <View style={styles.nutritionItem}>
                            <Text style={styles.nutritionValue}>
                                {Math.round(product.nutrition.carbs)}g
                            </Text>
                            <Text style={styles.nutritionLabel}>Carbs</Text>
                        </View>

                        <View style={styles.nutritionItem}>
                            <Text style={styles.nutritionValue}>
                                {Math.round(product.nutrition.fats)}g
                            </Text>
                            <Text style={styles.nutritionLabel}>Fat</Text>
                        </View>
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.button, styles.primaryButton, saving && styles.buttonDisabled]}
                    onPress={handleAddToLog}
                    disabled={saving}
                >
                    <Text style={styles.primaryButtonText}>
                        {saving ? 'Adding...' : 'Add Food'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.secondaryButton, saving && styles.buttonDisabled]}
                    onPress={handleSaveOnly}
                    disabled={saving}
                >
                    <Text style={styles.secondaryButtonText}>
                        Save to My Foods
                    </Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    content: {
        padding: 20,
    },
    productImage: {
        width: '100%',
        height: 200,
        borderRadius: 12,
        backgroundColor: '#ffffff',
        marginBottom: 16,
    },
    badge: {
        backgroundColor: '#28a745',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        alignSelf: 'flex-start',
        marginBottom: 12,
    },
    badgeText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '600',
    },
    productName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#212529',
        marginBottom: 8,
    },
    brandName: {
        fontSize: 18,
        color: '#6c757d',
        marginBottom: 16,
    },
    barcodeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    barcodeLabel: {
        fontSize: 14,
        color: '#6c757d',
        marginRight: 8,
    },
    barcodeValue: {
        fontSize: 14,
        color: '#495057',
        fontFamily: 'monospace',
    },
    servingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    servingLabel: {
        fontSize: 14,
        color: '#6c757d',
        marginRight: 8,
    },
    servingValue: {
        fontSize: 14,
        color: '#495057',
        fontWeight: '600',
    },
    nutritionSection: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#212529',
        marginBottom: 16,
    },
    nutritionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
    nutritionItem: {
        flex: 1,
        minWidth: '45%',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
    },
    nutritionValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#007bff',
        marginBottom: 4,
    },
    nutritionLabel: {
        fontSize: 14,
        color: '#6c757d',
    },
    button: {
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 12,
    },
    primaryButton: {
        backgroundColor: '#007bff',
    },
    secondaryButton: {
        backgroundColor: '#ffffff',
        borderWidth: 2,
        borderColor: '#007bff',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    primaryButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#ffffff',
    },
    secondaryButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#007bff',
    },
});
