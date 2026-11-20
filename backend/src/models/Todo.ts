// Issue 2: write the mongoose schema, the model and `toTodo` here.
// Look at the Book model of Backend MongoDB: it has the same shape.
// A todo has a `title` (a required string, trimmed) and `done` (a boolean, default `false`).

import { model, Schema } from "mongoose";
import type { HydratedDocument } from "mongoose";

import type { NewTodo, Todo } from "../types";

export const todoSchema = new Schema<NewTodo>({
  title: { type: String, required: true, trim: true },
  done: { type: Boolean, default: false },
});

export const todoModel = model("todos", todoSchema);

export const toTodo = (todo: HydratedDocument<NewTodo>): Todo => {
  return {
    id: todo._id.toString(),
    title: todo.title,
    done: todo.done,
  };
};
