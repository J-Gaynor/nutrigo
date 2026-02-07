// OpenFoodFacts API integration for barcode lookup

const OPENFOODFACTS_API_BASE = 'https://world.openfoodfacts.org/api/v2';

export interface OpenFoodFactsProduct {
    code: string; // Barcode
    product_name: string;
    brands?: string;
    image_url?: string;
    nutriments?: {
        'energy-kcal_100g'?: number;
        'proteins_100g'?: number;
        'carbohydrates_100g'?: number;
        'fat_100g'?: number;
        'energy-kcal_serving'?: number;
        'proteins_serving'?: number;
        'carbohydrates_serving'?: number;
        'fat_serving'?: number;
    };
    serving_size?: string;
    nutrition_data_per?: string;
}

export interface OpenFoodFactsResponse {
    status: number;
    code: string;
    product?: OpenFoodFactsProduct;
}

export interface ProductLookupResult {
    found: boolean;
    product?: {
        barcode: string;
        name: string;
        brand?: string;
        imageUrl?: string;
        nutrition: {
            calories: number;
            protein: number;
            carbs: number;
            fats: number;
        };
        servingSize?: string;
    };
    error?: string;
}

/**
 * Look up a product by barcode using OpenFoodFacts API
 * @param barcode - Product barcode (EAN, UPC, etc.)
 * @returns Product information if found
 */
export const lookupProductByBarcode = async (
    barcode: string
): Promise<ProductLookupResult> => {
    try {
        const response = await fetch(
            `${OPENFOODFACTS_API_BASE}/product/${barcode}.json`,
            {
                headers: {
                    'User-Agent': 'Stamina - React Native - Version 1.0',
                },
            }
        );

        if (!response.ok) {
            return {
                found: false,
                error: `API request failed with status ${response.status}`,
            };
        }

        const data: OpenFoodFactsResponse = await response.json();

        if (data.status === 0 || !data.product) {
            return {
                found: false,
                error: 'Product not found in OpenFoodFacts database',
            };
        }

        const product = data.product;
        const nutriments = product.nutriments || {};

        // Prefer per-serving data, fallback to per-100g
        const calories = nutriments['energy-kcal_serving'] ?? nutriments['energy-kcal_100g'] ?? 0;
        const protein = nutriments['proteins_serving'] ?? nutriments['proteins_100g'] ?? 0;
        const carbs = nutriments['carbohydrates_serving'] ?? nutriments['carbohydrates_100g'] ?? 0;
        const fats = nutriments['fat_serving'] ?? nutriments['fat_100g'] ?? 0;

        return {
            found: true,
            product: {
                barcode: product.code,
                name: product.product_name || 'Unknown Product',
                brand: product.brands,
                imageUrl: product.image_url,
                nutrition: {
                    calories,
                    protein,
                    carbs,
                    fats,
                },
                servingSize: product.serving_size || (nutriments['energy-kcal_100g'] ? '100g' : undefined),
            },
        };
    } catch (error) {
        console.error('Error looking up product:', error);
        return {
            found: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
    }
};

/**
 * Search for products by name (optional feature)
 * @param query - Search query
 * @param page - Page number (default 1)
 * @returns Search results
 */
export const searchProducts = async (
    query: string,
    page: number = 1
): Promise<{ products: any[]; count: number }> => {
    try {
        const response = await fetch(
            `${OPENFOODFACTS_API_BASE}/search?search_terms=${encodeURIComponent(query)}&page=${page}&page_size=20&json=true`,
            {
                headers: {
                    'User-Agent': 'Stamina - React Native - Version 1.0',
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Search failed with status ${response.status}`);
        }

        const data = await response.json();
        return {
            products: data.products || [],
            count: data.count || 0,
        };
    } catch (error) {
        console.error('Error searching products:', error);
        return { products: [], count: 0 };
    }
};
