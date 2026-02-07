import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FoodProfile } from '../types/food';
import { theme } from '../theme';

interface FoodCardProps {
    food: FoodProfile;
    onPress?: () => void;
    onAdd?: () => void;
    hideAddButton?: boolean;
}

export const FoodCard: React.FC<FoodCardProps> = ({ food, onPress, onAdd, hideAddButton = false }) => {
    return (
        <TouchableOpacity
            style={styles.container}
            onPress={onPress}
            activeOpacity={onPress ? 0.7 : 1}
            disabled={!onPress}
        >
            <View style={styles.content}>
                <Text style={styles.name}>{food.name}</Text>
                {food.nutrition.servingSize && (
                    <Text style={styles.serving}>{food.nutrition.servingSize}</Text>
                )}
                <View style={styles.macros}>
                    <View style={styles.macroItem}>
                        <Text style={styles.macroValue}>{Math.round(food.nutrition.calories)}</Text>
                        <Text style={styles.macroLabel}>cal</Text>
                    </View>
                    <View style={styles.macroItem}>
                        <Text style={[styles.macroValue, { color: theme.colors.secondary }]}>
                            {Math.round(food.nutrition.protein)}g
                        </Text>
                        <Text style={styles.macroLabel}>pro</Text>
                    </View>
                    <View style={styles.macroItem}>
                        <Text style={[styles.macroValue, { color: theme.colors.success }]}>
                            {Math.round(food.nutrition.carbs)}g
                        </Text>
                        <Text style={styles.macroLabel}>carb</Text>
                    </View>
                    <View style={styles.macroItem}>
                        <Text style={[styles.macroValue, { color: theme.colors.warning }]}>
                            {Math.round(food.nutrition.fats)}g
                        </Text>
                        <Text style={styles.macroLabel}>fat</Text>
                    </View>
                </View>
            </View>
            {!hideAddButton && onAdd && (
                <TouchableOpacity style={styles.addButton} onPress={onAdd}>
                    <Text style={styles.addButtonText}>+</Text>
                </TouchableOpacity>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.m,
        padding: theme.spacing.m,
        marginBottom: theme.spacing.m,
        flexDirection: 'row',
        alignItems: 'center',
        ...theme.shadows.soft,
    },
    content: {
        flex: 1,
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text.primary,
        marginBottom: 4,
    },
    serving: {
        fontSize: 14,
        color: theme.colors.text.secondary,
        marginBottom: 8,
    },
    macros: {
        flexDirection: 'row',
        gap: theme.spacing.m,
    },
    macroItem: {
        alignItems: 'center',
        minWidth: 40,
    },
    macroValue: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.text.primary,
    },
    macroLabel: {
        fontSize: 11,
        color: theme.colors.text.tertiary,
        marginTop: 2,
    },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: theme.spacing.m,
    },
    addButtonText: {
        color: theme.colors.primary,
        fontSize: 24,
        fontWeight: '600',
    },
});
