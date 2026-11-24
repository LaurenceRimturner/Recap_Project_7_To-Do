import type { FormProps } from "../../types";
import { createTodo } from "../../api";
import { mutate } from "swr";
import { Plus } from "lucide-react";
import { useState } from "react";

export default function Form({
  newTodoTitle,
  setNewTodoTitle,
  setErrorMessage,
}: FormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await createTodo(newTodoTitle);
      await mutate((key) => Array.isArray(key) && key[0] === "todos");
      setNewTodoTitle("");
      setErrorMessage("");
    } catch {
      setErrorMessage(
        "Todo konnte nicht hinzugefügt werden. Bitte nochmal versuchen."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="input-group mb-4" onSubmit={handleSubmit}>
      <input
        className="form-control"
        placeholder="NEW TASK..."
        aria-label="new todo title"
        maxLength={50}
        type="text"
        onChange={(e) => setNewTodoTitle(e.target.value)}
        value={newTodoTitle}
      />
      <button
        className="btn btn-accent"
        aria-label="add todo"
        disabled={newTodoTitle.trim() === "" || isSubmitting === true}
        type="submit"
      >
        <Plus size={18} />
      </button>
    </form>
  );
}
