<?php
declare(strict_types=1);

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $c = cfg('db');
    $pdo = new PDO("mysql:host={$c['host']};port={$c['port']};dbname={$c['name']};charset=utf8mb4", $c['user'], $c['pass'], pdo_options($c));
    return $pdo;
}

/** Connection options shared by the API and setup.php (adds TLS for cloud databases). */
function pdo_options(array $c): array
{
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET time_zone = '+00:00', sql_mode = 'STRICT_ALL_TABLES,NO_ENGINE_SUBSTITUTION'",
    ];
    if (!empty($c['ssl'])) {
        $system = '/etc/ssl/certs/ca-certificates.crt';
        $options[PDO::MYSQL_ATTR_SSL_CA] = $c['ssl_ca'] ?: (is_file($system) ? $system : __DIR__ . '/../certs/isrgrootx1.pem');
        $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = (bool) $c['ssl_verify'];
    }
    return $options;
}

function q(string $sql, array $params = []): PDOStatement
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt;
}

function one(string $sql, array $params = []): ?array
{
    $row = q($sql, $params)->fetch();
    return $row === false ? null : $row;
}

function all(string $sql, array $params = []): array
{
    return q($sql, $params)->fetchAll();
}

/** Run $work inside a transaction; commit on return, roll back on any exception. Nested calls join the outer one. */
function in_transaction(callable $work): mixed
{
    $pdo = db();
    if ($pdo->inTransaction()) {
        return $work();
    }
    $pdo->beginTransaction();
    try {
        $result = $work();
        $pdo->commit();
        return $result;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function notify(string $accountId, string $message, string $kind = 'info'): void
{
    q(
        'INSERT INTO notifications (id, account_id, message, kind, created_at, is_read) VALUES (?, ?, ?, ?, ?, 0)',
        [new_id('n'), $accountId, mb_substr($message, 0, 500), $kind, dt(now_ms())]
    );
}

function notify_admins(string $message, string $kind = 'security'): void
{
    foreach (all("SELECT id FROM accounts WHERE role = 'admin'") as $admin) {
        notify($admin['id'], $message, $kind);
    }
}
