import { DummyFood } from '../data/dummyFoods';
import { ENV } from '../config/env';

export interface USDAFoodItem {
    fdcId: number;
    description: string;
    brandOwner?: string;
    foodNutrients: Array<{
        nutrientId: number;
        nutrientName: string;
        unitName: string;
        value: number;
    }>;
    servingSize?: number;
    servingSizeUnit?: string;
}

export interface USDASearchResponse {
    totalHits: number;
    foods: USDAFoodItem[];
}

/**
 * Search for foods using the USDA API
 */
export const searchUSDAFoods = async (query: string): Promise<DummyFood[]> => {
    if (!query.trim()) return [];

    try {
        const url = `${ENV.USDA_API_BASE}/foods/search?api_key=${ENV.USDA_API_KEY}&query=${encodeURIComponent(query)}&pageSize=25`;
        console.log('Searching USDA with query:', query);

        const response = await fetch(url);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`USDA API failed (${response.status}): ${JSON.stringify(errorData)}`);
        }

        const data: USDASearchResponse = await response.json();

        if (!data.foods || !Array.isArray(data.foods)) {
            return [];
        }

        return data.foods.map(mapUSDAFoodToDummyFood);
    } catch (error) {
        console.error('USDA Search Error:', error);
        return [];
    }
};

/**
 * Maps USDA nutrient data to our app's internal format
 * Nutrient IDs (FDC):
 * 1008: Calories (kcal)
 * 1003: Protein (g)
 * 1005: Carbohydrate (g)
 * 1004: Total lipid (fat) (g)
 */
const mapUSDAFoodToDummyFood = (usdaFood: USDAFoodItem): DummyFood => {
    const getNutrientValue = (id: number) => {
        const nutrient = usdaFood.foodNutrients.find(n => n.nutrientId === id);
        return nutrient ? nutrient.value : 0;
    };

    const calories = getNutrientValue(1008);
    const protein = getNutrientValue(1003);
    const carbs = getNutrientValue(1005);
    const fats = getNutrientValue(1004);

    const servingStr = usdaFood.servingSize
        ? `${usdaFood.servingSize} ${usdaFood.servingSizeUnit || 'g'}`
        : '100g';

    return {
        id: `usda-${usdaFood.fdcId}`,
        name: usdaFood.description,
        brand: usdaFood.brandOwner || 'USDA Database',
        calories,
        protein,
        carbs,
        fats,
        servingSize: servingStr,
        baseWeight: usdaFood.servingSize || 100,
    };
};
