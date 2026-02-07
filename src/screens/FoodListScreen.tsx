import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    Alert,
    TouchableOpacity,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { FoodCard } from '../components/FoodCard';
import { getAllFoodProfiles, addFoodToLog, getTodayDate } from '../services/storage';
import { FoodProfile } from '../types/food';
import { RootStackParamList } from '../navigation/types';
import { useSubscription } from '../context/SubscriptionContext';

type FoodListScreenProps = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'FoodList'>;
    route: RouteProp<RootStackParamList, 'FoodList'>;
};

export const FoodListScreen: React.FC<FoodListScreenProps> = ({ navigation, route }) => {
    const { isPremium } = useSubscription();
    const [foods, setFoods] = useState<FoodProfile[]>([]);
    const [filteredFoods, setFilteredFoods] = useState<FoodProfile[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    const loadFoods = async () => {
        const allFoods = await getAllFoodProfiles();
        setFoods(allFoods);
        setFilteredFoods(allFoods);
    };

    useFocusEffect(
        useCallback(() => {
            loadFoods();
        }, [])
    );

    const handleSearch = (query: string) => {
        setSearchQuery(query);
        if (query.trim() === '') {
            setFilteredFoods(foods);
        } else {
            const filtered = foods.filter((food) =>
                food.name.toLowerCase().includes(query.toLowerCase())
            );
            setFilteredFoods(filtered);
        }
    };

    const handleAddToLog = async (food: FoodProfile) => {
        const logDate = route.params?.date || getTodayDate();

        if (logDate !== getTodayDate() && !isPremium) {
            navigation.navigate('Paywall');
            return;
        }

        try {
            await addFoodToLog(
                logDate,
                food,
                1,
                route.params?.mealCategory
            );
            Alert.alert('Success', `${food.name} added to log!`, [
                { text: 'OK', onPress: () => navigation.navigate('Home', { date: logDate }) }
            ]);
        } catch (error) {
            console.error('Error adding to log:', error);
            Alert.alert('Error', 'Failed to add food to log');
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>My Foods</Text>
                <TextInput
                    style={styles.searchInput}
                    value={searchQuery}
                    onChangeText={handleSearch}
                    placeholder="Search foods..."
                    placeholderTextColor="#adb5bd"
                    maxLength={50}
                />
                {/* Added a button to navigate to ManualEntry, passing mealCategory and date */}
                <TouchableOpacity
                    style={styles.manualButton}
                    onPress={() => {
                        const logDate = route.params?.date || getTodayDate();
                        if (logDate !== getTodayDate() && !isPremium) {
                            Alert.alert(
                                'Premium Feature',
                                'Editing past days is a Stamina Pro feature.',
                                [{ text: 'Unlock Pro', onPress: () => navigation.navigate('Paywall') }, { text: 'Cancel', style: 'cancel' }]
                            );
                            return;
                        }
                        navigation.navigate('ManualEntry', {
                            mealCategory: route.params?.mealCategory,
                            date: route.params?.date
                        });
                    }}
                >
                    <Text style={styles.manualButtonText}>Add Manually</Text>
                </TouchableOpacity>
            </View>

            {filteredFoods.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>
                        {searchQuery
                            ? 'No foods found matching your search'
                            : 'No saved foods yet.\nScan a label or add manually to get started!'}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={filteredFoods}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <FoodCard
                            food={item}
                            onAdd={() => handleAddToLog(item)}
                        />
                    )}
                    contentContainerStyle={styles.list}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    header: {
        padding: 20,
        paddingTop: 60,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#212529',
        marginBottom: 16,
    },
    searchInput: {
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#ced4da',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: '#212529',
    },
    list: {
        padding: 16,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        fontSize: 16,
        color: '#6c757d',
        textAlign: 'center',
        lineHeight: 24,
    },
    manualButton: {
        marginTop: 10,
        backgroundColor: '#007bff',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    manualButtonText: {
        color: '#ffffff',
        fontWeight: 'bold',
    },
});
