const express = require("express");
const mongoose = require("mongoose");
const serverResponses = require("../utils/helpers/responses");
const messages = require("../config/messages");
const { Todo } = require("../models/todos/todo");
const logger = require("../telemetry/logger");
const { metricsHandler } = require("../telemetry/metrics");

function isClientInputError(err) {
  return Boolean(
    err && (err.name === "ValidationError" || err.name === "CastError")
  );
}

function sendRouteError(res, err) {
  if (isClientInputError(err)) {
    return serverResponses.sendError(res, messages.BAD_REQUEST);
  }
  if (mongoose.connection.readyState !== 1) {
    return serverResponses.sendError(res, {
      code: 503,
      message: "Database unavailable",
    });
  }
  return serverResponses.sendError(res, messages.INTERNAL_SERVER_ERROR);
}

const routes = (app) => {
  const router = express.Router();

  router.post("/todos", (req, res) => {
    const todo = new Todo({
      text: req.body.text,
    });

    todo
      .save()
      .then((result) => {
        logger.info("Todo created", {
          request_id: req.requestId,
          todo_id: result && result._id ? String(result._id) : undefined,
        });
        serverResponses.sendSuccess(res, messages.SUCCESSFUL, result);
      })
      .catch((e) => {
        const logFn = isClientInputError(e) ? logger.warn : logger.error;
        logFn("Failed to create todo", {
          request_id: req.requestId,
          error: e,
        });
        sendRouteError(res, e);
      });
  });

  router.get("/", (req, res) => {
    Todo.find({}, { __v: 0 })
      .then((todos) => {
        logger.debug("Fetched todos", {
          request_id: req.requestId,
          count: Array.isArray(todos) ? todos.length : 0,
        });
        serverResponses.sendSuccess(res, messages.SUCCESSFUL, todos);
      })
      .catch((e) => {
        const logFn = isClientInputError(e) ? logger.warn : logger.error;
        logFn("Failed to list todos", {
          request_id: req.requestId,
          error: e,
        });
        sendRouteError(res, e);
      });
  });

  router.put("/todos/:todoId", (req, res) => {
    const { todoId } = req.params;
    const done =
      req.body && typeof req.body.done === "boolean" ? req.body.done : true;

    if (!mongoose.Types.ObjectId.isValid(todoId)) {
      logger.warn("Invalid todoId format", {
        request_id: req.requestId,
        todo_id: todoId,
      });
      return serverResponses.sendError(res, {
        code: 400,
        message: "Invalid todo ID format",
      });
    }

    Todo.findByIdAndUpdate(todoId, { done }, { new: true, runValidators: true })
      .then((updatedTodo) => {
        if (!updatedTodo) {
          logger.warn("Todo not found", {
            request_id: req.requestId,
            todo_id: todoId,
          });
          return serverResponses.sendError(res, {
            code: 404,
            message: "Todo not found",
          });
        }

        logger.info("Todo updated", {
          request_id: req.requestId,
          todo_id: todoId,
        });
        return serverResponses.sendSuccess(
          res,
          "Todo updated successfully",
          updatedTodo
        );
      })
      .catch((e) => {
        const logFn = isClientInputError(e) ? logger.warn : logger.error;
        logFn("Failed to update todo", {
          request_id: req.requestId,
          todo_id: todoId,
          error: e,
        });
        sendRouteError(res, e);
      });
  });

  router.delete("/todos/:todoId", (req, res) => {
    const { todoId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(todoId)) {
      logger.warn("Invalid todoId format", {
        request_id: req.requestId,
        todo_id: todoId,
      });
      return serverResponses.sendError(res, {
        code: 400,
        message: "Invalid todo ID format",
      });
    }

    Todo.findByIdAndDelete(todoId)
      .then((deletedTodo) => {
        if (!deletedTodo) {
          logger.warn("Todo not found", {
            request_id: req.requestId,
            todo_id: todoId,
          });
          return serverResponses.sendError(res, {
            code: 404,
            message: "Todo not found",
          });
        }

        logger.info("Todo deleted", {
          request_id: req.requestId,
          todo_id: todoId,
        });
        return serverResponses.sendSuccess(
          res,
          "Todo deleted successfully",
          deletedTodo
        );
      })
      .catch((e) => {
        const logFn = isClientInputError(e) ? logger.warn : logger.error;
        logFn("Failed to delete todo", {
          request_id: req.requestId,
          todo_id: todoId,
          error: e,
        });
        sendRouteError(res, e);
      });
  });

  app.get("/metrics", metricsHandler);
  app.use("/api", router);
};

module.exports = routes;
