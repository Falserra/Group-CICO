<?php
declare(strict_types=1);

/** A problem the caller can fix; becomes {"ok":false,"error":"..."} with this HTTP status. */
class ApiError extends Exception
{
    public function __construct(public int $status, string $message)
    {
        parent::__construct($message);
    }
}

/** Parsed JSON request body (empty array when there is none). */
function body(): array
{
    static $parsed = null;
    if ($parsed === null) {
        $raw = file_get_contents('php://input');
        $data = $raw === '' || $raw === false ? [] : json_decode($raw, true);
        if (!is_array($data)) {
            throw new ApiError(400, 'Request body must be JSON.');
        }
        $parsed = $data;
    }
    return $parsed;
}

function send_json(array $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    exit;
}

/** Send a file (such as a profile photo) instead of JSON. */
function send_binary(string $data, string $mime, string $cache = 'public, max-age=31536000, immutable'): never
{
    http_response_code(200);
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . strlen($data));
    header('Cache-Control: ' . $cache);
    header('X-Content-Type-Options: nosniff');
    echo $data;
    exit;
}

/** Routing table: route('POST', '/subscriptions/{id}/status', fn(array $p) => [...]). */
function route(string $method, string $pattern, callable $handler): void
{
    $GLOBALS['cico_routes'][] = [$method, $pattern, $handler];
}

function request_path(): string
{
    $path = $_SERVER['PATH_INFO'] ?? null;
    if ($path === null) {
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $script = $_SERVER['SCRIPT_NAME'] ?? '';
        $path = str_starts_with($uri, $script) ? substr($uri, strlen($script)) : substr($uri, strlen(dirname($script)));
    }
    return '/' . trim($path, '/');
}

function dispatch(string $method, string $path): never
{
    foreach ($GLOBALS['cico_routes'] ?? [] as [$m, $pattern, $handler]) {
        if ($m !== $method) {
            continue;
        }
        $regex = '#^' . preg_replace('#\{(\w+)\}#', '(?P<$1>[A-Za-z0-9_.-]+)', $pattern) . '$#';
        if (preg_match($regex, $path, $matches)) {
            $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);
            $result = $handler($params) ?? [];
            $failed = ($result['ok'] ?? true) === false;
            send_json($failed ? $result : ['ok' => true] + $result, $failed ? 422 : 200);
        }
    }
    throw new ApiError(404, 'No such endpoint.');
}
