<?php
declare(strict_types=1);

route('GET', '/health', function () {
    one('SELECT 1 AS up');
    return ['status' => 'up', 'time' => now_ms()];
});

// ---- Registration -------------------------------------------------------------------------
route('POST', '/auth/register', function () {
    $b = body();
    $name = clip($b['name'] ?? null, 80);
    $username = norm_username($b['username'] ?? '');
    $password = (string) ($b['password'] ?? '');
    $mpin = (string) ($b['mpin'] ?? '');
    $email = clip($b['email'] ?? null, 190);
    $phone = clip($b['phone'] ?? null, 20);

    if ($name === null || $username === '') {
        throw new ApiError(422, 'Enter your full name and a username.');
    }
    if (!preg_match('/^[a-z0-9_.]{3,20}$/', $username)) {
        throw new ApiError(422, 'Use 3–20 letters, numbers, dots or underscores for the username.');
    }
    if (strlen($password) < 6 || strlen($password) > 72) {
        throw new ApiError(422, 'Use 6–72 characters for your password.');
    }
    if (!preg_match('/^\d{6}$/', $mpin)) {
        throw new ApiError(422, 'Your MPIN must be exactly 6 digits.');
    }
    validate_contact($email, $phone);
    if (one('SELECT 1 FROM accounts WHERE username = ?', [$username])) {
        throw new ApiError(409, 'Username taken. Pick a different username.');
    }

    $id = new_id('u');
    $now = now_ms();
    try {
        in_transaction(function () use ($id, $name, $username, $password, $mpin, $email, $phone, $now) {
            q(
                "INSERT INTO accounts (id, name, username, password_hash, mpin_hash, role, kind, balance, status, verified, biometric_enabled, created_at)
                 VALUES (?, ?, ?, ?, ?, 'customer', 'personal', ?, 'active', 0, 0, ?)",
                [$id, $name, $username, password_hash($password, PASSWORD_BCRYPT), password_hash($mpin, PASSWORD_BCRYPT), '0.00', dt($now)]
            );
            q(
                'INSERT INTO profiles (account_id, email, phone, birthdate, address, avatar_key, updated_at) VALUES (?, ?, ?, NULL, NULL, NULL, ?)',
                [$id, $email, $phone, dt($now)]
            );
            if (cfg('sandbox_kit')) {
                sandbox_kit($id, $now);
            }
            welcome_notifications($id);
        });
    } catch (PDOException $e) {
        if (($e->errorInfo[1] ?? 0) === 1062) {
            throw new ApiError(409, str_contains($e->getMessage(), 'email') ? 'That email is already registered.' : 'Username taken. Pick a different username.');
        }
        throw $e;
    }
    return ['username' => $username];
});

// ---- Login: step 1, password -------------------------------------------------------------
route('POST', '/auth/login', function () {
    $b = body();
    $username = mb_substr(norm_username($b['username'] ?? ''), 0, 30);
    $password = (string) ($b['password'] ?? '');

    $secs = lock_remaining($username);
    if ($secs > 0) {
        throw new ApiError(429, "Too many failed attempts. Try again in {$secs}s.");
    }
    $account = one('SELECT id, name, password_hash, biometric_enabled FROM accounts WHERE username = ?', [$username]);
    $valid = password_verify($password, $account['password_hash'] ?? dummy_hash());
    if (!$account || !$valid) {
        $f = register_failure($username);
        if ($f['locked']) {
            throw new ApiError(429, 'Too many failed attempts. Try again in ' . cfg('lockout_seconds') . 's.');
        }
        $hint = $f['left'] < (int) cfg('max_attempts') ? " {$f['left']} attempt(s) left." : '';
        throw new ApiError(401, 'Invalid username or password.' . $hint);
    }

    q('DELETE FROM auth_tokens WHERE expires_at < ?', [dt(now_ms())]); // housekeeping
    return [
        'pendingToken' => issue_token($account['id'], 'mfa', (int) cfg('mfa_minutes') * 60),
        'name' => $account['name'],
        'biometricEnabled' => (bool) $account['biometric_enabled'],
    ];
});

// ---- Login: step 2, MPIN (or biometric, verified on the phone) -----------------------------
route('POST', '/auth/verify', function () {
    $b = body();
    $pending = find_token((string) ($b['pendingToken'] ?? ''), 'mfa')
        ?? throw new ApiError(401, 'Your login timed out. Please start again.');
    $account = one('SELECT id, username, mpin_hash, biometric_enabled FROM accounts WHERE id = ?', [$pending['account_id']]);
    if (!$account) {
        throw new ApiError(401, 'Your login timed out. Please start again.');
    }

    $secs = lock_remaining($account['username']);
    if ($secs > 0) {
        throw new ApiError(429, "Too many failed attempts. Try again in {$secs}s.");
    }
    if (!empty($b['biometric'])) {
        // The phone checked the fingerprint / face; the server only accepts it if the user opted in.
        if (!$account['biometric_enabled']) {
            throw new ApiError(403, 'Biometric login is not enabled for this account.');
        }
    } elseif (!password_verify((string) ($b['mpin'] ?? ''), $account['mpin_hash'])) {
        $f = register_failure($account['username']);
        throw $f['locked']
            ? new ApiError(429, 'Too many failed attempts. Login locked for ' . cfg('lockout_seconds') . 's.')
            : new ApiError(401, "Incorrect MPIN. {$f['left']} attempt(s) left.");
    }

    clear_failures($account['username']);
    q('DELETE FROM auth_tokens WHERE id = ?', [$pending['id']]);
    return ['token' => issue_token($account['id'], 'session', (int) cfg('session_days') * 86400)];
});

route('POST', '/auth/logout', function () {
    $u = auth();
    q('DELETE FROM auth_tokens WHERE token_hash = ?', [$u['token_hash']]);
    return [];
});
