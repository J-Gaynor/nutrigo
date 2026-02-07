/**
 * Calculates the One Rep Max (1RM) using the Epley formula.
 * Formula: Weight * (1 + Reps / 30)
 * 
 * @param weight The weight lifted
 * @param reps The number of repetitions performed
 * @returns The estimated One Rep Max
 */
export const calculateOneRepMax = (weight: number, reps: number): number => {
    if (weight <= 0 || reps <= 0) return 0;
    if (reps === 1) return weight;

    return weight * (1 + reps / 30);
};
