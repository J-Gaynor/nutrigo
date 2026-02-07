
// ... (imports)
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    FlatList,
    TouchableOpacity,
    SafeAreaView,
    Modal,
    Platform,
    Alert,
    Animated,
    Dimensions,
    ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { dummyFoods, DummyFood } from '../data/dummyFoods';
import { theme } from '../theme';
import { getLastMealEntries, bulkAddFoodsToLog, getTodayDate, searchUserFoods } from '../services/storage'; // Import storage functions
import { DailyLogEntry } from '../types/food';
import { useSubscription } from '../context/SubscriptionContext';
import { searchUSDAFoods } from '../services/usdaService';

type Props = NativeStackScreenProps<RootStackParamList, 'SearchFood'>;

export const SearchFoodScreen = ({ navigation, route }: Props) => {
    const { mealCategory, date } = route.params;
    const { isPremium } = useSubscription();
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredFoods, setFilteredFoods] = useState<DummyFood[]>(dummyFoods);
    const [isSearching, setIsSearching] = useState(false);

    const [showOptionsModal, setShowOptionsModal] = useState(false);
    const slideAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (showOptionsModal) {
            Animated.spring(slideAnim, {
                toValue: 1,
                useNativeDriver: true,
                speed: 14,
                bounciness: 4,
            }).start();
        } else {
            slideAnim.setValue(0);
        }
    }, [showOptionsModal]);

    const closeOptionsModal = () => {
        Animated.timing(slideAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
        }).start(() => setShowOptionsModal(false));
    };


    const [hasCurrentEntries, setHasCurrentEntries] = useState(false);

    useEffect(() => {
        const checkCurrentLog = async () => {
            try {
                const { getDailyLog } = require('../services/storage');
                const log = await getDailyLog(date);
                if (log && log.entries) {
                    const entries = log.entries.filter((e: DailyLogEntry) => e.mealCategory === mealCategory);
                    setHasCurrentEntries(entries.length > 0);
                }
            } catch (error) {
                console.error('Error checking current log:', error);
            }
        };
        checkCurrentLog();
    }, [date, mealCategory]);

    // ... existing Last Meal check ...
    const [lastMealEntries, setLastMealEntries] = useState<DailyLogEntry[] | null>(null);
    const [lastMealDate, setLastMealDate] = useState<string | null>(null);

    useEffect(() => {
        const checkLastMeal = async () => {
            // Historical Gating check
            if (date !== getTodayDate() && !isPremium) {
                navigation.goBack();
                navigation.navigate('Paywall');
                return;
            }

            const daysBack = isPremium ? 30 : 1;
            const result = await getLastMealEntries(mealCategory, date, daysBack);
            if (result) {
                setLastMealEntries(result.entries);
                setLastMealDate(result.date);
            }
        };
        checkLastMeal();
    }, [mealCategory, date, isPremium]);

    // ... (rest of the component)

    // Render logic update
    /* 
       Note: The actual replacement target is below. 
       I am injecting the state and effect before the existing checkLastMeal effect.
    */


    useLayoutEffect(() => {
        navigation.setOptions({
            title: 'Add Food',
            headerRight: () => (
                <TouchableOpacity onPress={() => setShowOptionsModal(true)}>
                    <Text style={{ fontSize: 16, color: '#ffffff', fontWeight: '600' }}>Options</Text>
                </TouchableOpacity>
            ),
        });
    }, [navigation, setShowOptionsModal]);

    const handleRepeatLast = async () => {
        if (!lastMealEntries) return;

        Alert.alert(
            'Repeat Last Meal?',
            `Add ${lastMealEntries.length === 1 ? '1 item' : `${lastMealEntries.length} items`} from ${lastMealDate}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Add Items',
                    onPress: async () => {
                        try {
                            await bulkAddFoodsToLog(date, lastMealEntries, mealCategory);
                            navigation.goBack(); // Go back to home/log after adding
                        } catch (error) {
                            Alert.alert('Error', 'Failed to repeat last meal.');
                        }
                    }
                }
            ]
        );
    };

    useEffect(() => {
        const debounceTimer = setTimeout(async () => {
            if (searchQuery.trim() === '') {
                let initialFoods = [...dummyFoods];
                if (isPremium) {
                    try {
                        // Dynamically import to ensure fresh data
                        const { getSavedMeals } = require('../services/storage');
                        const saved = await getSavedMeals();
                        const mappedSaved = saved.map((m: any) => ({
                            id: m.id,
                            name: m.name,
                            brand: 'My Meal',
                            calories: m.totalNutrition.calories,
                            protein: m.totalNutrition.protein,
                            carbs: m.totalNutrition.carbs,
                            fats: m.totalNutrition.fats,
                            servingSize: `${m.items.length} items`,
                            isSavedMeal: true,
                            items: m.items
                        }));
                        // Prepend saved meals
                        initialFoods = [...mappedSaved, ...initialFoods];
                    } catch (e) {
                        console.error('Error loading default saved meals:', e);
                    }
                }
                setFilteredFoods(initialFoods);
                setIsSearching(false);
                return;
            }

            setIsSearching(true);
            try {
                // Search both local and USDA
                const lowerQuery = searchQuery.toLowerCase();

                // 0. Search Saved Meals (Premium)
                let mealResults: any[] = [];
                if (isPremium) {
                    const { getSavedMeals } = require('../services/storage');
                    const savedMeals = await getSavedMeals();
                    mealResults = savedMeals.filter((m: any) => m.name.toLowerCase().includes(lowerQuery))
                        .map((m: any) => ({
                            id: m.id,
                            name: m.name,
                            brand: 'My Meal',
                            calories: m.totalNutrition.calories,
                            protein: m.totalNutrition.protein,
                            carbs: m.totalNutrition.carbs,
                            fats: m.totalNutrition.fats,
                            servingSize: `${m.items.length} items`,
                            isSavedMeal: true,
                            items: m.items
                        }));
                }

                // 1. Search Personal User Foods (Firestore)
                const userFoods = await searchUserFoods(searchQuery);
                const mappedUserFoods: DummyFood[] = userFoods.map(f => ({
                    id: f.id,
                    name: f.name,
                    brand: f.brand || 'Personal',
                    calories: f.nutrition.calories,
                    protein: f.nutrition.protein,
                    carbs: f.nutrition.carbs,
                    fats: f.nutrition.fats,
                    servingSize: f.nutrition.servingSize || '1 serving',
                    baseWeight: f.nutrition.servingWeight || 100,
                }));

                // 2. Search Dummy Foods (Static)
                const localResults = dummyFoods.filter(food =>
                    food.name.toLowerCase().includes(lowerQuery)
                );

                // 3. Search USDA (External API)
                const usdaResults = await searchUSDAFoods(searchQuery);

                // Prioritize: Saved Meals -> User Foods -> Dummy Foods -> USDA
                const combined = [...mealResults, ...mappedUserFoods];

                // Append Dummy Foods (if not duplicate of user food/meal)
                localResults.forEach(df => {
                    if (!combined.some(cf => cf.name.toLowerCase() === df.name.toLowerCase())) {
                        combined.push(df);
                    }
                });

                // Append USDA Results (if not duplicate)
                usdaResults.forEach(uf => {
                    if (!combined.some(cf => cf.name.toLowerCase() === uf.name.toLowerCase())) {
                        combined.push(uf);
                    }
                });

                // Sort by closest match
                const sorted = combined.sort((a, b) => {
                    // Always put Saved Meals first if they match
                    if ((a as any).isSavedMeal && !(b as any).isSavedMeal) return -1;
                    if (!(a as any).isSavedMeal && (b as any).isSavedMeal) return 1;

                    const nameA = a.name.toLowerCase();
                    const nameB = b.name.toLowerCase();
                    const query = searchQuery.toLowerCase();

                    // 1. Exact match
                    if (nameA === query && nameB !== query) return -1;
                    if (nameB === query && nameA !== query) return 1;

                    // 2. Starts with
                    const startsWithA = nameA.startsWith(query);
                    const startsWithB = nameB.startsWith(query);
                    if (startsWithA && !startsWithB) return -1;
                    if (startsWithB && !startsWithA) return 1;

                    // 3. Shorter names first (usually more relevant)
                    if (nameA.length !== nameB.length) {
                        return nameA.length - nameB.length;
                    }

                    return nameA.localeCompare(nameB);
                });

                setFilteredFoods(sorted);
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setIsSearching(false);
            }
        }, 500); // 500ms delay

        return () => clearTimeout(debounceTimer);
    }, [searchQuery, isPremium]);

    const handleAddFood = async (food: any) => {
        if (food.isSavedMeal) {
            try {
                // Bulk add items from the saved meal
                await bulkAddFoodsToLog(date, food.items, mealCategory);
                navigation.goBack();
                Alert.alert('Added', `Added ${food.name} to ${mealCategory}`);
            } catch (error) {
                console.error(error);
                Alert.alert('Error', 'Failed to add meal.');
            }
        } else {
            navigation.navigate('FoodDetail', { food, mealCategory, date });
        }
    };

    const renderFoodItem = ({ item }: { item: any }) => (
        <TouchableOpacity style={styles.foodItem} onPress={() => handleAddFood(item)}>
            <View style={styles.foodInfo}>
                <Text style={styles.foodName}>
                    {item.isSavedMeal ? '🍱 ' : ''}{item.name}
                </Text>
                <Text style={styles.foodDetails}>
                    {item.brand === 'My Meal' ? 'Saved Meal' : item.brand} • {item.calories} kcal • {item.servingSize}
                </Text>
            </View>
            <View style={styles.addButton}>
                <Text style={{ fontSize: 24, color: theme.colors.primary }}>+</Text>
            </View>
        </TouchableOpacity>
    );

    const navigateToOption = (screen: 'BarcodeScanner' | 'Scanner' | 'ManualEntry' | 'FoodList') => {
        setShowOptionsModal(false);
        // Need to cast potential undefined to ensure flow, but navigation handles it if params match
        if (screen === 'ManualEntry') {
            navigation.navigate('ManualEntry', { mealCategory, date });
        } else if (screen === 'BarcodeScanner') {
            navigation.navigate('BarcodeScanner', { mealCategory, date });
        } else if (screen === 'Scanner') {
            navigation.navigate('Scanner', { mealCategory, date });
        } else if (screen === 'FoodList') {
            navigation.navigate('FoodList', { mealCategory, date });
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View style={[styles.searchBarContainer, { marginLeft: 0 }]}>
                    <Text style={{ fontSize: 20, marginRight: 8 }}>🔍</Text>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search food"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoFocus
                        maxLength={50}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Text style={{ fontSize: 18, color: theme.colors.text.secondary }}>✕</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>



            <FlatList
                data={filteredFoods}
                keyExtractor={(item) => item.id}
                renderItem={renderFoodItem}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={
                    lastMealEntries && !hasCurrentEntries ? (
                        <TouchableOpacity
                            style={[styles.repeatButton, { marginHorizontal: 0, marginTop: 0 }]}
                            onPress={handleRepeatLast}
                        >
                            <Text style={styles.repeatButtonText}>
                                {isPremium ? 'Same as last time' : 'Same as yesterday'}
                            </Text>
                            <Text style={styles.repeatButtonSubtext}>
                                From {lastMealDate} ({lastMealEntries.length} items)
                            </Text>
                            {!isPremium && (
                                <Text style={{
                                    color: theme.colors.primary,
                                    fontSize: 11,
                                    marginTop: 4,
                                    textDecorationLine: 'underline'
                                }}>
                                    Access 30 days of meal history with Stamina Pro!
                                </Text>
                            )}
                        </TouchableOpacity>
                    ) : null
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        {isSearching ? (
                            <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
                        ) : (
                            <Text style={styles.emptyText}>No foods found.</Text>
                        )}
                    </View>
                }
            />

            <View style={{ height: 1, backgroundColor: theme.colors.border }} />

            <Modal
                visible={showOptionsModal}
                transparent={true}
                animationType="none"
                onRequestClose={() => closeOptionsModal()}
            >
                <View style={styles.modalOverlay}>
                    <Animated.View
                        style={[
                            styles.modalBackground,
                            {
                                opacity: slideAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, 1]
                                })
                            }
                        ]}
                    />
                    <TouchableOpacity
                        style={styles.modalOverlayTouch}
                        onPress={() => closeOptionsModal()}
                    />
                    <Animated.View
                        style={[
                            styles.modalContent,
                            {
                                opacity: slideAnim,
                                transform: [{
                                    scale: slideAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.9, 1]
                                    })
                                }]
                            }
                        ]}
                    >
                        <Text style={styles.modalTitle}>Add Food Options</Text>

                        <TouchableOpacity style={styles.modalOption} onPress={() => navigateToOption('BarcodeScanner')}>
                            <Text style={styles.modalOptionEmoji}>📷</Text>
                            <Text style={styles.modalOptionText}>Scan Barcode</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.modalOption} onPress={() => navigateToOption('Scanner')}>
                            <Text style={styles.modalOptionEmoji}>📝</Text>
                            <Text style={styles.modalOptionText}>Scan Label</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.modalOption} onPress={() => navigateToOption('FoodList')}>
                            <Text style={styles.modalOptionEmoji}>📋</Text>
                            <Text style={styles.modalOptionText}>My Savings</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.modalOption} onPress={() => navigateToOption('ManualEntry')}>
                            <Text style={styles.modalOptionEmoji}>✏️</Text>
                            <Text style={styles.modalOptionText}>Manual Entry</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.modalCancel} onPress={() => closeOptionsModal()}>
                            <Text style={styles.modalCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Modal>
        </SafeAreaView >
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.m,
        paddingVertical: theme.spacing.s,
        backgroundColor: theme.colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    backButton: {
        padding: theme.spacing.s,
        marginRight: theme.spacing.s,
    },
    searchBarContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.background,
        borderRadius: theme.borderRadius.m,
        paddingHorizontal: theme.spacing.m,
        paddingVertical: 8,
    },
    searchIcon: {
        marginRight: theme.spacing.s,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: theme.colors.text.primary,
    },
    listContent: {
        padding: theme.spacing.m,
    },
    foodItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: theme.spacing.m,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
        paddingHorizontal: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        marginBottom: theme.spacing.s,
    },
    foodInfo: {
        flex: 1,
    },
    foodName: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text.primary,
        marginBottom: 4,
    },
    foodDetails: {
        fontSize: 14,
        color: theme.colors.text.secondary,
    },
    addButton: {
        padding: theme.spacing.s,
    },
    emptyContainer: {
        padding: theme.spacing.xl,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: theme.colors.text.secondary,
    },
    footer: {
        padding: theme.spacing.m,
        backgroundColor: theme.colors.surface,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
    },
    moreOptionsButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: theme.spacing.m,
    },
    moreOptionsText: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.primary,
        marginRight: theme.spacing.s,
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: theme.spacing.xl,
    },
    modalBackground: {
        ...StyleSheet.absoluteFillObject,
    },
    modalOverlayTouch: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    modalContent: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.l,
        padding: theme.spacing.l,
        width: '100%',
        maxWidth: 400,
        alignSelf: 'center',
        // Shadow for elevation
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: theme.spacing.l,
        textAlign: 'center',
        color: theme.colors.text.primary,
    },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing.m,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    modalOptionEmoji: {
        fontSize: 24,
        marginRight: theme.spacing.m,
    },
    modalOptionText: {
        fontSize: 18,
        color: theme.colors.text.primary,
    },
    modalCancel: {
        marginTop: theme.spacing.l,
        paddingVertical: theme.spacing.m,
        alignItems: 'center',
    },
    modalCancelText: {
        fontSize: 18,
        color: theme.colors.error,
        fontWeight: '600',
    },
    repeatButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.colors.primaryLight,
        padding: theme.spacing.m,
        marginHorizontal: theme.spacing.m,
        marginTop: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        borderWidth: 1,
        borderColor: theme.colors.primary,
        borderStyle: 'dashed',
    },
    repeatButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.primaryDark,
    },
    repeatButtonSubtext: {
        fontSize: 12,
        color: theme.colors.primary,
    },
});
