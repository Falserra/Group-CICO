// Small persistent key/value store for things that must survive an app restart (login token,
// "remember me"). Native builds keep them in the OS keychain / keystore (expo-secure-store);
// in a browser, where SecureStore doesn't exist, localStorage is used instead.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const web = Platform.OS === 'web';

export async function getItem(key: string): Promise<string | null> {
  try {
    if (web) return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  try {
    if (web) localStorage.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // Storage unavailable (private mode, full): the app keeps working, it just won't remember.
  }
}

export async function removeItem(key: string): Promise<void> {
  try {
    if (web) localStorage.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore, see above
  }
}
