import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import session from "express-session";
import { promises as fs } from "node:fs";
import { config } from "./config";
import authRouter from "./routes/auth";
import uploadRouter from "./routes/upload";
import adminRouter from "./routes/admin";
import statusRouter from "./routes/status";
import { errorHandler } from "./middleware/errorHandler";

async function ensureUploadDir() {
  await fs.mkdir(config.uploadDir, { recursive: true });
}

export async function createServer() {
  await ensureUploadDir();
  const app = express();

  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(compression());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          callback(null, false);
          return;
        }
        if (config.allowOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Nicht erlaubter Origin."));
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.use(
    session({
      name: config.session.name,
      secret: config.session.secret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        maxAge: config.session.cookieMaxAge,
        httpOnly: true,
        sameSite: "lax",
        secure: config.env === "production",
      },
    })
  );

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, status: "healthy" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/upload", uploadRouter);
  app.use("/api/status", statusRouter);
  app.use("/api/admin", adminRouter);

  app.use(errorHandler);

  return app;
}

if (require.main === module) {
  createServer()
    .then((app) => {
      app.listen(config.port, () => {
        console.log(`Server läuft auf Port ${config.port}`);
      });
    })
    .catch((err) => {
      console.error("Serverstart fehlgeschlagen", err);
      process.exit(1);
    });
}
