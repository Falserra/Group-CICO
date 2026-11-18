<?php
declare(strict_types=1);

// Initial data. A real deployment gets only seed_core(): the biller list and ONE administrator
// whose password you choose at setup time. seed_demo_customers() is for local development
// (setup.php --demo) and creates sample customers with well-known passwords - never use it on
// a server that other people can reach.

const DAY_MS = 86_400_000;

function demo_customers(): array
{
    // id, name, username, password, mpin, kind, balance, verified, [email, phone, birthdate, address]
    return [
        ['u1', 'Demo User', 'cico', '1234', '123456', 'personal', 12500, 1, ['demo.user@cico.ph', '0917 123 4567', '2003-05-14', 'Lapasan, Cagayan de Oro City']],
        ['u2', 'Juan Dela Cruz', 'juan', '1234', '111111', 'personal', 3200, 1, ['juan.delacruz@cico.ph', '0918 222 3344', '2002-09-03', 'Carmen, Cagayan de Oro City']],
        ['u3', 'Maria Santos', 'maria', '1234', '222222', 'personal', 800, 0, ['maria.santos@cico.ph', '0919 555 6677', '2004-01-22', 'Nazareth, Cagayan de Oro City']],
        ['m1', 'Siomai House', 'siomai.house', 'merchant-only', '999999', 'merchant', 0, 1, [null, null, null, 'Divisoria, Cagayan de Oro City']],
        ['m2', 'Café Amihan', 'cafe.amihan', 'merchant-only', '999999', 'merchant', 0, 1, [null, null, null, 'Limketkai, Cagayan de Oro City']],
        ['u4', 'Benjie Robles', 'benjie.r', 'scammer-only', '999999', 'personal', 0, 0, [null, null, null, null]],
    ];
}

function core_billers(): array
{
    return [
        ['b1', 'Meralco', 'Electricity', 1],
        ['b2', 'Maynilad', 'Water', 1],
        ['b3', 'PLDT Home', 'Internet', 1],
        ['b4', 'Globe At Home', 'Internet', 1],
        ['b5', 'USTP Tuition', 'School', 1],
    ];
}

/** Sample linked bank/card and auto-deductions (development convenience only; see config sandbox_kit). */
function sandbox_kit(string $accountId, int $now): void
{
    foreach ([['BPI Savings', 'bank', '•••• 4821'], ['Visa Debit', 'card', '•••• 1123']] as [$label, $type, $number]) {
        q(
            'INSERT INTO payment_methods (id, account_id, label, account_type, account_number) VALUES (?, ?, ?, ?, ?)',
            [new_id('pm'), $accountId, $label, $type, $number]
        );
    }
    $subs = [
        ['NovelNest', 'VIP Reader', 149, 'weekly', -40, 2],
        ['Spotify', 'Premium Student', 75, 'monthly', -90, 12],
        ['Mobile Legends', 'Weekly Diamond Pass', 99, 'weekly', -10, 4],
    ];
    foreach ($subs as [$merchant, $plan, $amount, $cycle, $linked, $next]) {
        q(
            'INSERT INTO subscriptions (id, account_id, merchant, plan, amount, cycle, linked_on, next_charge, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [new_id('s'), $accountId, $merchant, $plan, cents_str($amount * 100), $cycle, dt($now + $linked * DAY_MS), dt($now + $next * DAY_MS), 'active']
        );
    }
}

function welcome_notifications(string $accountId): void
{
    notify($accountId, 'Welcome to CiCo! Link a bank account or card under Pay → Top up to add money to your wallet.', 'info');
    notify($accountId, 'Tip: CiCo will never ask for your OTP or MPIN, and never asks you to share your screen.', 'security');
}

function insert_account(string $id, string $name, string $username, string $password, string $mpin, string $role, string $kind, int $balance, int $verified, int $createdAt, array $profile = [null, null, null, null]): void
{
    q(
        "INSERT INTO accounts (id, name, username, password_hash, mpin_hash, role, kind, balance, status, verified, biometric_enabled, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, 0, ?)",
        [$id, $name, $username, password_hash($password, PASSWORD_BCRYPT), password_hash($mpin, PASSWORD_BCRYPT), $role, $kind, cents_str($balance * 100), $verified, dt($createdAt)]
    );
    [$email, $phone, $birthdate, $address] = $profile;
    q(
        'INSERT INTO profiles (account_id, email, phone, birthdate, address, avatar_key, updated_at) VALUES (?, ?, ?, ?, ?, NULL, ?)',
        [$id, $email, $phone, $birthdate, $address, dt(now_ms())]
    );
}

/** Billers and the administrator account. */
function seed_core(string $adminPassword, string $adminMpin): void
{
    in_transaction(function () use ($adminPassword, $adminMpin) {
        foreach (core_billers() as [$id, $name, $category, $verified]) {
            q('INSERT INTO billers (id, name, category, verified) VALUES (?, ?, ?, ?)', [$id, $name, $category, $verified]);
        }
        insert_account('a1', 'Security Admin', 'admin', $adminPassword, $adminMpin, 'admin', 'personal', 0, 1, now_ms(), ['security@cico.ph', null, null, null]);
    });
}

/** Sample customers with history, for local development and screenshots. */
function seed_demo_customers(): void
{
    $now = now_ms();
    in_transaction(function () use ($now) {
        foreach (demo_customers() as [$id, $name, $username, $password, $mpin, $kind, $balance, $verified, $profile]) {
            insert_account($id, $name, $username, $password, $mpin, 'customer', $kind, $balance, $verified, $now - 30 * DAY_MS, $profile);
        }
        $txns = [
            ['t1', 'u1', 'topup', 5000, 'BPI Savings', null, null, -3],
            ['t2', 'u1', 'bill', 1850.75, 'Meralco', '0123456789', null, -2],
            ['t3', 'u1', 'receive', 500, 'Juan Dela Cruz', null, 'Lunch', -1],
            ['t4', 'u2', 'send', 500, 'Demo User', null, 'Lunch', -1],
        ];
        foreach ($txns as [$id, $account, $type, $amount, $counterparty, $reference, $note, $days]) {
            q(
                "INSERT INTO transactions (id, account_id, type, amount, counterparty, reference, note, created_at, status, risk) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', 'green')",
                [$id, $account, $type, cents_str((int) round($amount * 100)), $counterparty, $reference, $note, dt($now + $days * DAY_MS)]
            );
        }
        q(
            "INSERT INTO notifications (id, account_id, message, kind, created_at, is_read) VALUES ('n1', 'u1', ?, 'info', ?, 1)",
            ['Welcome to CiCo! Tip: CiCo will never ask for your OTP or MPIN.', dt($now - 3 * DAY_MS)]
        );
        sandbox_kit('u1', $now);
    });
}
