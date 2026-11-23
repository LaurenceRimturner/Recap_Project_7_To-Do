import useSWR, { mutate } from "swr";
import { editTodo, fetchTodos } from "./api";
import { useState } from "react";
import Form from "./components/Form/Form";

export default function App() {
  const { data, error, isLoading } = useSWR(`todos`, fetchTodos);
  const [title, setTitle] = useState("");

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
          </li>
        ))}
      </ul>
    </main>
  );
}
