<?php
declare(strict_types=1);

route('GET', '/me', fn() => ['me' => me_out(auth())]);

// ---- Profile ---------------------------------------------------------------------------------
route('PUT', '/me/profile', function () {
    $u = auth();
    $b = body();
    $name = clip($b['name'] ?? null, 80) ?? throw new ApiError(422, 'Your name cannot be empty.');
    $email = clip($b['email'] ?? null, 190);
    $phone = clip($b['phone'] ?? null, 20);
    $address = clip($b['address'] ?? null, 255);
    $birthdate = clip($b['birthdate'] ?? null, 10);
    validate_contact($email, $phone);
    if ($birthdate !== null) {
        $ok = preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $birthdate, $m)
            && checkdate((int) $m[2], (int) $m[3], (int) $m[1])
            && (int) $m[1] >= 1900
            && $birthdate <= gmdate('Y-m-d');
        if (!$ok) {
            throw new ApiError(422, 'Enter your birthdate as YYYY-MM-DD.');
        }
    }

    try {
        in_transaction(function () use ($u, $name, $email, $phone, $birthdate, $address) {
            q('UPDATE accounts SET name = ? WHERE id = ?', [$name, $u['id']]);
            q(
                'INSERT INTO profiles (account_id, email, phone, birthdate, address, avatar_key, updated_at) VALUES (?, ?, ?, ?, ?, NULL, ?)
                 ON DUPLICATE KEY UPDATE email = VALUES(email), phone = VALUES(phone), birthdate = VALUES(birthdate),
                                         address = VALUES(address), updated_at = VALUES(updated_at)',
                [$u['id'], $email, $phone, $birthdate, $address, dt(now_ms())]
            );
        });
    } catch (PDOException $e) {
        if (($e->errorInfo[1] ?? 0) === 1062) {
            throw new ApiError(409, 'That email is already used by another account.');
        }
        throw $e;
    }
    return ['me' => me_out(load_account($u['id']))];
});

route('POST', '/me/avatar', function () {
    $u = auth();
    $image = body()['image'] ?? null;

    if ($image === null) { // remove the photo
        q('UPDATE profiles SET avatar_data = NULL, avatar_mime = NULL, avatar_key = NULL, updated_at = ? WHERE account_id = ?', [dt(now_ms()), $u['id']]);
        return ['avatar' => null];
    }

    $binary = base64_decode(preg_replace('#^data:image/[\w.+-]+;base64,#', '', (string) $image), true);
    if ($binary === false || $binary === '') {
        throw new ApiError(422, 'That photo could not be read.');
    }
    if (strlen($binary) > (int) cfg('max_avatar_kb') * 1024) {
        throw new ApiError(422, 'That photo is too large (max ' . round((int) cfg('max_avatar_kb') / 1024) . ' MB).');
    }
    $info = @getimagesizefromstring($binary);
    $mime = $info['mime'] ?? '';
    if (!in_array($mime, ['image/jpeg', 'image/png'], true)) {
        throw new ApiError(422, 'Use a JPEG or PNG photo.');
    }
    if ($info[0] > 4096 || $info[1] > 4096) {
        throw new ApiError(422, 'That photo is too large. Pick one under 4096 px.');
    }

    $key = bin2hex(random_bytes(8)); // new key per upload: the old URL stops working and caches refresh
    q(
        'INSERT INTO profiles (account_id, avatar_data, avatar_mime, avatar_key, updated_at) VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE avatar_data = VALUES(avatar_data), avatar_mime = VALUES(avatar_mime),
                                 avatar_key = VALUES(avatar_key), updated_at = VALUES(updated_at)',
        [$u['id'], $binary, $mime, $key, dt(now_ms())]
    );
    return ['avatar' => avatar_path($key)];
});

// Profile photos are public by their unguessable key (an <Image> can't send a login header).
route('GET', '/avatar/{key}', function (array $p) {
    $row = one('SELECT avatar_data, avatar_mime FROM profiles WHERE avatar_key = ?', [$p['key']]);
    if (!$row || $row['avatar_data'] === null) {
        throw new ApiError(404, 'No such photo.');
    }
    send_binary($row['avatar_data'], $row['avatar_mime']);
});

// ---- Credentials -----------------------------------------------------------------------------
route('POST', '/me/password', function () {
    $u = auth();
    $b = body();
    $next = (string) ($b['next'] ?? '');
    if (lock_remaining($u['username']) > 0) {
        throw new ApiError(429, 'Too many failed attempts. Try again in a minute.');
    }
    if (!password_verify((string) ($b['current'] ?? ''), $u['password_hash'])) {
        register_failure($u['username']);
        throw new ApiError(401, 'Your current password is incorrect.');
    }
    if (strlen($next) < 6 || strlen($next) > 72) {
        throw new ApiError(422, 'Use 6–72 characters for your new password.');
    }
    clear_failures($u['username']);
    q('UPDATE accounts SET password_hash = ? WHERE id = ?', [password_hash($next, PASSWORD_BCRYPT), $u['id']]);
    q('DELETE FROM auth_tokens WHERE account_id = ? AND token_hash <> ?', [$u['id'], $u['token_hash']]); // sign out other devices
    notify($u['id'], 'Your password was changed. If this was not you, freeze your wallet and contact the Security Team.', 'security');
    return [];
});

route('POST', '/me/mpin', function () {
    $u = auth();
    $b = body();
    $next = (string) ($b['next'] ?? '');
    if (lock_remaining($u['username']) > 0) {
        throw new ApiError(429, 'Too many failed attempts. Try again in a minute.');
    }
    if (!password_verify((string) ($b['current'] ?? ''), $u['mpin_hash'])) {
        register_failure($u['username']);
        throw new ApiError(401, 'Your current MPIN is incorrect.');
    }
    if (!preg_match('/^\d{6}$/', $next)) {
        throw new ApiError(422, 'Your new MPIN must be exactly 6 digits.');
    }
    clear_failures($u['username']);
    q('UPDATE accounts SET mpin_hash = ? WHERE id = ?', [password_hash($next, PASSWORD_BCRYPT), $u['id']]);
    notify($u['id'], 'Your MPIN was changed. If this was not you, freeze your wallet and contact the Security Team.', 'security');
    return [];
});

route('POST', '/me/biometric', function () {
    $u = auth();
    q('UPDATE accounts SET biometric_enabled = ? WHERE id = ?', [empty(body()['enabled']) ? 0 : 1, $u['id']]);
    return ['me' => me_out(load_account($u['id']))];
});

// ---- FR-05 emergency freeze: lock the wallet and file a ticket in one atomic step ----------
route('POST', '/me/freeze', function () {
    $u = auth();
    need_customer($u);
    in_transaction(function () use ($u) {
        q("UPDATE accounts SET status = 'frozen' WHERE id = ?", [$u['id']]);
        q(
            "INSERT INTO reports (id, account_id, transaction_id, description, emergency, created_at, status) VALUES (?, ?, NULL, ?, 1, ?, 'pending')",
            [new_id('r'), $u['id'], 'User activated 1-tap emergency freeze. All outgoing funds locked pending review.', dt(now_ms())]
        );
        notify_admins("New EMERGENCY report from {$u['name']}.");
        notify($u['id'], 'Your wallet is frozen. No money can leave your account until the Security Team unlocks it.', 'security');
    });
    return [];
});
