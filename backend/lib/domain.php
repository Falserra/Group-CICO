<?php
declare(strict_types=1);

// Small building blocks shared by several routes.

function err(string $message): array
{
    return ['ok' => false, 'error' => $message];
}

function record_tx(string $accountId, string $type, int $cents, string $counterparty, ?string $reference, ?string $note, string $status, string $risk): string
{
    $id = new_id('t');
    q(
        'INSERT INTO transactions (id, account_id, type, amount, counterparty, reference, note, created_at, status, risk)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [$id, $accountId, $type, cents_str($cents), mb_substr($counterparty, 0, 160), $reference, $note, dt(now_ms()), $status, $risk]
    );
    return $id;
}

/** File a suspicious-activity report and alert every administrator. */
function create_report(string $accountId, string $accountName, string $description, ?string $transactionId, bool $emergency): string
{
    $id = new_id('r');
    q(
        "INSERT INTO reports (id, account_id, transaction_id, description, emergency, created_at, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')",
        [$id, $accountId, $transactionId, $description, $emergency ? 1 : 0, dt(now_ms())]
    );
    notify_admins('New ' . ($emergency ? 'EMERGENCY ' : '') . "report from {$accountName}.");
    return $id;
}
