import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    Alert,
    ActivityIndicator,
    SafeAreaView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../../theme';
import { getUserProfile } from '../../services/storage';

// We'll define AuthStackParamList later in AppNavigator
type LoginScreenProps = {
    navigation: NativeStackNavigationProp<any, 'Login'>;
};

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
    const [loading, setLoading] = useState(false);

    const handleSimulatedLogin = async (provider: 'Apple' | 'Google') => {
        setLoading(true);

        // Simulate network delay
        setTimeout(async () => {
            // Check if user already has a profile
            try {
                const profile = await getUserProfile();
                setLoading(false);

                if (profile) {
                    // User exists, go to Home (Main App)
                    // Navigation logic will be handled by AppNavigator switching stacks,
                    // but for now we might navigate to Home directly if in same stack,
                    // or we trigger a re-render of AppNavigator.
                    // For this implementation, we assume we're in AuthStack and need to go to Onboarding if no profile.
                    navigation.replace('ProfileSetup');
                } else {
                    // New user, go to Onboarding
                    navigation.replace('ProfileSetup');
                }
            } catch (error) {
                setLoading(false);
                navigation.replace('ProfileSetup');
            }
        }, 1500);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.logo}>🍏</Text>
                    <Text style={styles.title}>NutritionApp</Text>
                    <Text style={styles.subtitle}>Smart calorie and workout tracking</Text>
                </View>

                <View style={styles.form}>
                    <Text style={styles.loginTitle}>Get Started</Text>

                    <TouchableOpacity
                        style={[styles.socialButton, styles.appleButton]}
                        onPress={() => handleSimulatedLogin('Apple')}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={theme.colors.text.inverse} />
                        ) : (
                            <Text style={styles.appleButtonText}>Sign in with Apple</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.socialButton, styles.googleButton]}
                        onPress={() => handleSimulatedLogin('Google')}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={theme.colors.text.primary} />
                        ) : (
                            <Text style={styles.googleButtonText}>Sign in with Google</Text>
                        )}
                    </TouchableOpacity>

                    <Text style={styles.disclaimer}>
                        By signing in, you agree to our Terms of Service and Privacy Policy.
                    </Text>
                </View>
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
        flex: 1,
        justifyContent: 'space-between',
        padding: theme.spacing.l,
    },
    header: {
        alignItems: 'center',
        marginTop: theme.spacing.xxl,
    },
    logo: {
        fontSize: 64,
        marginBottom: theme.spacing.m,
    },
    title: {
        ...theme.typography.h1,
        color: theme.colors.text.inverse,
        marginBottom: theme.spacing.s,
    },
    subtitle: {
        ...theme.typography.body,
        color: theme.colors.primaryLight,
        textAlign: 'center',
    },
    form: {
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.l,
        borderRadius: theme.borderRadius.l,
        ...theme.shadows.medium,
        marginBottom: theme.spacing.l,
    },
    loginTitle: {
        ...theme.typography.h2,
        textAlign: 'center',
        marginBottom: theme.spacing.l,
    },
    socialButton: {
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        alignItems: 'center',
        marginBottom: theme.spacing.m,
        borderWidth: 1,
    },
    appleButton: {
        backgroundColor: '#000000',
        borderColor: '#000000',
    },
    googleButton: {
        backgroundColor: '#FFFFFF',
        borderColor: theme.colors.border,
    },
    appleButtonText: {
        ...theme.typography.button,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    googleButtonText: {
        ...theme.typography.button,
        color: '#000000',
        fontWeight: '600',
    },
    disclaimer: {
        ...theme.typography.caption,
        textAlign: 'center',
        marginTop: theme.spacing.s,
    },
});
