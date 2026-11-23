import useSWR, { mutate } from "swr";
import { editTodo, fetchTodos, deleteTodo } from "./api";
import { useState } from "react";
import Form from "./components/Form/Form";
import { SquarePen, Trash, Save, X } from "lucide-react";

export default function App() {
  const { data, error, isLoading, mutate } = useSWR(`todos`, fetchTodos);
  const [title, setTitle] = useState("");
  const [currEditTodo, setCurrEditTodo] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");

  if (isLoading)
    return (
      <main>
        <p className="status-line">&gt; loading...</p>
      </main>
    );
  if (error)
    return (
      <main>
        <div className="alert alert-danger" role="alert">
          failed to load
          <button onClick={() => mutate()}>Try again</button>
        </div>
      </main>
    );
  if (!data)
    return (
      <main>
        <div className="alert alert-danger" role="alert">
          an error has occurred
          <button onClick={() => mutate()}>Try again</button>
        </div>
      </main>
    );

  return (
    <main>
      <h1>
        Todos
        <span className="count">{String(data.length).padStart(2, "0")}</span>
      </h1>
      <Form title={title} setTitle={setTitle} />
      {data.length === 0 && <p className="status-line">Keine ToDo's</p>}
      <ul className="todo-list list-group">
        {data.map((todo) => (
          <li
            className="todo-item list-group-item d-flex flex-column gap-3"
            key={todo.id}
          >
            {currEditTodo === todo.id && (
              <div className="flex-grow-1">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  maxLength={50}
                  value={editTitle}
                  onChange={(e) => {
                    setEditTitle(e.target.value);
                  }}
                />
                {editTitle.trim() === "" && (
                  <p className="text-danger small mb-0 mt-1">
                    Gültige Aufgabe einfügen.
                  </p>
                )}
              </div>
            )}
            {currEditTodo !== todo.id ? (
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
                      await editTodo(todo.id, todo.title, !todo.done);
                      await mutate("todos");
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
                      setCurrEditTodo(todo.id);
                      setEditTitle(todo.title);
                    }}
                  >
                    <SquarePen size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    aria-label={`delete todo: ${todo.title}`}
                    onClick={async () => {
                      await deleteTodo(todo.id);
                      await mutate("todos");
                    }}
                  >
                    <Trash size={16} />
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
                    if (editTitle.trim() === "") {
                      return;
                    }
                    await editTodo(todo.id, editTitle, todo.done);
                    await mutate("todos");
                    setCurrEditTodo(null);
                  }}
                >
                  <Save size={16} />
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  aria-label={`cancel todo changes on ${todo.title}`}
                  onClick={() => {
                    setCurrEditTodo(null);
                  }}
                >
                  <X size={16} />
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  aria-label={`delete todo: ${todo.title}`}
                  onClick={async () => {
                    await deleteTodo(todo.id);
                    await mutate("todos");
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
