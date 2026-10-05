// RAWAND — Neon backend (infrastructure as code)
//   bucket  media : the photos and videos added on /auth (anyone can read, only the API writes)
//   function api  : the dashboard's API — sign-in, projects, uploads (src/index.ts)
// The admin email/password and the token secret come from .env.local (never committed):
//   neon deploy --env .env.local
import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  buckets: {
    media: { access: "public_read" },
  },
  functions: {
    api: {
      name: "RAWAND API",
      source: "src/index.ts",
      env: {
        ADMIN_EMAIL: process.env.ADMIN_EMAIL!,
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD!,
        SESSION_SECRET: process.env.SESSION_SECRET!,
      },
    },
  },
});
