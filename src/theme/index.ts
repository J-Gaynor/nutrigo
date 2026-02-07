export const theme = {
    colors: {
        // Primary Brand Colors (Clean Health Aesthetic)
        primary: '#10B981', // Emerald 500 - Validated safe, energetic green
        primaryDark: '#059669', // Emerald 600
        primaryLight: '#D1FAE5', // Emerald 100

        // Secondary Accents
        secondary: '#3B82F6', // Blue 500 - Trust, medical
        secondaryDark: '#2563EB', // Blue 600
        secondaryLight: '#EFF6FF', // Blue 50

        // Functional Colors
        success: '#10B981',
        warning: '#F59E0B', // Amber 500
        error: '#EF4444', // Red 500
        info: '#3B82F6',

        // Neutrals
        background: '#F9FAFB', // Gray 50 - Soft off-white for main bg
        surface: '#FFFFFF', // Pure white for cards
        text: {
            primary: '#111827', // Gray 900
            secondary: '#6B7280', // Gray 500
            tertiary: '#9CA3AF', // Gray 400
            inverse: '#FFFFFF',
        },
        border: '#E5E7EB', // Gray 200
        gold: '#FFD700', // Gold for Premium
    },

    spacing: {
        xs: 4,
        s: 8,
        m: 16,
        l: 24,
        xl: 32,
        xxl: 48,
    },

    borderRadius: {
        s: 8,
        m: 16,
        l: 24,
        xl: 32, // For rounded buttons/pills
    },

    shadows: {
        soft: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
        },
        medium: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 4,
        },
    },

    typography: {
        h1: { fontSize: 32, fontWeight: 'bold' as const, color: '#111827' },
        h2: { fontSize: 24, fontWeight: 'bold' as const, color: '#111827' },
        h3: { fontSize: 20, fontWeight: '600' as const, color: '#111827' },
        body: { fontSize: 16, color: '#4B5563' },
        caption: { fontSize: 14, color: '#6B7280' },
        button: { fontSize: 16, fontWeight: '600' as const, color: '#FFFFFF' },
    },
};
