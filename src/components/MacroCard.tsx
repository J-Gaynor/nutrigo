import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

interface MacroCardProps {
    label: string;
    current: number;
    target: number;
    unit?: string;
    color: string;
}

export const MacroCard: React.FC<MacroCardProps> = ({ label, current, target, unit = 'g', color }) => {
    const percentage = Math.min((current / target) * 100, 100);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.label}>{label}</Text>
                <Text style={styles.value}>
                    {Math.round(current)}/{Math.round(target)}{unit}
                </Text>
            </View>
            <View style={styles.progressBarContainer}>
                <View
                    style={[
                        styles.progressBar,
                        { width: `${percentage}%`, backgroundColor: color }
                    ]}
                />
            </View>
            <Text style={styles.percentage}>{Math.round(percentage)}%</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.m,
        padding: theme.spacing.m,
        marginBottom: theme.spacing.m,
        marginRight: theme.spacing.m,
        minWidth: 140, // Ensure good width in horizontal scroll
        ...theme.shadows.soft,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.s,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text.primary,
    },
    value: {
        fontSize: 14,
        color: theme.colors.text.secondary,
        fontWeight: '500',
    },
    progressBarContainer: {
        height: 6,
        backgroundColor: theme.colors.background,
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 4,
    },
    progressBar: {
        height: '100%',
        borderRadius: 3,
    },
    percentage: {
        fontSize: 12,
        color: theme.colors.text.tertiary,
        textAlign: 'right',
    },
});
