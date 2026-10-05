<?php
/* =====================================================================
   RAWAND — the site's small API (plain PHP 8, no database)
   Projects live in data/projects.json, uploaded images and videos in uploads/projects/.

   Public
     GET  ?action=projects          published projects, in the order set on /auth
     GET  ?action=project&id=…      one project + its neighbours (drafts only when signed in)
   Dashboard (/auth) — signed in, and every POST carries the X-CSRF token
     GET  ?action=session           signed in? (+ csrf token and upload limits)
     POST ?action=login             {email, password} — the one fixed account in config.php
     POST ?action=logout
     GET  ?action=all               every project, drafts included
     POST ?action=save              {project} — creates or updates
     POST ?action=delete            {id}
     POST ?action=reorder           {ids: […]}
     POST ?action=upload            one piece of a file (multipart) — big videos arrive in pieces
   ===================================================================== */
declare(strict_types=1);

$cfg = require __DIR__ . '/config.php';

define('ROOT', dirname(__DIR__));
define('DATA', ROOT . '/data');
define('MEDIA_DIR', ROOT . '/uploads/projects');
define('MEDIA_URL', 'uploads/projects/');
define('SESSION_SECONDS', max(1, (int) ($cfg['session_hours'] ?? 12)) * 3600);

// what an upload really is (read from its bytes, not its name) → the extension it is saved with
const IMAGE_TYPES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif', 'image/avif' => 'avif'];
// .mov from phones is the same container as .mp4; saved as .mp4 so browsers try to play it
const VIDEO_TYPES = ['video/mp4' => 'mp4', 'video/quicktime' => 'mp4', 'video/x-m4v' => 'mp4', 'video/webm' => 'webm'];

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

/* ------------------------------------------------------------ helpers */

function out(array $body, int $code = 200): void
{
  http_response_code($code);
  echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function fail(string $error, int $code = 400, array $extra = []): void
{
  out(['ok' => false, 'error' => $error] + $extra, $code);
}

function post_only(): void
{
  if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('method', 405);
}

function body(): array
{
  $in = json_decode((string) file_get_contents('php://input'), true);
  return is_array($in) ? $in : [];
}

function ensure_dir(string $dir): void
{
  if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) fail('storage', 500);
}

function is_https(): bool
{
  return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || strtolower($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
}

function start_session(): void
{
  if (session_status() === PHP_SESSION_ACTIVE) return;
  ensure_dir(DATA . '/sessions');
  session_save_path(DATA . '/sessions');
  ini_set('session.gc_maxlifetime', (string) SESSION_SECONDS);
  ini_set('session.use_strict_mode', '1');
  session_name('rw_admin');
  session_set_cookie_params([
    'lifetime' => SESSION_SECONDS,
    'path'     => '/',
    'secure'   => is_https(),
    'httponly' => true,
    'samesite' => 'Strict',
  ]);
  session_start();
}

function signed_in(): bool
{
  if (!isset($_COOKIE['rw_admin'])) return false;   // visitors never get a session file
  start_session();
  return !empty($_SESSION['admin']) && ($_SESSION['since'] ?? 0) > time() - SESSION_SECONDS;
}

function require_admin(bool $csrf = true): void
{
  if (!signed_in()) fail('unauthorized', 401);
  if ($csrf && !hash_equals((string) ($_SESSION['csrf'] ?? ''), (string) ($_SERVER['HTTP_X_CSRF'] ?? ''))) fail('csrf', 403);
  session_write_close();   // don't hold the session lock during uploads
}

function ini_bytes(string $v): int
{
  $v = trim($v);
  $n = (int) $v;
  switch (strtolower(substr($v, -1))) {
    case 'g': $n *= 1024;
    case 'm': $n *= 1024;
    case 'k': $n *= 1024;
  }
  return $n;
}

function session_info(): array
{
  global $cfg;
  $limit = min(ini_bytes((string) ini_get('upload_max_filesize')), ini_bytes((string) ini_get('post_max_size')));
  $chunk = max(512 * 1024, min(8 * 1024 * 1024, $limit - 256 * 1024));
  return [
    'auth'     => true,
    'email'    => $cfg['email'],
    'csrf'     => $_SESSION['csrf'] ?? '',
    'chunk'    => $chunk,
    'maxImage' => (int) $cfg['max_image_mb'] * 1048576,
    'maxVideo' => (int) $cfg['max_video_mb'] * 1048576,
  ];
}

/* ------------------------------------------------------------ sign-in guard: 6 wrong tries → 15 min wait */

function guard(string $ip, ?bool $success = null): int
{
  ensure_dir(DATA);
  $file = DATA . '/login-guard.json';
  $fh = fopen($file, 'c+');
  flock($fh, LOCK_EX);
  $all = json_decode((string) stream_get_contents($fh), true) ?: [];
  $now = time();
  foreach ($all as $k => $g) if ($g['t'] < $now - 900) unset($all[$k]);
  $key = hash('sha256', $ip);
  if ($success === true) unset($all[$key]);
  if ($success === false) $all[$key] = ['n' => ($all[$key]['n'] ?? 0) + 1, 't' => $all[$key]['t'] ?? $now];
  $wait = ($all[$key]['n'] ?? 0) >= 6 ? max(1, $all[$key]['t'] + 900 - $now) : 0;
  ftruncate($fh, 0);
  rewind($fh);
  fwrite($fh, json_encode($all));
  flock($fh, LOCK_UN);
  fclose($fh);
  return $wait;
}

/* ------------------------------------------------------------ the project list */

function store_read(): array
{
  $file = DATA . '/projects.json';
  if (!is_file($file)) return [];
  $list = json_decode((string) file_get_contents($file), true);
  return is_array($list) ? $list : [];
}

// read → change → write, one request at a time
function store_update(callable $change)
{
  ensure_dir(DATA);
  $lock = fopen(DATA . '/.lock', 'c');
  flock($lock, LOCK_EX);
  $list = store_read();
  $result = $change($list);
  $tmp = DATA . '/projects.json.tmp';
  $ok = file_put_contents($tmp, json_encode($list, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)) !== false
    && rename($tmp, DATA . '/projects.json');
  flock($lock, LOCK_UN);
  fclose($lock);
  if (!$ok) fail('storage', 500);
  return $result;
}

function find_index(array $list, string $id): int
{
  foreach ($list as $i => $p) if (($p['id'] ?? '') === $id) return $i;
  return -1;
}

function valid_id($id): string
{
  $id = is_string($id) ? $id : '';
  return preg_match('/^[a-z0-9-]{1,64}$/', $id) ? $id : '';
}

function new_id(string $en, array $list): string
{
  $base = substr(trim((string) preg_replace('/[^a-z0-9]+/', '-', strtolower($en)), '-'), 0, 48);
  $base = trim($base, '-') ?: 'project';
  $taken = array_column($list, 'id');
  $id = $base;
  for ($n = 2; in_array($id, $taken, true); $n++) $id = $base . '-' . $n;
  return $id;
}

/* ------------------------------------------------------------ cleaning what the dashboard sends */

function text($v, int $max, bool $multiline = false): string
{
  $s = is_string($v) ? $v : (is_int($v) || is_float($v) ? (string) $v : '');
  $s = str_replace(["\r\n", "\r"], "\n", $s);
  $s = (string) preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s);
  $s = $multiline ? (string) preg_replace("/\n{3,}/", "\n\n", $s) : (string) preg_replace('/\s+/u', ' ', $s);
  return mb_substr(trim($s), 0, $max);
}

function pair($v, int $max, bool $multiline = false): array
{
  $v = is_array($v) ? $v : [];
  return ['ar' => text($v['ar'] ?? '', $max, $multiline), 'en' => text($v['en'] ?? '', $max, $multiline)];
}

function media_path($src): string
{
  $src = is_string($src) ? $src : '';
  if (!preg_match('#^uploads/projects/[a-f0-9]{20}\.(jpg|png|webp|gif|avif|mp4|webm)$#', $src)) return '';
  return is_file(ROOT . '/' . $src) ? $src : '';
}

function clean_image($m): ?array
{
  $src = media_path(is_array($m) ? ($m['src'] ?? '') : '');
  if ($src === '' || !preg_match('/\.(jpg|png|webp|gif|avif)$/', $src)) return null;
  $dim = @getimagesize(ROOT . '/' . $src);
  return [
    'src' => $src,
    'w'   => (int) ($dim[0] ?? $m['w'] ?? 0),
    'h'   => (int) ($dim[1] ?? $m['h'] ?? 0),
  ];
}

function clean_video($m): ?array
{
  $src = media_path(is_array($m) ? ($m['src'] ?? '') : '');
  if ($src === '' || !preg_match('/\.(mp4|webm)$/', $src)) return null;
  return ['src' => $src, 'size' => (int) @filesize(ROOT . '/' . $src)];
}

function clean_video_url($u): string
{
  $u = text($u, 300);
  if ($u === '') return '';
  if (!preg_match('#^https://(www\.|m\.)?(youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)/#i', $u)) fail('bad_video_url', 422);
  return $u;
}

function clean_project(array $in, array $old = []): array
{
  $p = [
    'id'          => $old['id'] ?? '',
    'published'   => !empty($in['published']),
    'title'       => pair($in['title'] ?? [], 140),
    'category'    => pair($in['category'] ?? [], 60),
    'location'    => pair($in['location'] ?? [], 120),
    'summary'     => pair($in['summary'] ?? [], 360),
    'description' => pair($in['description'] ?? [], 12000, true),
    'year'        => text($in['year'] ?? '', 9),
    'area'        => text($in['area'] ?? '', 16),
    'areaUnit'    => in_array($in['areaUnit'] ?? '', ['m2', 'ha'], true) ? $in['areaUnit'] : 'm2',
    'scope'       => [
      'consult' => !empty($in['scope']['consult']),
      'design'  => !empty($in['scope']['design']),
      'build'   => !empty($in['scope']['build']),
    ],
    'images'      => [],
    'video'       => clean_video($in['video'] ?? null),
    'videoUrl'    => clean_video_url($in['videoUrl'] ?? ''),
    'created'     => $old['created'] ?? date('c'),
    'updated'     => date('c'),
  ];
  foreach (array_slice(is_array($in['images'] ?? null) ? $in['images'] : [], 0, 60) as $m) {
    $img = clean_image($m);
    if ($img) $p['images'][] = $img;
  }
  if ($p['title']['ar'] === '' || $p['title']['en'] === '') fail('title_required', 422);
  if ($p['published'] && !$p['images']) fail('cover_required', 422);
  return $p;
}

function media_of(array $p): array
{
  $files = array_column($p['images'] ?? [], 'src');
  if (!empty($p['video']['src'])) $files[] = $p['video']['src'];
  return $files;
}

function drop_files(array $srcs): void
{
  foreach ($srcs as $src) if (media_path($src) !== '') @unlink(ROOT . '/' . $src);
}

// uploads that never made it into a saved project (editor closed without saving) — gone after a day
function tidy(array $list): void
{
  $used = [];
  foreach ($list as $p) foreach (media_of($p) as $src) $used[$src] = true;
  $old = time() - 86400;
  foreach (glob(MEDIA_DIR . '/*') ?: [] as $file) {
    if (is_file($file) && !isset($used[MEDIA_URL . basename($file)]) && filemtime($file) < $old && basename($file) !== '.htaccess') @unlink($file);
  }
  foreach (glob(DATA . '/tmp/*.part') ?: [] as $file) if (filemtime($file) < $old) @unlink($file);
}

function public_project(array $p): array
{
  unset($p['created']);
  return $p;
}

/* ------------------------------------------------------------ routes */

$action = (string) ($_GET['action'] ?? '');

switch ($action) {

  case 'projects':
    $list = array_values(array_filter(store_read(), fn($p) => !empty($p['published'])));
    out(['ok' => true, 'projects' => array_map('public_project', $list)]);

  case 'project':
    $id = valid_id($_GET['id'] ?? '');
    $admin = signed_in();
    if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
    $list = array_values(array_filter(store_read(), fn($p) => $admin || !empty($p['published'])));
    $i = find_index($list, $id);
    if ($i < 0) fail('not_found', 404);
    $near = function ($p) {
      return $p ? ['id' => $p['id'], 'title' => $p['title'], 'cover' => $p['images'][0]['src'] ?? ''] : null;
    };
    $n = count($list);
    out([
      'ok'      => true,
      'project' => public_project($list[$i]),
      'index'   => $i,
      'total'   => $n,
      'prev'    => $n > 1 ? $near($list[($i - 1 + $n) % $n]) : null,
      'next'    => $n > 1 ? $near($list[($i + 1) % $n]) : null,
    ]);

  case 'session':
    if (!signed_in()) out(['ok' => true, 'auth' => false]);
    out(['ok' => true] + session_info());

  case 'login':
    post_only();
    // a custom header can't be sent by a form on another site
    if (($_SERVER['HTTP_X_RAWAND'] ?? '') !== '1') fail('bad_request');
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    if ($wait = guard($ip)) fail('too_many', 429, ['wait' => $wait]);
    $in = body();
    $email = strtolower(trim((string) ($in['email'] ?? '')));
    $pass = (string) ($in['password'] ?? '');
    // both are always compared (no early exit), so timing says nothing about which one was wrong
    $okEmail = hash_equals(strtolower((string) $cfg['email']), $email);
    $okPass = hash_equals((string) $cfg['password'], $pass);
    if (!$okEmail || !$okPass) {
      usleep(400000);
      $wait = guard($ip, false);
      fail($wait ? 'too_many' : 'bad_login', $wait ? 429 : 401, ['wait' => $wait]);
    }
    guard($ip, true);
    start_session();
    session_regenerate_id(true);
    $_SESSION = ['admin' => true, 'since' => time(), 'csrf' => bin2hex(random_bytes(24))];
    out(['ok' => true] + session_info());

  case 'logout':
    post_only();
    require_admin(true);
    start_session();
    $_SESSION = [];
    session_destroy();
    setcookie('rw_admin', '', ['expires' => time() - 3600, 'path' => '/', 'secure' => is_https(), 'httponly' => true, 'samesite' => 'Strict']);
    out(['ok' => true]);

  case 'all':
    require_admin(false);
    out(['ok' => true, 'projects' => store_read()]);

  case 'save':
    post_only();
    require_admin();
    $in = body()['project'] ?? null;
    if (!is_array($in)) fail('invalid');
    $id = valid_id($in['id'] ?? '');
    $saved = store_update(function (array &$list) use ($in, $id) {
      $i = $id === '' ? -1 : find_index($list, $id);
      if ($id !== '' && $i < 0) fail('not_found', 404);
      $old = $i >= 0 ? $list[$i] : [];
      $p = clean_project($in, $old);
      if ($i < 0) {
        $p['id'] = new_id($p['title']['en'], $list);
        array_unshift($list, $p);   // newest first; reorder on the dashboard
      } else {
        $list[$i] = $p;
        drop_files(array_diff(media_of($old), media_of($p)));
      }
      return $p;
    });
    tidy(store_read());
    out(['ok' => true, 'project' => $saved]);

  case 'delete':
    post_only();
    require_admin();
    $id = valid_id(body()['id'] ?? '');
    $gone = store_update(function (array &$list) use ($id) {
      $i = find_index($list, $id);
      if ($i < 0) fail('not_found', 404);
      $p = $list[$i];
      array_splice($list, $i, 1);
      return $p;
    });
    drop_files(media_of($gone));
    out(['ok' => true]);

  case 'reorder':
    post_only();
    require_admin();
    $ids = body()['ids'] ?? [];
    if (!is_array($ids)) fail('invalid');
    store_update(function (array &$list) use ($ids) {
      $rank = array_flip(array_values(array_filter(array_map('valid_id', $ids))));
      usort($list, fn($a, $b) => [$rank[$a['id']] ?? PHP_INT_MAX, $a['id']] <=> [$rank[$b['id']] ?? PHP_INT_MAX, $b['id']]);
      return null;
    });
    out(['ok' => true]);

  case 'upload':
    post_only();
    require_admin();
    $uid = (string) ($_POST['uploadId'] ?? '');
    $kind = (string) ($_POST['kind'] ?? '');
    $offset = (int) ($_POST['offset'] ?? -1);
    $size = (int) ($_POST['size'] ?? 0);
    if (!preg_match('/^[a-z0-9]{16,40}$/', $uid) || !in_array($kind, ['image', 'video'], true) || $offset < 0 || $size <= 0) fail('invalid');
    if ($size > ($kind === 'image' ? $cfg['max_image_mb'] : $cfg['max_video_mb']) * 1048576) fail('too_big', 413);
    $f = $_FILES['chunk'] ?? null;
    if (!$f || ($f['error'] ?? 1) !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) fail('upload_failed');
    ensure_dir(DATA . '/tmp');
    $part = DATA . '/tmp/' . $uid . '.part';
    if ($offset === 0) @unlink($part);
    clearstatcache();
    $have = is_file($part) ? (int) filesize($part) : 0;
    if ($have !== $offset) fail('out_of_order', 409, ['have' => $have]);
    if ($offset + (int) $f['size'] > $size) fail('invalid');
    $dst = fopen($part, 'ab');
    $src = fopen($f['tmp_name'], 'rb');
    stream_copy_to_stream($src, $dst);
    fclose($src);
    fclose($dst);
    $now = $offset + (int) $f['size'];
    if ($now < $size) out(['ok' => true, 'received' => $now]);

    // the last piece: check what the file really is before it becomes public
    $mime = (string) (new finfo(FILEINFO_MIME_TYPE))->file($part);
    $types = $kind === 'image' ? IMAGE_TYPES : VIDEO_TYPES;
    if (!isset($types[$mime])) {
      @unlink($part);
      fail('bad_type', 415, ['mime' => $mime]);
    }
    ensure_dir(MEDIA_DIR);
    $name = bin2hex(random_bytes(10)) . '.' . $types[$mime];
    if (!rename($part, MEDIA_DIR . '/' . $name)) fail('storage', 500);
    $res = ['ok' => true, 'done' => true, 'src' => MEDIA_URL . $name, 'size' => $size];
    if ($kind === 'image') {
      $dim = @getimagesize(MEDIA_DIR . '/' . $name);
      $res += ['w' => (int) ($dim[0] ?? 0), 'h' => (int) ($dim[1] ?? 0)];
    }
    out($res);

  default:
    fail('unknown_action', 404);
}
