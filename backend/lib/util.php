<?php
declare(strict_types=1);

/** Read a config value ("db", or "db.port" for a nested one). */
function cfg(string $path): mixed
{
    static $config = null;
    if ($config === null) {
        $config = require __DIR__ . '/../config.php';
        $local = __DIR__ . '/../config.local.php';
        // Environment variables are authoritative: when the database is chosen through CICO_DB_*
        // (hosting, tests), the local file must not be able to redirect the app to another database.
        $dbFromEnv = getenv('CICO_DB_HOST') !== false || getenv('CICO_DB_PORT') !== false;
        if (is_file($local) && !$dbFromEnv) {
            $config = array_replace_recursive($config, require $local);
        }
    }
    $value = $config;
    foreach (explode('.', $path) as $key) {
        $value = $value[$key] ?? null;
    }
    return $value;
}

function now_ms(): int
{
    return (int) floor(microtime(true) * 1000);
}

/** Epoch milliseconds -> "Y-m-d H:i:s.v" in UTC for DATETIME(3) columns. */
function dt(int $ms): string
{
    return gmdate('Y-m-d H:i:s', intdiv($ms, 1000)) . sprintf('.%03d', $ms % 1000);
}

/** DATETIME(3) string (UTC) -> epoch milliseconds. */
function to_ms(?string $dt): int
{
    if ($dt === null || $dt === '') {
        return 0;
    }
    [$date, $frac] = array_pad(explode('.', $dt, 2), 2, '0');
    return strtotime($date . ' UTC') * 1000 + (int) str_pad(substr($frac, 0, 3), 3, '0');
}

function new_id(string $prefix): string
{
    return $prefix . bin2hex(random_bytes(6));
}

/** Trim; empty -> null; cap the length. */
function clip(mixed $value, int $max): ?string
{
    if ($value === null || is_array($value) || is_object($value)) {
        return null;
    }
    $s = trim((string) $value);
    return $s === '' ? null : mb_substr($s, 0, $max);
}

function norm_username(mixed $value): string
{
    return strtolower(ltrim(trim((string) $value), '@'));
}

/** "12.5" / 12.5 -> 1250 cents, or null when it isn't a usable positive amount. */
function parse_cents(mixed $value): ?int
{
    if (is_string($value)) {
        $value = str_replace(',', '', $value);
    }
    if (!is_numeric($value)) {
        return null;
    }
    $cents = (int) round((float) $value * 100);
    $max = (int) cfg('max_amount') * 100;
    return ($cents >= 1 && $cents <= $max) ? $cents : null;
}

function to_cents(string|int|float $decimal): int
{
    return (int) round((float) $decimal * 100);
}

function cents_str(int $cents): string
{
    return number_format($cents / 100, 2, '.', '');
}

function peso(int $cents): string
{
    return '₱' . number_format($cents / 100, 2);
}

/** Drop null values so optional fields are simply missing in the JSON. */
function clean(array $row): array
{
    return array_filter($row, static fn($v) => $v !== null);
}
