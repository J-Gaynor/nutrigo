import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Modal,
    TouchableWithoutFeedback,
    Keyboard,
    Linking
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';
import { UserProfile, Goal, ActivityLevel, Gender, DietPace, UserType } from '../types/user';
import {
    calculateBMR, calculateTDEE,
    calculateMacroTargets,
    calculateAge,
    validateTargetWeight
} from '../utils/calculations';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getUserProfile, saveUserProfile, saveUserGoals } from '../services/storage';

import { useSubscription } from '../context/SubscriptionContext';
import { deleteAccount, signOutUser, updateUserPassword } from '../services/auth';
import { auth } from '../config/firebase';

type ProfileScreenProps = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'Profile'>;
};

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {

    const { isPremium } = useSubscription();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

    // Delete Account State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    // Modal State
    const [showGoalModal, setShowGoalModal] = useState(false);
    const [pendingGoal, setPendingGoal] = useState<Goal | null>(null);
    const [pendingTargetWeight, setPendingTargetWeight] = useState('');
    const [pendingDietPace, setPendingDietPace] = useState<DietPace>('normal');
    const [pendingUserType, setPendingUserType] = useState<UserType>('casual');
    const [showLanguageModal, setShowLanguageModal] = useState(false);
    const modalInputRef = useRef<TextInput>(null);
    const deletePasswordRef = useRef<TextInput>(null);
    // Form State
    const [name, setName] = useState('');

    // Change Password State
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    const passwordInputRef = useRef<TextInput>(null);
    const [dob, setDob] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [age, setAge] = useState('');
    const [gender, setGender] = useState<'male' | 'female'>('male');
    const [weight, setWeight] = useState('');
    const [targetWeight, setTargetWeight] = useState('');
    const [height, setHeight] = useState('');
    const [activityLevel, setActivityLevel] = useState<ActivityLevel>('sedentary');
    const [goal, setGoal] = useState<Goal>('maintain');
    const [dietPace, setDietPace] = useState<DietPace>('normal');
    const [userType, setUserType] = useState<UserType>('casual');

    const [prefLanguage, setPrefLanguage] = useState<'en' | 'ja' | 'es' | 'zh'>('en');
    // Removed duplicate showDatePicker declaration

    useEffect(() => {
        loadProfile();
    }, []);

    // Live Calculation Preview (for Modal)
    const previewTargets = useMemo(() => {
        const w = parseFloat(weight);
        const h = parseFloat(height);
        const a = parseInt(age);
        // Use pending target weight if modal is open (pendingGoal is set), otherwise actual targetWeight
        const tw = parseFloat(pendingGoal ? pendingTargetWeight : targetWeight);

        // Use pending goal for preview inside modal, or current goal if not in modal
        const activeGoal = pendingGoal || goal;
        const activePace = pendingGoal ? pendingDietPace : dietPace;
        const activeType = pendingGoal ? pendingUserType : userType;

        if (isNaN(w) || isNaN(h) || isNaN(a) || !gender) return null;

        const bmr = calculateBMR(w, h, a, gender);
        const tdee = calculateTDEE(bmr, activityLevel);

        // If maintain, target = current. 
        const finalTargetWeight = (activeGoal === 'maintain' || isNaN(tw)) ? w : tw;

        return calculateMacroTargets(tdee, activeGoal, finalTargetWeight, w, gender, activePace, activeType);
    }, [weight, height, age, gender, activityLevel, goal, targetWeight, pendingGoal, pendingTargetWeight, dietPace, userType, pendingDietPace, pendingUserType]);

    const loadProfile = async () => {
        try {
            const profile = await getUserProfile();
            if (profile) {
                setUserProfile(profile);
                setName(profile.name);
                if (profile.dateOfBirth) {
                    setDob(new Date(profile.dateOfBirth));
                    setAge(calculateAge(profile.dateOfBirth).toString());
                } else {
                    setAge(profile.age.toString());
                }
                setGender(profile.gender);
                setWeight(profile.weight.toString());
                setTargetWeight(profile.targetWeight ? profile.targetWeight.toString() : profile.weight.toString());
                setHeight(profile.height.toString());
                setActivityLevel(profile.activityLevel);
                setGoal(profile.goal);
                setDietPace(profile.dietPace || 'normal');
                setUserType(profile.userType || 'casual');
                if (profile.language) {
                    setPrefLanguage(profile.language);

                }
            }
        } catch (error) {
            console.error('Failed to load profile:', error);
            Alert.alert('Error', 'Failed to load profile from storage.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoalPress = (selectedGoal: Goal) => {
        if (selectedGoal === 'maintain') {
            setGoal('maintain');
            setTargetWeight(weight); // Sync immediately
            setPendingGoal(null);
        } else {
            setPendingGoal(selectedGoal);
            // Initialize modal input with current settings
            setPendingTargetWeight(targetWeight);
            setPendingDietPace(dietPace);
            setPendingUserType(userType);
            setShowGoalModal(true);
            setTimeout(() => modalInputRef.current?.focus(), 100);
        }
    };

    const handleActivitySelect = (level: ActivityLevel) => {
        if (level === 'none') {
            Alert.alert(
                'Are you sure?',
                'Only calories from exercises you manually track will be added to your daily calorie goal.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Confirm', onPress: () => setActivityLevel(level) }
                ]
            );
        } else {
            const w = parseFloat(weight);
            const h = parseFloat(height);
            const a = parseInt(age);

            if (w && h && a && gender) {
                const bmrVal = calculateBMR(w, h, a, gender);
                const tdeeSelected = calculateTDEE(bmrVal, level);
                const tdeeNone = calculateTDEE(bmrVal, 'none');

                const diff = Math.round(tdeeSelected - tdeeNone);

                Alert.alert(
                    'Activity Level Confirmation',
                    `This activity level adds ${diff} calories to your daily baseline to account for your lifestyle.\n\nAny exercise you log will be added ON TOP of this amount.`,
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Confirm', onPress: () => setActivityLevel(level) }
                    ]
                );
            } else {
                setActivityLevel(level);
            }
        }
    };



    const handlePendingWeightChange = (text: string) => {
        if (/^\d*\.?\d{0,1}$/.test(text)) {
            setPendingTargetWeight(text);
        }
    };

    const handleDateChange = (event: any, selectedDate?: Date) => {
        setShowDatePicker(false);
        if (selectedDate) {
            setDob(selectedDate);
            const calculatedAge = calculateAge(selectedDate.toISOString());
            setAge(calculatedAge.toString());
        }
    };

    const confirmModal = () => {
        if (!pendingGoal) return;

        const weightNum = parseFloat(pendingTargetWeight);
        const currentWeightNum = parseFloat(weight);

        if (isNaN(weightNum) || weightNum <= 0) {
            Alert.alert('Invalid Weight', 'Please enter a valid target weight.');
            return;
        }

        // Validate direction
        if (pendingGoal === 'lose' && weightNum >= currentWeightNum) {
            Alert.alert('Error', 'Target weight must be less than current weight to lose weight.');
            return;
        }
        if (pendingGoal === 'gain' && weightNum <= currentWeightNum) {
            Alert.alert('Error', 'Target weight must be greater than current weight to gain weight.');
            return;
        }

        // Validate safe bounds
        const heightH = parseFloat(height);
        if (!isNaN(heightH)) {
            const validation = validateTargetWeight(currentWeightNum, weightNum, heightH);
            if (!validation.isValid) {
                Alert.alert(
                    'Invalid Weight',
                    validation.error,
                    [{ text: 'OK' }]
                );
                return;
            }
        }

        setGoal(pendingGoal);
        setTargetWeight(pendingTargetWeight);
        setDietPace(pendingDietPace);
        setUserType(pendingUserType);

        setPendingGoal(null);
        setShowGoalModal(false);
    };

    const cancelModal = () => {
        setShowGoalModal(false);
        setPendingGoal(null);
        // Reset target weight to what it was? 
        // For simplicity, we keep the state as is, user just cancelled the specific action of changing goal. 
        // But if they typed in the box, `targetWeight` state updated. 
        // ideally we should have used a temp state for the modal, but this is fine for now as long as they don't save.
    };

    const handleSave = async () => {
        if (!name || !age || !weight || !height) {
            Alert.alert('Missing Information', 'Please fill in all required fields.');
            return;
        }

        // Final sanity check before saving to disk
        if (goal !== 'maintain' && !targetWeight) {
            Alert.alert('Missing Information', 'Please enter a valid target weight.');
            return;
        }

        if (goal !== 'maintain' && targetWeight) {
            const currentW = parseFloat(weight);
            const targetW = parseFloat(targetWeight);
            const heightH = parseFloat(height);

            if (!isNaN(currentW) && !isNaN(targetW) && !isNaN(heightH)) {
                const validation = validateTargetWeight(currentW, targetW, heightH);
                if (!validation.isValid) {
                    Alert.alert(
                        'Invalid Input',
                        validation.error,
                        [{ text: 'OK' }]
                    );
                    return;
                }
            }
        }

        setSaving(true);
        try {
            const currentW = parseFloat(weight);
            const targetW = parseFloat(targetWeight);
            const finalTargetW = goal === 'maintain' ? currentW : targetW;

            const bmr = calculateBMR(currentW, parseFloat(height), parseInt(age), gender);
            // FORCE SEDENTARY (none) as per user request
            const tdee = calculateTDEE(bmr, 'none');
            const targets = calculateMacroTargets(tdee, goal, finalTargetW, currentW, gender, dietPace, userType);

            const updatedProfile: UserProfile = {
                id: 'user_default',
                name,
                age: parseInt(age),
                dateOfBirth: dob.toISOString().split('T')[0],
                gender,
                weight: currentW,
                height: parseFloat(height),
                targetWeight: finalTargetW,
                activityLevel,
                goal,
                dietPace,
                userType,
                tdee,
                targetMacros: targets,
                language: prefLanguage,
                createdAt: userProfile?.createdAt || new Date().toISOString(),
            };

            await saveUserProfile(updatedProfile);
            const userGoals = {
                dailyCalories: targets.calories,
                dailyProtein: targets.protein,
                dailyCarbs: targets.carbs,
                dailyFats: targets.fats,
            };
            await saveUserGoals(userGoals);

            Alert.alert('Updated', 'Your profile has been successfully updated.', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            console.error('Error saving profile:', error);
            Alert.alert('Error', 'Failed to save profile.');
        } finally {
            setSaving(false);
        }
    };

    const handleSignOut = () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                {
                    text: 'Cancel',
                    style: 'cancel'
                },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await signOutUser();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to sign out. Please try again.');
                        }
                    }
                }
            ]
        );
    };

    const handleDeleteAccount = async () => {
        if (!deletePassword) {
            Alert.alert('Error', 'Please enter your password to confirm deletion.');
            return;
        }

        setIsDeleting(true);
        try {
            await deleteAccount(deletePassword);
            // Success! The auth listener in AppNavigator should handle the redirect to Login.
            // We can manually close modal just in case.
            setShowDeleteModal(false);
        } catch (error: any) {
            console.error('Delete account check failed:', error);
            let msg = 'Failed to delete account. Please try again.';
            if (error.code === 'auth/wrong-password') {
                msg = 'Incorrect password. Please try again.';
            } else if (error.code === 'auth/too-many-requests') {
                msg = 'Too many attempts. Please try again later.';
            }
            Alert.alert('Error', msg);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleUpdatePassword = async () => {
        if (!currentPassword || !newPassword || !confirmNewPassword) {
            Alert.alert('Error', 'Please fill in all fields.');
            return;
        }

        if (newPassword !== confirmNewPassword) {
            Alert.alert('Error', 'New passwords do not match.');
            return;
        }

        // Strict Validation (Same as LoginScreen)
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,32}$/;
        if (!passwordRegex.test(newPassword)) {
            Alert.alert(
                'Weak Password',
                'Password must be 8-32 characters long, include at least one uppercase letter, one lowercase letter, and one number.'
            );
            return;
        }

        setIsUpdatingPassword(true);
        try {
            await updateUserPassword(currentPassword, newPassword);
            Alert.alert('Success', 'Password updated successfully!');
            setShowPasswordModal(false);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmNewPassword('');
        } catch (error: any) {
            console.error('Password update failed:', error);
            let msg = 'Failed to update password.';
            if (error.code === 'auth/wrong-password') {
                msg = 'Incorrect current password.';
            } else if (error.code === 'auth/weak-password') {
                msg = 'Password is too weak.';
            } else if (error.code === 'auth/requires-recent-login') {
                msg = 'For security, please sign out and sign in again before changing your password.';
            }
            Alert.alert('Error', msg);
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <Text style={styles.headerTitle}>Edit Profile</Text>

                    {isPremium && (
                        <View style={{
                            alignSelf: 'center',
                            backgroundColor: `${theme.colors.gold}20`,
                            paddingHorizontal: 16,
                            paddingVertical: 6,
                            borderRadius: 20,
                            marginBottom: theme.spacing.l,
                            borderWidth: 1,
                            borderColor: theme.colors.gold
                        }}>
                            <Text style={{
                                color: theme.colors.gold,
                                fontWeight: 'bold',
                                fontSize: 14
                            }}>
                                PRO Member
                            </Text>
                        </View>
                    )}

                    <TouchableOpacity
                        style={[styles.optionBtn, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.l }]}
                        onPress={() => navigation.navigate('Tutorial', { fromProfile: true })}
                    >
                        <Text style={{ fontSize: 20, marginRight: 8 }}>🎓</Text>
                        <Text style={styles.optionText}>View Tutorial</Text>
                    </TouchableOpacity>

                    {!isPremium && (
                        <TouchableOpacity
                            style={[styles.optionBtn, {
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: theme.spacing.l,
                                backgroundColor: theme.colors.primary,
                                borderColor: theme.colors.primary
                            }]}
                            onPress={() => navigation.navigate('Paywall')}
                        >
                            <Text style={{ fontSize: 20, marginRight: 8 }}>💎</Text>
                            <Text style={[styles.optionText, { color: '#fff', fontWeight: 'bold' }]}>Join PRO</Text>
                        </TouchableOpacity>
                    )}



                    {/* Name */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Name</Text>
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder="Your Name"
                            maxLength={50}
                        />
                    </View>

                    {/* Username */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Username</Text>
                        <TextInput
                            style={[styles.input, { opacity: 0.7, backgroundColor: '#f0f0f0' }]}
                            value={userProfile?.username || auth.currentUser?.displayName || ''}
                            editable={false}
                            placeholder="Username"
                        />
                    </View>

                    {/* Stats Row */}
                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                            <Text style={styles.label}>Date of Birth</Text>
                            <TouchableOpacity
                                style={styles.input}
                                onPress={() => setShowDatePicker(true)}
                            >
                                <Text style={{ color: theme.colors.text.primary, fontSize: 16 }}>
                                    {dob.toLocaleDateString()}
                                </Text>
                            </TouchableOpacity>
                            <Text style={{ marginTop: 4, color: theme.colors.text.secondary }}>Age: {age}</Text>
                            {showDatePicker && (
                                <DateTimePicker
                                    value={dob}
                                    mode="date"
                                    display="spinner"
                                    maximumDate={new Date()}
                                    onChange={handleDateChange}
                                />
                            )}
                        </View>
                        <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.label}>Gender</Text>
                            <View style={styles.genderToggle}>
                                <TouchableOpacity
                                    style={[styles.genderBtn, gender === 'male' && styles.genderBtnActive]}
                                    onPress={() => setGender('male')}
                                >
                                    <Text style={[styles.genderText, gender === 'male' && styles.genderTextActive]}>Male</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.genderBtn, gender === 'female' && styles.genderBtnActive]}
                                    onPress={() => setGender('female')}
                                >
                                    <Text style={[styles.genderText, gender === 'female' && styles.genderTextActive]}>Female</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* Body Row */}
                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                            <Text style={styles.label}>Weight (kg)</Text>
                            <TextInput
                                style={styles.input}
                                value={weight}
                                onChangeText={setWeight}
                                keyboardType="numeric"
                                maxLength={5}
                            />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.label}>Target Weight (kg)</Text>
                            <TouchableOpacity onPress={() => {
                                // Allow tapping the disabled input to trigger the modal for the current goal
                                if (goal !== 'maintain') handleGoalPress(goal);
                                else Alert.alert('Set Target Weight', 'Please select a goal other than "Maintain Weight" to set a target weight.');
                            }}>
                                <View pointerEvents="none">
                                    <TextInput
                                        style={[styles.input, styles.disabledInput]}
                                        value={targetWeight}
                                        editable={false}
                                        placeholder="Auto"
                                        placeholderTextColor={theme.colors.text.tertiary}
                                    />
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Height Row */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Height (cm)</Text>
                        <TextInput
                            style={styles.input}
                            value={height}
                            onChangeText={(t) => {
                                if (/^\d*$/.test(t)) setHeight(t);
                            }}
                            keyboardType="numeric"
                            maxLength={3}
                        />
                    </View>



                    {/* Goal Selection */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Goal</Text>
                        {(['lose', 'maintain', 'gain'] as Goal[]).map((g) => (
                            <TouchableOpacity
                                key={g}
                                style={[styles.optionBtn, goal === g && styles.optionBtnActive]}
                                onPress={() => handleGoalPress(g)}
                            >
                                <Text style={[styles.optionText, goal === g && styles.optionTextActive]}>
                                    {g === 'lose' && 'Lose Weight'}
                                    {g === 'maintain' && 'Maintain Weight'}
                                    {g === 'gain' && 'Gain Muscle'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TouchableOpacity
                        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                        onPress={handleSave}
                        disabled={saving}
                    >
                        <Text style={styles.saveButtonText}>{saving ? 'Updating...' : 'Save Changes'}</Text>
                    </TouchableOpacity>

                    {/* NEW BUTTON LAYOUT */}
                    <View style={{ marginTop: 20, gap: 12 }}>
                        {/* Row 1: Sign Out (Full Width) */}
                        <TouchableOpacity
                            style={[
                                styles.optionBtn,
                                {
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: 0,
                                    backgroundColor: theme.colors.surface,
                                    paddingVertical: 12,
                                    height: 50,
                                }
                            ]}
                            onPress={handleSignOut}
                        >
                            <Text style={[styles.optionText, { color: theme.colors.text.primary, fontSize: 16, fontWeight: '600' }]}>
                                Sign Out
                            </Text>
                        </TouchableOpacity>

                        {/* Row 2: Change Password & Delete Account (Split) */}
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity
                                style={[
                                    styles.optionBtn,
                                    {
                                        flex: 1,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginBottom: 0,
                                        backgroundColor: theme.colors.surface,
                                        paddingVertical: 12,
                                        height: 50,
                                    }
                                ]}
                                onPress={() => {
                                    setCurrentPassword('');
                                    setNewPassword('');
                                    setConfirmNewPassword('');
                                    setShowPasswordModal(true);
                                    setTimeout(() => passwordInputRef.current?.focus(), 100);
                                }}
                            >
                                <Text style={[styles.optionText, { color: theme.colors.text.primary, fontSize: 14, fontWeight: '600' }]}>
                                    Change Password
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.saveButton,
                                    {
                                        flex: 1,
                                        backgroundColor: '#FF3B30',
                                        marginTop: 0,
                                        padding: 0,
                                        paddingVertical: 12,
                                        height: 50,
                                        justifyContent: 'center'
                                    }
                                ]}
                                onPress={() => {
                                    setDeletePassword('');
                                    setShowDeleteModal(true);
                                    setTimeout(() => deletePasswordRef.current?.focus(), 100);
                                }}
                            >
                                <Text style={[styles.saveButtonText, { fontSize: 14 }]}>
                                    Delete Account
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Legal & Medical Footer */}
                    <View style={styles.footerContainer}>
                        <Text style={styles.disclaimerTitle}>Medical Disclaimer</Text>
                        <Text style={styles.disclaimerText}>
                            This app does not provide medical advice. Consult a doctor before starting any diet or exercise program.
                        </Text>

                        <Text style={styles.citationTitle}>Data Sources & Formulas</Text>
                        <TouchableOpacity onPress={() => Linking.openURL('https://pubmed.ncbi.nlm.nih.gov/2305711/')}>
                            <Text style={[styles.citationText, { textDecorationLine: 'underline', color: theme.colors.primary }]}>
                                • Calorie calculations: Mifflin-St Jeor Equation
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => Linking.openURL('https://pubmed.ncbi.nlm.nih.gov/12423180/')}>
                            <Text style={[styles.citationText, { textDecorationLine: 'underline', color: theme.colors.primary }]}>
                                • One Rep Max: Epley Formula
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => Linking.openURL('https://fdc.nal.usda.gov/')}>
                            <Text style={[styles.citationText, { textDecorationLine: 'underline', color: theme.colors.primary }]}>
                                • Nutritional Data: USDA FoodData Central
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>


                {/* ... Modals ... */}

                {/* Change Password Modal */}
                <Modal
                    visible={showPasswordModal}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setShowPasswordModal(false)}
                >
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <View style={styles.modalOverlay}>
                            <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>Change Password</Text>

                                <Text style={styles.modalLabel}>Current Password</Text>
                                <TextInput
                                    ref={passwordInputRef}
                                    style={styles.modalInput}
                                    value={currentPassword}
                                    onChangeText={setCurrentPassword}
                                    secureTextEntry
                                    placeholder="Current Password"
                                    textContentType="password"
                                    autoComplete="password"
                                    autoCapitalize="none"
                                    maxLength={32}
                                />

                                <Text style={styles.modalLabel}>New Password</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                    secureTextEntry
                                    placeholder="New Password (8-32 chars)"
                                    textContentType="newPassword"
                                    autoComplete="password-new"
                                    autoCapitalize="none"
                                    maxLength={32}
                                />

                                <Text style={styles.modalLabel}>Confirm New Password</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    value={confirmNewPassword}
                                    onChangeText={setConfirmNewPassword}
                                    secureTextEntry
                                    placeholder="Confirm New Password"
                                    textContentType="newPassword"
                                    autoComplete="password-new"
                                    autoCapitalize="none"
                                    maxLength={32}
                                />

                                <View style={styles.modalButtons}>
                                    <TouchableOpacity
                                        style={styles.modalCancelBtn}
                                        onPress={() => setShowPasswordModal(false)}
                                    >
                                        <Text style={styles.modalCancelText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.modalConfirmBtn}
                                        onPress={handleUpdatePassword}
                                        disabled={isUpdatingPassword}
                                    >
                                        {isUpdatingPassword ? (
                                            <ActivityIndicator color="#FFF" size="small" />
                                        ) : (
                                            <Text style={styles.modalConfirmText}>Update</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </Modal>

                {/* Language Selection Modal */}
                <Modal
                    visible={showLanguageModal}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowLanguageModal(false)}
                >
                    <TouchableWithoutFeedback onPress={() => setShowLanguageModal(false)}>
                        <View style={styles.modalOverlay}>
                            <View style={[styles.modalContent, { padding: 0, overflow: 'hidden' }]}>
                                <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
                                    <Text style={[styles.modalTitle, { textAlign: 'center', marginBottom: 0 }]}>Select Language</Text>
                                </View>
                                <ScrollView>
                                    {[
                                        { code: 'en', label: 'English' },
                                        { code: 'ja', label: '日本語' },
                                        { code: 'es', label: 'Español' },
                                        { code: 'zh', label: '中文' }
                                    ].map((item) => (
                                        <TouchableOpacity
                                            key={item.code}
                                            style={{
                                                padding: 20,
                                                borderBottomWidth: 1,
                                                borderBottomColor: theme.colors.border,
                                                backgroundColor: prefLanguage === item.code ? theme.colors.primary + '10' : 'transparent',
                                                flexDirection: 'row',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}
                                            onPress={() => {
                                                setPrefLanguage(item.code as any);

                                                setShowLanguageModal(false);
                                            }}
                                        >
                                            <Text style={{
                                                fontSize: 18,
                                                fontWeight: prefLanguage === item.code ? 'bold' : 'normal',
                                                color: prefLanguage === item.code ? theme.colors.primary : theme.colors.text.primary
                                            }}>
                                                {item.label}
                                            </Text>
                                            {prefLanguage === item.code && (
                                                <Text style={{ color: theme.colors.primary, fontSize: 18 }}>✓</Text>
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                                <TouchableOpacity
                                    style={{ padding: 20, alignItems: 'center' }}
                                    onPress={() => setShowLanguageModal(false)}
                                >
                                    <Text style={{ color: theme.colors.text.secondary, fontWeight: '600' }}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </Modal>


                {/* Target Weight Modal */}
                <Modal
                    visible={showGoalModal}
                    transparent
                    animationType="slide"
                    onRequestClose={cancelModal}
                >
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <View style={styles.modalOverlay}>
                            <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>
                                    Set Target Weight
                                    {pendingGoal === 'lose' ? ` (Lose)` : pendingGoal === 'gain' ? ` (Gain)` : ''}
                                </Text>

                                <Text style={styles.modalLabel}>Enter your target weight in kg:</Text>
                                <TextInput
                                    ref={modalInputRef}
                                    style={styles.modalInput}
                                    value={pendingTargetWeight}
                                    onChangeText={handlePendingWeightChange}
                                    keyboardType="numeric"
                                    placeholder="Target Weight"
                                    maxLength={5}
                                />

                                {/* Live Preview Inside Modal */}
                                {previewTargets && (
                                    <View style={styles.previewContainer}>
                                        <Text style={styles.previewTitle}>Projected Daily Targets</Text>
                                        <View style={styles.macroRow}>
                                            <View style={styles.macroItem}>
                                                <Text style={styles.macroValue}>{previewTargets?.calories}</Text>
                                                <Text style={styles.macroLabel}>Cal</Text>
                                            </View>
                                            <View style={styles.macroItem}>
                                                <Text style={styles.macroValue}>{previewTargets?.protein}g</Text>
                                                <Text style={styles.macroLabel}>Prot</Text>
                                            </View>
                                            <View style={styles.macroItem}>
                                                <Text style={styles.macroValue}>{previewTargets?.carbs}g</Text>
                                                <Text style={styles.macroLabel}>Carbs</Text>
                                            </View>
                                            <View style={styles.macroItem}>
                                                <Text style={styles.macroValue}>{previewTargets?.fats}g</Text>
                                                <Text style={styles.macroLabel}>Fats</Text>
                                            </View>
                                        </View>
                                    </View>
                                )}

                                {pendingGoal !== 'maintain' && (
                                    <View style={[styles.inputGroup, { marginTop: theme.spacing.m }]}>
                                        <Text style={styles.label}>Diet Pace</Text>
                                        <View style={styles.optionRow}>
                                            {['slow', 'normal', 'fast'].map((p) => (
                                                <TouchableOpacity
                                                    key={p}
                                                    style={[
                                                        styles.optionBtn,
                                                        pendingDietPace === p && styles.optionBtnActive
                                                    ]}
                                                    onPress={() => setPendingDietPace(p as DietPace)}
                                                >
                                                    <Text style={[
                                                        styles.optionText,
                                                        pendingDietPace === p && styles.optionTextActive
                                                    ]}>
                                                        {p === 'slow' && 'Slow'}
                                                        {p === 'normal' && 'Normal'}
                                                        {p === 'fast' && 'Fast'}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                )}

                                <View style={[styles.inputGroup, { marginTop: theme.spacing.m }]}>
                                    <Text style={styles.label}>User Type</Text>
                                    <View style={styles.optionRow}>
                                        {['casual', 'athletic'].map((t) => (
                                            <TouchableOpacity
                                                key={t}
                                                style={[
                                                    styles.optionBtn,
                                                    pendingUserType === t && styles.optionBtnActive
                                                ]}
                                                onPress={() => setPendingUserType(t as UserType)}
                                            >
                                                <Text style={[
                                                    styles.optionText,
                                                    pendingUserType === t && styles.optionTextActive
                                                ]}>
                                                    {t === 'casual' && 'Casual'}
                                                    {t === 'athletic' && 'Athletic'}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                <View style={styles.modalButtons}>
                                    <TouchableOpacity style={styles.modalCancelBtn} onPress={cancelModal}>
                                        <Text style={styles.modalCancelText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.modalConfirmBtn} onPress={confirmModal}>
                                        <Text style={styles.modalConfirmText}>Set Goal</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </Modal>

                {/* Account Deletion Confirmation Modal */}
                <Modal
                    visible={showDeleteModal}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowDeleteModal(false)}
                >
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <View style={styles.modalOverlay}>
                            <View style={[styles.modalContent, { borderColor: '#FF3B30', borderWidth: 1 }]}>
                                <Text style={[styles.modalTitle, { color: '#FF3B30' }]}>Delete Account</Text>

                                <Text style={{ color: theme.colors.text.primary, marginBottom: 15, lineHeight: 20 }}>
                                    Warning: This action is permanent. Your data will be wiped.
                                    {'\n\n'}
                                    If you have paid for this month, you will <Text style={{ fontWeight: 'bold' }}>not be refunded</Text>,
                                    but all future payments will halt immediately.
                                </Text>

                                <Text style={styles.modalLabel}>Enter password to confirm:</Text>
                                <TextInput
                                    ref={deletePasswordRef}
                                    style={styles.modalInput}
                                    value={deletePassword}
                                    onChangeText={setDeletePassword}
                                    secureTextEntry
                                    placeholder="Password"
                                />

                                <View style={styles.modalButtons}>
                                    <TouchableOpacity
                                        style={styles.modalCancelBtn}
                                        onPress={() => setShowDeleteModal(false)}
                                        disabled={isDeleting}
                                    >
                                        <Text style={styles.modalCancelText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.modalConfirmBtn, { backgroundColor: '#FF3B30', opacity: isDeleting ? 0.7 : 1 }]}
                                        onPress={handleDeleteAccount}
                                        disabled={isDeleting}
                                    >
                                        {isDeleting ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <Text style={styles.modalConfirmText}>Confirm Delete</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </Modal>
            </KeyboardAvoidingView >
        </SafeAreaView >
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        padding: theme.spacing.l,
        paddingBottom: 40,
    },
    headerTitle: {
        ...theme.typography.h1,
        marginBottom: theme.spacing.xl,
        color: theme.colors.text.primary,
    },
    inputGroup: {
        marginBottom: theme.spacing.l,
    },
    label: {
        ...theme.typography.body,
        fontWeight: '600',
        marginBottom: theme.spacing.s,
        color: theme.colors.text.primary,
    },
    input: {
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        borderWidth: 1,
        borderColor: theme.colors.border,
        fontSize: 16,
    },
    disabledInput: {
        backgroundColor: theme.colors.background,
        color: theme.colors.text.secondary,
    },
    optionRow: {
        flexDirection: 'row',
        gap: theme.spacing.m,
    },
    row: {
        flexDirection: 'row',
    },
    genderToggle: {
        flexDirection: 'row',
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.m,
        borderWidth: 1,
        borderColor: theme.colors.border,
        overflow: 'hidden',
        height: 50,
    },
    genderBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    genderBtnActive: {
        backgroundColor: theme.colors.primaryLight,
    },
    genderText: {
        color: theme.colors.text.secondary,
        fontWeight: '600',
    },
    genderTextActive: {
        color: theme.colors.primary,
    },
    optionBtn: {
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        borderWidth: 1,
        borderColor: theme.colors.border,
        marginBottom: theme.spacing.s,
    },
    optionBtnActive: {
        backgroundColor: theme.colors.primaryLight,
        borderColor: theme.colors.primary,
    },
    optionText: {
        color: theme.colors.text.primary,
        fontSize: 16,
    },
    optionTextActive: {
        color: theme.colors.primary,
        fontWeight: 'bold',
    },
    saveButton: {
        backgroundColor: theme.colors.primary,
        padding: theme.spacing.l,
        borderRadius: theme.borderRadius.m,
        alignItems: 'center',
        marginTop: theme.spacing.l,
        ...theme.shadows.medium,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    saveButtonDisabled: {
        backgroundColor: theme.colors.text.tertiary,
    },
    // Footer Styles
    footerContainer: {
        padding: theme.spacing.l,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        marginTop: theme.spacing.xl,
        marginBottom: theme.spacing.xl,
    },
    disclaimerTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: theme.colors.text.secondary,
        marginBottom: 4,
        textAlign: 'center',
    },
    disclaimerText: {
        fontSize: 12,
        color: theme.colors.text.tertiary,
        textAlign: 'center',
        marginBottom: theme.spacing.l,
        lineHeight: 18,
    },
    citationTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.colors.text.secondary,
        marginBottom: 4,
        marginTop: 8,
    },
    citationText: {
        fontSize: 11,
        color: theme.colors.text.tertiary,
        marginBottom: 2,
    },
    outlineButton: {
        borderWidth: 2,
        padding: theme.spacing.l,
        borderRadius: theme.borderRadius.m,
        alignItems: 'center',
    },
    outlineButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    previewContainer: {
        backgroundColor: theme.colors.background,
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        marginTop: theme.spacing.m,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    previewTitle: {
        ...theme.typography.h3,
        fontSize: 14,
        marginBottom: theme.spacing.s,
        color: theme.colors.text.primary,
        textAlign: 'center',
    },
    macroRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    macroItem: {
        alignItems: 'center',
    },
    macroValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.primary,
    },
    macroLabel: {
        fontSize: 12,
        color: theme.colors.text.secondary,
    },
    previewHint: {
        fontSize: 12,
        color: theme.colors.text.tertiary,
        textAlign: 'center',
        marginTop: theme.spacing.s,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing.l,
    },
    modalContent: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.l,
        padding: theme.spacing.l,
        width: '100%',
        maxWidth: 400,
        ...theme.shadows.medium,
    },
    modalTitle: {
        ...theme.typography.h2,
        marginBottom: theme.spacing.l,
        textAlign: 'center',
    },
    modalLabel: {
        ...theme.typography.body,
        marginBottom: theme.spacing.s,
        color: theme.colors.text.secondary,
    },
    modalInput: {
        backgroundColor: theme.colors.background,
        padding: theme.spacing.l,
        borderRadius: theme.borderRadius.m,
        fontSize: 24,
        textAlign: 'center',
        fontWeight: 'bold',
        borderWidth: 1,
        borderColor: theme.colors.primary,
        marginBottom: theme.spacing.m,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: theme.spacing.m,
        marginTop: theme.spacing.l,
    },
    modalCancelBtn: {
        flex: 1,
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
    },
    modalConfirmBtn: {
        flex: 1,
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
    },
    modalCancelText: {
        color: theme.colors.text.secondary,
        fontWeight: '600',
    },
    modalConfirmText: {
        color: '#ffffff',
        fontWeight: 'bold',
    },
});
