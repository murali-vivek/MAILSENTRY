export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  MAILSENTRY_ACCESS_PASSWORD: string;
  MAILSENTRY_SESSION_SECRET: string;
  MAILSENTRY_ENABLE_DEMO_RESET?: string;
  APP_ENV?: string;
}
