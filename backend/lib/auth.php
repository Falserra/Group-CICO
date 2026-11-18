<?php
declare(strict_types=1);

function bearer_token(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? null;
    if (!$header && function_exists('apache_request_headers')) {
        foreach (apache_request_headers() as $name => $value) {
            if (strcasecmp($name, 'Authorization') === 0) {
                $header = $value;
            }
        }
    }
    return ($header && preg_match('/^Bearer\s+([a-f0-9]{64})$/i', $header, $m)) ? strtolower($m[1]) : null;
}

function issue_token(string $accountId, string $scope, int $ttlSeconds): string
{
    $raw = bin2hex(random_bytes(32));
    $now = now_ms();
    q(
        'INSERT INTO auth_tokens (token_hash, account_id, scope, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
        [hash('sha256', $raw), $accountId, $scope, dt($now), dt($now + $ttlSeconds * 1000)]
    );
    return $raw;
}

function find_token(string $raw, string $scope): ?array
{
    if (!preg_match('/^[a-f0-9]{64}$/', $raw)) {
        return null;
    }
    return one(
        'SELECT * FROM auth_tokens WHERE token_hash = ? AND scope = ? AND expires_at > ?',
        [hash('sha256', $raw), $scope, dt(now_ms())]
    );
}

function load_account(string $id): ?array
{
    return one(
        'SELECT a.*, p.email, p.phone, p.birthdate, p.address, p.avatar_key
           FROM accounts a LEFT JOIN profiles p ON p.account_id = a.id WHERE a.id = ?',
        [$id]
    );
}

/** The signed-in account (with profile columns), or a 401. */
function auth(): array
{
    static $user = null;
    if ($user !== null) {
        return $user;
    }
    $raw = bearer_token() ?? throw new ApiError(401, 'Please log in.');
    $token = find_token($raw, 'session') ?? throw new ApiError(401, 'Your session expired. Please log in again.');
    $row = load_account($token['account_id']) ?? throw new ApiError(401, 'Your session expired. Please log in again.');
    return $user = $row + ['token_hash' => $token['token_hash']];
}

function need_customer(array $u): void
{
    if ($u['role'] !== 'customer') {
        throw new ApiError(403, 'This action is for customer accounts.');
    }
}

function need_admin(array $u): void
{
    if ($u['role'] !== 'admin') {
        throw new ApiError(403, 'Administrators only.');
    }
}

// ---- Lockout after repeated failures (TC-01) --------------------------------------------

/** Seconds left on a lockout, 0 when the user may try. */
function lock_remaining(string $username): int
{
    $row = one('SELECT locked_until FROM login_attempts WHERE username = ?', [$username]);
    if (!$row || $row['locked_until'] === null) {
        return 0;
    }
    return max(0, (int) ceil((to_ms($row['locked_until']) - now_ms()) / 1000));
}

/** Count a failed attempt; returns ['left' => tries remaining, 'locked' => bool]. */
function register_failure(string $username): array
{
    $row = one('SELECT fail_count FROM login_attempts WHERE username = ?', [$username]);
    $count = (int) ($row['fail_count'] ?? 0) + 1;
    $max = (int) cfg('max_attempts');
    $lockedUntil = null;
    if ($count >= $max) {
        $lockedUntil = dt(now_ms() + (int) cfg('lockout_seconds') * 1000);
        $count = 0;
    }
    q(
        'INSERT INTO login_attempts (username, fail_count, locked_until) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE fail_count = VALUES(fail_count), locked_until = VALUES(locked_until)',
        [$username, $count, $lockedUntil]
    );
    return ['left' => $max - $count, 'locked' => $lockedUntil !== null];
}

function clear_failures(string $username): void
{
    q('DELETE FROM login_attempts WHERE username = ?', [$username]);
}

/** A bcrypt hash to verify against when the username doesn't exist, so timing doesn't leak it. */
function dummy_hash(): string
{
    static $hash = null;
    return $hash ??= password_hash('cico-timing-guard', PASSWORD_BCRYPT);
}

function validate_contact(?string $email, ?string $phone): void
{
    if ($email !== null && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new ApiError(422, 'Enter a valid email address.');
    }
    if ($phone !== null && !preg_match('/^[0-9+\-\s()]{7,20}$/', $phone)) {
        throw new ApiError(422, 'Enter a valid mobile number.');
    }
}
