import { recognizeText, OcrResult, DetectorType } from 'rn-mlkit-ocr';
import { Alert, Platform } from 'react-native';

export interface OCRResult {
    text: string;
    blocks: Array<{
        text: string;
        lines: Array<{
            text: string;
        }>;
    }>;
}

export type SupportedLanguage = 'latin';

const MOCK_OCR_TEXT = `
Nutrition Facts
Serving Size 1 cup (228g)
Calories 260
Total Fat 13g
Total Carbohydrate 31g
Protein 5g
`;

/**
 * Process an image with OCR to extract text
 * @param imageUri - Local file URI of the image to process
 * @param language - Language/script to use for OCR (default: latin)
 * @returns OCR result with extracted text
 */
export const processImageWithOCR = async (
    imageUri: string,
    language: SupportedLanguage = 'latin'
): Promise<OCRResult> => {
    try {
        const detectorType: DetectorType = language as DetectorType;
        console.log(`Processing image with OCR (Language: ${language})...`);

        // Attempt actual OCR
        const result: OcrResult = await recognizeText(imageUri, detectorType);

        return {
            text: result.text,
            blocks: result.blocks.map((block) => ({
                text: block.text,
                lines: block.lines.map((line) => ({
                    text: line.text,
                })),
            })),
        };
    } catch (error) {
        console.warn('OCR processing error (likely missing native module or simulator):', error);

        // Fallback for development/simulator where native OCR might fail
        if (__DEV__) {
            console.log('Falling back to MOCK OCR data for development...');
            Alert.alert(
                'Dev Mode: Mock OCR',
                'Native OCR failed (expected on Simulator/Expo Go). Using mock data for testing.'
            );

            return {
                text: MOCK_OCR_TEXT,
                blocks: [
                    {
                        text: MOCK_OCR_TEXT,
                        lines: MOCK_OCR_TEXT.split('\n').map(text => ({ text })),
                    }
                ]
            };
        }

        throw new Error('Failed to process image with OCR');
    }
};

/**
 * Get display name for language
 */
/**
 * Get display name for language
 */
export const getLanguageDisplayName = (language: SupportedLanguage): string => {
    return 'English';
};
