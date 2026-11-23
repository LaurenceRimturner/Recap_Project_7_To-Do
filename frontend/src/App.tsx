import useSWR, { mutate } from "swr";
import { editTodo, fetchTodos } from "./api";
import { useState } from "react";
import Form from "./components/Form/Form";
import { SquarePen, Trash, Save } from "lucide-react";

export default function App() {
  const { data, error, isLoading } = useSWR(`todos`, fetchTodos);
  const [title, setTitle] = useState("");
  const [currEditTodo, setCurrEditTodo] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");

  if (isLoading) return <div>loading...</div>;
  if (error) return <div>failed to load</div>;
  if (!data) return <div>an error has occurred</div>;

  return (
    <main>
      <h1>Todos</h1>
      <Form title={title} setTitle={setTitle} />
      {data.length === 0 && <p>Keine ToDo's</p>}
      <ul className="todo-list">
        {data.map((todo) => (
          <li className="todo-item" key={todo.id}>
            {currEditTodo === todo.id && (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => {
                  setEditTitle(e.target.value);
                }}
              />
            )}
            {currEditTodo !== todo.id ? (
              <>
                <label className={`todo-title ${todo.done ? "done" : ""}`}>
                  <input
                    type="checkbox"
                    onChange={async () => {
                      await editTodo(todo.id, todo.title, !todo.done);
                      await mutate("todos");
                    }}
                    checked={todo.done}
                  />
                  {todo.title}
                </label>
                <button
                  aria-label={`edit todo: ${todo.title}`}
                  onClick={() => {
                    setCurrEditTodo(todo.id);
                    setEditTitle(todo.title);
                  }}
                >
                  <SquarePen size={16} />
                </button>
              </>
            ) : (
              <button
                aria-label={`edit todo: ${todo.title}`}
                onClick={() => {
                  setCurrEditTodo(todo.id);
                  setEditTitle(todo.title);
                }}
              >
                <Save size={16} />
              </button>
            )}

            {/* <button aria-label={`delete todo: ${todo.title}`}>
              <Trash size={16} color="red" />
            </button> */}
          </li>
        ))}
      </ul>
    </main>
  );
}
