import { NutritionInfo } from '../types/food';
import { SupportedLanguage } from './ocr';

export interface ParsedNutrition {
    nutrition: NutritionInfo | null;
    confidence: 'high' | 'medium' | 'low';
    errors: string[];
}

// Multi-language nutrition label terms
const NUTRITION_TERMS: Record<SupportedLanguage, {
    calories: string[];
    protein: string[];
    carbs: string[];
    fats: string[];
    serving: string[];
}> = {
    latin: {
        calories: ['calories', 'energy', 'kcal', 'cal'],
        protein: ['protein', 'proteins'],
        carbs: ['carbohydrate', 'carbohydrates', 'carbs', 'total carbohydrate'],
        fats: ['fat', 'fats', 'total fat', 'lipid'],
        serving: ['serving size', 'serving', 'portion'],
    },
};

/**
 * Parse OCR text to extract nutrition information
 * Supports multiple languages
 */
export const parseNutritionLabel = (
    ocrText: string,
    language: SupportedLanguage = 'latin'
): ParsedNutrition => {
    const errors: string[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'low';

    // Normalize text: lowercase and remove extra whitespace
    const normalizedText = ocrText.toLowerCase().replace(/\s+/g, ' ');

    const terms = NUTRITION_TERMS[language];

    // Extract nutrition values
    const calories = extractCalories(normalizedText, terms.calories);
    const protein = extractMacro(normalizedText, terms.protein);
    const carbs = extractMacro(normalizedText, terms.carbs);
    const fats = extractMacro(normalizedText, terms.fats);

    // Determine confidence based on what we found
    const foundCount = [calories, protein, carbs, fats].filter(v => v !== null).length;

    if (foundCount === 4) {
        confidence = 'high';
    } else if (foundCount >= 2) {
        confidence = 'medium';
        if (!calories) errors.push('Could not find calories');
        if (!protein) errors.push('Could not find protein');
        if (!carbs) errors.push('Could not find carbohydrates');
        if (!fats) errors.push('Could not find fats');
    } else {
        confidence = 'low';
        errors.push('Could not extract enough nutrition information from the label');
    }

    // Only return nutrition if we found at least calories
    if (calories !== null) {
        return {
            nutrition: {
                calories: calories ?? 0,
                protein: protein ?? 0,
                carbs: carbs ?? 0,
                fats: fats ?? 0,
            },
            confidence,
            errors,
        };
    }

    return {
        nutrition: null,
        confidence: 'low',
        errors: ['Could not extract nutrition information. Please try again or enter manually.'],
    };
};

/**
 * Extract calorie value from text
 */
/**
 * Extract calorie value from text
 */
const extractCalories = (text: string, labels: string[]): number | null => {
    // 1. Priority: Look for explicit 'kcal' pattern regardless of label
    // Matches: "123 kcal", "123kcal" anywhere in text
    // We scan entire text for this unit as it's definitive
    const kcalRegex = /(\d+)\s*kcal/gi;
    let match;
    while ((match = kcalRegex.exec(text)) !== null) {
        const val = parseInt(match[1], 10);
        // Sanity range for a single serving or per 100g (0 to 1000 usually)
        if (val > 0 && val < 2000) {
            return val;
        }
    }

    // 2. Fallback: Look for label association if no clear kcal unit found
    // e.g. "Energy 200"
    for (const label of labels) {
        const patterns = [
            new RegExp(`${label}[:\\s]+(\\d+)`, 'i'),
            new RegExp(`(\\d+)\\s*${label}`, 'i'),
        ];

        for (const pattern of patterns) {
            const m = text.match(pattern);
            if (m && m[1]) {
                const val = parseInt(m[1], 10);
                // Avoid values that look like kJ (usually > 2000 for standard foods or clearly large)
                // 1 kcal = 4.184 kJ. 500 kcal = 2092 kJ. 
                // If we get a huge number without unit, it might be kJ.
                if (val > 0 && val < 4000) {
                    return val;
                }
            }
        }
    }

    return null;
};

/**
 * Extract macro value (protein, carbs, fats) from text
 */
const extractMacro = (text: string, labels: string[]): number | null => {
    for (const label of labels) {
        // Priority: Value followed explicitly by 'g'
        // "Protein 5g", "Total Fat 12.5g"
        const explicitGramPattern = new RegExp(`${label}[^\\d]*(\\d+\\.?\\d*)\\s*g`, 'i');
        const m1 = text.match(explicitGramPattern);
        if (m1 && m1[1]) {
            return parseFloat(m1[1]);
        }

        // Reverse: "10g Protein"
        const reverseGramPattern = new RegExp(`(\\d+\\.?\\d*)\\s*g[^\\d]*${label}`, 'i');
        const m2 = text.match(reverseGramPattern);
        if (m2 && m2[1]) {
            return parseFloat(m2[1]);
        }

        // Fallback: Just number after label (risky, but needed often)
        const numberPattern = new RegExp(`${label}[:\\s]+(\\d+\\.?\\d*)`, 'i');
        const m3 = text.match(numberPattern);
        if (m3 && m3[1]) {
            const val = parseFloat(m3[1]);
            // Filter out unlikely values (e.g. year 2024, or tiny 0.001)
            if (val < 1000) return val;
        }
    }

    return null;
};

/**
 * Extract serving size information
 */
export const extractServingSize = (
    text: string,
    language: SupportedLanguage = 'latin'
): string | null => {
    const terms = NUTRITION_TERMS[language];

    for (const label of terms.serving) {
        const patterns = [
            new RegExp(`${label}[:\\s]+([^\\n]+)`, 'i'),
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
    }

    return null;
};
