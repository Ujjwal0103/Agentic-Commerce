import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import agentRoutes from "./routes/agents.js";
import taskRoutes from "./routes/tasks.js";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

// ---- Security ----
app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

// ---- Body Parsing ----
app.use(express.json({ limit: "1mb" }));

// ---- Rate Limiting ----
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_requests" },
});
app.use(limiter);

// ---- Health Check ----
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    network: process.env.STACKS_NETWORK ?? "devnet",
  });
});

// ---- API Routes ----
app.use("/api/agents", agentRoutes);
app.use("/api/tasks", taskRoutes);

// ---- 404 ----
app.use((_req, res) => {
  res.status(404).json({ error: "not_found" });
});

// ---- Global Error Handler ----
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("[server] Unhandled error:", err);
    res.status(500).json({ error: "internal_server_error" });
  }
);

app.listen(PORT, () => {
  console.log(`Agent Commerce API running on port ${PORT}`);
  console.log(`Network: ${process.env.STACKS_NETWORK ?? "devnet"}`);
  console.log(`CORS origin: ${process.env.FRONTEND_URL ?? "http://localhost:3000"}`);
});

export default app;
