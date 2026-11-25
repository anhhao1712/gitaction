const mongoose = require("mongoose");
const logger = require("../telemetry/logger");

let listenersRegistered = false;
let retryTimer = null;
let shuttingDown = false;

exports.connect = (app) => {
  shuttingDown = false;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }

  const options = {
    useNewUrlParser: true,
    autoIndex: false, // Don't build indexes
    maxPoolSize: 10, // Maintain up to 10 socket connections
  };

  if (!listenersRegistered) {
    listenersRegistered = true;
    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected");
    });
    mongoose.connection.on("error", (err) => {
      logger.error("MongoDB connection error", { error: err });
    });
  }

  const connectWithRetry = () => {
    if (shuttingDown) {
      return;
    }
    mongoose.Promise = global.Promise;
    logger.debug("Attempting MongoDB connection");
    mongoose
      .connect(process.env.MONGODB_URI, options)
      .then(() => {
        logger.info("MongoDB connected");
        app.emit("ready");
      })
      .catch((err) => {
        logger.error("MongoDB connection unsuccessful, retrying in 2s", {
          error: err,
        });
        if (!shuttingDown) {
          retryTimer = setTimeout(connectWithRetry, 2000);
        }
      });
  };

  connectWithRetry();
};

exports.disconnect = async () => {
  shuttingDown = true;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close(false);
  }
};
