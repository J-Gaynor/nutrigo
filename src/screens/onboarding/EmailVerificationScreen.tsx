import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, SafeAreaView, Image } from 'react-native';
import { sendEmailVerification, signOut } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { theme } from '../../theme';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = {
    navigation: NativeStackNavigationProp<any, 'EmailVerification'>;
};

export const EmailVerificationScreen: React.FC<Props> = ({ navigation }) => {
    const [loading, setLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

    const user = auth.currentUser;

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (resendCooldown > 0) {
            timer = setInterval(() => {
                setResendCooldown((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [resendCooldown]);



    const handleCheckVerification = async () => {
        setLoading(true);
        try {
            if (auth.currentUser) {
                await auth.currentUser.reload(); // Refresh user data
                if (auth.currentUser.emailVerified) {
                    // Force token refresh to trigger AppNavigator's onIdTokenChanged listener
                    await auth.currentUser.getIdToken(true);
                } else {
                    Alert.alert('Not Verified', 'We still can\'t verify your email. Please check your inbox and click the link.');
                }
            }
        } catch (error: any) {
            console.error('Check verification failed:', error);
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResendEmail = async () => {
        if (!user) return;
        setLoading(true);
        try {
            await sendEmailVerification(user);
            Alert.alert('Sent', `A new verification email has been sent to ${user.email}`);
            setResendCooldown(60); // 60 seconds cooldown
        } catch (error: any) {
            console.error('Resend failed:', error);
            if (error.code === 'auth/too-many-requests') {
                Alert.alert('Error', 'Too many requests. Please wait a bit before trying again.');
            } else {
                Alert.alert('Error', error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Sign out failed:', error);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <Text style={styles.icon}>✉️</Text>
                </View>

                <Text style={styles.title}>Verify Your Email</Text>

                <Text style={styles.description}>
                    We've sent a verification email to:
                </Text>
                <Text style={styles.email}>{user?.email}</Text>

                <Text style={styles.instructions}>
                    Please check your inbox (and spam/junk folder) and click the link to verify your account. Once verified, click the button below.
                </Text>

                <TouchableOpacity
                    style={styles.checkButton}
                    onPress={handleCheckVerification}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text style={styles.checkButtonText}>I've Verified My Email</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.resendButton, resendCooldown > 0 && styles.disabledButton]}
                    onPress={handleResendEmail}
                    disabled={loading || resendCooldown > 0}
                >
                    <Text style={[styles.resendButtonText, resendCooldown > 0 && styles.disabledText]}>
                        {resendCooldown > 0 ? `Resend Email (${resendCooldown}s)` : 'Resend Email'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.signOutButton}
                    onPress={handleSignOut}
                    disabled={loading}
                >
                    <Text style={styles.signOutText}>Sign Out</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    content: {
        flex: 1,
        padding: theme.spacing.xl,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconContainer: {
        marginBottom: theme.spacing.xl,
        padding: theme.spacing.l,
        backgroundColor: theme.colors.surface,
        borderRadius: 50,
        ...theme.shadows.medium,
    },
    icon: {
        fontSize: 48,
    },
    title: {
        ...theme.typography.h1,
        marginBottom: theme.spacing.m,
        textAlign: 'center',
        color: theme.colors.text.primary,
    },
    description: {
        ...theme.typography.body,
        textAlign: 'center',
        color: theme.colors.text.secondary,
        marginBottom: theme.spacing.s,
    },
    email: {
        ...theme.typography.h3,
        textAlign: 'center',
        color: theme.colors.primary,
        marginBottom: theme.spacing.l,
    },
    instructions: {
        ...theme.typography.body,
        textAlign: 'center',
        color: theme.colors.text.tertiary,
        marginBottom: theme.spacing.xxl,
    },
    checkButton: {
        backgroundColor: theme.colors.primary,
        paddingVertical: theme.spacing.m,
        paddingHorizontal: theme.spacing.xl,
        borderRadius: theme.borderRadius.m,
        width: '100%',
        alignItems: 'center',
        marginBottom: theme.spacing.m,
        ...theme.shadows.medium,
    },
    checkButtonText: {
        ...theme.typography.button,
        color: '#FFFFFF',
    },
    resendButton: {
        paddingVertical: theme.spacing.m,
        width: '100%',
        alignItems: 'center',
        marginBottom: theme.spacing.l,
    },
    resendButtonText: {
        ...theme.typography.button,
        color: theme.colors.primary,
    },
    disabledButton: {
        opacity: 0.6,
    },
    disabledText: {
        color: theme.colors.text.tertiary,
    },
    signOutButton: {
        padding: theme.spacing.s,
    },
    signOutText: {
        color: theme.colors.error,
        fontSize: 14,
        fontWeight: '600',
    },
});
