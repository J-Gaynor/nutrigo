import { lookupProductByBarcode } from './foodDatabase';
import { ENV } from '../config/env';
import { DummyFood } from '../data/dummyFoods';
import { getFoodByBarcode } from './storage';

export interface BarcodeResult {
    found: boolean;
    product?: DummyFood;
    source?: 'OFF' | 'USDA';
    error?: string;
}

/**
 * Enhanced USDA Barcode Lookup (using FDC API)
 */
const lookupUSDAByBarcode = async (barcode: string): Promise<BarcodeResult> => {
    try {
        const url = `${ENV.USDA_API_BASE}/foods/search?api_key=${ENV.USDA_API_KEY}&query=${barcode}&pageSize=1`;
        const response = await fetch(url);

        if (!response.ok) return { found: false };

        const data = await response.json();

        if (data.foods && data.foods.length > 0) {
            const usdaFood = data.foods[0];

            // Map to DummyFood format
            const getNutrient = (id: number) =>
                usdaFood.foodNutrients.find((n: any) => n.nutrientId === id)?.value || 0;

            return {
                found: true,
                source: 'USDA',
                product: {
                    id: `usda-${usdaFood.fdcId}`,
                    name: usdaFood.description,
                    brand: usdaFood.brandOwner || 'USDA Database',
                    calories: getNutrient(1008),
                    protein: getNutrient(1003),
                    carbs: getNutrient(1005),
                    fats: getNutrient(1004),
                    servingSize: usdaFood.servingSize ? `${usdaFood.servingSize} ${usdaFood.servingSizeUnit || 'g'}` : '100g',
                    baseWeight: usdaFood.servingSize || 100,
                }
            };
        }
        return { found: false };
    } catch (error) {
        console.error('USDA Barcode Lookup Error:', error);
        return { found: false };
    }
};

/**
 * Unified Barcode Lookup
 * Searches OpenFoodFacts and USDA in parallel for maximum speed.
 */
export const unifiedBarcodeLookup = async (barcode: string): Promise<BarcodeResult> => {
    console.log('[BarcodeService] Starting parallel lookup for:', barcode);
    try {
        // 1. Check Local User Data First
        const localFood = await getFoodByBarcode(barcode);
        if (localFood) {
            console.log('[BarcodeService] Found in local user data');
            return {
                found: true,
                source: 'USDA', // Treat user data as high quality
                product: {
                    id: localFood.id,
                    name: localFood.name,
                    brand: localFood.brand || 'Personal Database',
                    calories: localFood.nutrition.calories,
                    protein: localFood.nutrition.protein,
                    carbs: localFood.nutrition.carbs,
                    fats: localFood.nutrition.fats,
                    servingSize: localFood.nutrition.servingSize || '1 serving',
                    baseWeight: localFood.nutrition.servingWeight || 100,
                }
            };
        }

        // 2. Run external APIs in parallel
        const [offResult, usdaResult] = await Promise.all([
            lookupProductByBarcode(barcode).then(res => {
                console.log('[BarcodeService] OFF search complete, found:', res.found);
                if (res.found && res.product) {
                    return {
                        found: true,
                        source: 'OFF' as const,
                        product: {
                            id: `off-${res.product.barcode}`,
                            name: res.product.name,
                            brand: res.product.brand,
                            calories: res.product.nutrition.calories,
                            protein: res.product.nutrition.protein,
                            carbs: res.product.nutrition.carbs,
                            fats: res.product.nutrition.fats,
                            servingSize: res.product.servingSize || '100g',
                            baseWeight: 100, // Default for OFF if not specified
                        }
                    };
                }
                return { found: false };
            }),
            lookupUSDAByBarcode(barcode).then(res => {
                console.log('[BarcodeService] USDA search complete, found:', res.found);
                return res;
            })
        ]);

        // Prioritization Logic:
        // 1. prefer USDA if both found (usually more detailed branded macros)
        // 2. fallback to OFF
        if (usdaResult.found) return usdaResult;
        if (offResult.found) return offResult;

        return { found: false, error: 'Product not found in any database.' };
    } catch (error) {
        console.error('Unified Lookup Error:', error);
        return { found: false, error: 'An error occurred during lookup.' };
    }
};
