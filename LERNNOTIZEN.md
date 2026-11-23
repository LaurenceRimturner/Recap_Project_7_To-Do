# Lernnotizen: Todo-App Schritt für Schritt

Stack: Express 5 + MongoDB (`backend/`), React 19 + SWR (`frontend/`).

| Issue | Thema | Stand |
|---|---|---|
| 1 | Setup | ✅ |
| 2 | See All Todos | ✅ |
| 3 | Add a Todo | ✅ |
| 4 | Mark a Todo as Done | ✅ |
| 5 | Edit a Todo | ✅ (PR #14 gemerged) |
| 6 | Delete a Todo | ⬜ |
| 7 | Loading, Error and Empty States | ⬜ |
| 8 | Hand Over | ⬜ |
| 9 | Bonus: Filter | ⬜ |

Regeln aus `CLAUDE.md`: pro Issue ein Branch, nur das tun, was das Issue verlangt, alle API-Aufrufe in `frontend/src/api.ts`, `any` ist verboten, Routen rufen das Mongoose-Modell direkt auf.

---

## Issue 1: Setup

**Ziel:** Backend und Frontend laufen und sprechen miteinander.

1. MongoDB-Datenbank anlegen (Atlas oder lokal), Name `todos`.
2. `backend/.env` aus `backend/.env.example` erstellen und `MONGODB_URI` eintragen. Die Datei wird nie committet und nie in einen Prompt kopiert.
3. `npm i` in `backend/` und in `frontend/`.
4. Beide Teile in zwei Terminals starten: `npm run dev`.
5. Prüfen: `GET http://localhost:3001/api/health` antwortet `{ "status": "ok" }`, und http://localhost:5173 zeigt "Todos".

**Warum CORS?** Frontend (Port 5173) und Backend (Port 3001) haben verschiedene Origins. Der Browser blockt Anfragen, wenn das Backend sie nicht erlaubt. Das macht `cors({ origin: "http://localhost:5173" })` in `backend/src/app.ts`. Nie `*`.

---

## Issue 2: See All Todos

**Ziel:** Todos kommen aus MongoDB über die API in die App.

### Backend

`backend/src/models/Todo.ts`: Schema, Modell und `toTodo`.

```ts
export const todoSchema = new Schema<NewTodo>({
  title: { type: String, required: true, trim: true },
  done: { type: Boolean, default: false },
});

export const todoModel = model("todos", todoSchema);

export const toTodo = (todo: HydratedDocument<NewTodo>): Todo => {
  return {
    id: todo._id.toString(),
    title: todo.title,
    done: todo.done,
  };
};
```

`toTodo` macht aus `_id` ein `id` und lässt `__v` weg, wie der Vertrag es verlangt.

`backend/src/routes/todos.ts`:

```ts
todosRouter.get("/", async (request, response) => {
  const todos = await todoModel.find();
  response.json(todos.map(toTodo));
});
```

### Frontend

`frontend/src/api.ts`: der Fetcher.

```ts
export const fetchTodos = async (): Promise<Todo[]> => {
  const response = await fetch(API_URL + "/todos");
  if (!response.ok) {
    throw new Error("Todos konnten nicht geladen werden");
  }
  return response.json();
};
```

`frontend/src/App.tsx`: laden und anzeigen.

```tsx
const { data, error, isLoading } = useSWR(`todos`, fetchTodos);

if (isLoading) return <div>loading...</div>;
if (error) return <div>failed to load</div>;
if (!data) return <div>an error has occurred</div>;

{data.length === 0 && <p>Keine ToDo's</p>}
<ul className="todo-list">
  {data.map((todo) => (
    <li className="todo-item" key={todo.id}>
      <label className={`todo-title ${todo.done ? "done" : ""}`}>
        <input type="checkbox" checked={todo.done} />
        {todo.title}
      </label>
    </li>
  ))}
</ul>
```

**Merke:**
- Komponenten rufen nie `fetch` auf, nur Funktionen aus `api.ts`.
- `key={todo.id}` braucht jedes Listenelement.
- `useSWR("todos", fetchTodos)`: der erste Wert ist der Cache-Schlüssel. Mit `mutate("todos")` lädt man die Liste neu.

---

## Issue 3: Add a Todo

**Ziel:** Ein Todo über ein Formular anlegen.

### Backend

```ts
todosRouter.post("/", async (request, response) => {
  const newTodo = await todoModel.create(request.body);
  response.status(201).json(toTodo(newTodo));
});
```

- `create` wendet die Schema-Regeln an (`required`, `trim`). Ein leerer Titel löst einen `ValidationError` aus, den `errors.ts` in 400 umwandelt.
- Express 5 leitet Fehler aus `async`-Routen automatisch an den Error-Handler weiter. Ein `try/catch` ist nicht nötig.

### Frontend

`api.ts`:

```ts
export const createTodo = async (title: string): Promise<Todo> => {
  const response = await fetch(API_URL + "/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) {
    throw new Error("Todo konnte nicht erstellt werden");
  }
  return response.json();
};
```

`components/Form/Form.tsx`:

```tsx
async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  await createTodo(title);
  await mutate("todos");
  setTitle("");
}

<form onSubmit={handleSubmit}>
  <input type="text" onChange={(e) => setTitle(e.target.value)} value={title} />
  <button disabled={title.trim() === ""} type="submit">submit</button>
</form>
```

**Merke:**
- Ohne `Content-Type: application/json` und `JSON.stringify` liest `express.json()` den Body nicht.
- `e.preventDefault()` verhindert, dass der Browser die Seite neu lädt.
- Das Eingabefeld ist "kontrolliert": `value` kommt aus dem State, `onChange` schreibt zurück.
- Reihenfolge: speichern, `mutate`, dann das Feld leeren.
- `disabled={title.trim() === ""}` verhindert leere Titel.

---

## Issue 4: Mark a Todo as Done

**Ziel:** Ein Todo per Checkbox an- und abhaken.

### Backend

```ts
todosRouter.put("/:id", async (request, response) => {
  const editTodo = await todoModel.findByIdAndUpdate(
    request.params.id,
    request.body as NewTodo,
    {
      returnDocument: "after",
      runValidators: true,
    }
  );
  if (!editTodo) {
    return response.status(404).json({ error: "Todo not found" });
  }

  response.status(200).json(toTodo(editTodo));
});
```

- `returnDocument: "after"` liefert das **neue** Dokument. Ohne diese Option kommt das alte zurück.
- `runValidators: true` wendet die Schema-Regeln auch bei einem Update an. Ohne die Option würde ein leerer Titel durchgehen.
- Unbekannte `id`: `findByIdAndUpdate` gibt `null` zurück, daraus wird 404. Die Fehlermeldung muss genau wie im Vertrag lauten: `Todo not found`.
- Ungültige `id` (zum Beispiel `abc`): Mongoose wirft einen `CastError`, `errors.ts` macht daraus 404.

### Frontend

`api.ts`:

```ts
export const editTodo = async (
  id: string,
  title: string,
  done: boolean
): Promise<Todo> => {
  const response = await fetch(`${API_URL}/todos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, done }),
  });
  if (!response.ok) {
    throw new Error("Todo konnte nicht bearbeitet werden");
  }
  return response.json();
};
```

`App.tsx`: die Checkbox.

```tsx
<input
  type="checkbox"
  onChange={async () => {
    await editTodo(todo.id, todo.title, !todo.done);
    await mutate("todos");
  }}
  checked={todo.done}
/>
```

**Merke:**
- Der PUT ersetzt das ganze Todo. Man schickt immer **beide** Felder, `title` und `done`.
- Muster für jede Änderung: API-Aufruf, dann `await mutate("todos")`.

---

## Issue 5: Edit a Todo

**Ziel:** Den Titel eines Todos ändern. Das Backend bleibt unverändert.

### Schritt 1: Icons installieren

```bash
cd frontend
npm i lucide-react
```

`lucide` allein ist die Vanilla-Variante. Für React gibt es `lucide-react`. Installiere es im richtigen Ordner (`frontend/`).

### Schritt 2: State anlegen

```tsx
const [currEditTodo, setCurrEditTodo] = useState<string | null>(null);
const [editTitle, setEditTitle] = useState<string>("");
```

- `currEditTodo` ist die `id` des Todos im Edit-Modus, oder `null`. Ein Boolean würde **alle** Todos gleichzeitig umschalten.
- `editTitle` ist der Text im Eingabefeld. Der `title`-State gehört zum Formular für neue Todos.
- Hooks stehen **vor** den frühen `return`s.

### Schritt 3: Edit-Button

```tsx
<button
  aria-label={`edit todo: ${todo.title}`}
  onClick={() => {
    setCurrEditTodo(todo.id);
    setEditTitle(todo.title);
  }}
>
  <SquarePen size={16} />
</button>
```

- `aria-label` gehört an den **Button**, nicht ans Icon. Ein Screenreader liest den Namen des Buttons vor.
- `onClick` braucht eine **Funktion**: `() => setX(id)`. `onClick={setX(id)}` läuft sofort beim Rendern und löst eine Endlosschleife aus.
- `setEditTitle(todo.title)` füllt das Feld mit dem alten Titel.

### Schritt 4: Feld statt Titel anzeigen

Die Bedingung `currEditTodo === todo.id` gilt nur für das Todo, das gerade bearbeitet wird.

```tsx
{currEditTodo === todo.id && (
  <>
    <input
      type="text"
      value={editTitle}
      onChange={(e) => {
        setEditTitle(e.target.value);
      }}
    />
    {editTitle.trim() === "" && <p>Gültige Aufgabe einfügen.</p>}
  </>
)}
{currEditTodo !== todo.id ? (
  <>
    {/* Label mit Checkbox und Titel, Edit-Button */}
  </>
) : (
  <>
    {/* Save- und Cancel-Button */}
  </>
)}
```

- Der neue Text steht in `e.target.value`. `onChange` muss `setEditTitle` aufrufen, nicht `setCurrEditTodo`.
- Mehrere Elemente pro Zweig gruppiert man mit `<>...</>`.
- In `{ }` bist du in JavaScript: Werte schreibst du ohne weitere Klammern (`todo.title`). `${...}` gilt nur in Backticks.

### Schritt 5: Save-Button

```tsx
<button
  aria-label={`save todo: ${todo.title}`}
  onClick={async () => {
    if (editTitle.trim() === "") {
      return;
    }
    await editTodo(todo.id, editTitle, todo.done);
    await mutate("todos");
    setCurrEditTodo(null);
  }}
>
  <Save size={16} />
</button>
```

- Das frühe `return` verhindert, dass ein leerer Titel gesendet wird. Lies die Bedingung laut: "Wenn der Titel leer ist, brich ab."
- Gesendet wird `editTitle` (der getippte Text), nicht `todo.title` (der alte Titel). TypeScript merkt den Unterschied nicht, beide sind `string`.
- `todo.done` bleibt erhalten, weil der PUT beide Felder verlangt.
- Reihenfolge: speichern, `mutate`, Edit-Modus beenden.

### Schritt 6: Cancel-Button

```tsx
<button
  aria-label={`cancel todo changes on ${todo.title}`}
  onClick={() => {
    setCurrEditTodo(null);
  }}
>
  <X size={16} />
</button>
```

- Cancel beendet nur den Edit-Modus. Kein Netzwerkaufruf.
- Jeder Button braucht ein eigenes `aria-label`.

### Fehler, die uns passiert sind

| Fehler | Richtig |
|---|---|
| `todo.title` im PUT beim Speichern | `editTitle` |
| `if (editTitle.trim() !== "") return;` | `=== ""` |
| `onClick={setX(id)}` | `onClick={() => setX(id)}` |
| `:void()` aus einer Fehlermeldung als Code übernommen | Eine Fehlermeldung beschreibt den Fehler, sie ist kein Code |
| Edit-Button als Save-/Cancel-Button kopiert, `onClick` und Label nicht angepasst | Nach dem Kopieren immer beides prüfen |

`npm run check` prüft nur Typen. Logikfehler bei gleichen Typen findet nur der Test im Browser.

---

## Issue 6: Delete a Todo

**Ziel:** Ein Todo löschen. Die letzte der vier CRUD-Operationen.

### Backend

`DELETE /api/todos/:id` in `backend/src/routes/todos.ts`:

- Löscht das Todo und antwortet **204 ohne Body**.
- Unbekannte oder ungültige `id`: 404 `{ "error": "Todo not found" }`. Zweimal löschen gibt beim zweiten Mal 404.

Hinweise:
- Mongoose hat `findByIdAndDelete`. Wie bei `findByIdAndUpdate` kommt `null` zurück, wenn es das Todo nicht gibt.
- Bei 204 gibt es keinen Body. Für die Antwort gibt es `response.status(204).send()` oder `.end()`, nicht `.json(...)`.
- Eine ungültige `id` (`abc`) löst den `CastError` aus, den `errors.ts` schon behandelt.

### Frontend

- `api.ts`: eine Funktion `deleteTodo(id)` mit `method: "DELETE"`. Bei 204 darf man `response.json()` **nicht** aufrufen.
- `App.tsx`: ein Delete-Button pro Todo, danach `await mutate("todos")`.
- Der auskommentierte Block mit `Trash` in `App.tsx` ist ein Ansatz. Prüf sein `aria-label`, es hatte ein verrutschtes Backtick.

### Prüfen

- Bruno: 204, dann dieselbe Anfrage noch einmal (404), dazu eine ungültige `id`.
- Browser: Todo löschen, Seite neu laden, es bleibt weg. Kontrolle in der Datenbank.

---

## Issue 7: Loading, Error and Empty States

**Ziel:** Die App sagt immer, was gerade passiert.

Anforderungen:
- Ladeanzeige (steht schon).
- Backend nicht erreichbar: Fehlermeldung und ein Button "Try again" ersetzen die Liste.
- Fehler bei Add, Edit oder Delete: die Meldung wird angezeigt, die Liste bleibt, wie sie war.
- Nach einem fehlgeschlagenen Speichern bleibt der getippte Text.
- Leere Liste: freundliche Meldung mit Hinweis, das erste Todo anzulegen.
- "Add" ist während der Anfrage deaktiviert (kein doppeltes Todo bei Doppelklick).

Hinweise:
- Die API-Funktionen werfen bei einem Fehler schon ein `Error`. Fang es dort auf, wo der Aufruf passiert, zum Beispiel mit `try/catch` im Handler.
- Für die Meldung brauchst du einen State. Frag dich, wer sie anzeigen soll und wann sie wieder verschwindet.
- Bei `useSWR` kannst du `mutate` aus dem Hook für "Try again" nutzen.
- Für "Add deaktiviert" brauchst du einen State, der während der Anfrage `true` ist. Setz ihn in `finally` wieder zurück.

Prüfen: Backend stoppen, Seite neu laden, Backend starten, "Try again" klicken. Danach ein Todo hinzufügen und das Backend vor dem Klick stoppen.

---

## Issue 8: Hand Over

**Ziel:** Das Projekt ist dokumentiert und sauber, damit Projekt 8 darauf aufbauen kann.

Checkliste:
- `README.md` erklärt den Start von einem frischen Clone: install, `.env` aus `.env.example`, Backend und Frontend starten, URLs.
- `docs/api-contract.md` stimmt mit der API überein. Jedes Beispiel in Bruno prüfen.
- `backend/.env.example` listet jede Variable, die der Code liest, mit Platzhaltern. Kein Passwort im Repo oder in der Historie.
- Saubere Struktur: Routen, Modell und Error-Handler in getrennten Dateien, alle API-Aufrufe in `api.ts`, kein toter Code, keine ungenutzten Dateien.
- `npm run typecheck` (Backend) sowie `npm run check` und `npm run build` (Frontend) laufen ohne Fehler.
- Im README 2–3 Sätze dazu, wo ein Besitzer pro Todo (ein User) im Backend und im Frontend ergänzt würde.
- Jede Story funktioniert im Browser.

Mögliche Aufräumpunkte, die wir gesehen haben:
- Ungenutzter Import `Trash` und auskommentierter Delete-Block in `App.tsx`.
- `console.log`-Reste.
- Unbenutzte Beispielkommentare in `routes/todos.ts` und `models/Todo.ts` (`// Issue 2: ...`).

**Bekannte Lücken im Backend** (vor dem Vertragsabgleich testen):
- `PUT` ohne `title` (zum Beispiel `{ "done": true }`): Mongoose prüft `required` bei Updates nur für Felder, die im Update vorkommen. Vermutlich kommt 200 statt 400.
- `PUT` mit `done: "abc"`: Mongoose wirft einen `CastError`, der `errorHandler` macht daraus 404. Richtig wäre 400. Der `CastError` für eine ungültige `id` und der für `done` sind dieselbe Klasse.
- Beides erst mit echten Requests in Bruno prüfen, dann entscheiden, wo es behandelt wird.

---

## Issue 9: Bonus, Filter

**Ziel:** Nur offene oder nur erledigte Todos anzeigen.

### Backend

`GET /api/todos?done=true` liefert nur erledigte, `?done=false` nur offene, ohne `done` alle.

Hinweise:
- Der Wert steht in `request.query.done`, immer als String.
- `todoModel.find(filter)` nimmt ein Objekt. Ohne Parameter braucht es einen leeren Filter.
- Beschreib den neuen Parameter in `docs/api-contract.md`.

### Frontend

- Drei Buttons "All", "Open" und "Done". Der aktive ist sichtbar.
- Die App fragt die API nach der gefilterten Liste. Es wird **nicht** im Browser gefiltert (Netzwerk-Tab prüfen).
- Der Filter gehört in den **Schlüssel** von `useSWR`, damit jeder Filter seine eigene Anfrage hat. Dann muss `mutate` den passenden Schlüssel treffen.
- Leere Ergebnisse zeigen eine passende Meldung.

---

## Befehle

| Befehl | Ordner | Zweck |
|---|---|---|
| `npm run dev` | `frontend/` | App auf http://localhost:5173 |
| `npm run dev` | `backend/` | API auf http://localhost:3001 |
| `npm run check` | `frontend/` | Typen prüfen |
| `npm run build` | `frontend/` | Produktions-Build |
| `npm run typecheck` | `backend/` | Typen prüfen |
| `gh issue view <nr>` | Projekt | Issue lesen |
