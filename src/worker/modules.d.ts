declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    ASSETS: Fetcher;
    MAILSENTRY_ACCESS_PASSWORD: string;
    MAILSENTRY_SESSION_SECRET: string;
    MAILSENTRY_ENABLE_DEMO_RESET?: string;
    APP_ENV?: string;
  }
  interface GlobalProps {
    mainModule: typeof import("./index");
  }
}

declare module "*.sql" {
  const value: string;
  export default value;
}
