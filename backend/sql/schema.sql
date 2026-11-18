-- CiCo database schema (MySQL 8 / MariaDB 10.4+, InnoDB, utf8mb4).
-- Created by setup.php; you can also import this file in phpMyAdmin (select the `cico` database first).
-- All timestamps are DATETIME(3) in UTC; the API converts them to epoch milliseconds for the app.

CREATE TABLE IF NOT EXISTS accounts (
  id                VARCHAR(32)  NOT NULL,
  name              VARCHAR(80)  NOT NULL,
  username          VARCHAR(30)  NOT NULL,
  password_hash     VARCHAR(255) NOT NULL,
  mpin_hash         VARCHAR(255) NOT NULL,
  role              ENUM('customer','admin')    NOT NULL DEFAULT 'customer',
  kind              ENUM('personal','merchant') NOT NULL DEFAULT 'personal',
  balance           DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  status            ENUM('active','frozen')     NOT NULL DEFAULT 'active',
  verified          TINYINT(1)   NOT NULL DEFAULT 0,
  biometric_enabled TINYINT(1)   NOT NULL DEFAULT 0,
  created_at        DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_accounts_username (username),
  CONSTRAINT chk_accounts_balance CHECK (balance >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One profile per account (name lives on accounts so it can be shown without a join).
CREATE TABLE IF NOT EXISTS profiles (
  account_id  VARCHAR(32)  NOT NULL,
  email       VARCHAR(190) NULL,
  phone       VARCHAR(20)  NULL,
  birthdate   DATE         NULL,
  address     VARCHAR(255) NULL,
  -- Profile photo lives in the database (hosts like Render wipe local files on restart).
  -- avatar_key is a random per-upload key used in the photo's URL, so it can't be guessed.
  avatar_data MEDIUMBLOB   NULL,
  avatar_mime VARCHAR(30)  NULL,
  avatar_key  CHAR(16)     NULL,
  updated_at  DATETIME(3)  NOT NULL,
  PRIMARY KEY (account_id),
  UNIQUE KEY uq_profiles_email (email),
  UNIQUE KEY uq_profiles_avatar_key (avatar_key),
  CONSTRAINT fk_profiles_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Login sessions. Only the SHA-256 of the token is stored. scope 'mfa' = password accepted,
-- waiting for the MPIN / biometric step (short-lived).
CREATE TABLE IF NOT EXISTS auth_tokens (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  token_hash CHAR(64)    NOT NULL,
  account_id VARCHAR(32) NOT NULL,
  scope      ENUM('session','mfa') NOT NULL,
  created_at DATETIME(3) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tokens_hash (token_hash),
  KEY idx_tokens_account (account_id),
  CONSTRAINT fk_tokens_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Failed password / MPIN attempts per username (lockout after repeated failures).
CREATE TABLE IF NOT EXISTS login_attempts (
  username     VARCHAR(30) NOT NULL,
  fail_count   INT         NOT NULL DEFAULT 0,
  locked_until DATETIME(3) NULL,
  PRIMARY KEY (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS billers (
  id       VARCHAR(32) NOT NULL,
  name     VARCHAR(80) NOT NULL,
  category VARCHAR(40) NOT NULL,
  verified TINYINT(1)  NOT NULL DEFAULT 0,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transactions (
  id           VARCHAR(32)   NOT NULL,
  account_id   VARCHAR(32)   NOT NULL,
  type         ENUM('send','receive','bill','topup')        NOT NULL,
  amount       DECIMAL(12,2) NOT NULL,
  counterparty VARCHAR(160)  NOT NULL,
  reference    VARCHAR(80)   NULL,
  note         VARCHAR(255)  NULL,
  created_at   DATETIME(3)   NOT NULL,
  status       ENUM('completed','failed','cancelled')       NOT NULL,
  risk         ENUM('green','yellow','red')                 NOT NULL DEFAULT 'green',
  PRIMARY KEY (id),
  KEY idx_tx_account_time (account_id, created_at),
  KEY idx_tx_risk (risk),
  CONSTRAINT chk_tx_amount CHECK (amount > 0),
  CONSTRAINT fk_tx_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_methods (
  id             VARCHAR(32) NOT NULL,
  account_id     VARCHAR(32) NOT NULL,
  label          VARCHAR(60) NOT NULL,
  account_type   ENUM('bank','card') NOT NULL,
  account_number VARCHAR(30) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_pm_account (account_id),
  CONSTRAINT fk_pm_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscriptions (
  id          VARCHAR(32)   NOT NULL,
  account_id  VARCHAR(32)   NOT NULL,
  merchant    VARCHAR(80)   NOT NULL,
  plan        VARCHAR(80)   NOT NULL,
  amount      DECIMAL(12,2) NOT NULL,
  cycle       ENUM('monthly','weekly','yearly')     NOT NULL,
  linked_on   DATETIME(3)   NOT NULL,
  next_charge DATETIME(3)   NOT NULL,
  status      ENUM('active','blocked','unbound')    NOT NULL DEFAULT 'active',
  PRIMARY KEY (id),
  KEY idx_sub_account (account_id),
  CONSTRAINT fk_sub_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reports (
  id             VARCHAR(32) NOT NULL,
  account_id     VARCHAR(32) NOT NULL,
  transaction_id VARCHAR(32) NULL,
  description    TEXT        NOT NULL,
  emergency      TINYINT(1)  NOT NULL DEFAULT 0,
  created_at     DATETIME(3) NOT NULL,
  status         ENUM('pending','resolved-frozen','dismissed') NOT NULL DEFAULT 'pending',
  PRIMARY KEY (id),
  KEY idx_reports_account (account_id),
  KEY idx_reports_status (status),
  CONSTRAINT fk_reports_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id         VARCHAR(32)  NOT NULL,
  account_id VARCHAR(32)  NOT NULL,
  message    VARCHAR(500) NOT NULL,
  kind       ENUM('info','success','warning','security') NOT NULL DEFAULT 'info',
  created_at DATETIME(3)  NOT NULL,
  is_read    TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_notif_account_time (account_id, created_at),
  CONSTRAINT fk_notif_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
