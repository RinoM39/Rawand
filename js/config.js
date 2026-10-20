/* RAWAND — where the site's API and media live (the Neon function and bucket in backend/).
   The live site reaches both through its own address: vercel.json rewrites /api/* to the function and
   /media/* to the bucket. So anyone who can open the site can also sign in and see the project photos,
   even on networks where Neon's own addresses don't load (phones in Syria without a VPN, for one).
   On a local server (and on the old workers.dev copy, which has no rewrites) Neon is called directly.
   Empty FN = no API: the home page shows the sample projects and /auth can't sign in. */
(function () {
  var FN = 'https://br-lingering-morning-b1edvcfd-api.compute.c-5.eu-central-1.aws.neon.tech';
  var STORE = 'https://br-lingering-morning-b1edvcfd.storage.c-5.eu-central-1.aws.neon.tech';
  var host = location.hostname;
  var direct = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(host) || /\.workers\.dev$/.test(host);
  window.RAWAND_API = !FN ? '' : direct ? FN : '/api';
  // fetch(path) against the API: through the site first; if that way is missing (no rewrite on this
  // host: a network error, or a page instead of JSON) Neon's own address is tried and kept from then on
  var base = window.RAWAND_API;
  window.RAWAND_FETCH = function (path, opts) {
    if (!base) return Promise.reject(new Error('no API'));
    var first = base;
    return fetch(first + path, opts).then(function (r) {
      var json = (r.headers.get('content-type') || '').indexOf('json') >= 0;
      if (json || first === FN) return r;
      throw new Error('not the API');
    }).catch(function (e) {
      if (first === FN) throw e;
      base = FN;
      return fetch(FN + path, opts);
    });
  };
  // photos and videos are stored with their Neon address; on the live site they are fetched through /media
  window.RAWAND_MEDIA = function (u) {
    return base !== FN && typeof u === 'string' && u.indexOf(STORE + '/') === 0 ? u.slice(STORE.length) : u;
  };
})();
