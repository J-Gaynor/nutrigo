import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { theme } from '../../theme';
import { UserProfile } from '../../types/user';


type SuccessScreenProps = {
    navigation: NativeStackNavigationProp<any, 'Success'>;
    route: RouteProp<any, 'Success'>;
};

export const SuccessScreen: React.FC<SuccessScreenProps> = ({ navigation, route }) => {
    const profile = route.params?.metrics as UserProfile;

    const handleStart = () => {
        // Navigate to Tutorial
        navigation.replace('Tutorial', { fromProfile: false });
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.emoji}>🎉</Text>
                    <Text style={styles.title}>All Set!</Text>
                    <Text style={styles.subtitle}>
                        We've calculated your daily targets based on your goals and activity level.
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Daily Targets</Text>

                    <View style={styles.targetRow}>
                        <View style={styles.targetItem}>
                            <Text style={styles.targetValue}>{profile.targetMacros.calories}</Text>
                            <Text style={styles.targetLabel}>Calories</Text>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.macroRow}>
                        <View style={styles.macroItem}>
                            <Text style={[styles.macroValue, { color: '#3B82F6' }]}>
                                {profile.targetMacros.protein}g
                            </Text>
                            <Text style={styles.macroLabel}>Protein</Text>
                        </View>
                        <View style={styles.macroItem}>
                            <Text style={[styles.macroValue, { color: '#10B981' }]}>
                                {profile.targetMacros.carbs}g
                            </Text>
                            <Text style={styles.macroLabel}>Carbs</Text>
                        </View>
                        <View style={styles.macroItem}>
                            <Text style={[styles.macroValue, { color: '#F59E0B' }]}>
                                {profile.targetMacros.fats}g
                            </Text>
                            <Text style={styles.macroLabel}>Fats</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.infoBox}>
                    <Text style={styles.infoTitle}>Pro Tip:</Text>
                    <Text style={styles.infoText}>
                        You can adjust these targets anytime in your profile settings.
                    </Text>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.button} onPress={handleStart}>
                    <Text style={styles.buttonText}>Let's Go!</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.primary,
    },
    content: {
        padding: theme.spacing.l,
        paddingTop: theme.spacing.xxl,
    },
    header: {
        alignItems: 'center',
        marginBottom: theme.spacing.xl,
    },
    emoji: {
        fontSize: 64,
        marginBottom: theme.spacing.m,
    },
    title: {
        ...theme.typography.h1,
        color: theme.colors.text.inverse,
        marginBottom: theme.spacing.s,
        textAlign: 'center',
    },
    subtitle: {
        ...theme.typography.body,
        color: theme.colors.primaryLight,
        textAlign: 'center',
        lineHeight: 24,
    },
    card: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.l,
        padding: theme.spacing.l,
        ...theme.shadows.medium,
        marginBottom: theme.spacing.l,
    },
    cardTitle: {
        ...theme.typography.h3,
        textAlign: 'center',
        marginBottom: theme.spacing.l,
        color: theme.colors.text.secondary,
        textTransform: 'uppercase',
        fontSize: 14,
        letterSpacing: 1,
    },
    targetRow: {
        alignItems: 'center',
        marginBottom: theme.spacing.l,
    },
    targetItem: {
        alignItems: 'center',
    },
    targetValue: {
        fontSize: 48,
        fontWeight: '800',
        color: theme.colors.text.primary,
    },
    targetLabel: {
        fontSize: 18,
        color: theme.colors.text.secondary,
        fontWeight: '500',
    },
    divider: {
        height: 1,
        backgroundColor: theme.colors.border,
        marginVertical: theme.spacing.m,
    },
    macroRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    macroItem: {
        alignItems: 'center',
        flex: 1,
    },
    macroValue: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 4,
    },
    macroLabel: {
        fontSize: 14,
        color: theme.colors.text.secondary,
    },
    infoBox: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: theme.borderRadius.m,
        padding: theme.spacing.m,
    },
    infoTitle: {
        color: theme.colors.text.inverse,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    infoText: {
        color: theme.colors.text.inverse,
        fontSize: 14,
        opacity: 0.9,
        lineHeight: 20,
    },
    footer: {
        padding: theme.spacing.l,
        paddingBottom: theme.spacing.xl,
    },
    button: {
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.l,
        alignItems: 'center',
        ...theme.shadows.medium,
    },
    buttonText: {
        ...theme.typography.button,
        color: theme.colors.primary,
        fontSize: 18,
        fontWeight: 'bold',
    },
});
