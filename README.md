# NutritionApp - Calorie Tracking with Camera-Based Label Scanning

A React Native mobile app built with Expo that allows users to track calories and macros by scanning nutrition labels with their camera.

## Features

- 📱 **Barcode Scanning**: Instantly look up products using their barcode (powered by OpenFoodFacts)
- 📷 **Camera-Based Scanning**: Take photos of nutrition labels and automatically extract nutritional information using OCR
- 🌍 **Multi-Language Support**: Scans labels in English, Chinese, Japanese, Korean, and Devanagari
- 📊 **Daily Tracking**: Track your daily calorie and macro intake with visual progress bars
- 💾 **Food Database**: Save food profiles for quick logging
- ✏️ **Manual Entry**: Add foods manually when scanning isn't available
- 📱 **Cross-Platform**: Works on both iOS and Android

## Tech Stack

- **React Native + Expo**: Cross-platform mobile framework
- **TypeScript**: Type-safe development
- **rn-mlkit-ocr**: OCR using Google ML Kit (Android) and Apple Vision (iOS)
- **Expo Camera**: Camera access and photo capture
- **AsyncStorage**: Local data persistence
- **React Navigation**: Screen navigation

## Prerequisites

- Node.js (v18 or later)
- npm or yarn
- Expo CLI
- iOS Simulator (Mac only) or Android Emulator
- For physical device testing: Expo Go app or EAS Build

## Installation

1. Clone the repository:
\`\`\`bash
git clone <your-repo-url>
cd NutritionApp
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

## Development

### Running with Expo Go (Limited Functionality)

**Note**: Camera and OCR features require native modules and won't work in Expo Go. Use this only for testing basic UI.

\`\`\`bash
npx expo start
\`\`\`

### Running with Development Build (Recommended)

To test camera, OCR, and barcode features, you need to create a development build:

1. Install EAS CLI:
\`\`\`bash
npm install -g eas-cli
\`\`\`

2. Login to Expo:
\`\`\`bash
eas login
\`\`\`

3. Configure your project:
\`\`\`bash
eas build:configure
\`\`\`

4. Build for iOS Simulator (Mac only):
\`\`\`bash
eas build --profile development --platform ios --local
\`\`\`

5. Build for Android:
\`\`\`bash
eas build --profile development --platform android --local
\`\`\`

6. Install the build on your simulator/emulator and run:
\`\`\`bash
npx expo start --dev-client
\`\`\`

## Project Structure

\`\`\`
NutritionApp/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── MacroCard.tsx
│   │   └── FoodCard.tsx
│   ├── navigation/          # Navigation configuration
│   │   └── AppNavigator.tsx
│   ├── screens/             # App screens
│   │   ├── HomeScreen.tsx
│   │   ├── ScannerScreen.tsx
│   │   ├── ManualEntryScreen.tsx
│   │   └── FoodListScreen.tsx
│   ├── services/            # Business logic and utilities
│   │   ├── ocr.ts
│   │   ├── nutritionParser.ts
│   │   └── storage.ts
│   └── types/               # TypeScript type definitions
│       └── food.ts
├── App.tsx                  # Root component
├── app.json                 # Expo configuration
└── eas.json                 # EAS Build configuration
\`\`\`

## How It Works

1. **Scan Barcode**: Use the barcode scanner to instantly find products in the OpenFoodFacts database
2. **Scan Label**: If not found, take a photo of the nutrition label
3. **Multi-Language**: Select the label language (e.g., Chinese, Japanese) for better accuracy
4. **OCR Processing**: The app extracts text and parses nutrition values
5. **Review & Save**: Review the data (marked as "Private/Local Only" for scanned labels) and save
6. **Track Daily**: Add foods to your daily log

## Customization

### Adjusting Daily Goals

Default goals are set in `src/services/storage.ts`:
- Calories: 2000
- Protein: 150g
- Carbs: 200g
- Fats: 65g

You can modify these defaults or add a settings screen to let users customize their goals.

### OCR Language Support

The app uses ML Kit's Latin script detector by default. To support other languages, modify `src/services/ocr.ts` to pass a different `detectorType`:

\`\`\`typescript
await recognizeText(imageUri, 'chinese'); // or 'japanese', 'korean', 'devanagari'
\`\`\`

## Known Limitations

- OCR accuracy depends on image quality and label format
- Some nutrition labels may not parse correctly (manual entry available as fallback)
- Requires development build for full functionality (camera + OCR)

## Future Enhancements

- [ ] Barcode scanning for automatic food lookup
- [ ] Cloud sync across devices
- [ ] Meal planning features
- [ ] Progress charts and analytics
- [ ] Integration with fitness APIs
- [ ] Recipe calculator

## Troubleshooting

### Camera not working
- Ensure you've granted camera permissions
- Make sure you're using a development build, not Expo Go

### OCR not extracting text
- Ensure good lighting and clear image
- Try holding the camera steady
- Use manual entry as a fallback

### Build errors
- Run `npm install` to ensure all dependencies are installed
- Clear cache: `npx expo start -c`
- For native module issues, rebuild with EAS

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
