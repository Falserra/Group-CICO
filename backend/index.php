<?php
declare(strict_types=1);

// CiCo API front controller. Every request goes through here: /cico-api/index.php/<route>
ini_set('display_errors', '0'); // never let a PHP notice corrupt the JSON
error_reporting(E_ALL);

foreach (['util', 'db', 'http', 'auth', 'serialize', 'domain', 'seed'] as $lib) {
    require __DIR__ . "/lib/$lib.php";
}
foreach (['auth', 'me', 'sync', 'money', 'funding', 'safety', 'admin'] as $routes) {
    require __DIR__ . "/routes/$routes.php";
}

header('Access-Control-Allow-Origin: *'); // the app (and the web build) run on other origins
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    dispatch($_SERVER['REQUEST_METHOD'] ?? 'GET', request_path());
} catch (ApiError $e) {
    send_json(['ok' => false, 'error' => $e->getMessage()], $e->status);
} catch (PDOException $e) {
    error_log('CiCo database error: ' . $e->getMessage());
    $unreachable = in_array($e->getCode(), [2002, 1049, 1045], true);
    send_json(
        ['ok' => false, 'error' => $unreachable ? 'The CiCo database is not reachable. Check that MySQL is running and setup.php has been run.' : 'Something went wrong on the server.']
        + (cfg('debug') ? ['detail' => $e->getMessage()] : []),
        500
    );
} catch (Throwable $e) {
    error_log('CiCo error: ' . $e);
    send_json(['ok' => false, 'error' => 'Something went wrong on the server.'] + (cfg('debug') ? ['detail' => $e->getMessage()] : []), 500);
}
