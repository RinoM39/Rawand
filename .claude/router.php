<?php
// Local dev server for the whole site — pages, /api and the /auth dashboard:
//   php -S 127.0.0.1:5173 .claude/router.php
// Behaves like the Apache .htaccess files (private folders, /auth → /auth/) and, like the old
// serve.py, tells the browser never to cache html/css/js so edits show on a normal reload.
$root = realpath(__DIR__ . '/..');
$uri = $_SERVER['REQUEST_URI'];
$path = rawurldecode((string) parse_url($uri, PHP_URL_PATH));
$query = (string) parse_url($uri, PHP_URL_QUERY);

if (strpos($path, '..') !== false || preg_match('#(^|/)(data|\.claude)(/|$)|/api/config\.php$|/\.ht#', $path)) {
  http_response_code(403);
  echo 'Forbidden';
  return true;
}
if (preg_match('#^/uploads/.*\.(php\d?|phtml|phar|html?|svg|js)$#i', $path)) {
  http_response_code(403);
  echo 'Forbidden';
  return true;
}

$file = $root . str_replace('/', DIRECTORY_SEPARATOR, $path);
if (is_dir($file)) {
  if (substr($path, -1) !== '/') {
    header('Location: ' . $path . '/' . ($query !== '' ? '?' . $query : ''), true, 301);
    return true;
  }
  if (is_file($file . 'index.php')) return false;   // e.g. /api/
  $file .= 'index.html';
}

$types = ['html' => 'text/html; charset=utf-8', 'css' => 'text/css; charset=utf-8', 'js' => 'text/javascript; charset=utf-8', 'svg' => 'image/svg+xml', 'json' => 'application/json'];
$ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
if (isset($types[$ext]) && is_file($file)) {
  header('Content-Type: ' . $types[$ext]);
  header('Cache-Control: no-store');
  readfile($file);
  return true;
}
return false;   // images, video, fonts, php: the built-in server handles them
