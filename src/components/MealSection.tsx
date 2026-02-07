import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { DailyLogEntry } from '../types/food';
import { theme } from '../theme';
import { FoodCard } from './FoodCard';


interface MealSectionProps {
    title: string;
    entries: DailyLogEntry[];
    calories: number;
    macros: { protein: number; carbs: number; fats: number };
    onAddFood: () => void;
    onRepeatLast?: () => void;
    lastMealDate?: string | null;
    lastMealCount?: number;
    isPremium?: boolean;
    onRemoveEntry?: (entryId: string) => void;
    onDeleteSection?: () => void;
    isRemovable?: boolean;
    onSaveMeal?: () => void;
}

export const MealSection: React.FC<MealSectionProps> = ({
    title,
    entries,
    calories,
    macros,
    onAddFood,
    onRepeatLast,
    lastMealDate,
    lastMealCount,
    isPremium = false,
    onRemoveEntry,
    onDeleteSection,
    isRemovable = false,
    onSaveMeal,
}) => {
    const [expanded, setExpanded] = React.useState(false);



    const toggleExpand = () => {
        setExpanded(!expanded);
    };

    // Determine which entries to show
    const visibleEntries = expanded ? entries : entries.slice(0, 2);
    const hasMore = entries.length > 2;

    return (
        <View style={styles.container}>
            {/* Header */}
            <TouchableOpacity
                style={styles.header}
                onPress={hasMore ? toggleExpand : undefined}
                activeOpacity={hasMore ? 0.7 : 1}
            >
                <View>
                    <Text style={styles.title}>{title}</Text>
                    {/* Macro Subtitle */}
                    <View style={styles.macroSubtitle}>
                        <Text style={[styles.macroText, { color: theme.colors.secondary }]}>Pro: {Math.round(macros.protein)}g</Text>
                        <Text style={[styles.macroText, { color: theme.colors.success }]}>Carb: {Math.round(macros.carbs)}g</Text>
                        <Text style={[styles.macroText, { color: theme.colors.warning }]}>Fat: {Math.round(macros.fats)}g</Text>
                    </View>
                </View>
                <View style={styles.headerRight}>
                    <Text style={styles.calories}>{Math.round(calories)} kcal</Text>
                    {isRemovable && onDeleteSection && (
                        <TouchableOpacity style={styles.deleteButton} onPress={onDeleteSection}>
                            <Text style={styles.deleteText}>✕</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </TouchableOpacity>

            {/* Repeat Last Meal Button - Only show if meal is empty */}
            {onRepeatLast && lastMealDate && lastMealCount !== undefined && entries.length === 0 && (
                <TouchableOpacity style={styles.repeatButton} onPress={onRepeatLast}>
                    <View style={styles.repeatButtonMain}>
                        <Text style={styles.repeatButtonText}>
                            {isPremium ? 'Same as last time' : 'Same as yesterday'}
                        </Text>
                        <Text style={styles.repeatButtonSubtext}>
                            From {lastMealDate} ({lastMealCount} {lastMealCount === 1 ? 'item' : 'items'})
                        </Text>
                    </View>
                    {!isPremium && (
                        <Text style={styles.repeatButtonUpsell}>
                            Access 30 days of meal history with Stamina Pro!
                        </Text>
                    )}
                </TouchableOpacity>
            )}

            {/* Food List */}
            <View style={styles.list}>
                {entries.length > 0 ? (
                    <>
                        {visibleEntries.map((entry) => (
                            <View key={entry.id} style={styles.entryWrapper}>
                                {expanded ? (
                                    // Full view (existing card)
                                    <FoodCard
                                        food={{
                                            id: entry.foodId,
                                            name: entry.foodName,
                                            nutrition: {
                                                calories: entry.nutrition.calories * entry.servings,
                                                protein: entry.nutrition.protein * entry.servings,
                                                carbs: entry.nutrition.carbs * entry.servings,
                                                fats: entry.nutrition.fats * entry.servings,
                                            },
                                            createdAt: entry.timestamp,
                                            source: 'user_manual',
                                            isLocalOnly: true,
                                        }}
                                        hideAddButton={true}
                                        onPress={() => { }}
                                    />
                                ) : (
                                    // Compact view (preview)
                                    <View style={styles.compactCard}>
                                        <Text style={styles.compactName} numberOfLines={1}>{entry.foodName}</Text>
                                        <Text style={styles.compactCal}>{Math.round(entry.nutrition.calories * entry.servings)} kcal</Text>
                                    </View>
                                )}

                                {/* Delete Entry Button - Now visible in both views */}
                                {onRemoveEntry && (
                                    <TouchableOpacity
                                        style={styles.removeEntryButton}
                                        onPress={() => onRemoveEntry(entry.id)}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <Text style={styles.removeEntryText}>—</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ))}


                        {/* See More / Show Less Button */}
                        {hasMore && (
                            <TouchableOpacity onPress={toggleExpand} style={styles.expandButton}>
                                <Text style={styles.expandText}>
                                    {expanded ? 'Show less' : `See ${entries.length - 2} more...`}
                                </Text>
                            </TouchableOpacity>
                        )}

                        {/* If not expanded but we have items, we still showed 2 compact items. 
                             If expanded, we show all full items.
                         */}
                    </>
                ) : (
                    <Text style={styles.emptyText}>No food added</Text>
                )}
            </View>



            {/* Add Button */}
            <TouchableOpacity style={styles.addButton} onPress={onAddFood}>
                <Text style={styles.addButtonText}>+ Add Food</Text>
            </TouchableOpacity>

            {/* Save Meal Button (Premium) */}
            {onSaveMeal && entries.length > 0 && (
                <TouchableOpacity style={styles.saveMealButton} onPress={onSaveMeal}>
                    <Text style={styles.saveMealButtonText}>♥ Save Meal</Text>
                </TouchableOpacity>
            )}
        </View >
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: theme.spacing.l,
        backgroundColor: 'transparent',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start', // Align start for multiline
        marginBottom: theme.spacing.s,
        paddingHorizontal: theme.spacing.s,
    },
    title: {
        ...theme.typography.h3,
        color: theme.colors.text.primary,
        marginBottom: 2,
    },
    macroSubtitle: {
        flexDirection: 'row',
        gap: 8,
    },
    macroText: {
        fontSize: 12,
        fontWeight: '600',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.m,
        paddingTop: 4, // Align with title visually
    },
    calories: {
        ...theme.typography.body,
        fontWeight: '600',
        color: theme.colors.text.secondary,
    },
    deleteButton: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteText: {
        color: theme.colors.error,
        fontWeight: 'bold',
        fontSize: 12,
    },
    list: {
        gap: theme.spacing.s,
    },
    entryWrapper: {
        position: 'relative',
    },
    compactCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        paddingHorizontal: theme.spacing.m,
        paddingVertical: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        // No shadow to keep it flat/clean as requested for "preview" feeling
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    compactName: {
        fontSize: 14,
        color: theme.colors.text.primary,
        flex: 1,
    },
    compactCal: {
        fontSize: 14,
        color: theme.colors.text.secondary,
        fontWeight: '500',
    },
    removeEntryButton: {
        position: 'absolute',
        top: -6,
        right: -6,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: theme.colors.error,
        alignItems: 'center',
        justifyContent: 'center',
        ...theme.shadows.soft,
        zIndex: 10,
    },
    removeEntryText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
        lineHeight: 16,
    },
    emptyText: {
        ...theme.typography.caption,
        fontStyle: 'italic',
        paddingHorizontal: theme.spacing.s,
        marginBottom: theme.spacing.s,
    },
    expandButton: {
        alignItems: 'center',
        paddingVertical: 4,
    },
    expandText: {
        fontSize: 12,
        color: theme.colors.primary,
        fontWeight: '600',
    },
    addButton: {
        marginTop: theme.spacing.s,
        backgroundColor: theme.colors.surface,
        paddingVertical: theme.spacing.m,
        alignItems: 'center',
        borderRadius: theme.borderRadius.m,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderStyle: 'dashed',
    },
    addButtonText: {
        ...theme.typography.button,
        color: theme.colors.primary,
        fontSize: 14,
    },
    repeatButton: {
        marginBottom: theme.spacing.s,
        backgroundColor: theme.colors.primaryLight,
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        borderWidth: 1,
        borderColor: theme.colors.primary,
        borderStyle: 'dashed',
    },
    repeatButtonMain: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    repeatButtonUpsell: {
        color: theme.colors.primary,
        fontSize: 11,
        marginTop: 6,
        textAlign: 'center',
        textDecorationLine: 'underline',
    },
    repeatButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.primaryDark,
    },
    repeatButtonSubtext: {
        fontSize: 12,
        color: theme.colors.text.secondary,
    },
    saveMealButton: {
        marginTop: theme.spacing.s,
        backgroundColor: theme.colors.surface,
        paddingVertical: theme.spacing.m,
        alignItems: 'center',
        borderRadius: theme.borderRadius.m,
        borderWidth: 1,
        borderColor: theme.colors.primary,
        borderStyle: 'solid',
    },
    saveMealButtonText: {
        ...theme.typography.button,
        color: theme.colors.primary,
        fontSize: 14,
        fontWeight: 'bold',
    },
});
