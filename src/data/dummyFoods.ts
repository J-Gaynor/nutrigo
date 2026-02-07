export interface DummyFood {
    id: string;
    name: string;
    brand?: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    servingSize: string;
    baseWeight: number; // weight in grams for the stated nutrition
}

export const dummyFoods: DummyFood[] = [
    { id: '1', name: 'Apple, Medium', calories: 95, protein: 0.5, carbs: 25, fats: 0.3, servingSize: '1 medium (182g)', baseWeight: 182 },
    { id: '2', name: 'Banana, Medium', calories: 105, protein: 1.3, carbs: 27, fats: 0.4, servingSize: '1 medium (118g)', baseWeight: 118 },
    { id: '3', name: 'Chicken Breast, Grilled', calories: 165, protein: 31, carbs: 0, fats: 3.6, servingSize: '100g', baseWeight: 100 },
    { id: '4', name: 'White Rice, Cooked', calories: 130, protein: 2.7, carbs: 28, fats: 0.3, servingSize: '100g', baseWeight: 100 },
    { id: '5', name: 'Broccoli, Steamed', calories: 35, protein: 2.3, carbs: 7.2, fats: 0.4, servingSize: '1 cup (91g)', baseWeight: 91 },
    { id: '6', name: 'Egg, Large', calories: 72, protein: 6, carbs: 0.4, fats: 4.8, servingSize: '1 large', baseWeight: 50 },
    { id: '7', name: 'Oatmeal, Cooked', calories: 158, protein: 6, carbs: 27, fats: 3, servingSize: '1 cup (234g)', baseWeight: 234 },
    { id: '8', name: 'Almonds', calories: 164, protein: 6, carbs: 6, fats: 14, servingSize: '1 oz (28g)', baseWeight: 28 },
    { id: '9', name: 'Salmon, Grilled', calories: 206, protein: 22, carbs: 0, fats: 12, servingSize: '100g', baseWeight: 100 },
    { id: '10', name: 'Greek Yogurt, Plain', calories: 100, protein: 17, carbs: 6, fats: 0.7, servingSize: '170g', baseWeight: 170 },
    { id: '11', name: 'Avocado', calories: 234, protein: 2.9, carbs: 12, fats: 21, servingSize: '1 medium (150g)', baseWeight: 150 },
    { id: '12', name: 'Sweet Potato, Baked', calories: 103, protein: 2.3, carbs: 24, fats: 0.2, servingSize: '1 medium (114g)', baseWeight: 114 },
    { id: '13', name: 'Cheddar Cheese', calories: 113, protein: 7, carbs: 0.4, fats: 9, servingSize: '1 slice (28g)', baseWeight: 28 },
    { id: '14', name: 'Whole Wheat Bread', calories: 80, protein: 4, carbs: 15, fats: 1, servingSize: '1 slice', baseWeight: 32 },
    { id: '15', name: 'Peanut Butter', calories: 190, protein: 7, carbs: 8, fats: 16, servingSize: '2 tbsp (32g)', baseWeight: 32 },
];
