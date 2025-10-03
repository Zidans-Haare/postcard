declare module "express-session" {
  interface SessionData {
    user?: {
      username: string;
      loggedInAt: string;
    };
  }
}
export {};
