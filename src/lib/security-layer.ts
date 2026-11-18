// SecurityLayer (Master File §5.4.3): protecting the OTP step from someone watching your screen.
//
// Neither iOS nor Android exposes a public API that tells an app "a Messenger/Zoom call is sharing
// your screen", and expo-screen-capture only offers screenshot events. So CiCo does two things:
//  1. Always blocks capture on the OTP screen (usePreventScreenCapture). On Android this sets
//     FLAG_SECURE, so anyone watching a shared screen sees black.
//  2. Offers "Screen-sharing protection" in the Security tab. Turn it on during a video call and the
//     OTP is masked until you press and hold to reveal it, with a warning before you continue.
//     (A native module that detects casting automatically could drive the same flag later.)
import { useSyncExternalStore } from 'react';

import { getItem, setItem } from './storage';

const KEY = 'cico_screen_share_protection';
let enabled = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

// Restore the saved choice at launch.
getItem(KEY).then((v) => {
  if (v === '1' && !enabled) {
    enabled = true;
    emit();
  }
});

export function setScreenSharingProtection(on: boolean) {
  enabled = on;
  setItem(KEY, on ? '1' : '0');
  emit();
}

/** Re-renders when the protection is switched on or off. */
export function useScreenSharingProtection() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => enabled,
  );
}

export async function detectScreenSharing(): Promise<'active' | 'inactive'> {
  return enabled ? 'active' : 'inactive';
}
