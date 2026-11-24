import useSWR, { mutate } from "swr";
import { editTodo, fetchTodos, deleteTodo } from "./api";
import { useState } from "react";
import Form from "./components/Form/Form";
import { SquarePen, Trash, Save, X } from "lucide-react";

export default function App() {
  const {
    data: todos,
    error,
    isLoading,
    mutate: retry,
  } = useSWR(`todos`, fetchTodos);
  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState("");

  if (isLoading)
    return (
      <main>
        <p className="status-line">&gt; loading...</p>
      </main>
    );
  if (error)
    return (
      <main>
        <div
          className="alert alert-danger d-flex align-items-center justify-content-between gap-3"
          role="alert"
        >
          failed to load
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => retry()}
          >
            Try again
          </button>
        </div>
      </main>
    );
  if (!todos)
    return (
      <main>
        <div
          className="alert alert-danger d-flex align-items-center justify-content-between gap-3"
          role="alert"
        >
          an error has occurred
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => retry()}
          >
            Try again
          </button>
        </div>
      </main>
    );

  return (
    <main>
      <h1>
        Todos
        <span className="count">{String(todos.length).padStart(2, "0")}</span>
      </h1>
      {errorMessage !== "" && (
        <div className="alert alert-danger" role="alert">
          <p className="status-line">{errorMessage}</p>
        </div>
      )}
      <Form
        newTodoTitle={newTodoTitle}
        setNewTodoTitle={setNewTodoTitle}
        setErrorMessage={setErrorMessage}
      />
      {todos.length === 0 && (
        <p className="status-line">
          Noch keine Todos. Erstelle doch eins =^w^=
        </p>
      )}
      <ul className="todo-list list-group">
        {todos.map((todo) => (
          <li
            className="todo-item list-group-item d-flex flex-column gap-3"
            key={todo.id}
          >
            {editingTodoId === todo.id && (
              <div className="flex-grow-1">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  maxLength={50}
                  value={editingTitle}
                  onChange={(e) => {
                    setEditingTitle(e.target.value);
                  }}
                />
                {editingTitle.trim() === "" && (
                  <p className="text-danger small mb-0 mt-1">
                    Gültige Aufgabe einfügen.
                  </p>
                )}
              </div>
            )}
            {editingTodoId !== todo.id ? (
              <>
                <label
                  className={`todo-title form-check-label ${
                    todo.done ? "done" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    className="visually-hidden"
                    onChange={async () => {
                      try {
                        await editTodo(todo.id, todo.title, !todo.done);
                        await mutate("todos");
                        setErrorMessage("");
                      } catch {
                        setErrorMessage(
                          "Todo konnte nicht bearbeitet werden. Bitte nochmal versuchen."
                        );
                      }
                    }}
                    checked={todo.done}
                  />
                  {todo.title}
                </label>
                <div className="todo-actions">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    aria-label={`edit todo: ${todo.title}`}
                    onClick={() => {
                      setEditingTodoId(todo.id);
                      setEditingTitle(todo.title);
                      setErrorMessage("");
                    }}
                  >
                    <SquarePen size={16} />
                  </button>
                </div>
              </>
            ) : (
              <div className="todo-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-accent"
                  aria-label={`save todo: ${todo.title}`}
                  onClick={async () => {
                    if (editingTitle.trim() === "") {
                      return;
                    }
                    try {
                      await editTodo(todo.id, editingTitle, todo.done);
                      await mutate("todos");
                      setEditingTodoId(null);
                      setErrorMessage("");
                    } catch {
                      setErrorMessage(
                        "Todo konnte nicht gespeichert werden. Bitte nochmal versuchen."
                      );
                    }
                  }}
                >
                  <Save size={16} />
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  aria-label={`cancel todo changes on ${todo.title}`}
                  onClick={() => {
                    setEditingTodoId(null);
                  }}
                >
                  <X size={16} />
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  aria-label={`delete todo: ${todo.title}`}
                  onClick={async () => {
                    try {
                      await deleteTodo(todo.id);
                      await mutate("todos");
                      setErrorMessage("");
                    } catch {
                      setErrorMessage(
                        "Todo konnte nicht gelöscht werden. Bitte nochmal versuchen."
                      );
                    }
                  }}
                >
                  <Trash size={16} />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
