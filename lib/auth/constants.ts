// Edge-safe constants (imported by middleware — no Node APIs here).
export const DEMO_COOKIE = "boldly_demo_session";
export const LAST_CLIENT_COOKIE = "boldly_last_client";
// /api/files is authorised by signed URL; /api/cron by CRON_SECRET.
export const PUBLIC_PATHS = ["/login", "/api/auth", "/api/files", "/api/cron"];
