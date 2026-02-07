import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as AppleAuthentication from 'expo-apple-authentication';
import { ResponseType } from 'expo-auth-session';
import {
    GoogleAuthProvider,
    FacebookAuthProvider,
    signInWithCredential,
    OAuthProvider,
    signInWithPopup,
    updateProfile
} from 'firebase/auth';
import { theme } from '../../theme';
import { auth, db } from '../../config/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { checkUsernameAvailable, reserveUsername } from '../../services/storage';


WebBrowser.maybeCompleteAuthSession();

// We'll define AuthStackParamList later in AppNavigator
type LoginScreenProps = {
    navigation: NativeStackNavigationProp<any, 'Login'>;
};

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);

    // TODO: OAuth Sign-In (v2.0)
    // Uncomment below and add OAuth credentials to .env when ready to enable social sign-in
    /*
    // Google Auth Request
    const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
        clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
    });

    // Facebook Auth Request
    const [fbRequest, fbResponse, fbPromptAsync] = Facebook.useAuthRequest({
        clientId: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || 'YOUR_FACEBOOK_APP_ID',
    });

    useEffect(() => {
        if (response?.type === 'success') {
            const { id_token } = response.params;
            const credential = GoogleAuthProvider.credential(id_token);
            handleSocialLogin(credential);
        }
    }, [response]);

    useEffect(() => {
        if (fbResponse?.type === 'success') {
            const { access_token } = fbResponse.params;
            const credential = FacebookAuthProvider.credential(access_token);
            handleSocialLogin(credential);
        }
    }, [fbResponse]);
    */

    /*
    const handleSocialLogin = async (credential: any) => {
        setLoading(true);
        try {
            const userCredential = await signInWithCredential(auth, credential);
            await checkUserProfile(userCredential.user.uid);
        } catch (error: any) {
            console.error(error);
            Alert.alert('Login Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAppleLogin = async () => {
        try {
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
            });

            // For Firebase Auth with Apple, we usually need a custom Cloud Function or 
            // the 'OAuthProvider' flow if ignoring the raw nonce details for simplicity in Expo Go context.
            // Note: Apple Sign In natively on simple Expo Go is tricky without development build. 
            // We'll leave the UI active but it might error on Simulator/Device without config.
            Alert.alert('Sign In with Apple', 'Apple Sign In setup is required in Expo Dashboard.');

        } catch (e: any) {
            if (e.code !== 'ERR_REQUEST_CANCELED') {
                Alert.alert('Login Error', e.message);
            }
        }
    };
    */

    const checkUserProfile = async (uid: string) => {
        try {
            console.log('Checking profile for UID:', uid);
            // AppNavigator will automatically route based on profile existence
            // No need to manually navigate here
        } catch (error: any) {
            console.error('Firestore Error in checkUserProfile:', error);
            Alert.alert('Database Error', `Error processing profile: ${error.message}`);
        }
    };


    const handleAuth = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter both email and password.');
            return;
        }

        if (isSignUp) {
            // Username Validation
            if (!username.trim()) {
                Alert.alert('Error', 'Please enter a username.');
                return;
            }
            if (username.trim().length < 3 || username.trim().length > 16) {
                Alert.alert('Invalid Username', 'Username must be between 3 and 16 characters.');
                return;
            }

            // Password Validation
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,32}$/;
            if (!passwordRegex.test(password)) {
                Alert.alert(
                    'Weak Password',
                    'Password must be 8-32 characters long, include at least one uppercase letter, one lowercase letter, and one number.'
                );
                return;
            }

            if (password !== confirmPassword) {
                Alert.alert('Error', 'Passwords do not match.');
                return;
            }
        }

        setLoading(true);
        try {
            if (isSignUp) {
                // Check Username Availability
                const isAvailable = await checkUsernameAvailable(username);
                if (!isAvailable) {
                    Alert.alert('Unavailable', 'This username is already taken. Please choose another.');
                    setLoading(false);
                    return;
                }

                // Sign Up - NEW USER
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);

                // Reserve Username
                await reserveUsername(username, userCredential.user.uid);

                // Update displayName
                await updateProfile(userCredential.user, { displayName: username.trim() });

                // Send Verification Email
                await sendEmailVerification(userCredential.user);
                Alert.alert('Account Created', 'Please check your email to verify your account.');

                // Mark as new signup so AppNavigator shows Tutorial
                const AsyncStorage = require('@react-native-async-storage/async-storage').default;
                await AsyncStorage.setItem('isNewSignup', 'true');

                // Let AppNavigator handle routing to Tutorial
            } else {
                // Login - EXISTING USER
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                await checkUserProfile(userCredential.user.uid);
                // AppNavigator will route to ProfileSetup if no profile exists (skip Tutorial)
            }
        } catch (error: any) {
            console.error(error);
            let msg = error.message;

            if (error.code === 'auth/invalid-email') msg = 'Invalid email address.';
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                msg = 'Incorrect email or password.';
            }
            if (error.code === 'auth/email-already-in-use') msg = 'Email already in use.';
            if (error.code === 'auth/weak-password') msg = 'Password is too weak.';
            Alert.alert('Authentication Error', msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.header}>
                        <Text style={styles.title}>Stamina</Text>
                        <Text style={styles.subtitle}>Smarter Nutrition & Workouts</Text>
                    </View>

                    <View style={styles.form}>
                        <Text style={styles.loginTitle}>{isSignUp ? 'Create Account' : 'Welcome Back'}</Text>
                        <View style={styles.formContainer}>
                            {isSignUp && (
                                <View style={styles.inputContainer}>
                                    <Text style={styles.label}>Username</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="StaminaUser"
                                        placeholderTextColor={theme.colors.text.tertiary}
                                        value={username}
                                        onChangeText={(text) => setUsername(text.toLowerCase())}
                                        autoCapitalize="none"
                                        maxLength={16}
                                    />
                                </View>
                            )}

                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Email</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="hello@example.com"
                                    placeholderTextColor={theme.colors.text.tertiary}
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                    maxLength={100}
                                />
                            </View>

                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Password</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="••••••••"
                                    placeholderTextColor={theme.colors.text.tertiary}
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                    textContentType={isSignUp ? "newPassword" : "password"}
                                    autoComplete={isSignUp ? "password-new" : "password"}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    maxLength={32}
                                />
                            </View>

                            {isSignUp && (
                                <View style={styles.inputContainer}>
                                    <Text style={styles.label}>Confirm Password</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="••••••••"
                                        placeholderTextColor={theme.colors.text.tertiary}
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        secureTextEntry
                                        textContentType="newPassword"
                                        autoComplete="password-new"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        maxLength={22}
                                    />
                                </View>
                            )}
                        </View>

                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={handleAuth}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.primaryButtonText}>
                                    {isSignUp ? 'Sign Up' : 'Log In'}
                                </Text>
                            )}
                        </TouchableOpacity>

                        {/* TODO: OAuth Sign-In Buttons (v2.0) */}
                        {/*
                        <View style={styles.divider}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>OR</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        <TouchableOpacity
                            style={[styles.socialButton, styles.appleButton]}
                            onPress={handleAppleLogin}
                            disabled={loading}
                        >
                            <Text style={styles.appleButtonText}>Sign in with Apple</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.socialButton, styles.googleButton]}
                            onPress={() => promptAsync()}
                            disabled={loading}
                        >
                            <Text style={styles.googleButtonText}>Sign in with Google</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.socialButton, styles.facebookButton]}
                            onPress={() => fbPromptAsync()}
                            disabled={loading}
                        >
                            <Text style={styles.facebookButtonText}>Sign in with Facebook</Text>
                        </TouchableOpacity>
                        */}

                        <TouchableOpacity
                            style={styles.switchButton}
                            onPress={() => setIsSignUp(!isSignUp)}
                            disabled={loading}
                        >
                            <Text style={styles.switchButtonText}>
                                {isSignUp ? 'Have an account? Log In' : 'No account? Sign Up'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
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
        justifyContent: 'center',
        padding: theme.spacing.l,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: theme.spacing.l,
    },
    header: {
        alignItems: 'center',
        marginBottom: theme.spacing.l, // Reduced from xxl
        marginTop: theme.spacing.l,    // Added explicit top margin/padding context if needed, or just let it float up
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
    },
    formContainer: {
        width: '100%',
    },
    loginTitle: {
        ...theme.typography.h2,
        textAlign: 'center',
        marginBottom: theme.spacing.l,
    },
    inputContainer: {
        marginBottom: theme.spacing.m,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        color: theme.colors.text.secondary,
    },
    input: {
        backgroundColor: theme.colors.background,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.borderRadius.m,
        padding: theme.spacing.m,
        fontSize: 16,
        color: theme.colors.text.primary,
    },
    primaryButton: {
        backgroundColor: theme.colors.primary,
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        alignItems: 'center',
        marginTop: theme.spacing.m,
    },
    primaryButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    switchButton: {
        marginTop: theme.spacing.l,
        alignItems: 'center',
    },
    switchButtonText: {
        color: theme.colors.primary,
        fontWeight: '600',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: theme.spacing.l,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: theme.colors.border,
    },
    dividerText: {
        marginHorizontal: theme.spacing.m,
        color: theme.colors.text.tertiary,
        fontWeight: '600',
    },
    socialButton: {
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        alignItems: 'center',
        marginBottom: theme.spacing.s,
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
    facebookButton: {
        backgroundColor: '#1877F2',
        borderColor: '#1877F2',
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
    facebookButtonText: {
        ...theme.typography.button,
        color: '#FFFFFF',
        fontWeight: '600',
    },
});
