import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { onIdTokenChanged } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';
import { ScannerScreen } from '../screens/ScannerScreen';
import { ManualEntryScreen } from '../screens/ManualEntryScreen';
import { FoodListScreen } from '../screens/FoodListScreen';
import { BarcodeScannerScreen } from '../screens/BarcodeScannerScreen';
import { ProductResultScreen } from '../screens/ProductResultScreen';
import { LoginScreen } from '../screens/onboarding/LoginScreen';
import { ProfileSetupScreen } from '../screens/onboarding/ProfileSetupScreen';
import { SuccessScreen } from '../screens/onboarding/SuccessScreen';
import { TutorialScreen } from '../screens/onboarding/TutorialScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { AddExerciseScreen } from '../screens/AddExerciseScreen';
import { AddWorkoutExerciseScreen } from '../screens/AddWorkoutExerciseScreen';
import { AddWorkoutScreen } from '../screens/AddWorkoutScreen';
import { WorkoutDetailScreen } from '../screens/WorkoutDetailScreen';
import { WorkoutExecuteScreen } from '../screens/WorkoutExecuteScreen';
import { ExerciseLogScreen } from '../screens/ExerciseLogScreen';
import { WorkoutSummaryScreen } from '../screens/WorkoutSummaryScreen';
import { ParserTestScreen } from '../screens/ParserTestScreen';
import { getUserProfile } from '../services/storage';
import { theme } from '../theme';
import { RootStackParamList } from './types';
import { PaywallScreen } from '../screens/PaywallScreen';
import { EmailVerificationScreen } from '../screens/onboarding/EmailVerificationScreen';

// --- Navigation ---

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
    const [user, setUser] = useState<any>(undefined);
    const [hasProfile, setHasProfile] = useState<boolean | null>(null); // null = loading/unknown
    const [isLoading, setIsLoading] = useState(true);
    const [isNewSignup, setIsNewSignup] = useState<boolean>(false);

    useEffect(() => {
        let profileUnsubscribe: (() => void) | undefined;

        const authUnsubscribe = onIdTokenChanged(auth, async (authUser) => {
            if (authUser) {
                setUser(authUser);
                setHasProfile(null); // Reset to null so loading spinner shows while we check Firestore

                // Check if this is a new signup
                const AsyncStorage = require('@react-native-async-storage/async-storage').default;
                const newSignupFlag = await AsyncStorage.getItem('isNewSignup');
                if (newSignupFlag === 'true') {
                    setIsNewSignup(true);
                    await AsyncStorage.removeItem('isNewSignup'); // Clear flag
                }

                // Subscribe to profile changes to handle onboarding flow real-time
                profileUnsubscribe = onSnapshot(doc(db, 'users', authUser.uid), (docSnapshot) => {
                    if (docSnapshot.exists()) {
                        setHasProfile(true);
                    } else {
                        setHasProfile(false);
                    }
                    setIsLoading(false);
                }, (error) => {
                    console.error("Profile snapshot error:", error);
                    setHasProfile(false); // Fallback to ensure we don't get stuck in loading state
                    setIsLoading(false);
                });
            } else {
                setUser(null);
                setHasProfile(false);
                setIsNewSignup(false);
                if (profileUnsubscribe) {
                    profileUnsubscribe();
                    profileUnsubscribe = undefined;
                }
                setIsLoading(false);
            }
        });

        return () => {
            authUnsubscribe();
            if (profileUnsubscribe) profileUnsubscribe();
        };
    }, []);



    // Track if we ever loaded a profile to detect deletion vs new user
    const [wasProfileLoaded, setWasProfileLoaded] = useState(false);

    useEffect(() => {
        if (hasProfile) {
            setWasProfileLoaded(true);
            setIsNewSignup(false);
        }
    }, [hasProfile]);

    // Loading Logic:
    // 1. Initial Load (isLoading=true) - we only strictly block if we are waiting for a verified user's profile.
    // 2. Profile Unknown (hasProfile=null) - block only if verified.
    // 3. Profile "Lost" (wasLoaded && !hasProfile) - block only if verified.
    const shouldShowSpinner =
        (isLoading && (!user || user.emailVerified)) ||
        (user && user.emailVerified && hasProfile === null) ||
        (user && user.emailVerified && wasProfileLoaded && !hasProfile);

    if (shouldShowSpinner) {
        // Only show loading if we really don't know yet.
        // If hasProfile is false (even if wasProfileLoaded=true), we should let the flow continue to onboarding.
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.primary }}>
                <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
        );
    }

    return (
        <Stack.Navigator
            screenOptions={{
                headerStyle: {
                    backgroundColor: theme.colors.primary,
                },
                headerTintColor: '#ffffff',
                headerTitleStyle: {
                    fontWeight: 'bold',
                },
                headerShadowVisible: false,
                headerBackTitle: 'Back',
            }}
        >
            {!user ? (
                // Not Logged In
                <Stack.Group screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="Login" component={LoginScreen} />
                    <Stack.Screen name="Tutorial" component={TutorialScreen} />
                </Stack.Group>
            ) : !user.emailVerified ? (
                // Logged In, But Email Not Verified
                <Stack.Group screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
                </Stack.Group>
            ) : !hasProfile ? (
                // Logged In, Verified, No Profile -> Onboarding Flow
                <Stack.Group screenOptions={{ headerShown: false }}>
                    {isNewSignup ? (
                        // New signup: Show Tutorial first
                        <>
                            <Stack.Screen name="Tutorial" component={TutorialScreen} />
                            <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
                            <Stack.Screen name="Success" component={SuccessScreen} />
                        </>
                    ) : (
                        // Existing user signing in: Skip Tutorial
                        <>
                            <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
                            <Stack.Screen name="Success" component={SuccessScreen} />
                            <Stack.Screen name="Tutorial" component={TutorialScreen} />
                        </>
                    )}
                </Stack.Group>
            ) : (
                // Authenticated & Profile Exists (Main App)
                <Stack.Group>
                    <Stack.Screen
                        name="Home"
                        component={HomeScreen}
                        options={{ headerShown: false }}
                    />
                    <Stack.Screen
                        name="Scanner"
                        component={ScannerScreen}
                        options={{ title: 'Scan Label' }}
                    />
                    <Stack.Screen
                        name="ParserTest"
                        component={ParserTestScreen}
                        options={{ title: 'OCR Debug' }}
                    />
                    <Stack.Screen
                        name="ManualEntry"
                        component={ManualEntryScreen}
                        options={{ title: 'Add Food' }}
                    />
                    <Stack.Screen
                        name="FoodList"
                        component={FoodListScreen}
                        options={{ title: 'Food Database' }}
                    />
                    <Stack.Screen
                        name="SearchFood"
                        getComponent={() => require('../screens/SearchFoodScreen').SearchFoodScreen}
                        options={{ title: 'Add Food' }}
                    />
                    <Stack.Screen
                        name="FoodDetail"
                        getComponent={() => require('../screens/FoodDetailScreen').FoodDetailScreen}
                        options={{ title: 'Food Details', presentation: 'modal' }}
                    />
                    <Stack.Screen
                        name="BarcodeScanner"
                        component={BarcodeScannerScreen}
                        options={{
                            headerShown: false,
                            title: 'Scan Barcode'
                        }}
                    />
                    <Stack.Screen
                        name="ProductResult"
                        component={ProductResultScreen}
                        options={{ title: 'Product Details' }}
                    />
                    <Stack.Screen
                        name="Profile"
                        component={ProfileScreen}
                        options={{ title: 'My Profile' }}
                    />
                    <Stack.Screen
                        name="AddExercise"
                        component={AddExerciseScreen}
                        options={{ title: 'Add Exercise' }}
                    />
                    <Stack.Screen
                        name="AddWorkout"
                        component={AddWorkoutScreen}
                        options={{ title: 'Add Workout' }}
                    />
                    <Stack.Screen
                        name="AddWorkoutExercise"
                        component={AddWorkoutExerciseScreen}
                        options={{ title: 'Add Exercise' }}
                    />
                    <Stack.Screen
                        name="WorkoutDetail"
                        component={WorkoutDetailScreen}
                        options={{ title: 'Workout Details' }}
                    />
                    <Stack.Screen
                        name="WorkoutExecute"
                        component={WorkoutExecuteScreen}
                        options={{
                            gestureEnabled: false
                        }}
                    />
                    <Stack.Screen
                        name="ExerciseLog"
                        component={ExerciseLogScreen}
                        options={{ title: 'Log Exercise' }}
                    />
                    <Stack.Screen
                        name="WorkoutSummary"
                        component={WorkoutSummaryScreen}
                        options={{
                            title: 'Workout Summary',
                            headerLeft: () => null,
                            gestureEnabled: false
                        }}
                    />
                    <Stack.Screen name="Tutorial" component={TutorialScreen} />
                    <Stack.Screen name="Paywall" component={PaywallScreen} options={{ headerShown: false }} />
                </Stack.Group>
            )}
        </Stack.Navigator>
    );
};
