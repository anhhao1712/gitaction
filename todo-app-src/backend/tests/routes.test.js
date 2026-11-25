const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const routes = require("../routes/index");

// Mock the Todo model
jest.mock("../models/todos/todo", () => {
  const saveMock = jest.fn();
  const mockTodoModel = function (todo) {
    this.text = todo.text;
    this.save = saveMock;
  };
  mockTodoModel.find = jest.fn();
  mockTodoModel.findByIdAndUpdate = jest.fn();
  mockTodoModel.findByIdAndDelete = jest.fn();

  return { Todo: mockTodoModel, saveMock }; // Export saveMock to assert on it
});

const { Todo, saveMock } = require("../models/todos/todo");

describe("Todo Routes API Unit Tests", () => {
  let app;
  const origReadyStateDescriptor = Object.getOwnPropertyDescriptor(
    mongoose.connection,
    "readyState"
  );

  function setMongoReadyState(state) {
    Object.defineProperty(mongoose.connection, "readyState", {
      configurable: true,
      get: () => state,
    });
  }

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    // Initialize routes
    routes(app);
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (origReadyStateDescriptor) {
      Object.defineProperty(
        mongoose.connection,
        "readyState",
        origReadyStateDescriptor
      );
    }
  });

  describe("GET /api/", () => {
    it("should return all todos on success", async () => {
      const mockTodos = [
        { _id: "1", text: "Task 1", done: false },
        { _id: "2", text: "Task 2", done: true },
      ];
      Todo.find.mockResolvedValue(mockTodos);

      const res = await request(app).get("/api/");
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockTodos);
      expect(Todo.find).toHaveBeenCalledWith({}, { __v: 0 });
    });

    it("should return 500 when database query fails while connected", async () => {
      setMongoReadyState(1);
      Todo.find.mockRejectedValue(new Error("Database error"));

      const res = await request(app).get("/api/");
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
    });

    it("should return 503 when database is disconnected", async () => {
      setMongoReadyState(0);
      Todo.find.mockRejectedValue(new Error("Topology closed"));

      const res = await request(app).get("/api/");
      expect(res.statusCode).toBe(503);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/todos", () => {
    it("should create a new todo", async () => {
      const newTodo = { _id: "123", text: "New Task", done: false };
      saveMock.mockResolvedValue(newTodo);

      const res = await request(app)
        .post("/api/todos")
        .send({ text: "New Task" });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(newTodo);
      expect(saveMock).toHaveBeenCalled();
    });

    it("should return 400 on Mongoose ValidationError", async () => {
      const validationError = new Error("Todo validation failed");
      validationError.name = "ValidationError";
      saveMock.mockRejectedValue(validationError);

      const res = await request(app).post("/api/todos").send({ text: "" });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 500 on unexpected database error", async () => {
      setMongoReadyState(1);
      saveMock.mockRejectedValue(new Error("Database write failed"));

      const res = await request(app)
        .post("/api/todos")
        .send({ text: "Good Task" });

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe("PUT /api/todos/:todoId", () => {
    it("should update and return the todo if a valid ID is passed", async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      const updatedTodo = { _id: validId, text: "Update Task", done: true };

      Todo.findByIdAndUpdate.mockResolvedValue(updatedTodo);

      const res = await request(app).put(`/api/todos/${validId}`).send({});

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(updatedTodo);
      expect(Todo.findByIdAndUpdate).toHaveBeenCalledWith(
        validId,
        { done: true },
        { new: true, runValidators: true }
      );
    });

    it("should update done=false when explicitly passed in body", async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      const updatedTodo = { _id: validId, text: "Update Task", done: false };

      Todo.findByIdAndUpdate.mockResolvedValue(updatedTodo);

      const res = await request(app)
        .put(`/api/todos/${validId}`)
        .send({ done: false });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(updatedTodo);
      expect(Todo.findByIdAndUpdate).toHaveBeenCalledWith(
        validId,
        { done: false },
        { new: true, runValidators: true }
      );
    });

    it("should return 400 if ID is invalid", async () => {
      const res = await request(app).put("/api/todos/invalid-id");
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Invalid todo ID format");
    });

    it("should return 404 if todo is not found", async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      Todo.findByIdAndUpdate.mockResolvedValue(null);

      const res = await request(app).put(`/api/todos/${validId}`);
      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("Todo not found");
    });
  });

  describe("DELETE /api/todos/:todoId", () => {
    it("should delete and return the todo if a valid ID is passed", async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      const deletedTodo = { _id: validId, text: "Delete Task", done: false };

      Todo.findByIdAndDelete.mockResolvedValue(deletedTodo);

      const res = await request(app).delete(`/api/todos/${validId}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(deletedTodo);
      expect(Todo.findByIdAndDelete).toHaveBeenCalledWith(validId);
    });

    it("should return 400 if ID is invalid", async () => {
      const res = await request(app).delete("/api/todos/invalid-id");
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Invalid todo ID format");
    });

    it("should return 404 if todo is not found", async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      Todo.findByIdAndDelete.mockResolvedValue(null);

      const res = await request(app).delete(`/api/todos/${validId}`);
      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("Todo not found");
    });
  });
});
