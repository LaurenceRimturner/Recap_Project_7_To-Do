import type { FormProps } from "../../types";
import { createTodo } from "../../api";
import { mutate } from "swr";
import { Plus } from "lucide-react";
export default function Form({ title, setTitle }: FormProps) {
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await createTodo(title);
    await mutate("todos");
    setTitle("");
  }

  return (
    <form className="input-group mb-4" onSubmit={handleSubmit}>
      <input
        className="form-control"
        placeholder="NEW TASK..."
        aria-label="new todo title"
        maxLength={50}
        type="text"
        onChange={(e) => setTitle(e.target.value)}
        value={title}
      />
      <button
        className="btn btn-accent"
        aria-label="add todo"
        disabled={title.trim() === ""}
        type="submit"
      >
        <Plus size={18} />
      </button>
    </form>
  );
}
