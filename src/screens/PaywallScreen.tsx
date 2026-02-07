import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Linking } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';
import { useSubscription } from '../context/SubscriptionContext';
import Purchases from 'react-native-purchases';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;

export const PaywallScreen = ({ navigation }: Props) => {
    const { packages, purchasePackage, restorePurchases, isLoading, isPremium } = useSubscription();

    const handlePurchase = async (pack: any) => {
        await purchasePackage(pack);
        if (isPremium) {
            navigation.goBack();
        }
    };

    const handleRestore = async () => {
        await restorePurchases();
        if (isPremium) {
            Alert.alert('Success', 'Your purchases have been resumed.');
            navigation.goBack();
        }
    };

    if (isLoading) {
        return (
            <View style={[styles.container, styles.loadingContainer]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
                    <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Unlock Stamina Pro</Text>
            </View>

            <View style={styles.featuresContainer}>
                <Text style={styles.featureItem}>Auto-Sync Workouts to Nutrition</Text>
                <Text style={styles.featureItem}>Edit Past Days History</Text>
                <Text style={styles.featureItem}>Smart Repeat ("Same as Last Time")</Text>
                <Text style={styles.featureItem}>Save custom meals</Text>
            </View>

            <Text style={styles.sectionTitle}>Choose your plan</Text>

            {packages.map((pack) => (
                <TouchableOpacity
                    key={pack.identifier}
                    style={styles.packageCard}
                    onPress={() => handlePurchase(pack)}
                >
                    <View>
                        <Text style={styles.packageTitle}>{pack.product.title}</Text>
                        <Text style={styles.packageDesc}>{pack.product.description}</Text>
                    </View>
                    <View>
                        <Text style={styles.packagePrice}>{pack.product.priceString}</Text>
                    </View>
                </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.restoreButton} onPress={handleRestore}>
                <Text style={styles.restoreButtonText}>Restore Purchases</Text>
            </TouchableOpacity>

            <Text style={styles.disclaimer}>
                Payment will be charged to your Apple ID account at the confirmation of purchase. Subscription automatically renews unless it is canceled at least 24 hours before the end of the current period. Your account will be charged for renewal within 24 hours prior to the end of the current period. You can manage and cancel your subscriptions by going to your account settings on the App Store after purchase.
            </Text>

            <View style={styles.legalContainer}>
                <TouchableOpacity onPress={() => { Linking.openURL('https://stamina-nutrition.vercel.app/privacy') }}>
                    <Text style={styles.legalLink}>Privacy Policy</Text>
                </TouchableOpacity>
                <Text style={styles.legalSeparator}>•</Text>
                <TouchableOpacity onPress={() => { Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/') }}>
                    <Text style={styles.legalLink}>Terms of Use (EULA)</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: theme.spacing.l,
        paddingBottom: 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: theme.spacing.xl,
        marginTop: theme.spacing.m,
    },
    closeButton: {
        position: 'absolute',
        left: 0,
        top: 0,
        padding: theme.spacing.s,
    },
    closeButtonText: {
        fontSize: 24,
        color: theme.colors.text.secondary,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: theme.colors.text.primary,
        marginTop: theme.spacing.s,
    },
    featuresContainer: {
        marginBottom: theme.spacing.xl,
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.l,
        borderRadius: theme.borderRadius.l,
    },
    featureItem: {
        fontSize: 18,
        color: theme.colors.text.primary,
        marginBottom: theme.spacing.m,
        fontWeight: '500',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text.primary,
        marginBottom: theme.spacing.m,
        textAlign: 'center',
    },
    packageCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.l,
        borderRadius: theme.borderRadius.m,
        marginBottom: theme.spacing.m,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    packageTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.primary,
    },
    packageDesc: {
        fontSize: 14,
        color: theme.colors.text.secondary,
        marginTop: 4,
        maxWidth: 200,
    },
    packagePrice: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text.primary,
    },
    restoreButton: {
        marginTop: theme.spacing.m,
        alignItems: 'center',
        padding: theme.spacing.m,
    },
    restoreButtonText: {
        fontSize: 16,
        color: theme.colors.text.secondary,
        textDecorationLine: 'underline',
    },
    disclaimer: {
        marginTop: theme.spacing.l,
        textAlign: 'center',
        color: theme.colors.text.secondary,
        fontSize: 12,
    },
    legalContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: theme.spacing.m,
        marginBottom: theme.spacing.xl,
    },
    legalLink: {
        fontSize: 12,
        color: theme.colors.text.secondary,
        textDecorationLine: 'underline',
    },
    legalSeparator: {
        fontSize: 12,
        color: theme.colors.text.secondary,
        marginHorizontal: theme.spacing.s,
    },
});
