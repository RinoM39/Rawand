<?php
/* =====================================================================
   TEMPLATE — copy this file to api/config.php on the server and fill it in (config.php is never committed).
   RAWAND — admin settings (read by api/index.php only; never sent to the browser)
   The dashboard at /auth has ONE fixed account and no sign-up.
   Change the email and the password below before the site goes live.
   Hosting: PHP 8 on Apache (shared hosting / cPanel) works as is — the .htaccess files keep
   data/ and this file private. On nginx, add the same rule: deny /data/ and /api/config.php.
   data/ and uploads/ must be writable by PHP.
   ===================================================================== */
return [
  'email'    => 'admin@example.com',
  'password' => 'CHANGE-ME',

  // largest file the dashboard accepts (MB). Videos arrive in small pieces,
  // so the hosting's own upload limit does not matter here.
  'max_image_mb' => 25,
  'max_video_mb' => 800,

  // stay signed in for this long (hours)
  'session_hours' => 12,
];
