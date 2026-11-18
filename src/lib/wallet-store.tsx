// App state + the operations from the Master File's sequence diagrams.
// The MySQL database behind the PHP API (/backend) is the source of truth. After signing in the
// app downloads one snapshot (GET /sync), shows it, and refreshes it every few seconds, so a
// payment made on one phone shows up on the other. Every change is a call to the API; the server
// checks it (balances, ownership, roles) and the app then re-syncs.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { api, setApiToken, setUnauthorizedHandler } from './api';
import { getItem, removeItem, setItem } from './storage';
import type {
  Account,
  AccountStatus,
  DirectoryAccount,
  Notification,
  PaymentMethod,
  RiskLevel,
  Subscription,
  SuspiciousActivityReport,
  Transaction,
  TxType,
} from './types';
import { billers } from './billers';
import { runRiskAssessment, type RiskResult } from './verification';

const TOKEN_KEY = 'cico_session';
const REMEMBER_KEY = 'cico_remember_username';
const POLL_MS = 4000;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type TxRequest = {
  type: TxType;
  amount: number;
  recipientUsername?: string; // send
  billerId?: string; // bill
  paymentMethodId?: string; // topup
  reference?: string;
  note?: string;
  qrMerchant?: string; // merchant name printed in a scanned counter QR
};

export type Result = { ok: true } | { ok: false; error: string };

/** Everything GET /sync returns for the signed-in user. */
type Snapshot = {
  me: Account;
  accounts: DirectoryAccount[];
  transactions: Transaction[];
  paymentMethods: PaymentMethod[];
  subscriptions: Subscription[];
  reports: SuspiciousActivityReport[];
  notifications: Notification[];
};

export type ProfileForm = { name: string; email: string; phone: string; birthdate: string; address: string };

type Restored = { username: string | null; outcome: { kind: 'guest' } | { kind: 'ok'; data: Snapshot } | { kind: 'error'; error: string } };

/** At launch: find a saved login and, if there is one, ask the server for that user's data. */
async function restoreSession(): Promise<Restored> {
  const [username, saved] = await Promise.all([getItem(REMEMBER_KEY), getItem(TOKEN_KEY)]);
  if (!saved) return { username, outcome: { kind: 'guest' } };
  setApiToken(saved);
  const res = await api<Snapshot & { serverTime: number }>('GET', '/sync');
  if (res.ok) {
    const { ok: _ok, serverTime: _t, ...data } = res;
    return { username, outcome: { kind: 'ok', data } };
  }
  setApiToken(null);
  if (res.status === 401) {
    removeItem(TOKEN_KEY); // expired, or wiped by a reset: back to the login screen
    return { username, outcome: { kind: 'guest' } };
  }
  return { username, outcome: { kind: 'error', error: res.error } }; // server unreachable: keep the token and let the user retry
}

function useWalletState() {
  const [ready, setReady] = useState(false); // saved session checked
  const [loadError, setLoadError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false); // a refresh failed while signed in
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [lastMe, setLastMe] = useState<Account | null>(null); // protected screens render once more during logout
  const [lastRegistered, setLastRegistered] = useState<string | null>(null);
  const [remembered, setRemembered] = useState<string | null>(null);

  const seq = useRef(0); // ignore sync replies that arrive out of order
  const lastJson = useRef(''); // skip re-rendering when nothing changed
  const signedIn = snap !== null;

  const apply = (s: Snapshot) => {
    setSnap(s);
    setLastMe(s.me);
  };

  /** Download the latest snapshot. Returns false when it could not (offline, or session rejected). */
  async function refresh(): Promise<boolean> {
    const mine = ++seq.current;
    const res = await api<Snapshot & { serverTime: number }>('GET', '/sync');
    if (mine !== seq.current) return res.ok; // a newer refresh (or a logout) superseded this one
    if (!res.ok) {
      if (res.status === 0) setOffline(true);
      return false;
    }
    setOffline(false);
    const { ok: _ok, serverTime: _t, ...data } = res;
    const json = JSON.stringify(data);
    if (json !== lastJson.current) {
      lastJson.current = json;
      apply(data);
    }
    return true;
  }

  function clearSession() {
    seq.current++;
    setApiToken(null);
    removeItem(TOKEN_KEY);
    lastJson.current = '';
    setSnap(null);
    setOffline(false);
  }

  // ---- Launch: restore a saved session ----
  const boot = () =>
    restoreSession().then(({ username, outcome }) => {
      setRemembered(username);
      if (outcome.kind === 'error') return setLoadError(outcome.error);
      if (outcome.kind === 'ok') {
        lastJson.current = JSON.stringify(outcome.data);
        apply(outcome.data);
      }
      setReady(true);
    });
  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    boot();
    return () => setUnauthorizedHandler(null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once at launch
  const retryLoad = () => {
    setLoadError(null);
    boot();
  };

  // ---- Keep the snapshot fresh while signed in ----
  useEffect(() => {
    if (!signedIn) return;
    const tick = () => AppState.currentState === 'active' && refresh();
    const timer = setInterval(tick, POLL_MS);
    const sub = AppState.addEventListener('change', (state) => state === 'active' && refresh());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [signedIn]); // eslint-disable-line react-hooks/exhaustive-deps -- refresh only uses refs and setters

  // Run a call, then re-sync so every screen shows what the server now holds.
  async function act<T = object>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown) {
    const res = await api<T>(method, path, body);
    if (res.ok) await refresh();
    return res;
  }
  const toResult = (res: { ok: true } | { ok: false; error: string }): Result => (res.ok ? { ok: true } : { ok: false, error: res.error });

  const me = snap?.me ?? null;
  const accounts = snap?.accounts ?? [];
  const transactionsAll = snap?.transactions ?? [];
  const reports = snap?.reports ?? [];
  const notificationsAll = snap?.notifications ?? [];
  const paymentMethods = snap?.paymentMethods ?? [];

  const accountById = (id: string) => accounts.find((a) => a.id === id);
  const accountByUsername = (u: string) => accounts.find((a) => a.username === u.trim().toLowerCase().replace(/^@/, ''));

  // ---- Authentication (Figure 10): password -> MPIN or biometric ----
  async function validateCredentials(username: string, password: string) {
    const res = await api<{ pendingToken: string; name: string; biometricEnabled: boolean }>('POST', '/auth/login', { username, password });
    return res.ok ? ({ ok: true, pending: { token: res.pendingToken, name: res.name, biometricEnabled: res.biometricEnabled } } as const) : ({ ok: false, error: res.error } as const);
  }

  async function finishLogin(pendingToken: string, factor: { mpin: string } | { biometric: true }): Promise<Result> {
    const res = await api<{ token: string }>('POST', '/auth/verify', { pendingToken, ...factor });
    if (!res.ok) return { ok: false, error: res.error };
    setApiToken(res.token);
    await setItem(TOKEN_KEY, res.token);
    if (!(await refresh())) {
      clearSession();
      return { ok: false, error: "You're signed in, but your data could not be loaded. Check the connection and try again." };
    }
    return { ok: true };
  }

  async function logout() {
    api('POST', '/auth/logout'); // best effort: the token also expires on its own
    clearSession();
  }

  // "Remember me" on the login screen keeps the username between launches.
  const setRememberedUsername = (u: string | null) => {
    setRemembered(u);
    if (u) setItem(REMEMBER_KEY, u);
    else removeItem(REMEMBER_KEY);
  };

  async function register(f: { name: string; username: string; password: string; mpin: string; email?: string; phone?: string }): Promise<Result> {
    const res = await api<{ username: string }>('POST', '/auth/register', f);
    if (!res.ok) return { ok: false, error: res.error };
    setLastRegistered(res.username);
    return { ok: true };
  }

  // ---- Profile ----
  async function updateProfile(f: ProfileForm): Promise<Result> {
    return toResult(await act('PUT', '/me/profile', f));
  }
  /** base64 = the picked photo as base64 (no data: prefix); null removes the photo. */
  async function setAvatar(base64: string | null): Promise<Result> {
    return toResult(await act('POST', '/me/avatar', { image: base64 }));
  }
  async function changePassword(current: string, next: string): Promise<Result> {
    return toResult(await act('POST', '/me/password', { current, next }));
  }
  async function changeMpin(current: string, next: string): Promise<Result> {
    return toResult(await act('POST', '/me/mpin', { current, next }));
  }
  async function setBiometric(enabled: boolean): Promise<Result> {
    return toResult(await act('POST', '/me/biometric', { enabled }));
  }

  // ---- Money movement + verification (Figure 5 / Figure 11) ----
  // The risk check runs on the phone against the public directory, so the warning appears instantly;
  // the server independently enforces balances, frozen accounts and ownership when money moves.
  function verifyTransaction(req: TxRequest): RiskResult & { recipientName?: string; recipientVerified?: boolean; recipientIsMerchant?: boolean } {
    if (!me) return { level: 'red', reasons: ['Not logged in'] };
    if (req.type === 'send') {
      const r = req.recipientUsername ? accountByUsername(req.recipientUsername) : undefined;
      const valid = r && r.role === 'customer' && r.id !== me.id;
      const res = runRiskAssessment({
        type: 'send',
        amount: req.amount,
        balance: me.balance,
        recipientKnown: !!valid,
        recipientVerified: !!r?.verified,
        recipientFrozen: r?.status === 'frozen',
        recipientReported: !!r?.reported,
        firstTimeRecipient: !!r && !transactionsAll.some((t) => t.accountId === me.id && t.type === 'send' && t.counterparty === r.name && t.status === 'completed'),
        note: req.note,
        qrMerchantClaim: req.qrMerchant,
        recipientName: r?.name,
        recipientIsMerchant: r?.kind === 'merchant',
      });
      return { ...res, recipientName: valid ? r.name : undefined, recipientVerified: r?.verified, recipientIsMerchant: r?.kind === 'merchant' };
    }
    if (req.type === 'bill') {
      const b = billers.find((x) => x.id === req.billerId);
      const res = runRiskAssessment({ type: 'bill', amount: req.amount, balance: me.balance, recipientKnown: !!b, recipientVerified: !!b?.verified, recipientFrozen: false, recipientReported: false, firstTimeRecipient: false, note: req.note });
      return { ...res, recipientName: b?.name, recipientVerified: b?.verified };
    }
    const pm = paymentMethods.find((p) => p.id === req.paymentMethodId);
    const res = runRiskAssessment({ type: 'topup', amount: req.amount, balance: me.balance, recipientKnown: true, recipientVerified: true, recipientFrozen: false, recipientReported: false, firstTimeRecipient: false });
    return { ...res, recipientName: pm ? `${pm.label} ${pm.accountNumber}` : undefined, recipientVerified: true };
  }

  // processPayment -> PaymentGateway -> BankPaymentNetwork
  async function processTransaction(req: TxRequest, risk: RiskLevel): Promise<Result & { transactionId?: string }> {
    if (!me) return { ok: false, error: 'Not logged in.' };
    await wait(700); // gateway round trip shown by the "Processing…" step
    const res = await act<{ transactionId: string }>('POST', '/transactions', {
      type: req.type,
      amount: req.amount,
      recipientUsername: req.recipientUsername,
      billerId: req.billerId,
      paymentMethodId: req.paymentMethodId,
      reference: req.reference,
      note: req.note,
      risk,
    });
    if (!res.ok) await refresh(); // a failed attempt is still recorded in the history
    return res.ok ? { ok: true, transactionId: res.transactionId } : { ok: false, error: res.error };
  }

  // User declined a flagged transaction -> cancel it and (optionally) report to admin
  function cancelTransaction(req: TxRequest, risk: RiskLevel, counterparty: string, reasons: string[], report: boolean) {
    if (!me) return;
    act('POST', '/transactions/cancel', {
      type: req.type,
      amount: req.amount,
      counterparty,
      reference: req.reference,
      note: req.note,
      recipientUsername: req.recipientUsername,
      risk,
      reasons,
      report,
    });
  }

  // ---- Subscription Hub (Figure 8 / Figure 13) ----
  async function setSubscriptionStatus(id: string, status: Subscription['status']): Promise<Result> {
    await wait(500); // revokeAccessToken() at ExternalMerchantAPI
    return toResult(await act('POST', `/subscriptions/${id}/status`, { status }));
  }

  // ---- Reports, emergency freeze, admin (Figure 9 / Figure 14) ----
  async function submitReport(r: { description: string; transactionId?: string }): Promise<Result> {
    return toResult(await act('POST', '/reports', r));
  }

  // FR-05 (revised): freeze applied within 3 s. The server freezes the account and files the ticket
  // in a single database transaction; the measured time-to-lock is the full round trip.
  async function emergencyFreeze(): Promise<Result & { ms: number }> {
    const t0 = performance.now();
    if (!me) return { ok: false, error: 'Not logged in.', ms: 0 };
    const res = await api('POST', '/me/freeze');
    const ms = performance.now() - t0;
    if (!res.ok) return { ok: false, error: res.error, ms };
    await refresh();
    return { ok: true, ms };
  }

  function reviewReport(reportId: string, decision: 'freeze' | 'dismiss') {
    act('POST', `/admin/reports/${reportId}/review`, { decision });
  }

  function setAccountStatus(accountId: string, status: AccountStatus) {
    // Only the Security Team can lock or unlock an account.
    if (me?.role === 'admin') act('POST', `/admin/accounts/${accountId}/status`, { status });
  }

  const markAllRead = () => {
    if (!me) return;
    setSnap((s) => s && { ...s, notifications: s.notifications.map((n) => (n.accountId === me.id ? { ...n, read: true } : n)) });
    api('POST', '/notifications/read', {});
  };
  const markRead = (id: string) => {
    setSnap((s) => s && { ...s, notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) });
    api('POST', '/notifications/read', { id });
  };

  // ---- Linked bank accounts and cards (used by Top up) ----
  async function linkAccount(f: { label: string; type: 'bank' | 'card'; number: string }): Promise<Result> {
    return toResult(await act('POST', '/payment-methods', f));
  }
  async function unlinkAccount(id: string): Promise<Result> {
    return toResult(await act('DELETE', `/payment-methods/${id}`));
  }

  return {
    ready,
    loadError,
    retryLoad,
    offline,
    refresh,
    me,
    lastMe,
    lastRegistered,
    accounts,
    accountById,
    accountByUsername,
    transactions: me ? transactionsAll.filter((t) => t.accountId === me.id) : [],
    allTransactions: transactionsAll,
    paymentMethods: me ? paymentMethods : [],
    subscriptions: me ? (snap?.subscriptions ?? []) : [],
    reports,
    notifications: me ? notificationsAll.filter((n) => n.accountId === me.id) : [],
    validateCredentials,
    finishLogin,
    logout,
    rememberedUsername: remembered,
    setRememberedUsername,
    register,
    updateProfile,
    setAvatar,
    changePassword,
    changeMpin,
    setBiometric,
    verifyTransaction,
    processTransaction,
    cancelTransaction,
    setSubscriptionStatus,
    submitReport,
    emergencyFreeze,
    reviewReport,
    setAccountStatus,
    markAllRead,
    markRead,
    linkAccount,
    unlinkAccount,
  };
}

type Wallet = ReturnType<typeof useWalletState>;
const WalletContext = createContext<Wallet | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const value = useWalletState();
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside <WalletProvider>');
  return ctx;
}

// Screens behind Stack.Protected can assume a signed-in user.
export function useMe() {
  return useWallet().lastMe as Account;
}
