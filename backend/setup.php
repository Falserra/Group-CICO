<?php
declare(strict_types=1);

// One-time installer: creates the database, its tables, the billers and the administrator.
//
//   php setup.php --admin-password=<10+ chars> --admin-mpin=<6 digits>     real / hosted setup
//   php setup.php --demo                                                   local dev: also adds sample customers
//   php setup.php --fresh --yes ...                                        drop every CiCo table first (asks for --yes)
//
// Credentials can also come from CICO_ADMIN_PASSWORD / CICO_ADMIN_MPIN. The database connection comes
// from the CICO_DB_* environment variables or config.local.php (see config.php). This script only runs
// from the command line, so it can never be triggered over the web.

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

foreach (['util', 'db', 'auth', 'seed'] as $lib) {
    require __DIR__ . "/lib/$lib.php";
}

$flags = [];
$values = [];
foreach (array_slice($argv, 1) as $arg) {
    if (preg_match('/^--([a-z-]+)=(.*)$/', $arg, $m)) {
        $values[$m[1]] = $m[2];
    } elseif (str_starts_with($arg, '--')) {
        $flags[substr($arg, 2)] = true;
    }
}
$fresh = isset($flags['fresh']);
$demo = isset($flags['demo']);
if ($fresh && !isset($flags['yes'])) {
    $t = cfg('db');
    fwrite(STDERR, "--fresh DELETES every CiCo table in `{$t['name']}` on {$t['host']}:{$t['port']}.\nAdd --yes to confirm.\n");
    exit(1);
}

$adminPassword = $values['admin-password'] ?? getenv('CICO_ADMIN_PASSWORD') ?: ($demo ? 'admin123' : null);
$adminMpin = $values['admin-mpin'] ?? getenv('CICO_ADMIN_MPIN') ?: ($demo ? '000000' : null);
if ($adminPassword === null || $adminMpin === null) {
    fwrite(STDERR, "Choose the administrator's credentials:\n  php setup.php --admin-password=<at least 10 characters> --admin-mpin=<6 digits>\n(or add --demo for local development with sample accounts)\n");
    exit(1);
}
if (!$demo && strlen($adminPassword) < 10) {
    fwrite(STDERR, "The administrator password must be at least 10 characters.\n");
    exit(1);
}
if (!preg_match('/^\d{6}$/', $adminMpin)) {
    fwrite(STDERR, "The administrator MPIN must be exactly 6 digits.\n");
    exit(1);
}

$c = cfg('db');
try {
    $server = new PDO("mysql:host={$c['host']};port={$c['port']};charset=utf8mb4", $c['user'], $c['pass'], pdo_options($c));
} catch (PDOException $e) {
    fwrite(STDERR, "Could not connect to MySQL at {$c['host']}:{$c['port']} as '{$c['user']}'.\n{$e->getMessage()}\n");
    fwrite(STDERR, "Check the CICO_DB_* settings (or backend/config.local.php), and that the database server is running.\n");
    exit(1);
}

try {
    $server->exec("CREATE DATABASE IF NOT EXISTS `{$c['name']}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
} catch (PDOException $e) {
    echo "Note: could not create database `{$c['name']}` ({$e->getMessage()}); using it as it is.\n";
}
$server->exec("USE `{$c['name']}`");
echo "Database `{$c['name']}` ready.\n";

if ($fresh) {
    $server->exec('SET FOREIGN_KEY_CHECKS = 0');
    foreach ($server->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $table) {
        $server->exec("DROP TABLE IF EXISTS `$table`");
    }
    $server->exec('SET FOREIGN_KEY_CHECKS = 1');
    echo "Dropped existing tables.\n";
}

$schema = preg_replace('/^--.*$/m', '', file_get_contents(__DIR__ . '/sql/schema.sql'));
foreach (array_filter(array_map('trim', explode(';', $schema))) as $statement) {
    $server->exec($statement);
}
echo "Tables created.\n";

if ((int) one('SELECT COUNT(*) AS n FROM accounts')['n'] > 0) {
    echo "Accounts already exist - nothing was added (use --fresh to start over).\n";
    exit(0);
}

seed_core($adminPassword, $adminMpin);
echo "Administrator account created: username 'admin'.\n";
if ($demo) {
    seed_demo_customers();
    echo "Demo customers added (local development only):\n";
    foreach (demo_customers() as [$id, $name, $username, $password, $mpin, $kind]) {
        if ($kind === 'personal' && $username !== 'benjie.r') {
            echo sprintf("  %-8s password %-9s MPIN %s  (%s)\n", $username, $password, $mpin, $name);
        }
    }
    echo "  admin    password $adminPassword  MPIN $adminMpin\n";
}
echo "Done.\n";
