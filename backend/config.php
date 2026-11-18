<?php
// CiCo API settings. Every value can come from an environment variable, which is how the hosted
// server (Render) is configured. On your own PC, create config.local.php next to this file
// (it is git-ignored) that returns just the keys you want to override, e.g.
//   <?php return ['db' => ['port' => 3306, 'pass' => 'secret']];

$env = static fn(string $name, mixed $default = null): mixed => getenv($name) !== false && getenv($name) !== '' ? getenv($name) : $default;
$flag = static fn(string $name, bool $default): bool => filter_var($env($name, $default ? '1' : '0'), FILTER_VALIDATE_BOOLEAN);

return [
    'db' => [
        'host' => $env('CICO_DB_HOST', '127.0.0.1'),
        'port' => (int) $env('CICO_DB_PORT', 3306),
        'name' => $env('CICO_DB_NAME', 'cico'),
        'user' => $env('CICO_DB_USER', 'root'),
        'pass' => $env('CICO_DB_PASS', ''),          // XAMPP's root has no password by default
        'ssl' => $flag('CICO_DB_SSL', false),        // required by cloud databases such as TiDB Cloud
        'ssl_ca' => $env('CICO_DB_SSL_CA'),          // path to a CA bundle; defaults to the one in certs/
        'ssl_verify' => $flag('CICO_DB_SSL_VERIFY', true),
    ],
    'debug'           => $flag('CICO_DEBUG', false), // include technical detail in 500 responses
    'session_days'    => 30,                         // how long a login stays valid
    'mfa_minutes'     => 5,                          // time allowed between password and MPIN steps
    'max_attempts'    => 5,                          // failed password/MPIN tries before a lockout
    'lockout_seconds' => 60,
    'max_amount'      => 500000,                     // largest single transaction in pesos
    'max_linked'      => 5,                          // funding sources per account
    'max_avatar_kb'   => 3072,
    // Sandbox behaviour: new accounts start empty. Set CICO_SANDBOX_KIT=1 to give them the sample
    // linked accounts and auto-deductions (only useful for local development).
    'sandbox_kit'     => $flag('CICO_SANDBOX_KIT', false),
];
