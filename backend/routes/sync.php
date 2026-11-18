<?php
declare(strict_types=1);

// One call that returns everything the signed-in user's screens need. The app polls this.
// Customers get their own records plus a public directory (for recipient look-ups);
// administrators get every account, report, transaction and test result.
route('GET', '/sync', function () {
    $u = auth();
    $admin = $u['role'] === 'admin';
    $id = $u['id'];

    $directory = all(
        "SELECT a.id, a.name, a.username, a.role, a.kind, a.verified, a.status, a.balance, a.created_at, p.avatar_key,
                EXISTS (SELECT 1 FROM reports r WHERE r.status <> 'dismissed' AND r.description LIKE CONCAT('%@', a.username, '%')) AS reported
           FROM accounts a LEFT JOIN profiles p ON p.account_id = a.id
          ORDER BY a.created_at, a.id"
    );

    // $mine: rows owned by this user; administrators see everyone's.
    $scope = static fn(string $table, string $order, int $limit) => $admin
        ? all("SELECT * FROM $table ORDER BY $order LIMIT $limit")
        : all("SELECT * FROM $table WHERE account_id = ? ORDER BY $order LIMIT $limit", [$id]);

    return [
        'serverTime' => now_ms(),
        'me' => me_out($u),
        'accounts' => array_map(static fn($r) => directory_out($r, $admin), $directory),
        'transactions' => array_map('tx_out', $scope('transactions', 'created_at DESC', 1000)),
        'paymentMethods' => array_map('pm_out', all('SELECT * FROM payment_methods WHERE account_id = ? ORDER BY id', [$id])),
        'subscriptions' => array_map('sub_out', all('SELECT * FROM subscriptions WHERE account_id = ? ORDER BY linked_on', [$id])),
        'reports' => array_map('report_out', $scope('reports', 'created_at DESC', 500)),
        'notifications' => array_map('notif_out', all('SELECT * FROM notifications WHERE account_id = ? ORDER BY created_at DESC LIMIT 200', [$id])),
    ];
});
