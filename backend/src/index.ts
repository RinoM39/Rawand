/* =====================================================================
   RAWAND — the site's API, a Neon Function (Hono)
   Projects live in Postgres (table `projects`), photos and videos in the `media` bucket.

   Public
     GET  /projects            published projects, in the order set on /auth
     GET  /project?id=…        one project + its neighbours (drafts only with an admin token)
   Dashboard (/auth) — Authorization: Bearer <token from /login>
     POST /login               {email, password} — the one fixed account (ADMIN_EMAIL / ADMIN_PASSWORD)
     GET  /session             is the token still good? (+ upload limits)
     GET  /all                 every project, drafts included
     POST /save                {project} — creates or updates
     POST /delete              {id}
     POST /reorder             {ids: […]}
     POST /upload              {kind, type, size} → a signed URL; the browser PUTs the file to storage itself
     POST /upload/check        {key, kind} → reads the first bytes: is it really an image / a video?

   Every reply is JSON: {ok: true, …} or {ok: false, error: "<code>"} — js/admin.js maps the codes
   to Arabic messages. Auth is a bearer token (no cookies), so any origin may call the API.
   ===================================================================== */
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { Pool } from "pg";
import { attachDatabasePool, waitUntil } from "@neon/functions";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutBucketCorsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const env = process.env;
const BUCKET = "media";
const MEDIA_BASE = `${(env.AWS_ENDPOINT_URL_S3 ?? "").replace(/\/+$/, "")}/${BUCKET}/`;
const TOKEN_HOURS = 12;
const MAX_IMAGE = 25 * 1024 * 1024;
const MAX_VIDEO = 1024 * 1024 * 1024; // the free plan holds 5 GB in all
const KEY_RE = /^projects\/[a-f0-9]{20}\.(jpg|png|webp|gif|avif|mp4|webm)$/;

// what the browser says the file is → the extension (and type) it is stored with
const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };
// .mov from phones is the same container as .mp4; stored as video/mp4 so browsers try to play it
const VIDEO_TYPES: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mp4", "video/x-m4v": "mp4", "video/webm": "webm" };
const CONTENT_TYPE: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", avif: "image/avif", mp4: "video/mp4", webm: "video/webm" };

const pool = new Pool({ connectionString: env.DATABASE_URL, max: 5 });
attachDatabasePool(pool);
// checksums only when required: browsers can't add the SDK's default CRC to a presigned PUT
const s3 = new S3Client({ forcePathStyle: true, requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED" });

/* ------------------------------------------------------------ once per isolate */

let schemaReady: Promise<unknown> | null = null;
function schema() {
  schemaReady ??= pool
    .query(`
      create table if not exists projects (
        id          text primary key,
        sort        integer not null default 0,
        published   boolean not null default false,
        data        jsonb not null,
        created_at  timestamptz not null default now(),
        updated_at  timestamptz not null default now()
      );
      create table if not exists login_attempts (
        ip_hash   text primary key,
        count     integer not null,
        first_at  timestamptz not null
      );`)
    .catch((err) => {
      schemaReady = null;
      throw err;
    });
  return schemaReady;
}

// the browser uploads straight to the bucket, so the bucket has to accept cross-origin PUTs
let corsReady: Promise<unknown> | null = null;
function bucketCors() {
  corsReady ??= s3
    .send(new PutBucketCorsCommand({
      Bucket: BUCKET,
      CORSConfiguration: {
        CORSRules: [{ AllowedOrigins: ["*"], AllowedMethods: ["GET", "HEAD", "PUT"], AllowedHeaders: ["*"], ExposeHeaders: ["ETag"], MaxAgeSeconds: 3600 }],
      },
    }))
    .catch((err) => {
      corsReady = null;
      console.error("[bucket cors]", err);
    });
  return corsReady;
}

/* ------------------------------------------------------------ helpers */

class Fail extends Error {
  constructor(public code: string, public status = 400, public extra: Record<string, unknown> = {}) {
    super(code);
  }
}

type Pair = { ar: string; en: string };
type Media = { key: string; w?: number; h?: number; size?: number };
type ProjectData = {
  title: Pair; category: Pair; location: Pair; summary: Pair; description: Pair;
  year: string; area: string; areaUnit: "m2" | "ha";
  scope: { consult: boolean; design: boolean; build: boolean };
  images: Media[]; video: Media | null; videoUrl: string;
};
type Row = { id: string; sort: number; published: boolean; data: ProjectData; created_at: Date; updated_at: Date };

function text(v: unknown, max: number, multiline = false): string {
  let s = typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
  s = s.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  s = multiline ? s.replace(/\n{3,}/g, "\n\n") : s.replace(/\s+/g, " ");
  return Array.from(s.trim()).slice(0, max).join("");
}
function pair(v: unknown, max: number, multiline = false): Pair {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return { ar: text(o.ar, max, multiline), en: text(o.en, max, multiline) };
}

const keyOf = (m: unknown): string => {
  if (!m || typeof m !== "object") return "";
  const o = m as Record<string, unknown>;
  const raw = typeof o.key === "string" ? o.key : typeof o.src === "string" && o.src.startsWith(MEDIA_BASE) ? o.src.slice(MEDIA_BASE.length) : "";
  return KEY_RE.test(raw) ? raw : "";
};
const mediaKeys = (d: ProjectData) => [...d.images.map((m) => m.key), ...(d.video ? [d.video.key] : [])];

async function exists(key: string) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function removeObjects(keys: string[]) {
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000);
    if (chunk.length) await s3.send(new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true } }));
  }
}

// uploads that never made it into a saved project (editor closed without saving) — gone after a day
async function tidy() {
  const { rows } = await pool.query<{ data: ProjectData }>("select data from projects");
  const used = new Set(rows.flatMap((r) => mediaKeys(r.data)));
  const old = Date.now() - 86_400_000;
  const stale: string[] = [];
  let token: string | undefined;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: "projects/", ContinuationToken: token }));
    for (const o of page.Contents ?? []) {
      if (o.Key && !used.has(o.Key) && (o.LastModified?.getTime() ?? Date.now()) < old) stale.push(o.Key);
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  await removeObjects(stale);
}

/* ------------------------------------------------------------ the admin token (HMAC, no server state) */

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const sign = (body: string) => createHmac("sha256", env.SESSION_SECRET ?? "").update(body).digest("base64url");

function issueToken() {
  const exp = Date.now() + TOKEN_HOURS * 3_600_000;
  const body = b64(JSON.stringify({ sub: "admin", exp }));
  return { token: `${body}.${sign(body)}`, exp };
}

function isAdmin(c: Context): boolean {
  const auth = c.req.header("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ") || !env.SESSION_SECRET) return false;
  const [body, mac] = auth.slice(7).trim().split(".");
  if (!body || !mac) return false;
  const want = Buffer.from(sign(body));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return false;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    return p.sub === "admin" && typeof p.exp === "number" && p.exp > Date.now();
  } catch {
    return false;
  }
}

function requireAdmin(c: Context) {
  if (!isAdmin(c)) throw new Fail("unauthorized", 401);
}

const safeEqual = (a: string, b: string) => {
  const x = createHash("sha256").update(a).digest();
  const y = createHash("sha256").update(b).digest();
  return timingSafeEqual(x, y);
};

// sign-in guard: 6 wrong tries → 15 minutes' wait (per IP)
async function guard(ip: string, outcome?: "fail" | "ok"): Promise<number> {
  const id = createHash("sha256").update(ip).digest("hex");
  await pool.query("delete from login_attempts where first_at < now() - interval '15 minutes'");
  if (outcome === "ok") {
    await pool.query("delete from login_attempts where ip_hash = $1", [id]);
    return 0;
  }
  if (outcome === "fail") {
    await pool.query(
      `insert into login_attempts (ip_hash, count, first_at) values ($1, 1, now())
       on conflict (ip_hash) do update set count = login_attempts.count + 1`,
      [id],
    );
  }
  const { rows } = await pool.query<{ count: number; wait: number }>(
    "select count, extract(epoch from first_at + interval '15 minutes' - now())::int as wait from login_attempts where ip_hash = $1",
    [id],
  );
  return rows[0] && rows[0].count >= 6 ? Math.max(1, rows[0].wait) : 0;
}

/* ------------------------------------------------------------ projects in / out */

function out(r: Row) {
  const d = r.data;
  return {
    id: r.id,
    published: r.published,
    ...d,
    images: d.images.map((m) => ({ src: MEDIA_BASE + m.key, w: m.w ?? 0, h: m.h ?? 0 })),
    video: d.video ? { src: MEDIA_BASE + d.video.key, size: d.video.size ?? 0 } : null,
    created: r.created_at,
    updated: r.updated_at,
  };
}

async function clean(input: Record<string, unknown>, old?: ProjectData): Promise<{ published: boolean; data: ProjectData }> {
  const known = new Set(old ? mediaKeys(old) : []);
  const scope = (input.scope && typeof input.scope === "object" ? input.scope : {}) as Record<string, unknown>;

  const images: Media[] = [];
  for (const m of (Array.isArray(input.images) ? input.images : []).slice(0, 60)) {
    const key = keyOf(m);
    if (!key || !/\.(jpg|png|webp|gif|avif)$/.test(key)) continue;
    if (!known.has(key) && !(await exists(key))) continue;
    const o = m as Record<string, unknown>;
    images.push({ key, w: Math.max(0, Math.round(Number(o.w) || 0)), h: Math.max(0, Math.round(Number(o.h) || 0)) });
  }

  let video: Media | null = null;
  const vkey = keyOf(input.video);
  if (vkey && /\.(mp4|webm)$/.test(vkey) && (known.has(vkey) || (await exists(vkey)))) {
    const old = input.video as Record<string, unknown>;
    video = { key: vkey, size: Math.max(0, Math.round(Number(old.size) || 0)) };
  }

  const videoUrl = text(input.videoUrl, 300);
  if (videoUrl && !/^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)\//i.test(videoUrl)) throw new Fail("bad_video_url", 422);

  const data: ProjectData = {
    title: pair(input.title, 140),
    category: pair(input.category, 60),
    location: pair(input.location, 120),
    summary: pair(input.summary, 360),
    description: pair(input.description, 12000, true),
    year: text(input.year, 9),
    area: text(input.area, 16),
    areaUnit: input.areaUnit === "ha" ? "ha" : "m2",
    scope: { consult: !!scope.consult, design: !!scope.design, build: !!scope.build },
    images,
    video,
    videoUrl,
  };
  const published = !!input.published;
  if (!data.title.ar || !data.title.en) throw new Fail("title_required", 422);
  if (published && !images.length) throw new Fail("cover_required", 422);
  return { published, data };
}

async function newId(en: string) {
  const base = en.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48).replace(/-+$/, "") || "project";
  const { rows } = await pool.query<{ id: string }>("select id from projects where id = $1 or id like $2", [base, `${base}-%`]);
  const taken = new Set(rows.map((r) => r.id));
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

const validId = (v: unknown) => (typeof v === "string" && /^[a-z0-9-]{1,64}$/.test(v) ? v : "");
const ORDER = "order by sort, created_at desc";

// the first bytes of a file say what it really is
function sniff(b: Uint8Array): "image" | "video" | "" {
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image";            // jpeg
  if (b[0] === 0x89 && ascii(1, 4) === "PNG") return "image";                        // png
  if (ascii(0, 4) === "GIF8") return "image";                                         // gif
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image";            // webp
  if (ascii(4, 8) === "ftyp") return /^(avif|avis)$/.test(ascii(8, 12)) ? "image" : "video"; // avif / mp4 · mov
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "video"; // webm
  return "";
}

/* ------------------------------------------------------------ routes */

const app = new Hono();

app.use("*", cors({ origin: "*", allowMethods: ["GET", "POST", "OPTIONS"], allowHeaders: ["Content-Type", "Authorization"], maxAge: 86400 }));
app.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  await schema();
  await next();
});

app.onError((err, c) => {
  if (err instanceof Fail) return c.json({ ok: false, error: err.code, ...err.extra }, err.status as 400);
  console.error(err);
  return c.json({ ok: false, error: "server" }, 500);
});
app.notFound((c) => c.json({ ok: false, error: "unknown_action" }, 404));

const body = async (c: Context) => {
  try {
    const v = await c.req.json();
    return (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
};

app.get("/", (c) => c.json({ ok: true, name: "RAWAND API" }));

app.get("/projects", async (c) => {
  const { rows } = await pool.query<Row>(`select * from projects where published ${ORDER}`);
  return c.json({ ok: true, projects: rows.map(out) });
});

app.get("/project", async (c) => {
  const id = validId(c.req.query("id"));
  const admin = isAdmin(c);
  const { rows } = await pool.query<Row>(`select * from projects ${admin ? "" : "where published"} ${ORDER}`);
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) throw new Fail("not_found", 404);
  const n = rows.length;
  const near = (r: Row) => ({ id: r.id, title: r.data.title, cover: r.data.images[0] ? MEDIA_BASE + r.data.images[0].key : "" });
  return c.json({
    ok: true,
    project: out(rows[i]),
    index: i,
    total: n,
    prev: n > 1 ? near(rows[(i - 1 + n) % n]) : null,
    next: n > 1 ? near(rows[(i + 1) % n]) : null,
  });
});

const sessionInfo = () => ({ auth: true, email: env.ADMIN_EMAIL ?? "", maxImage: MAX_IMAGE, maxVideo: MAX_VIDEO });

app.post("/login", async (c) => {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD || !env.SESSION_SECRET) throw new Fail("not_configured", 500);
  const ip = c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  let wait = await guard(ip);
  if (wait) throw new Fail("too_many", 429, { wait });
  const b = await body(c);
  const email = String(b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");
  // both are always compared, so timing says nothing about which one was wrong
  const okEmail = safeEqual(email, env.ADMIN_EMAIL.trim().toLowerCase());
  const okPass = safeEqual(password, env.ADMIN_PASSWORD);
  if (!okEmail || !okPass) {
    await new Promise((r) => setTimeout(r, 400));
    wait = await guard(ip, "fail");
    throw wait ? new Fail("too_many", 429, { wait }) : new Fail("bad_login", 401);
  }
  await guard(ip, "ok");
  return c.json({ ok: true, ...issueToken(), ...sessionInfo() });
});

app.get("/session", (c) => c.json(isAdmin(c) ? { ok: true, ...sessionInfo() } : { ok: true, auth: false }));

app.get("/all", async (c) => {
  requireAdmin(c);
  const { rows } = await pool.query<Row>(`select * from projects ${ORDER}`);
  return c.json({ ok: true, projects: rows.map(out) });
});

app.post("/save", async (c) => {
  requireAdmin(c);
  const input = (await body(c)).project;
  if (!input || typeof input !== "object") throw new Fail("invalid");
  const p = input as Record<string, unknown>;
  const id = validId(p.id);

  let row: Row;
  let dropped: string[] = [];
  if (id) {
    const { rows } = await pool.query<Row>("select * from projects where id = $1", [id]);
    if (!rows[0]) throw new Fail("not_found", 404);
    const { published, data } = await clean(p, rows[0].data);
    const res = await pool.query<Row>("update projects set published = $2, data = $3, updated_at = now() where id = $1 returning *", [id, published, data]);
    row = res.rows[0];
    const keep = new Set(mediaKeys(data));
    dropped = mediaKeys(rows[0].data).filter((k) => !keep.has(k));
  } else {
    const { published, data } = await clean(p);
    const res = await pool.query<Row>(
      "insert into projects (id, sort, published, data) values ($1, (select coalesce(min(sort), 0) - 1 from projects), $2, $3) returning *",
      [await newId(data.title.en), published, data],
    );
    row = res.rows[0];
  }
  waitUntil(removeObjects(dropped).then(tidy).catch((err) => console.error("[tidy]", err)));
  return c.json({ ok: true, project: out(row) });
});

app.post("/delete", async (c) => {
  requireAdmin(c);
  const id = validId((await body(c)).id);
  const { rows } = await pool.query<Row>("delete from projects where id = $1 returning *", [id]);
  if (!rows[0]) throw new Fail("not_found", 404);
  waitUntil(removeObjects(mediaKeys(rows[0].data)).catch((err) => console.error("[delete media]", err)));
  return c.json({ ok: true });
});

app.post("/reorder", async (c) => {
  requireAdmin(c);
  const ids = (await body(c)).ids;
  if (!Array.isArray(ids)) throw new Fail("invalid");
  const list = ids.map(validId).filter(Boolean);
  await pool.query(
    "update projects set sort = x.ord from unnest($1::text[]) with ordinality as x(id, ord) where projects.id = x.id",
    [list],
  );
  return c.json({ ok: true });
});

app.post("/upload", async (c) => {
  requireAdmin(c);
  const b = await body(c);
  const kind = b.kind === "video" ? "video" : b.kind === "image" ? "image" : "";
  const type = String(b.type ?? "");
  const size = Math.round(Number(b.size) || 0);
  const ext = kind === "image" ? IMAGE_TYPES[type] : kind === "video" ? VIDEO_TYPES[type] : undefined;
  if (!kind || size <= 0) throw new Fail("invalid");
  if (!ext) throw new Fail("bad_type", 415);
  if (size > (kind === "image" ? MAX_IMAGE : MAX_VIDEO)) throw new Fail("too_big", 413);
  await bucketCors();
  const key = `projects/${randomBytes(10).toString("hex")}.${ext}`;
  const contentType = CONTENT_TYPE[ext];
  const url = await getSignedUrl(s3, new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }), { expiresIn: 3600 });
  return c.json({ ok: true, key, url, headers: { "Content-Type": contentType }, src: MEDIA_BASE + key });
});

app.post("/upload/check", async (c) => {
  requireAdmin(c);
  const b = await body(c);
  const key = keyOf({ key: b.key });
  const kind = b.kind === "video" ? "video" : "image";
  if (!key) throw new Fail("invalid");
  let head;
  try {
    head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch {
    throw new Fail("upload_failed", 404);
  }
  const size = head.ContentLength ?? 0;
  const limit = kind === "image" ? MAX_IMAGE : MAX_VIDEO;
  const first = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key, Range: "bytes=0-15" }));
  const bytes = (await first.Body?.transformToByteArray()) ?? new Uint8Array();
  if (!size || size > limit || sniff(bytes) !== kind) {
    await removeObjects([key]);
    throw new Fail(size > limit ? "too_big" : "bad_type", 415);
  }
  return c.json({ ok: true, key, src: MEDIA_BASE + key, size });
});

export default app;
