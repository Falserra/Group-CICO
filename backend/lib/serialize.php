<?php
declare(strict_types=1);

// Database rows -> the camelCase JSON shapes the app uses (see src/lib/types.ts).

function profile_out(array $r): object
{
    return (object) clean([
        'email' => $r['email'] ?? null,
        'phone' => $r['phone'] ?? null,
        'birthdate' => $r['birthdate'] ?? null,
        'address' => $r['address'] ?? null,
        'avatar' => avatar_path($r['avatar_key'] ?? null),
    ]);
}

/** Relative URL of a profile photo (the app prefixes the API address). */
function avatar_path(?string $key): ?string
{
    return $key ? "avatar/$key" : null;
}

/** The signed-in user's own account: includes balance and profile. */
function me_out(array $r): array
{
    return [
        'id' => $r['id'],
        'name' => $r['name'],
        'username' => $r['username'],
        'role' => $r['role'],
        'kind' => $r['kind'],
        'verified' => (bool) $r['verified'],
        'status' => $r['status'],
        'balance' => (float) $r['balance'],
        'biometricEnabled' => (bool) $r['biometric_enabled'],
        'createdAt' => to_ms($r['created_at']),
        'profile' => profile_out($r),
    ];
}

/** Public directory entry (used to look up recipients). Balance only for admins. */
function directory_out(array $r, bool $admin): array
{
    $out = [
        'id' => $r['id'],
        'name' => $r['name'],
        'username' => $r['username'],
        'role' => $r['role'],
        'kind' => $r['kind'],
        'verified' => (bool) $r['verified'],
        'status' => $r['status'],
        'reported' => (bool) $r['reported'],
        'avatar' => avatar_path($r['avatar_key']),
    ];
    if ($admin) {
        $out['balance'] = (float) $r['balance'];
        $out['createdAt'] = to_ms($r['created_at']);
    }
    return clean($out);
}

function tx_out(array $r): array
{
    return clean([
        'id' => $r['id'],
        'accountId' => $r['account_id'],
        'type' => $r['type'],
        'amount' => (float) $r['amount'],
        'counterparty' => $r['counterparty'],
        'reference' => $r['reference'],
        'note' => $r['note'],
        'timestamp' => to_ms($r['created_at']),
        'status' => $r['status'],
        'risk' => $r['risk'],
    ]);
}

function pm_out(array $r): array
{
    return [
        'id' => $r['id'],
        'accountId' => $r['account_id'],
        'label' => $r['label'],
        'accountType' => $r['account_type'],
        'accountNumber' => $r['account_number'],
    ];
}

function sub_out(array $r): array
{
    return [
        'id' => $r['id'],
        'accountId' => $r['account_id'],
        'merchant' => $r['merchant'],
        'plan' => $r['plan'],
        'amount' => (float) $r['amount'],
        'cycle' => $r['cycle'],
        'linkedOn' => to_ms($r['linked_on']),
        'nextCharge' => to_ms($r['next_charge']),
        'status' => $r['status'],
    ];
}

function report_out(array $r): array
{
    return clean([
        'id' => $r['id'],
        'accountId' => $r['account_id'],
        'transactionId' => $r['transaction_id'],
        'description' => $r['description'],
        'emergency' => (bool) $r['emergency'],
        'timestamp' => to_ms($r['created_at']),
        'status' => $r['status'],
    ]);
}

function notif_out(array $r): array
{
    return [
        'id' => $r['id'],
        'accountId' => $r['account_id'],
        'message' => $r['message'],
        'kind' => $r['kind'],
        'timestamp' => to_ms($r['created_at']),
        'read' => (bool) $r['is_read'],
    ];
}
