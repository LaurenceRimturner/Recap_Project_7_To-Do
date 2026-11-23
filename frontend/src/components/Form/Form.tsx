import type { FormProps } from "../../types";
import { createTodo } from "../../api";
import { mutate } from "swr";
export default function Form({ title, setTitle }: FormProps) {
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await createTodo(title);
    await mutate("todos")
    setTitle("")
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        onChange={(e) => setTitle(e.target.value)}
        value={title}
      />
      <button disabled={title.trim() === ""} type="submit">
        submit
      </button>
    </form>
  );
}
