import useSWR from "swr";
import { fetchTodos } from "./api";

export default function App() {
  const { data, error, isLoading } = useSWR(`todos`, fetchTodos);

  if (isLoading) return <div>loading...</div>;
  if (error) return <div>failed to load</div>;
  if (!data) return <div>an error has occurred</div>;

  return (
    <main>
      <h1>Todos</h1>
      {data.length === 0 && <p>Keine ToDo's</p>}
      <ul className="todo-list">
        {data.map((todo) => (
          <li className="todo-item" key={todo.id}>
            <label className={`todo-title ${todo.done ? "done" : ""}`}>
              <input type="checkbox" checked={todo.done} readOnly />
              {todo.title}
            </label>
          </li>
        ))}
      </ul>
    </main>
  );
}
