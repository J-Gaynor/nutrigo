import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Image,
    Modal,
    ScrollView,
    Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { processImageWithOCR, SupportedLanguage, getLanguageDisplayName } from '../services/ocr';
import { parseNutritionLabel } from '../services/nutritionParser';
import { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';

type ScannerScreenProps = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'Scanner'>;
    route: RouteProp<RootStackParamList, 'Scanner'>;
};

export const ScannerScreen: React.FC<ScannerScreenProps> = ({ navigation, route }) => {
    const [permission, requestPermission] = useCameraPermissions();
    const [processing, setProcessing] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [cameraRef, setCameraRef] = useState<CameraView | null>(null);
    // Hardcoded to 'latin' (English) as app is now English-only
    const selectedLanguage: SupportedLanguage = 'latin';

    useFocusEffect(
        React.useCallback(() => {
            return () => {
                setProcessing(false);
                setCapturedImage(null);
            };
        }, [])
    );

    const prefilledBarcode = route.params?.barcode;

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
                    To scan nutrition labels, we need your permission to use the camera.
                </Text>
                <TouchableOpacity style={styles.grantButton} onPress={requestPermission}>
                    <Text style={styles.grantButtonText}>Grant Access</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const takePicture = async () => {
        if (!cameraRef) return;

        try {
            setProcessing(true);
            const photo = await cameraRef.takePictureAsync();
            if (photo?.uri) {
                setCapturedImage(photo.uri);
                await processImage(photo.uri);
            }
        } catch (error) {
            console.error('Error taking picture:', error);
            Alert.alert('Error', 'Failed to take picture');
            setProcessing(false);
        }
    };

    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                quality: 1,
            });

            if (!result.canceled && result.assets[0]) {
                setProcessing(true);
                setCapturedImage(result.assets[0].uri);
                await processImage(result.assets[0].uri);
            }
        } catch (error) {
            console.error('Error picking image:', error);
            Alert.alert('Error', 'Failed to pick image');
            setProcessing(false);
        }
    };

    const processImage = async (imageUri: string) => {
        try {
            // Run OCR with selected language
            const ocrResult = await processImageWithOCR(imageUri, selectedLanguage);

            // Parse nutrition info with same language
            const parsed = parseNutritionLabel(ocrResult.text, selectedLanguage);

            const entryParams = {
                nutrition: parsed.nutrition || undefined,
                barcode: prefilledBarcode,
                source: 'user_scanned' as const,
                language: selectedLanguage,
                mealCategory: route.params?.mealCategory,
                date: route.params?.date,
                confidence: parsed.confidence,
            };

            setProcessing(false);

            if (parsed.nutrition) {
                if (parsed.confidence === 'low') {
                    Alert.alert(
                        'Low Confidence',
                        'We found some nutrition info but confidence is low. Please review carefully.',
                        [
                            {
                                text: 'Review',
                                onPress: () => {
                                    navigation.navigate('ManualEntry', entryParams);
                                },
                            },
                        ]
                    );
                } else {
                    navigation.navigate('ManualEntry', entryParams);
                }
            } else {
                Alert.alert(
                    'Could not parse',
                    'We could not detect any nutrition label in this image.',
                    [
                        { text: 'Retake', style: 'cancel', onPress: () => setCapturedImage(null) },
                        {
                            text: 'Manual Entry',
                            onPress: () => navigation.navigate('ManualEntry', {
                                barcode: prefilledBarcode,
                                source: 'user_manual',
                                date: route.params?.date,
                                mealCategory: route.params?.mealCategory // Pass mealCategory!
                            }),
                        },
                    ]
                );
            }
        } catch (error) {
            console.error('Error processing image:', error);
            setProcessing(false);
            Alert.alert(
                'Processing Error',
                'There was an error processing the image.',
                [
                    { text: 'Retake', style: 'cancel', onPress: () => setCapturedImage(null) },
                    {
                        text: 'Manual Entry',
                        onPress: () => navigation.navigate('ManualEntry', {
                            barcode: prefilledBarcode,
                            source: 'user_manual',
                            date: route.params?.date,
                            mealCategory: route.params?.mealCategory
                        }),
                    },
                ]
            );
        }
    };

    const retake = () => {
        setCapturedImage(null);
        setProcessing(false);
    };

    // If image is captured and processing/waiting, show preview
    if (capturedImage) {
        return (
            <View style={styles.container}>
                <Image source={{ uri: capturedImage }} style={styles.preview} />
                {processing && (
                    <View style={styles.processingOverlay}>
                        <ActivityIndicator size="large" color="#ffffff" />
                        <Text style={styles.processingText}>Reading Label...</Text>
                    </View>
                )}
                {!processing && (
                    <View style={styles.bottomOverlay}>
                        {/* Fallback controls if alert is dismissed without action? usually alert handles nav */}
                        <TouchableOpacity style={styles.button} onPress={retake}>
                            <Text style={styles.buttonText}>Try Again</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.cameraWrapper}>
                <CameraView style={styles.camera} ref={setCameraRef} facing="back" />

                <View style={styles.overlay} pointerEvents="box-none">
                    {/* Top Overlay */}
                    <View style={styles.topOverlay}>
                        {/* No content needed for now, keeps spacing */}
                    </View>

                    {/* Middle Row with Scan Window */}
                    <View style={styles.middleRow}>
                        <View style={styles.sideOverlay} />
                        <View style={styles.scanArea} />
                        <View style={styles.sideOverlay} />
                    </View>

                    {/* Bottom Overlay with Instructions */}
                    <View style={styles.bottomInstructionOverlay}>
                        <Text style={styles.instructionText}>
                            Position the nutrition label within the frame and take a photo
                        </Text>
                    </View>
                </View>
            </View>

            <View style={styles.controls}>
                <TouchableOpacity style={styles.galleryButton} onPress={pickImage}>
                    <Text style={{ fontSize: 24 }}>🖼️</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.captureButton}
                    onPress={takePicture}
                    disabled={processing}
                >
                    <View style={styles.captureButtonInner} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={{ fontSize: 24, color: '#fff' }}>✕</Text>
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
        backgroundColor: '#4B5563',
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
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 50,
    },
    middleRow: {
        flexDirection: 'row',
        height: 400, // Taller for labels
    },
    sideOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    scanArea: {
        width: 300,
        borderWidth: 2,
        borderColor: theme.colors.primary,
        backgroundColor: 'transparent',
        borderRadius: 12,
    },
    bottomInstructionOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: theme.spacing.xl,
    },
    // Controls Footer
    controls: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: 20,
        backgroundColor: '#000',
    },
    captureButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureButtonInner: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#fff',
    },
    galleryButton: {
        padding: 12,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 50,
    },
    closeButton: {
        padding: 12,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 50,
        width: 50,
        height: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Components
    languageButton: {
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    languageButtonText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
    },
    instructionText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
        paddingHorizontal: 40,
    },

    // Post-Capture
    preview: {
        flex: 1,
        resizeMode: 'contain',
    },
    processingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    processingText: {
        color: '#ffffff',
        fontSize: 18,
        marginTop: 16,
        fontWeight: '600',
    },
    bottomOverlay: { // Reuse name for retake screen bottom
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 30,
        alignItems: 'center',
    },
    button: {
        backgroundColor: theme.colors.primary,
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 12,
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: '60%',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
        color: theme.colors.text.primary,
    },
    languageOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    languageOptionSelected: {
        backgroundColor: theme.colors.primaryLight,
        marginHorizontal: -20,
        paddingHorizontal: 20,
    },
    languageOptionText: {
        fontSize: 16,
        color: theme.colors.text.primary,
    },
    languageOptionTextSelected: {
        color: theme.colors.primary,
        fontWeight: '600',
    },
    checkmark: {
        color: theme.colors.primary,
        fontWeight: 'bold',
    },
    modalCloseButton: {
        marginTop: 16,
        padding: 16,
        backgroundColor: theme.colors.background,
        borderRadius: 12,
        alignItems: 'center',
    },
    modalCloseButtonText: {
        color: theme.colors.text.secondary,
        fontWeight: '600',
    },
});
