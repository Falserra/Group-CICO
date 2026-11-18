<?php
declare(strict_types=1);

// Money movement (Figure 5 / Figure 11). Every transfer runs in one database transaction with the
// affected account rows locked, so balances can never go negative or be double-spent, even when
// two phones pay the same wallet at the same moment.

route('POST', '/transactions', function () {
    $u = auth();
    need_customer($u);
    $b = body();
    $type = (string) ($b['type'] ?? '');
    if (!in_array($type, ['send', 'bill', 'topup'], true)) {
        throw new ApiError(422, 'Unknown transaction type.');
    }
    $cents = parse_cents($b['amount'] ?? null)
        ?? throw new ApiError(422, 'Enter an amount between ₱0.01 and ' . peso((int) cfg('max_amount') * 100) . '.');
    $risk = in_array($b['risk'] ?? '', ['green', 'yellow', 'red'], true) ? $b['risk'] : 'green';

    return in_transaction(fn() => process_money($u['id'], $type, $cents, $risk, $b));
});

function process_money(string $meId, string $type, int $cents, string $risk, array $b): array
{
    $reference = clip($b['reference'] ?? null, 80);
    $note = clip($b['note'] ?? null, 255);

    $recipientId = null;
    if ($type === 'send') {
        $row = one('SELECT id FROM accounts WHERE username = ?', [norm_username($b['recipientUsername'] ?? '')]);
        $recipientId = $row['id'] ?? null;
    }

    // Lock the affected accounts in a fixed order so two simultaneous payments can't deadlock.
    $ids = array_values(array_unique(array_filter([$meId, $recipientId])));
    sort($ids);
    $locked = [];
    $rows = all('SELECT id, name, role, status, balance FROM accounts WHERE id IN (' . implode(',', array_fill(0, count($ids), '?')) . ') ORDER BY id FOR UPDATE', $ids);
    foreach ($rows as $r) {
        $locked[$r['id']] = $r;
    }
    $me = $locked[$meId];
    $balance = to_cents($me['balance']);

    if ($me['status'] === 'frozen') {
        return err('Your account is frozen. Contact support to unlock it.');
    }

    if ($type === 'send') {
        $to = $recipientId ? ($locked[$recipientId] ?? null) : null;
        if (!$to || $to['role'] !== 'customer' || $to['id'] === $meId) {
            return err('Recipient not found.');
        }
        if ($cents > $balance) {
            record_tx($meId, 'send', $cents, $to['name'], $reference, $note, 'failed', $risk);
            return err('Insufficient balance.');
        }
        if ($to['status'] === 'frozen') {
            record_tx($meId, 'send', $cents, $to['name'], $reference, $note, 'failed', $risk);
            return err('The recipient account cannot receive funds right now.');
        }
        q('UPDATE accounts SET balance = balance - ? WHERE id = ?', [cents_str($cents), $meId]);
        q('UPDATE accounts SET balance = balance + ? WHERE id = ?', [cents_str($cents), $to['id']]);
        $id = record_tx($meId, 'send', $cents, $to['name'], $reference, $note, 'completed', $risk);
        record_tx($to['id'], 'receive', $cents, $me['name'], $reference, $note, 'completed', $risk);
        notify($meId, 'You sent ' . peso($cents) . " to {$to['name']}.", 'success');
        notify($to['id'], 'You received ' . peso($cents) . " from {$me['name']}.", 'success');
        return ['transactionId' => $id];
    }

    if ($type === 'bill') {
        $biller = one('SELECT name FROM billers WHERE id = ?', [(string) ($b['billerId'] ?? '')]);
        if (!$biller) {
            return err('Biller not found.');
        }
        if ($reference === null || !preg_match('/^\d{6,15}$/', $reference)) {
            return err('Enter the 6–15 digit account number from your bill.');
        }
        if ($cents > $balance) {
            record_tx($meId, 'bill', $cents, $biller['name'], $reference, $note, 'failed', $risk);
            return err('Insufficient balance.');
        }
        q('UPDATE accounts SET balance = balance - ? WHERE id = ?', [cents_str($cents), $meId]);
        $id = record_tx($meId, 'bill', $cents, $biller['name'], $reference, $note, 'completed', $risk);
        notify($meId, 'Paid ' . peso($cents) . " to {$biller['name']}.", 'success');
        return ['transactionId' => $id];
    }

    // top up
    $method = one('SELECT label, account_number FROM payment_methods WHERE id = ? AND account_id = ?', [(string) ($b['paymentMethodId'] ?? ''), $meId]);
    if (!$method) {
        return err('Choose a funding source.');
    }
    q('UPDATE accounts SET balance = balance + ? WHERE id = ?', [cents_str($cents), $meId]);
    $id = record_tx($meId, 'topup', $cents, $method['label'], $method['account_number'], null, 'completed', $risk);
    notify($meId, 'Topped up ' . peso($cents) . " from {$method['label']}.", 'success');
    return ['transactionId' => $id];
}

// The user declined (or abandoned) a payment: keep a record of it, and optionally report it.
route('POST', '/transactions/cancel', function () {
    $u = auth();
    need_customer($u);
    $b = body();
    $type = (string) ($b['type'] ?? '');
    if (!in_array($type, ['send', 'bill', 'topup'], true)) {
        throw new ApiError(422, 'Unknown transaction type.');
    }
    $cents = parse_cents($b['amount'] ?? null) ?? throw new ApiError(422, 'Invalid amount.');
    $risk = in_array($b['risk'] ?? '', ['green', 'yellow', 'red'], true) ? $b['risk'] : 'green';
    $counterparty = clip($b['counterparty'] ?? null, 160) ?? 'Unknown';

    return in_transaction(function () use ($u, $b, $type, $cents, $risk, $counterparty) {
        $id = record_tx($u['id'], $type, $cents, $counterparty, clip($b['reference'] ?? null, 80), clip($b['note'] ?? null, 255), 'cancelled', $risk);
        if (!empty($b['report'])) {
            $reasons = array_filter(array_map(static fn($r) => clip($r, 200), is_array($b['reasons'] ?? null) ? $b['reasons'] : []));
            $uname = norm_username($b['recipientUsername'] ?? '');
            $target = $uname !== '' ? " to @{$uname}" : '';
            create_report(
                $u['id'],
                $u['name'],
                "Auto-report: user cancelled a flagged {$type}{$target} (" . peso($cents) . '). Flags: ' . implode('; ', $reasons),
                $id,
                false
            );
        }
        return ['transactionId' => $id];
    });
});
