import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Keyboard,
    TouchableWithoutFeedback,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { parseNutritionLabel } from '../services/nutritionParser';
import { theme } from '../theme';

type ParserTestScreenProps = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'ParserTest'>;
};

export const ParserTestScreen: React.FC<ParserTestScreenProps> = ({ navigation }) => {
    const [inputText, setInputText] = useState('');
    const [result, setResult] = useState<any | null>(null);

    const handleParse = () => {
        const parsed = parseNutritionLabel(inputText, 'latin');
        setResult(parsed);
        Keyboard.dismiss();
    };

    const loadSample = () => {
        const sample = `Nutrition Facts
Serving Size 1 cup (228g)
Amount Per Serving
Calories 260
Total Fat 13g
Saturated Fat 5g
Trans Fat 0g
Cholesterol 30mg
Sodium 660mg
Total Carbohydrate 31g
Dietary Fiber 0g
Sugars 5g
Protein 5g`;
        setInputText(sample);
    };

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Text style={styles.backButtonText}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>OCR Logic Tester</Text>
                </View>

                <View style={styles.content}>
                    <Text style={styles.label}>Paste OCR Text Here:</Text>
                    <TextInput
                        style={styles.input}
                        multiline
                        placeholder="Paste label text here..."
                        placeholderTextColor="#666"
                        value={inputText}
                        onChangeText={setInputText}
                    />

                    <View style={styles.buttonRow}>
                        <TouchableOpacity style={styles.sampleButton} onPress={loadSample}>
                            <Text style={styles.buttonText}>Load Sample</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.parseButton} onPress={handleParse}>
                            <Text style={styles.buttonText}>Run Parser</Text>
                        </TouchableOpacity>
                    </View>

                    {result && (
                        <View style={styles.resultContainer}>
                            <Text style={styles.resultTitle}>Parsed Result:</Text>
                            <ScrollView style={styles.resultScroll}>
                                <Text style={styles.jsonText}>
                                    {JSON.stringify(result, null, 2)}
                                </Text>
                            </ScrollView>
                            <TouchableOpacity
                                style={styles.useButton}
                                onPress={() => {
                                    navigation.navigate('ManualEntry', {
                                        nutrition: result.nutrition || undefined,
                                        source: 'user_manual',
                                        confidence: result.confidence
                                    });
                                }}
                            >
                                <Text style={styles.useButtonText}>Test Data Passing →</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        </TouchableWithoutFeedback>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        paddingTop: 60,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    backButton: {
        padding: 10,
        marginRight: 10,
    },
    backButtonText: {
        fontSize: 16,
        color: theme.colors.primary,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        color: '#555',
    },
    input: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 12,
        height: 150,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: '#ddd',
        marginBottom: 16,
        fontSize: 14,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    sampleButton: {
        flex: 1,
        backgroundColor: '#6c757d',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    parseButton: {
        flex: 1,
        backgroundColor: theme.colors.primary,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
    },
    resultContainer: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 30,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    resultTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    resultScroll: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        padding: 8,
        marginBottom: 10,
    },
    jsonText: {
        fontFamily: 'monospace',
        fontSize: 12,
        color: '#333',
    },
    useButton: {
        backgroundColor: '#28a745',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    useButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
});
