import type { Todo } from "./types";
// The backend allows requests from http://localhost:5173 (CORS), so the frontend can call it directly.
export const API_URL = "http://localhost:3001/api";

export const fetchTodos = async (): Promise<Todo[]> => {
  const response = await fetch(API_URL + "/todos");

  if (!response.ok) {
    console.log("Loading Error");
  }
  return response.json();
};
// Put all functions that talk to the API here (fetcher for `useSWR`, create, update, delete),
// so that your components never call `fetch` themselves.
