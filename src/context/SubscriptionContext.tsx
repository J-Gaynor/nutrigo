import React, { createContext, useState, useEffect, useContext } from 'react';
import { Platform, Alert } from 'react-native';
import Purchases, { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { auth } from '../config/firebase';
import { getUserProfile, saveUserProfile } from '../services/storage';
import { ENV } from '../config/env';

// REVENUECAT CONFIG
const IOS_API_KEY = ENV.REVENUECAT_IOS_API_KEY;
const ANDROID_API_KEY = ENV.REVENUECAT_ANDROID_API_KEY;
const ENTITLEMENT_ID = 'Stamina Pro';

interface SubscriptionContextType {
    isPremium: boolean;
    packages: PurchasesPackage[];
    purchasePackage: (pack: PurchasesPackage) => Promise<void>;
    restorePurchases: () => Promise<void>;
    isLoading: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
    isPremium: false,
    packages: [],
    purchasePackage: async () => { },
    restorePurchases: async () => { },
    isLoading: true,
});

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isPremium, setIsPremium] = useState(false);
    const [packages, setPackages] = useState<PurchasesPackage[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        initRevenueCat();
    }, []);

    useEffect(() => {
        // Listen for Auth Changes to identify user in RevenueCat and check Admin status
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user) {

                try {
                    // 1. Identify User in RevenueCat
                    const { customerInfo } = await Purchases.logIn(user.uid);

                    // 2. Check Entitlements (and Admin status)
                    await checkEntitlement(customerInfo);
                } catch (e) {
                    console.error('Error identifying user in RevenueCat:', e);
                }
            } else {

                try {
                    // 1. Reset RevenueCat to anonymous
                    await Purchases.logOut();
                } catch (e) {
                    console.error('Error logging out of RevenueCat:', e);
                } finally {
                    setIsPremium(false);
                    // Reset packages? Maybe not strictly necessary but good practice
                }
            }
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const initRevenueCat = async () => {
        try {


            if (Platform.OS === 'ios') {

                await Purchases.configure({ apiKey: IOS_API_KEY });
            } else if (Platform.OS === 'android') {

                await Purchases.configure({ apiKey: ANDROID_API_KEY });
            }

            const appUserID = await Purchases.getAppUserID();


            // Fetch offerings (can be done anonymously)
            await loadOfferings();

            // Listen for real-time updates (expiration, external purchase)
            Purchases.addCustomerInfoUpdateListener((info) => {
                checkEntitlement(info);
            });

        } catch (e) {
            console.error('RevenueCat init error:', e);
            setIsLoading(false);
        }
    };

    const checkEntitlement = async (info: CustomerInfo) => {


        let hasPro = typeof info.entitlements.active[ENTITLEMENT_ID] !== 'undefined';


        // Check for Admin override
        try {
            const profile = await getUserProfile();


            if (profile?.isAdmin) {

                hasPro = true;
            }

            if (hasPro !== isPremium) {
                setIsPremium(hasPro);
                if (profile && profile.isPremium !== hasPro) {
                    await saveUserProfile({ ...profile, isPremium: hasPro });
                }
            }
        } catch (e) {
            console.warn('Error checking admin status:', e);
            if (hasPro !== isPremium) {
                setIsPremium(hasPro);
            }
        }
    };

    const loadOfferings = async () => {
        try {




            const offerings = await Purchases.getOfferings();
            console.log('SubscriptionContext: Offerings fetched:', JSON.stringify(offerings, null, 2));

            if (offerings.current) {
                console.log('SubscriptionContext: Found CURRENT offering with packages:', offerings.current.availablePackages.length);
                if (offerings.current.availablePackages.length > 0) {
                    setPackages(offerings.current.availablePackages);
                } else {
                    console.log('SubscriptionContext: CURRENT offering has NO available packages.');
                }
            } else {
                console.log('SubscriptionContext: NO CURRENT offering found.');
            }
        } catch (e) {
            console.error('Error loading offerings:', e);
        }
    };

    const purchasePackage = async (pack: PurchasesPackage) => {
        try {
            setIsLoading(true);
            const { customerInfo } = await Purchases.purchasePackage(pack);
            checkEntitlement(customerInfo);
        } catch (e: any) {
            if (!e.userCancelled) {
                Alert.alert('Purchase Error', e.message);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const restorePurchases = async () => {
        try {
            setIsLoading(true);
            const customerInfo = await Purchases.restorePurchases();
            checkEntitlement(customerInfo);

            if (typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined') {
                Alert.alert('Success', 'Purchases restored successfully!');
            } else {
                Alert.alert('Notice', 'No active subscriptions found to restore.');
            }
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SubscriptionContext.Provider
            value={{
                isPremium,
                packages,
                purchasePackage,
                restorePurchases,
                isLoading
            }}
        >
            {children}
        </SubscriptionContext.Provider>
    );
};

export const useSubscription = () => useContext(SubscriptionContext);
