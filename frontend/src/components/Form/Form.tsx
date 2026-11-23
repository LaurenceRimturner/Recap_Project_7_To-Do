import type { FormProps } from "../../types";
export default function Form({ title, setTitle }: FormProps) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const query = formData.get("query");
    setTitle(query);
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="text" name="query" id="" />
      <button type="submit">submit</button>
    </form>
  );
}
