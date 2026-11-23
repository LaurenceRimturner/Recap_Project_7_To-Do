import { Router } from "express";
import { todoModel, toTodo } from "../models/Todo";
import { NewTodo } from "../types";

export const todosRouter = Router();

// Issue 2: add the routes here. The router is already mounted on /api/todos in app.ts.
//
// GET    /api/todos       -> 200 with the list of todos
// POST   /api/todos       -> 201 with the new todo
// PUT    /api/todos/:id   -> 200 with the updated todo, 404 for an unknown id
// DELETE /api/todos/:id   -> 204 without a body, 404 for an unknown id
//
// The contract is in docs/api-contract.md at the root of the project.

todosRouter.get("/", async (request, response) => {
  const todos = await todoModel.find();
  response.json(todos.map(toTodo));
});

todosRouter.post("/", async (request, response) => {
  const newTodo = await todoModel.create(request.body);
  response.status(201).json(toTodo(newTodo));
});

todosRouter.put("/:id", async (request, response) => {
  const editTodo = await todoModel.findByIdAndUpdate(
    request.params.id,
    request.body as NewTodo,
    {
      returnDocument: "after",
      runValidators: true,
    }
  );
  if (!editTodo) {
    return response.status(404).json({ error: "Todo not found" });
  }

  response.status(200).json(toTodo(editTodo));
});
