import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, Text, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Btn, C, Icon, IconBubble } from '@/components/wallet-ui';
import { API_BASE } from '@/lib/api';
import { WalletProvider, useWallet } from '@/lib/wallet-store';

SplashScreen.preventAutoHideAsync();

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: C.bg, primary: C.primary } };

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <WalletProvider>
        <AnimatedSplashOverlay />
        <RootStack />
      </WalletProvider>
    </ThemeProvider>
  );
}

// Guards follow the Master File roles: signed-out → Login/Register,
// Customer → wallet screens, Administrator → admin console.
function RootStack() {
  const { me, ready, loadError, retryLoad, offline } = useWallet();
  if (loadError)
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', padding: 24 }}>
        <IconBubble name="cloud-offline-outline" color={C.danger} bg={C.dangerBg} size={64} />
        <Text style={{ color: C.ink, fontSize: 22, fontWeight: '800', marginTop: 16, marginBottom: 8 }}>Can&apos;t reach CiCo</Text>
        <Text style={{ color: C.mute, marginBottom: 20, lineHeight: 21 }}>{loadError}</Text>
        {__DEV__ && <Text style={{ color: C.mute, marginBottom: 16, fontSize: 12 }}>Server: {API_BASE}</Text>}
        <Btn label="Try again" icon="refresh" onPress={retryLoad} />
      </View>
    );
  // Checking for a saved login; show a spinner rather than flashing the login screen.
  if (!ready)
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.primary} />
      </View>
    );
  // Where each role lands.
  const landing = !me ? '/' : me.role === 'admin' ? '/admin' : '/home';
  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.bg },
          headerTintColor: C.primary,
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: '800', color: C.ink },
          contentStyle: { backgroundColor: C.bg },
        }}>
        <Stack.Protected guard={!me} redirectTo={landing}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="register" options={{ title: 'Create account' }} />
        </Stack.Protected>

        <Stack.Protected guard={me?.role === 'customer'} redirectTo={landing}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="transact" options={{ title: 'Money movement' }} />
          <Stack.Screen name="receive" options={{ title: 'Receive money' }} />
          <Stack.Screen name="link-account" options={{ title: 'Linked accounts' }} />
          <Stack.Screen name="subscriptions" options={{ title: 'Subscription Hub' }} />
          <Stack.Screen name="report" options={{ title: 'Report suspicious activity' }} />
          <Stack.Screen name="scan" options={{ title: 'Check a link or SMS' }} />
          <Stack.Screen name="qr" options={{ title: 'Scan to pay' }} />
          <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
        </Stack.Protected>

        <Stack.Protected guard={me?.role === 'admin'} redirectTo={landing}>
          <Stack.Screen name="admin" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>

      {/* Shown while the server can't be reached; clears itself when the connection returns. */}
      {offline && me && (
        <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: 90, backgroundColor: C.ink, borderRadius: 14, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <Icon name="cloud-offline-outline" size={22} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Can&apos;t reach the CiCo server</Text>
            <Text style={{ color: '#BFD3F2', marginTop: 2 }}>Showing the last data we had. Retrying…</Text>
          </View>
        </View>
      )}
    </View>
  );
}
