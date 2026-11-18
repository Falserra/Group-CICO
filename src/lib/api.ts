// HTTP client for the CiCo API (the PHP + MySQL backend in /backend, served by XAMPP).
//
// Where the server lives:
//   * EXPO_PUBLIC_API_URL, if set (a .env file for development, or the build profile in eas.json for
//     release builds) – always set this for a hosted server, e.g. https://cico-api.onrender.com/index.php
//   * Otherwise, in development only: Android emulator -> 10.0.2.2 (the emulator's alias for this PC),
//     real phone / Expo Go -> the PC running the Expo dev server, browser / iOS simulator -> localhost.
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

function resolveBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  const devHost = Constants.expoConfig?.hostUri?.split(':')[0]; // e.g. "192.168.1.5" while `expo start` runs
  const tunnel = !devHost || /exp\.direct|ngrok|expo\.dev/.test(devHost);
  let host = tunnel ? undefined : devHost;
  if (Platform.OS === 'android' && (!Device.isDevice || !host || host === 'localhost' || host === '127.0.0.1')) host = '10.0.2.2';
  return `http://${host ?? 'localhost'}/cico-api/index.php`;
}

export const API_BASE = resolveBase();

/** Public URL of a profile photo ("avatar/<key>" as returned by the API). */
export const fileUrl = (path?: string | null) => (path ? `${API_BASE}/${path}` : undefined);

export type ApiOk<T> = { ok: true } & T;
export type ApiFail = { ok: false; error: string; status: number };

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const setApiToken = (t: string | null) => {
  token = t;
};
/** Called when the server rejects the saved session (expired, or wiped by a reset). */
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};

// Generous on purpose: a free hosting plan can need up to a minute to wake up after being idle.
const TIMEOUT_MS = 45_000;

/** Never throws: network trouble comes back as { ok: false, status: 0 }. */
export async function api<T = object>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<ApiOk<T> | ApiFail> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const sentToken = token;
  try {
    const res = await fetch(API_BASE + path, {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(sentToken ? { Authorization: `Bearer ${sentToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let json: Record<string, unknown> | null = null;
    try {
      json = await res.json();
    } catch {
      /* not JSON – handled below */
    }
    if (!json) return { ok: false, status: res.status, error: `The server sent an unexpected reply (HTTP ${res.status}). Please try again in a moment.` };
    if (res.status === 401 && sentToken && sentToken === token) onUnauthorized?.();
    if (json.ok === false || !res.ok) return { ok: false, status: res.status, error: String(json.error ?? `Request failed (HTTP ${res.status}).`) };
    return json as ApiOk<T>;
  } catch {
    return { ok: false, status: 0, error: `Can't reach the CiCo server. Check your internet connection and try again. If it was idle, the server may need up to a minute to wake up.` };
  } finally {
    clearTimeout(timer);
  }
}
