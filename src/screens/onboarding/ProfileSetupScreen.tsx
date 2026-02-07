import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
} from 'react-native';

import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../../theme';
import { ActivityLevel, Gender, Goal, UserProfile, DietPace, UserType } from '../../types/user';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
    calculateAge,
    calculateBMR,
    calculateMacroTargets,
    calculateTDEE,
    validateTargetWeight
} from '../../utils/calculations';
import { saveUserProfile, getUserProfile } from '../../services/storage';
import { auth } from '../../config/firebase';


type Step = 1 | 2 | 3 | 4;

type ProfileSetupScreenProps = {
    navigation: NativeStackNavigationProp<any, 'ProfileSetup'>;
};

export const ProfileSetupScreen: React.FC<ProfileSetupScreenProps> = ({ navigation }) => {
    const [step, setStep] = useState<Step>(1);

    // Form State
    const [name, setName] = useState('');
    const [gender, setGender] = useState<Gender | null>(null);
    const [dob, setDob] = useState(new Date('2000-01-01'));
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [age, setAge] = useState('');
    const [height, setHeight] = useState('');
    const [weight, setWeight] = useState('');
    const [targetWeight, setTargetWeight] = useState('');
    const [activity, setActivity] = useState<ActivityLevel | null>(null);
    const [goal, setGoal] = useState<Goal | null>(null);
    const [dietPace, setDietPace] = useState<DietPace>('normal');
    const [userType, setUserType] = useState<UserType>('casual');
    const [prefLanguage, setPrefLanguage] = useState<'en' | 'ja'>('en');
    const [isSaving, setIsSaving] = useState(false);
    const [existingProfile, setExistingProfile] = useState<UserProfile | null>(null);

    useEffect(() => {
        const loadExistingProfile = async () => {
            const profile = await getUserProfile();
            if (profile) {
                setExistingProfile(profile);
            }
        };
        loadExistingProfile();
    }, []);

    const handleNext = async () => {
        if (step === 1) {
            if (!name.trim() || !gender) {
                Alert.alert('Please fill in all fields');
                return;
            }
            setStep(2);
        } else if (step === 2) {
            // New Step 2: Goal
            if (!goal) {
                Alert.alert('Please select a goal');
                return;
            }
            setStep(3);
        } else if (step === 3) {
            // New Step 3: Metrics (Weight/Target Weight)
            if (!age || !height || !weight) {
                Alert.alert('Please fill in all fields');
                return;
            }

            const weightNum = parseFloat(weight);
            const heightNum = parseFloat(height);

            // Validation: Height
            if (heightNum < 100 || heightNum > 245) {
                Alert.alert('Invalid Height', 'Height must be between 100cm and 245cm.');
                return;
            }

            if (goal !== 'maintain') {
                if (!targetWeight) {
                    Alert.alert('Please enter a target weight');
                    return;
                }
                const targetWeightNum = parseFloat(targetWeight);

                // Directional Validation
                if (goal === 'lose' && targetWeightNum >= weightNum) {
                    Alert.alert('Invalid Target', 'Target weight must be lower than current weight to lose weight.');
                    return;
                }
                if (goal === 'gain' && targetWeightNum <= weightNum) {
                    Alert.alert('Invalid Target', 'Target weight must be higher than current weight to gain weight.');
                    return;
                }

                // General Safety Validation
                const validation = validateTargetWeight(weightNum, targetWeightNum, heightNum);
                if (!validation.isValid) {
                    Alert.alert('Unsafe Target Weight', validation.error);
                    return;
                }
            }

            // SKIP Step 4 (Activity) - Go straight to completion
            // implicitly set activity to 'none' in completeSetup
            await completeSetup();
        }
        /* REMOVED Step 4 Logic
        else if (step === 4) {
            // New Step 4: Activity
            if (!activity) {
                Alert.alert('Error', 'Please select a valid exercise level.'); // Reuse error key
                return;
            }
            await completeSetup();
        }
        */
    };

    const handleBack = () => {
        if (step > 1) setStep((s) => (s - 1) as Step);
        else navigation.goBack();
    };

    const completeSetup = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            // Calculate Metrics
            const ageNum = parseInt(age);
            const weightNum = parseFloat(weight);
            const heightNum = parseFloat(height);
            // Default target weight to current if maintaining
            const targetWeightNum = goal === 'maintain' ? weightNum : parseFloat(targetWeight);

            const bmr = calculateBMR(weightNum, heightNum, ageNum, gender!);
            // FORCE SEDENTARY (none)
            const tdee = calculateTDEE(bmr, 'none');

            const targets = calculateMacroTargets(tdee, goal!, targetWeightNum, weightNum, gender!, dietPace, userType);

            const profile: UserProfile = {
                ...existingProfile,
                id: existingProfile?.id || Date.now().toString(),
                name,
                username: auth.currentUser?.displayName || undefined,
                gender: gender!,
                age: ageNum,
                dateOfBirth: dob.toISOString().split('T')[0],
                height: heightNum,
                weight: weightNum,
                targetWeight: targetWeightNum,
                activityLevel: 'none', // FORCE NONE
                goal: goal!,
                dietPace,
                userType,
                tdee,
                targetMacros: targets,
                language: prefLanguage,
                createdAt: existingProfile?.createdAt || new Date().toISOString(),
            };

            await saveUserProfile(profile);

            // Don't manually navigate - AppNavigator will automatically route to Home
            // when it detects the profile has been created (hasProfile becomes true)
        } catch (error) {
            console.error('Error saving profile:', error);
            Alert.alert('Error', 'Failed to save profile.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleActivitySelect = (level: ActivityLevel) => {
        if (level === 'none') {
            Alert.alert(
                'Are you sure?',
                'Only calories from exercises you manually track will be added to your daily calorie goal.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Confirm', onPress: () => setActivity(level) }
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
                        { text: 'Confirm', onPress: () => setActivity(level) }
                    ]
                );
            } else {
                setActivity(level);
            }
        }
    };

    // --- Step Components ---

    const renderStep1 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>About You</Text>
            <Text style={styles.stepSubtitle}>Let's get to know you to personalize your plan.</Text>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>First Name</Text>
                <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="John"
                    placeholderTextColor={theme.colors.text.tertiary}
                    maxLength={50}
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Biological Sex</Text>
                <View style={styles.optionRow}>
                    <TouchableOpacity
                        style={[styles.optionButton, gender === 'male' && styles.optionButtonSelected]}
                        onPress={() => setGender('male')}
                    >
                        <Text style={[styles.optionText, gender === 'male' && styles.optionTextSelected]}>Male</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.optionButton, gender === 'female' && styles.optionButtonSelected]}
                        onPress={() => setGender('female')}
                    >
                        <Text style={[styles.optionText, gender === 'female' && styles.optionTextSelected]}>Female</Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.hint}>Used to calculate metabolic rate.</Text>
            </View>
        </View>
    );

    const handleWeightChange = (text: string, setter: (val: string) => void) => {
        if (/^\d*\.?\d{0,1}$/.test(text)) {
            setter(text);
        }
    };

    const handleDateChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
        }
        if (selectedDate) {
            setDob(selectedDate);
            const calculatedAge = calculateAge(selectedDate.toISOString());
            setAge(calculatedAge.toString());
        }
    };

    const renderStep2 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Body Metrics</Text>
            <Text style={styles.stepSubtitle}>Understanding your body composition helps us set the right targets.</Text>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Date of Birth</Text>
                <TouchableOpacity
                    style={styles.input}
                    onPress={() => setShowDatePicker(true)}
                >
                    <Text style={{ color: age ? theme.colors.text.primary : theme.colors.text.tertiary, fontSize: 16 }}>
                        {age ? dob.toLocaleDateString() : 'Select Date'} ({age ? `${age} years` : 'Age'})
                    </Text>
                </TouchableOpacity>
                {showDatePicker && (
                    <View>
                        {Platform.OS === 'ios' && (
                            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 8 }}>
                                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                    <Text style={{ color: theme.colors.primary, fontWeight: 'bold' }}>Done</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        <DateTimePicker
                            value={dob}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            maximumDate={new Date()}
                            onChange={handleDateChange}
                        />
                    </View>
                )}
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Height (cm)</Text>
                <TextInput
                    style={styles.input}
                    value={height}
                    onChangeText={(t) => handleWeightChange(t, setHeight)}
                    keyboardType="numeric"
                    placeholder="175"
                    placeholderTextColor={theme.colors.text.tertiary}
                    maxLength={3}
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Weight (kg)</Text>
                <View style={{ flexDirection: 'row', gap: theme.spacing.m }}>
                    <TextInput
                        style={[styles.input, { flex: 1 }]}
                        value={weight}
                        onChangeText={(t) => handleWeightChange(t, setWeight)}
                        keyboardType="numeric"
                        placeholder="Current"
                        placeholderTextColor={theme.colors.text.tertiary}
                        maxLength={5}
                    />
                    {goal !== 'maintain' && (
                        <TextInput
                            style={[styles.input, { flex: 1 }]}
                            value={targetWeight}
                            onChangeText={(t) => handleWeightChange(t, setTargetWeight)}
                            keyboardType="numeric"
                            placeholder="Target"
                            placeholderTextColor={theme.colors.text.tertiary}
                            maxLength={5}
                        />
                    )}
                </View>
            </View>
        </View>
    );

    const renderStep3 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Activity Level</Text>
            <Text style={styles.stepSubtitle}>Be honest! We use this to calculate your baseline burn.</Text>

            <ScrollView style={{ marginTop: theme.spacing.m }}>
                {[
                    { id: 'none', label: 'Sedentary', desc: 'Little or no exercise, desk job.' },
                    { id: 'light', label: 'Lightly Active', desc: 'Light exercise/sports 1-3 days/week.' },
                    { id: 'moderate', label: 'Moderately Active', desc: 'Moderate exercise/sports 3-5 days/week.' },
                    { id: 'active', label: 'Very Active', desc: 'Hard exercise/sports 6-7 days/week.' },
                ].map((opt) => (
                    <TouchableOpacity
                        key={opt.id}
                        style={[
                            styles.cardOption,
                            activity === opt.id && styles.cardOptionSelected
                        ]}
                        onPress={() => handleActivitySelect(opt.id as ActivityLevel)}
                    >
                        <View>
                            <Text style={[styles.cardTitle, activity === opt.id && styles.cardTitleSelected]}>{opt.label}</Text>
                            <Text style={styles.cardDesc}>{opt.desc}</Text>
                        </View>
                        {activity === opt.id && <Text style={styles.checkmark}>✓</Text>}
                    </TouchableOpacity>
                ))}

                <Text style={{
                    textAlign: 'center',
                    color: theme.colors.text.tertiary,
                    fontSize: 12,
                    fontStyle: 'italic',
                    marginTop: theme.spacing.s,
                    marginBottom: theme.spacing.l,
                    paddingHorizontal: theme.spacing.m
                }}>
                    Calculations based on the Mifflin-St Jeor equation. Exercise entries will add to your daily total separately.
                </Text>
            </ScrollView>
        </View>
    );

    const renderStep4 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Your Goal</Text>
            <Text style={styles.stepSubtitle}>What do you want to achieve?</Text>

            <View style={{ marginTop: theme.spacing.l }}>
                {[
                    { id: 'lose', label: 'Lose Weight', emoji: '📉' },
                    { id: 'maintain', label: 'Maintain Weight', emoji: '⚖️' },
                    { id: 'gain', label: 'Gain Muscle', emoji: '💪' },
                ].map((opt) => (
                    <TouchableOpacity
                        key={opt.id}
                        style={[
                            styles.cardOption,
                            goal === opt.id && styles.cardOptionSelected,
                            { paddingVertical: theme.spacing.l }
                        ]}
                        onPress={() => setGoal(opt.id as Goal)}
                    >
                        <Text style={{ fontSize: 24, marginRight: 16 }}>{opt.emoji}</Text>
                        <Text style={[styles.cardTitle, goal === opt.id && styles.cardTitleSelected]}>{opt.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <View style={styles.header}>
                    {step > 1 ? (
                        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                            <Text style={styles.backButtonText}>‹</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={[styles.backButton, { opacity: 0 }]}>
                            <Text style={styles.backButtonText}>‹</Text>
                        </View>
                    )}
                    <View style={styles.progressContainer}>
                        <View style={[styles.progressBar, { width: `${(step / 3) * 100}%` }]} />
                    </View>
                    <Text style={styles.stepCounter}>Step {step} of 3</Text>
                </View>

                <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep4()}
                    {step === 3 && renderStep2()}
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.nextButton, isSaving && { opacity: 0.7 }]}
                        onPress={handleNext}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <Text style={styles.nextButtonText}>
                                {step === 3 ? 'Calculate Plan' : 'Next'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: theme.spacing.m,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
    },
    backButton: {
        padding: theme.spacing.s,
        marginRight: theme.spacing.m,
    },
    backButtonText: {
        fontSize: 24,
        color: theme.colors.text.primary,
    },
    progressContainer: {
        flex: 1,
        height: 6,
        backgroundColor: theme.colors.border,
        borderRadius: 3,
        marginRight: theme.spacing.m,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: theme.colors.primary,
        borderRadius: 3,
    },
    stepCounter: {
        ...theme.typography.caption,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        padding: theme.spacing.l,
    },
    stepContainer: {
        flex: 1,
    },
    stepTitle: {
        ...theme.typography.h1,
        marginBottom: theme.spacing.s,
        color: theme.colors.text.primary,
    },
    stepSubtitle: {
        ...theme.typography.body,
        marginBottom: theme.spacing.xl,
        color: theme.colors.text.secondary,
    },
    inputGroup: {
        marginBottom: theme.spacing.l,
    },
    label: {
        ...theme.typography.h3,
        fontSize: 16,
        marginBottom: theme.spacing.s,
    },
    input: {
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.borderRadius.m,
        padding: theme.spacing.m,
        fontSize: 18,
        color: theme.colors.text.primary,
    },
    optionRow: {
        flexDirection: 'row',
        gap: theme.spacing.m,
    },
    optionButton: {
        flex: 1,
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
        alignItems: 'center',
    },
    optionButtonSelected: {
        borderColor: theme.colors.primary,
        backgroundColor: theme.colors.primaryLight,
    },
    question: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 24,
        textAlign: 'center',
    },
    subQuestion: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 12,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
    },
    smallOption: {
        flex: 1,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
    },
    optionButtonSelectedText: {
        color: theme.colors.primary,
    },
    optionText: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text.secondary,
    },
    optionTextSelected: {
        color: theme.colors.primary,
    },
    hint: {
        ...theme.typography.caption,
        marginTop: theme.spacing.s,
    },
    cardOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: theme.spacing.m,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.m,
        marginBottom: theme.spacing.m,
        borderWidth: 1,
        borderColor: theme.colors.border,
        ...theme.shadows.soft,
    },
    cardOptionSelected: {
        borderColor: theme.colors.primary,
        backgroundColor: theme.colors.primaryLight,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text.primary,
        marginBottom: 4,
    },
    cardTitleSelected: {
        color: theme.colors.primaryDark,
    },
    cardDesc: {
        fontSize: 14,
        color: theme.colors.text.secondary,
    },
    checkmark: {
        color: theme.colors.primary,
        fontSize: 18,
        fontWeight: 'bold',
    },
    footer: {
        padding: theme.spacing.l,
        backgroundColor: theme.colors.surface,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
    },
    nextButton: {
        backgroundColor: theme.colors.primary,
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.l,
        alignItems: 'center',
        ...theme.shadows.medium,
    },
    nextButtonText: {
        ...theme.typography.button,
        fontSize: 18,
    },
});
