<?php
declare(strict_types=1);

// ---- Report review (Figure 9 / Figure 14) -----------------------------------------------------------
route('POST', '/admin/reports/{id}/review', function (array $p) {
    $u = auth();
    need_admin($u);
    $decision = (string) (body()['decision'] ?? '');
    if (!in_array($decision, ['freeze', 'dismiss'], true)) {
        throw new ApiError(422, 'Decision must be freeze or dismiss.');
    }
    $report = one('SELECT id, account_id FROM reports WHERE id = ?', [$p['id']]) ?? throw new ApiError(404, 'Report not found.');

    in_transaction(function () use ($report, $decision) {
        q('UPDATE reports SET status = ? WHERE id = ?', [$decision === 'freeze' ? 'resolved-frozen' : 'dismissed', $report['id']]);
        if ($decision === 'freeze') {
            q("UPDATE accounts SET status = 'frozen' WHERE id = ? AND role = 'customer'", [$report['account_id']]);
            notify($report['account_id'], 'Your report was confirmed. Your account has been frozen to protect your funds.', 'security');
        } else {
            notify($report['account_id'], 'Your report was reviewed by the Security Team and closed.', 'info');
        }
    });
    return [];
});

// ---- Freeze / unlock any customer account --------------------------------------------------------------
route('POST', '/admin/accounts/{id}/status', function (array $p) {
    $u = auth();
    need_admin($u);
    $status = (string) (body()['status'] ?? '');
    if (!in_array($status, ['active', 'frozen'], true)) {
        throw new ApiError(422, 'Status must be active or frozen.');
    }
    $target = one("SELECT id FROM accounts WHERE id = ? AND role = 'customer'", [$p['id']]) ?? throw new ApiError(404, 'Account not found.');
    q('UPDATE accounts SET status = ? WHERE id = ?', [$status, $target['id']]);
    notify($target['id'], $status === 'frozen' ? 'Your account was frozen by the Security Team.' : 'Your account was unlocked by the Security Team.', 'security');
    return [];
});
