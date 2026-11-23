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
  title: string;
  setTitle: (title: string) => void;
  setErrMsg: (title: string) => void;
};
