import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { unifiedBarcodeLookup } from '../services/barcodeService';
import { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';

import { RouteProp, useFocusEffect } from '@react-navigation/native';

type BarcodeScannerScreenProps = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'BarcodeScanner'>;
    route: RouteProp<RootStackParamList, 'BarcodeScanner'>;
};

export const BarcodeScannerScreen: React.FC<BarcodeScannerScreenProps> = ({ navigation, route }) => {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanning, setScanning] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [lastScanned, setLastScanned] = useState<string | null>(null);
    // Strict lock to prevent double-scanning before state updates
    // Strict lock to prevent double-scanning before state updates
    const isLocked = useRef(false);

    useFocusEffect(
        React.useCallback(() => {
            // Reset scanner when screen assumes focus
            setScanning(true);
            setProcessing(false);
            setLastScanned(null);
            isLocked.current = false;
        }, [])
    );

    // Permission Prompt Redesign
    if (!permission) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    if (!permission.granted) {
        return (
            <View style={styles.permissionContainer}>
                <View style={styles.permissionIconContainer}>
                    <Text style={{ fontSize: 64 }}>📸</Text>
                </View>
                <Text style={styles.permissionTitle}>Camera Access Required</Text>
                <Text style={styles.permissionText}>
                    To scan barcodes and labels, we need your permission to use the camera.
                </Text>
                <TouchableOpacity style={styles.grantButton} onPress={requestPermission}>
                    <Text style={styles.grantButtonText}>Grant Access</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
                    <Text style={styles.cancelButtonText}>Maybe Later</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const handleBarcodeScanned = async (result: BarcodeScanningResult, isManual = false) => {
        const barcode = result.data;
        const { bounds } = result;

        // 1. BOUNDING BOX CHECK (Software Filter)
        const { width, height } = Dimensions.get('window');
        const scanBoxSize = 250;
        // Calculate the theoretical frame of the scan box
        const scanBoxX = (width - scanBoxSize) / 2;
        const scanBoxY = (height - scanBoxSize) / 2;

        if (!isManual && bounds && bounds.origin) {
            const { x, y } = bounds.origin;
            const { width: bWidth, height: bHeight } = bounds.size;

            // Calculate center of the detected barcode
            const barcodeCenterX = x + bWidth / 2;
            const barcodeCenterY = y + bHeight / 2;

            // Check if the barcode's center is within the scan box
            // Increased buffer to 60px to make scanning feel more responsive/natural
            // while still keeping it largely centralized.
            const isInside =
                barcodeCenterX >= scanBoxX - 60 &&
                barcodeCenterX <= scanBoxX + scanBoxSize + 60 &&
                barcodeCenterY >= scanBoxY - 60 &&
                barcodeCenterY <= scanBoxY + scanBoxSize + 60;

            if (!isInside) {
                // silently ignore
                return;
            }
        }

        // SYNCHRONOUS LOCK: Check ref immediately
        // Allow manual entry to bypass "scanning" check
        if (isLocked.current || (!scanning && !isManual) || processing || (barcode === lastScanned && !isManual)) {
            return;
        }

        // Apply lock immediately
        isLocked.current = true;
        console.log('[BarcodeScanner] Lock applied. Starting lookup for:', barcode);

        setScanning(false);
        setProcessing(true);
        setLastScanned(barcode);

        try {
            // Unified Service Call (Parallel OFF + USDA)
            const lookupResult = await unifiedBarcodeLookup(barcode);

            if (lookupResult.found && lookupResult.product) {
                // Navigate to Food Detail (standardize mapping)
                navigation.navigate('FoodDetail', {
                    food: lookupResult.product,
                    mealCategory: route.params?.mealCategory || 'Lunch',
                    date: route.params?.date || new Date().toISOString().split('T')[0],
                });
            } else {
                // Product not found
                Alert.alert(
                    'Product Not Found',
                    `We couldn't find a product with barcode: ${barcode}. Would you like to try scanning the nutrition label instead?`,
                    [
                        {
                            text: 'Cancel',
                            style: 'cancel',
                            onPress: () => {
                                setScanning(true);
                                setProcessing(false);
                                setLastScanned(null);
                                isLocked.current = false; // Reset lock
                            },
                        },

                        {
                            text: 'Manual Entry',
                            onPress: () => {
                                setProcessing(false);
                                setLastScanned(null);
                                isLocked.current = false;
                                navigation.navigate('ManualEntry', {
                                    barcode,
                                    mealCategory: route.params?.mealCategory,
                                    date: route.params?.date
                                });
                            },
                        }
                    ]
                );
            }
        } catch (error) {
            console.error('Error processing barcode:', error);
            Alert.alert('Error', 'Failed to look up product.');
            setScanning(true);
            setProcessing(false);
            setLastScanned(null);
            isLocked.current = false; // Reset lock
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.cameraWrapper}>
                <CameraView
                    style={styles.camera}
                    facing="back"
                    // KEY FIX: Completely disable the callback when not scanning
                    onBarcodeScanned={scanning && !processing ? handleBarcodeScanned : undefined}
                    onCameraReady={() => console.log('[BarcodeScanner] Camera Ready')}
                />
                <View style={styles.overlay} pointerEvents="box-none">
                    <View style={styles.topOverlay} />
                    <View style={styles.middleRow}>
                        <View style={styles.sideOverlay} />
                        <View style={styles.scanArea}>
                            {processing && (
                                <View style={styles.processingContainer}>
                                    <ActivityIndicator size="large" color="#ffffff" />
                                    <Text style={styles.processingText}>Looking up product...</Text>
                                </View>
                            )}
                        </View>
                        <View style={styles.sideOverlay} />
                    </View>
                    <View style={styles.bottomOverlay}>
                        <Text style={styles.instructionText}>
                            Position the barcode within the frame
                        </Text>
                    </View>
                </View>
            </View>

            <View style={styles.controls}>


                <TouchableOpacity
                    style={[styles.button, { marginBottom: 12, width: '80%' }]}
                    onPress={() => {
                        setScanning(false); // Disable scanner while typing
                        Alert.prompt(
                            'Enter Barcode',
                            'Manually enter the barcode of the product.',
                            [
                                {
                                    text: 'Cancel',
                                    style: 'cancel',
                                    onPress: () => setScanning(true) // Re-enable on cancel
                                },
                                {
                                    text: 'Lookup',
                                    onPress: (text?: string) => {
                                        if (text) {
                                            handleBarcodeScanned({
                                                data: text,
                                                type: 'manual',
                                                bounds: { origin: { x: 0, y: 0 }, size: { width: 0, height: 0 } },
                                                cornerPoints: []
                                            } as any, true); // Pass true for manual force
                                        } else {
                                            setScanning(true); // Re-enable if empty
                                        }
                                    }
                                }
                            ],
                            'plain-text',
                            '',
                            'numeric'
                        );
                    }}
                >
                    <Text style={styles.buttonText}>Enter Barcode Manually</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.cancelButton, { width: '80%' }]}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.background,
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.background,
        padding: theme.spacing.xl,
    },
    permissionIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: theme.colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: theme.spacing.xl,
    },
    permissionTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.colors.text.primary,
        marginBottom: theme.spacing.m,
        textAlign: 'center',
    },
    permissionText: {
        fontSize: 16,
        color: theme.colors.text.secondary,
        textAlign: 'center',
        marginBottom: theme.spacing.xxl,
        lineHeight: 24,
    },
    grantButton: {
        backgroundColor: theme.colors.primary,
        paddingHorizontal: theme.spacing.xxl,
        paddingVertical: theme.spacing.m,
        borderRadius: theme.borderRadius.xl,
        width: '100%',
        alignItems: 'center',
        marginBottom: theme.spacing.m,
    },
    grantButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    cancelButton: {
        backgroundColor: '#4B5563', // Gray 600
        paddingHorizontal: theme.spacing.xl,
        paddingVertical: theme.spacing.s,
        borderRadius: theme.borderRadius.m,
        marginTop: theme.spacing.m,
    },
    cancelButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
    },
    button: {
        backgroundColor: theme.colors.primary,
        paddingHorizontal: theme.spacing.xl,
        paddingVertical: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        // alignItems: 'center', // Removed to match Cancel button alignment (left/default)
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    cameraWrapper: {
        flex: 1,
        position: 'relative',
    },
    camera: {
        flex: 1,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
    },
    topOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    middleRow: {
        flexDirection: 'row',
        height: 250,
    },
    sideOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    scanArea: {
        width: 250,
        borderWidth: 2,
        borderColor: theme.colors.primary,
        backgroundColor: 'transparent',
        borderRadius: 20,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    bottomOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: theme.spacing.xl,
    },
    instructionText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
        paddingHorizontal: 40,
    },
    processingContainer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    processingText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
        marginTop: theme.spacing.m,
    },
    controls: {
        padding: theme.spacing.xl,
        backgroundColor: '#000',
        alignItems: 'center',
    },
});
