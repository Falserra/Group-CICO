// Domain model for CiCo (see Master File §5.2 class diagram). These are the shapes the API returns.

export type Role = 'customer' | 'admin';
export type AccountStatus = 'active' | 'frozen';

// Optional personal details (the user profile). Missing = not filled in yet.
export type Profile = {
  email?: string;
  phone?: string;
  birthdate?: string; // YYYY-MM-DD
  address?: string;
  avatar?: string; // path on the server, e.g. "uploads/avatars/u1_123.jpg" (see fileUrl in api.ts)
};

/** The signed-in user's own account. Passwords and MPINs never leave the server (NFR-01). */
export type Account = {
  id: string;
  name: string;
  username: string;
  role: Role;
  kind: 'personal' | 'merchant'; // merchants are what counter QR codes should point to
  createdAt: number;
  balance: number;
  status: AccountStatus;
  verified: boolean; // shows a verified badge to people sending to this account (FR-03)
  biometricEnabled: boolean;
  profile: Profile;
};

/** Another account as seen in the public directory (used to look up recipients). */
export type DirectoryAccount = {
  id: string;
  name: string;
  username: string;
  role: Role;
  kind: 'personal' | 'merchant';
  verified: boolean;
  status: AccountStatus;
  reported: boolean; // named in an open suspicious-activity report
  avatar?: string;
  // Only sent to administrators:
  balance?: number;
  createdAt?: number;
};

export type TxType = 'send' | 'receive' | 'bill' | 'topup';
export type TxStatus = 'completed' | 'failed' | 'cancelled';
export type RiskLevel = 'green' | 'yellow' | 'red';

export type Transaction = {
  id: string;
  accountId: string; // owner of this record
  type: TxType;
  amount: number;
  counterparty: string; // display name of the other side
  reference?: string; // biller account no., payment method, etc.
  note?: string;
  timestamp: number;
  status: TxStatus;
  risk: RiskLevel;
};

export type PaymentMethod = {
  id: string;
  accountId: string;
  label: string; // e.g. "BPI Savings"
  accountType: 'bank' | 'card';
  accountNumber: string; // masked
};

export type SubscriptionStatus = 'active' | 'blocked' | 'unbound';

export type Subscription = {
  id: string;
  accountId: string;
  merchant: string;
  plan: string;
  amount: number;
  cycle: 'monthly' | 'weekly' | 'yearly';
  linkedOn: number;
  nextCharge: number;
  status: SubscriptionStatus;
};

export type ReportStatus = 'pending' | 'resolved-frozen' | 'dismissed';

export type SuspiciousActivityReport = {
  id: string;
  accountId: string;
  transactionId?: string;
  description: string;
  emergency: boolean; // raised by the 1-tap emergency freeze (FR-05)
  timestamp: number;
  status: ReportStatus;
};

export type Notification = {
  id: string;
  accountId: string;
  message: string;
  kind: 'info' | 'success' | 'warning' | 'security';
  timestamp: number;
  read: boolean;
};

export type Biller = { id: string; name: string; category: string; verified: boolean };
