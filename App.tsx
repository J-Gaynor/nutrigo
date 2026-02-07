import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { AppNavigator } from './src/navigation/AppNavigator';
import { SubscriptionProvider } from './src/context/SubscriptionContext';
import { ToastProvider, useToast } from './src/context/ToastContext';
import { Toast } from './src/components/Toast';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await SplashScreen.hideAsync();
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  if (!appIsReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <SubscriptionProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </SubscriptionProvider>
    </View>
  );
}

function AppContent() {
  const { toastMessage, toastVisible, hideToast } = useToast();

  return (
    <>
      <NavigationContainer>
        <AppNavigator />
        <StatusBar style="light" />
      </NavigationContainer>

      {/* Global Toast */}
      <Toast
        message={toastMessage}
        visible={toastVisible}
        onHide={hideToast}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
