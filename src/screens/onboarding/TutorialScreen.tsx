
import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    SafeAreaView,
    Dimensions,
    TouchableOpacity,
    ScrollView,
    NativeSyntheticEvent,
    NativeScrollEvent
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { RouteProp } from '@react-navigation/native';
import { theme } from '../../theme';


type Props = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'Tutorial'>;
    route: RouteProp<RootStackParamList, 'Tutorial'>;
};

const { width } = Dimensions.get('window');

const SLIDES = [
    {
        id: 'welcome',
        title: 'Welcome!',
        description: 'Start your journey to a healthier lifestyle with simple tracking and powerful insights.',
        image: require('../../assets/tutorial/welcome.png'),
    },
    {
        id: 'calories',
        title: 'Track Goals',
        description: 'Your daily calorie and macro targets adjust automatically based on your activity and goals.',
        image: require('../../assets/tutorial/calories.png'),
    },
    {
        id: 'meals',
        title: 'Log Meals',
        description: 'Easily add meals using the barcode scanner, search, or by repeating previous meals.',
        image: require('../../assets/tutorial/meals.png'),
    },
    {
        id: 'exercise',
        title: 'Add Exercise',
        description: 'Log cardio and other activities to earn extra calories for your daily budget.',
        image: require('../../assets/tutorial/exercise.png'),
    },
    {
        id: 'workouts',
        title: 'Plan Workouts',
        description: 'Create and track detailed gym workouts with sets, reps, and weights.',
        image: require('../../assets/tutorial/workouts.png'),
    },
];

export const TutorialScreen: React.FC<Props> = ({ navigation, route }) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const scrollViewRef = useRef<ScrollView>(null);
    const fromProfile = route.params?.fromProfile ?? false;

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const contentOffsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(contentOffsetX / width);
        setActiveIndex(index);
    };

    const handlePrev = () => {
        if (activeIndex > 0) {
            scrollViewRef.current?.scrollTo({ x: (activeIndex - 1) * width, animated: true });
        }
    };

    const handleNext = () => {
        if (activeIndex < SLIDES.length - 1) {
            scrollViewRef.current?.scrollTo({ x: (activeIndex + 1) * width, animated: true });
        } else {
            handleFinish();
        }
    };

    const handleFinish = () => {
        if (fromProfile) {
            navigation.goBack();
        } else {
            // Proceed to Profile Setup to complete onboarding
            navigation.replace('ProfileSetup');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                {!fromProfile && activeIndex < SLIDES.length - 1 && (
                    <TouchableOpacity
                        style={styles.topSkipButton}
                        onPress={handleFinish}
                    >
                        <Text style={styles.skipText}>Skip</Text>
                    </TouchableOpacity>
                )}

                <ScrollView
                    ref={scrollViewRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    style={styles.scrollView}
                >
                    {SLIDES.map((slide) => (
                        <View key={slide.id} style={styles.slide}>
                            <Image source={slide.image} style={styles.image} resizeMode="contain" />
                            <Text style={styles.title}>{slide.title}</Text>
                            <Text style={styles.description}>{slide.description}</Text>
                        </View>
                    ))}
                </ScrollView>

                <View style={styles.footer}>
                    {activeIndex > 0 ? (
                        <TouchableOpacity onPress={handlePrev} style={styles.navButton}>
                            <Text style={styles.navArrow}>{'<'}</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.navButtonPlaceholder} />
                    )}

                    <View style={styles.pagination}>
                        {SLIDES.map((_, i) => (
                            <View
                                key={i}
                                style={[
                                    styles.dot,
                                    i === activeIndex && styles.activeDot
                                ]}
                            />
                        ))}
                    </View>

                    <TouchableOpacity
                        style={[styles.navButton, activeIndex === SLIDES.length - 1 && styles.actionButton]}
                        onPress={handleNext}
                    >
                        {activeIndex === SLIDES.length - 1 ? (
                            <Text style={styles.actionButtonText}>
                                {fromProfile ? 'Done' : "Let's Go!"}
                            </Text>
                        ) : (
                            <Text style={styles.navArrow}>{'>'}</Text>
                        )}
                    </TouchableOpacity>
                </View>
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
    },
    scrollView: {
        flex: 1,
    },
    slide: {
        width: width,
        alignItems: 'center',
        padding: theme.spacing.xl,
        justifyContent: 'center',
    },
    image: {
        width: width * 0.8,
        height: width * 0.8,
        marginBottom: theme.spacing.xl,
    },
    title: {
        ...theme.typography.h1,
        fontSize: 28,
        color: theme.colors.primary,
        marginBottom: theme.spacing.m,
        textAlign: 'center',
    },
    description: {
        ...theme.typography.body,
        textAlign: 'center',
        paddingHorizontal: theme.spacing.l,
        color: theme.colors.text.secondary,
        lineHeight: 24,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.xl,
        paddingBottom: theme.spacing.xl,
    },
    pagination: {
        flexDirection: 'row',
        justifyContent: 'center',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: theme.colors.border,
        marginHorizontal: 4,
    },
    activeDot: {
        backgroundColor: theme.colors.primary,
        width: 16,
    },
    navButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    navButtonPlaceholder: {
        width: 44,
        height: 44,
    },
    navArrow: {
        fontSize: 32,
        color: theme.colors.primary,
        fontWeight: '300',
    },
    actionButton: {
        width: 'auto',
        paddingHorizontal: theme.spacing.l,
        paddingVertical: theme.spacing.s,
        backgroundColor: theme.colors.primary,
        borderRadius: theme.borderRadius.l,
        height: 44,
        justifyContent: 'center',
    },
    actionButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    topSkipButton: {
        position: 'absolute',
        top: 20,
        left: 20,
        zIndex: 10,
        padding: theme.spacing.s,
    },
    skipText: {
        color: theme.colors.text.secondary,
        fontSize: 16,
        fontWeight: '600',
    },
});
