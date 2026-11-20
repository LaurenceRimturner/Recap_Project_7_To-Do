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
      <ul>
        {data.map((todo) => (
          <li key={todo.id}>{todo.title}</li>
        ))}
      </ul>
    </main>
  );
}
