// Issue 2: write the mongoose schema, the model and `toTodo` here.
// Look at the Book model of Backend MongoDB: it has the same shape.
// A todo has a `title` (a required string, trimmed) and `done` (a boolean, default `false`).

import { model, Schema } from "mongoose";

// The types `Todo` and `NewTodo` are already in `../types.ts`.

export const todoSchema = new Schema({
  id: String,
  title: String,
  done: Boolean,
});

export const todoModel = model("todos", todoSchema);
