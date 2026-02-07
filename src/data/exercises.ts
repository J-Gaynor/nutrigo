export interface ExerciseOption {
    id: string;
    name: string;
    met: number; // Metabolic Equivalent of Task
}

// GYM Exercises - Used for "Workout" tab (Gym/Weights/Cardio Machines)
import { EXERCISE_DB } from './exercises_normalized';

// GYM Exercises - Imported from normalized ExerciseDB
export const GYM_EXERCISES: ExerciseOption[] = EXERCISE_DB;

export const SPORTS_AND_ACTIVITIES: ExerciseOption[] = [
    // Running / Walking (Outdoor)
    { id: 'running_moderate', name: 'Running (Moderate)', met: 8.0 },
    { id: 'running_fast', name: 'Running (Fast)', met: 11.5 },
    { id: 'walking_brisk', name: 'Walking (Brisk)', met: 3.8 },
    { id: 'walking_casual', name: 'Walking (Casual)', met: 3.0 },
    { id: 'hiking', name: 'Hiking', met: 6.0 },

    // Team Sports
    { id: 'soccer', name: 'Soccer / Football', met: 7.0 },
    { id: 'rugby', name: 'Rugby', met: 8.3 },
    { id: 'american_football', name: 'American Football', met: 8.0 },
    { id: 'basketball', name: 'Basketball', met: 6.5 },
    { id: 'cricket', name: 'Cricket', met: 4.8 },
    { id: 'baseball', name: 'Baseball / Softball', met: 5.0 },
    { id: 'volleyball', name: 'Volleyball', met: 4.0 },
    { id: 'hockey_field', name: 'Field Hockey', met: 7.8 },
    { id: 'hockey_ice', name: 'Ice Hockey', met: 8.0 },

    // Individual Sports / Activities
    { id: 'tennis', name: 'Tennis', met: 7.3 },
    { id: 'badminton', name: 'Badminton', met: 4.5 },
    { id: 'squash', name: 'Squash', met: 12.0 },
    { id: 'table_tennis', name: 'Table Tennis', met: 4.0 },
    { id: 'golf_walking', name: 'Golf (Walking)', met: 4.8 },
    { id: 'swimming_laps', name: 'Swimming (Laps)', met: 7.0 },
    { id: 'cycling_outdoor', name: 'Cycling (Outdoor)', met: 7.5 },
    { id: 'boxing', name: 'Boxing / MMA', met: 10.0 },
    { id: 'martial_arts', name: 'Martial Arts (General)', met: 10.0 },
    { id: 'wrestling', name: 'Wrestling', met: 6.0 },
    { id: 'yoga', name: 'Yoga', met: 3.0 },
    { id: 'pilates', name: 'Pilates', met: 3.0 },
    { id: 'dancing', name: 'Dancing', met: 5.0 },
    { id: 'rock_climbing', name: 'Rock Climbing', met: 8.0 },
    { id: 'skipping', name: 'Jump Rope', met: 10.0 },
];

// Unified List used for Nutrition Log (Includes ALL)
export const ALL_EXERCISES = [...GYM_EXERCISES, ...SPORTS_AND_ACTIVITIES].sort((a, b) => a.name.localeCompare(b.name));

// Backward compatibility / Default export used by Workout screens
// This MUST NOT include Sports/Activities
export const EXERCISE_OPTIONS = GYM_EXERCISES;
