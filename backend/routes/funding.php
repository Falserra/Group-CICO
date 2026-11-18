<?php
declare(strict_types=1);

// Linked funding sources (a bank account or card used by Top up). Only the last four digits are
// ever stored: the full number is used for validation and then discarded.

route('POST', '/payment-methods', function () {
    $u = auth();
    need_customer($u);
    $b = body();
    $label = clip($b['label'] ?? null, 60) ?? throw new ApiError(422, 'Give this account a name, for example "BPI Savings".');
    $type = (string) ($b['type'] ?? '');
    if (!in_array($type, ['bank', 'card'], true)) {
        throw new ApiError(422, 'Choose bank account or card.');
    }
    $digits = preg_replace('/\D+/', '', (string) ($b['number'] ?? ''));
    if (strlen($digits) < 8 || strlen($digits) > 19) {
        throw new ApiError(422, 'Enter the full account or card number (8-19 digits).');
    }
    if ($type === 'card' && !luhn_valid($digits)) {
        throw new ApiError(422, 'That card number does not look right. Check it and try again.');
    }
    $count = (int) one('SELECT COUNT(*) AS n FROM payment_methods WHERE account_id = ?', [$u['id']])['n'];
    if ($count >= (int) cfg('max_linked')) {
        throw new ApiError(422, 'You can link up to ' . cfg('max_linked') . ' accounts. Remove one first.');
    }
    $id = new_id('pm');
    q(
        'INSERT INTO payment_methods (id, account_id, label, account_type, account_number) VALUES (?, ?, ?, ?, ?)',
        [$id, $u['id'], $label, $type, '•••• ' . substr($digits, -4)]
    );
    notify($u['id'], "{$label} was linked to your wallet.", 'security');
    return ['id' => $id];
});

route('DELETE', '/payment-methods/{id}', function (array $p) {
    $u = auth();
    need_customer($u);
    $row = one('SELECT label FROM payment_methods WHERE id = ? AND account_id = ?', [$p['id'], $u['id']])
        ?? throw new ApiError(404, 'That account is not linked.');
    q('DELETE FROM payment_methods WHERE id = ?', [$p['id']]);
    notify($u['id'], "{$row['label']} was removed from your wallet.", 'security');
    return [];
});

/** Luhn checksum, used to catch mistyped card numbers. */
function luhn_valid(string $digits): bool
{
    $sum = 0;
    $alt = false;
    for ($i = strlen($digits) - 1; $i >= 0; $i--) {
        $n = (int) $digits[$i];
        if ($alt) {
            $n *= 2;
            if ($n > 9) {
                $n -= 9;
            }
        }
        $sum += $n;
        $alt = !$alt;
    }
    return $sum % 10 === 0;
}
