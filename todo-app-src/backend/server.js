const { initTracing, shutdownTracing } = require("./telemetry/tracing");

initTracing();
require("./config/config");

const express = require("express");
const path = require("path");
const cors = require("cors");
const mongoose = require("mongoose");
const db = require("./db");
const logger = require("./telemetry/logger");
const { observabilityMiddleware } = require("./telemetry/metrics");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(observabilityMiddleware);
app.use(express.static(path.join(__dirname, "public")));

app.get("/healthz", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: process.env.OTEL_SERVICE_NAME || "todo-backend",
  });
});

app.get("/readyz", (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  if (!isConnected) {
    return res.status(503).json({
      status: "not_ready",
      mongodb: "disconnected",
    });
  }
  return res.status(200).json({
    status: "ready",
    mongodb: "connected",
  });
});

// adding routes
require("./routes")(app);

function createGracefulShutdown({
  server,
  disconnectDb = () => db.disconnect(),
  shutdownTracer = shutdownTracing,
  exit = (code) => process.exit(code),
  timeoutMs = 10000,
}) {
  let shuttingDown = false;

  return async (signal) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    logger.info("Received shutdown signal, closing backend", { signal });

    const forceTimer = setTimeout(() => {
      logger.error("Graceful shutdown timed out, forcing exit", { signal });
      exit(1);
    }, timeoutMs);
    if (typeof forceTimer.unref === "function") {
      forceTimer.unref();
    }

    let exitCode = 0;
    try {
      await new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
      await disconnectDb();
      await shutdownTracer();
    } catch (error) {
      exitCode = 1;
      logger.error("Error during graceful shutdown", { signal, error });
    } finally {
      clearTimeout(forceTimer);
      exit(exitCode);
    }
  };
}

const port = Number(process.env.PORT) || 3000;

if (require.main === module) {
  db.connect(app);
  app.on("ready", () => {
    logger.info("MongoDB connected, backend is ready", { port });
  });
  const server = app.listen(port, () => {
    logger.info("Server is listening", { port });
  });
  const shutdown = createGracefulShutdown({ server });
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

app.createGracefulShutdown = createGracefulShutdown;

module.exports = app;
