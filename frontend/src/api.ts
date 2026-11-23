import type { Todo } from "./types";
// The backend allows requests from http://localhost:5173 (CORS), so the frontend can call it directly.
// Put all functions that talk to the API here (fetcher for `useSWR`, create, update, delete),
// so that your components never call `fetch` themselves.

export const API_URL = "http://localhost:3001/api";
export const fetchTodos = async (): Promise<Todo[]> => {
  const response = await fetch(API_URL + "/todos");
  if (!response.ok) {
    throw new Error("Todos konnten nicht geladen werden");
  }
  return response.json();
};

export const createTodo = async (title: string): Promise<Todo> => {
  const response = await fetch(API_URL + "/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) {
    throw new Error("Todo konnte nicht erstellt werden");
  }
  return response.json();
};
