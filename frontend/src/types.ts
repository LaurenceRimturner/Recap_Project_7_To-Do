export type Todo = {
  id: string;
  title: string;
  done: boolean;
};

export type NewTodo = {
  title: string;
  done: boolean;
};

export type FormProps = {
  newTodoTitle: string;
  setNewTodoTitle: (title: string) => void;
  setErrorMessage: (message: string) => void;
};

export type Filter = "all" | "open" | "done";
