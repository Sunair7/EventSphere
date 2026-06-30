"use strict";

require("dotenv").config();

const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const { Server } = require("socket.io");
const { apiLimiter } = require("./config/rateLimiter");
const { checkProductionEnv } = require("./config/envCheck");
const mongoSanitize = require('express-mongo-sanitize');

// ─── Route Imports ───────────────────────────────────────────────────────────
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const expoRoutes = require("./routes/expo.routes");
const boothRoutes = require("./routes/booth.routes");
const sessionRoutes = require("./routes/session.routes");
const exhibitorRoutes = require("./routes/exhibitor.routes");
const messageRoutes = require("./routes/message.routes");
const analyticsRoutes = require("./routes/analytics.routes");
const notificationRoutes = require('./routes/notification.routes');
const paymentRoutes = require('./routes/payment.routes');
const feedbackRoutes = require('./routes/feedback.routes');

// ─── Socket Handler Import ────────────────────────────────────────────────────
const initSocketHandlers = require("./config/socket");

// ─── Environment Validation ───────────────────────────────────────────────────
const REQUIRED_ENV = [
  "MONGODB_URI",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "JWT_ACCESS_EXPIRES_IN",
  "JWT_REFRESH_EXPIRES_IN",
  "CLIENT_ORIGIN",
  "NODE_ENV",
  "PORT",
];

REQUIRED_ENV.forEach((key) => {
  if (!process.env[key]) {
    console.error(
      `[BOOT] Fatal: Missing required environment variable → ${key}`,
    );
    process.exit(1);
  }
});

const { MONGODB_URI, CLIENT_ORIGIN, NODE_ENV, PORT = 5000 } = process.env;

const IS_PRODUCTION = NODE_ENV === "production";

// ─── Express App Initialization ───────────────────────────────────────────────
const app = express();

// ─── Trust Proxy (for rate limiting behind reverse proxies) ──────────────────
if (IS_PRODUCTION) {
  app.set("trust proxy", 1);
}

// ─── Security Headers (Helmet) ────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: IS_PRODUCTION
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com"],
            connectSrc: ["'self'", "ws:", "wss:"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
          },
        }
      : false,
    crossOriginEmbedderPolicy: IS_PRODUCTION,
    hsts: IS_PRODUCTION
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
      : false,
  }),
);

// ─── Additional Security Headers ──────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Add referrer policy
app.use(helmet.referrerPolicy({ policy: "strict-origin-when-cross-origin" }));

// ─── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = CLIENT_ORIGIN.split(",").map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(
          new Error(`CORS policy violation: origin ${origin} is not allowed.`),
        );
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["X-Total-Count"],
    maxAge: 86_400,
  }),
);

// ─── Body Parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// ─── NoSQL Injection Prevention ───────────────────────────────────────────────
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`[SECURITY] NoSQL injection attempt sanitized: ${key} in ${req.originalUrl}`);
  },
}));

// ─── Cookie Parser ────────────────────────────────────────────────────────────
app.use(cookieParser());

// ─── Request Logger ───────────────────────────────────────────────────────────
if (!IS_PRODUCTION) {
  app.use(morgan("dev"));
} else {
  app.use(
    morgan(
      ":remote-addr :method :url :status :res[content-length] - :response-time ms",
      {
        skip: (_req, res) => res.statusCode < 400,
      },
    ),
  );
}

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api", apiLimiter);
app.use('/api/v1/notifications', notificationRoutes); 
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/expos", expoRoutes);
app.use("/api/v1/booths", boothRoutes);
app.use("/api/v1/sessions", sessionRoutes);
app.use("/api/v1/exhibitors", exhibitorRoutes);
app.use("/api/v1/messages", messageRoutes);
app.use("/api/v1/analytics", analyticsRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/feedback', feedbackRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/v1/health', (_req, res) => {
  const mongoState = mongoose.connection.readyState;
  const mongoStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  res.status(200).json({
    success: true,
    status: 'operational',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    memory: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
    },
    mongo: {
      status: mongoStates[mongoState] || 'unknown',
      state: mongoState,
    },
    version: process.env.npm_package_version || '1.0.0',
  });
});
// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const isDev = !IS_PRODUCTION;

  // CORS origin errors
  if (err.message && err.message.startsWith("CORS policy violation")) {
    return res.status(403).json({ success: false, message: err.message });
  }

  // Mongoose validation errors
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((e) => e.message);
    return res.status(422).json({
      success: false,
      message: "Validation failed.",
      errors,
    });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return res.status(409).json({
      success: false,
      message: `A record with this ${field} already exists.`,
    });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ success: false, message: "Invalid token." });
  }
  if (err.name === "TokenExpiredError") {
    return res
      .status(401)
      .json({ success: false, message: "Token has expired." });
  }

  // Payload too large
  if (err.type === "entity.too.large") {
    return res
      .status(413)
      .json({ success: false, message: "Request payload is too large." });
  }

  const statusCode = err.statusCode || err.status || 500;

  console.error(`[ERROR] ${req.method} ${req.originalUrl} →`, err);

  res.status(statusCode).json({
    success: false,
    message:
      IS_PRODUCTION && statusCode === 500
        ? "An unexpected error occurred. Please try again."
        : err.message || "Internal server error.",
    ...(isDev && { stack: err.stack }),
  });
});

// ─── HTTP Server ──────────────────────────────────────────────────────────────
const httpServer = http.createServer(app);

// ─── Socket.io Initialization ─────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60_000,
  pingInterval: 25_000,
  transports: ["websocket", "polling"],
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true,
  },
});

// Attach io instance to app for controller access
app.set("io", io);

// Delegate all socket event wiring to dedicated config module
initSocketHandlers(io);

const PaymentService = require('./services/payment.service');
const Booth = require('./models/Booth');

const resolveMockMode = () => {
  if (process.env.MOCK_PAYMENTS === 'false') return false;
  if (process.env.MOCK_PAYMENTS === 'true') return true;
  return process.env.NODE_ENV !== 'production';
};

const paymentService = new PaymentService({
  mockMode: resolveMockMode(),
});

// Make it available globally
global._paymentService = paymentService;

// ─── MongoDB Connection ───────────────────────────────────────────────────────
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10_000,
      socketTimeoutMS: 45_000,
      maxPoolSize: 20,
      minPoolSize: 5,
    });

    console.log(
      `[DB] MongoDB connected → ${conn.connection.host} (${conn.connection.name})`,
    );

    mongoose.connection.on("disconnected", () =>
      console.warn("[DB] MongoDB disconnected. Attempting reconnect..."),
    );
    mongoose.connection.on("reconnected", () =>
      console.info("[DB] MongoDB reconnected."),
    );
    mongoose.connection.on("error", (err) =>
      console.error("[DB] MongoDB connection error:", err.message),
    );
  } catch (err) {
    console.error("[DB] Initial MongoDB connection failed:", err.message);
    process.exit(1);
  }
};

// ─── Server Bootstrap ─────────────────────────────────────────────────────────
const bootstrap = async () => {
  // Validate production environment
  if (IS_PRODUCTION) {
    checkProductionEnv();
  }
  await connectDB();

  // Expire stale pending transactions and booth locks every minute
  setInterval(async () => {
    try {
      await global._paymentService.handleExpiredTransactions();
      await Booth.cleanupExpiredLocks();
    } catch (err) {
      console.error('[CRON] Cleanup error:', err.message);
    }
  }, 60 * 1000).unref();

  httpServer.listen(PORT, () => {
    console.log("─────────────────────────────────────────────");
    console.log(`[SERVER] EventSphere Management API`);
    console.log(`[SERVER] Environment  : ${NODE_ENV}`);
    console.log(`[SERVER] Port         : ${PORT}`);
    console.log(`[SERVER] API Base     : /api/v1`);
    console.log(`[SERVER] Socket.io    : active`);
    console.log("─────────────────────────────────────────────");
  });
};

bootstrap();

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
const gracefulShutdown = (signal) => {
  console.log(`\n[SHUTDOWN] Received ${signal}. Starting graceful shutdown...`);

  httpServer.close(async (err) => {
    if (err) {
      console.error("[SHUTDOWN] HTTP server close error:", err.message);
      process.exit(1);
    }

    console.log("[SHUTDOWN] HTTP server closed.");

    try {
      io.close(() => console.log("[SHUTDOWN] Socket.io server closed."));
      await mongoose.connection.close(false);
      console.log("[SHUTDOWN] MongoDB connection closed.");
      console.log("[SHUTDOWN] Graceful shutdown complete.");
      process.exit(0);
    } catch (shutdownErr) {
      console.error("[SHUTDOWN] Error during shutdown:", shutdownErr.message);
      process.exit(1);
    }
  });

  // Force exit after 15s if graceful shutdown stalls
  setTimeout(() => {
    console.error("[SHUTDOWN] Forced shutdown after timeout.");
    process.exit(1);
  }, 15_000).unref();
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("unhandledRejection", (reason, promise) => {
  console.error(
    "[PROCESS] Unhandled Promise Rejection at:",
    promise,
    "→ Reason:",
    reason,
  );
});

process.on("uncaughtException", (err) => {
  console.error("[PROCESS] Uncaught Exception:", err.message);
  gracefulShutdown("uncaughtException");
});

module.exports = { app, httpServer, io };
