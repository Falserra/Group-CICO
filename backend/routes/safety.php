<?php
declare(strict_types=1);

// ---- Subscription Hub (Figure 8 / Figure 13) --------------------------------------------------
route('POST', '/subscriptions/{id}/status', function (array $p) {
    $u = auth();
    need_customer($u);
    $status = (string) (body()['status'] ?? '');
    if (!in_array($status, ['active', 'blocked', 'unbound'], true)) {
        throw new ApiError(422, 'Unknown subscription status.');
    }
    $sub = one('SELECT merchant FROM subscriptions WHERE id = ? AND account_id = ?', [$p['id'], $u['id']])
        ?? throw new ApiError(404, 'Unable to revoke access');
    q('UPDATE subscriptions SET status = ? WHERE id = ?', [$status, $p['id']]);
    $verb = match ($status) {
        'unbound' => 'unbound and its access token revoked',
        'blocked' => 'blocked from auto-deducting',
        default => 'allowed to auto-deduct again',
    };
    notify($u['id'], "{$sub['merchant']} was {$verb}.", $status === 'active' ? 'info' : 'security');
    return [];
});

// ---- Reports ------------------------------------------------------------------------------------
route('POST', '/reports', function () {
    $u = auth();
    need_customer($u);
    $b = body();
    $description = clip($b['description'] ?? null, 1000) ?? throw new ApiError(422, 'Describe what happened.');
    $transactionId = clip($b['transactionId'] ?? null, 32);
    if ($transactionId !== null && !one('SELECT 1 FROM transactions WHERE id = ? AND account_id = ?', [$transactionId, $u['id']])) {
        throw new ApiError(404, 'That transaction was not found.');
    }
    return ['reportId' => create_report($u['id'], $u['name'], $description, $transactionId, false)];
});

// ---- Notifications --------------------------------------------------------------------------------
route('POST', '/notifications/read', function () {
    $u = auth();
    $id = clip(body()['id'] ?? null, 32);
    if ($id === null) {
        q('UPDATE notifications SET is_read = 1 WHERE account_id = ?', [$u['id']]);
    } else {
        q('UPDATE notifications SET is_read = 1 WHERE account_id = ? AND id = ?', [$u['id'], $id]);
    }
    return [];
});
