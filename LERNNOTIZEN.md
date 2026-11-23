# Lernnotizen: Todo-App Schritt für Schritt

Stack: Express 5 + MongoDB (`backend/`), React 19 + SWR (`frontend/`).

| Issue | Thema | Stand |
|---|---|---|
| 1 | Setup | ✅ |
| 2 | See All Todos | ✅ |
| 3 | Add a Todo | ✅ |
| 4 | Mark a Todo as Done | ✅ |
| 5 | Edit a Todo | ✅ (PR #14 gemerged) |
| 6 | Delete a Todo | ✅ (PR #15 gemerged) |
| – | Design (Branch `design`) | 🟡 Code fertig, `check` und `build` laufen, Browser-Test offen |
| 7 | Loading, Error and Empty States | 🟡 in Arbeit (siehe Stand im Abschnitt) |
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

```ts
todosRouter.delete("/:id", async (request, response) => {
  const deleteTodo = await todoModel.findByIdAndDelete(request.params.id);
  if (!deleteTodo) {
    return response.status(404).json({ error: "Todo not found" });
  }

  response.status(204).send();
});
```

- `findByIdAndDelete` gibt `null` zurück, wenn es das Todo nicht gibt. Daraus wird 404. Zweimal löschen gibt beim zweiten Mal 404.
- Ungültige `id` (`abc`): Mongoose wirft den `CastError`, `errors.ts` macht daraus 404.

### Frontend

`api.ts`:

```ts
export const deleteTodo = async (id: string) => {
  const response = await fetch(`${API_URL}/todos/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Todo nicht gefunden");
  }
};
```

`App.tsx`: der Button steht im Edit-Modus, neben Save und Cancel.

```tsx
<button
  aria-label={`delete todo: ${todo.title}`}
  onClick={async () => {
    await deleteTodo(todo.id);
    await mutate("todos");
  }}
>
  <Trash size={16} color="red" />
</button>
```

**Merke:**
- Bei 204 gibt es keinen Body. Antwort im Backend mit `.status(204).send()`, nicht mit `.json(...)`. Im Frontend kein `response.json()`, sonst wirft die Funktion trotz erfolgreichem Löschen einen Fehler.
- `deleteTodo` gibt nichts zurück, der Typ ist von selbst `Promise<void>`. Kein `Promise<Todo>` hinschreiben.
- Die `id` steht in der URL. Ein DELETE braucht keinen Body und keinen `Content-Type`.
- Ohne `await` vor `deleteTodo(...)` läuft `mutate` zu früh los, die Liste lädt dann mit dem alten Stand. TypeScript meldet das nicht.

### Abweichung vom Issue

Das Issue verlangt "every todo has a Delete button". Im gemergten Stand steht der Button nur im Edit-Modus, das UI-Kriterium ist bei GitHub deshalb **nicht** abgehakt. Auf dem Branch `design` steht der Button zusätzlich im normalen Modus, neben Edit.

### Fehler, die uns passiert sind

| Fehler | Richtig |
|---|---|
| `status(204).json(toTodo(...))` | `status(204).send()`, kein Body |
| Variable zu `deleteTodo` umbenannt, Zeile darunter nutzt noch `editTodo` | Nach jedem Umbenennen alle Stellen prüfen, `npm run typecheck` zeigt es |
| `deleteTodo` aus `editTodo` kopiert: `Promise<Todo>`, `body`, `response.json()`, Text "bearbeitet" | Beim Kopieren Typ, Body, Rückgabe und Fehlertext anpassen |
| `deleteTodo(todo.id);` ohne `await` | `await deleteTodo(todo.id);` vor `mutate` |
| Delete-Button beim Aufräumen in den Edit-Zweig gerutscht | Bewusst entscheiden, in welchem Zweig der Button steht |

### Geprüft

- Bruno: 204, dieselbe Anfrage noch einmal (404), ungültige `id` (404).
- Browser: Todo löschen, es verschwindet sofort und bleibt nach dem Reload weg.

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

**Stand (2026-11-23), Lösungscode kommt erst, wenn das Issue fertig ist:**

| Anforderung | Stand |
|---|---|
| "Try again" bei Ladefehler | ✅ im Browser geprüft |
| Fehler bei Edit (Speichern), Delete (Edit-Modus), Checkbox anzeigen, Liste bleibt | ✅ in `App.tsx`, Type-Check grün, Browser-Test mit gestopptem Backend offen |
| Fehler bei Add | ⬜ (`Form.tsx`) |
| Text bleibt nach fehlgeschlagenem Speichern | ✅ beim Edit, ⬜ bei Add |
| Leere Liste: freundlicher Hinweis | ⬜ |
| "Add" während der Anfrage deaktiviert | ⬜ |

**Merke (bisher):**
- `useSWR` gibt ein eigenes `mutate` zurück. Beim Destructuring mit `mutate: neuerName` umbenennen, weil das globale `mutate` aus dem Import sonst verdeckt wird.
- Ladefehler und Aktionsfehler sind zwei Dinge. Ein Ladefehler ersetzt die Seite (früher `return`), ein Aktionsfehler ist ein State und steht im Haupt-`return`, damit die Liste sichtbar bleibt.
- Ein `catch` ohne Variable reicht, wenn man einen eigenen Text zeigt. Rohe Fehlertexte (`Failed to fetch`) sind für Nutzer nutzlos.
- Eine gute Meldung sagt, was passiert ist und was man tun kann, und passt zur Aktion.
- `setErrMsg("")` gehört in den Erfolgsfall, sonst bleibt die alte Meldung stehen.
- `setCurrEditTodo(null)` steht nach `await editTodo` im `try`: Bei einem Fehler wird es nie erreicht, der Edit-Modus und der getippte Text bleiben.

| Fehler | Richtig |
|---|---|
| `setErrMsg(instanceof Error.message)` | `instanceof` braucht links einen Wert: `fehler instanceof Error` |
| `setErrMsg(err.message)` außerhalb des `if (err instanceof Error)` | Die Typprüfung gilt nur innerhalb des `if`-Blocks. Mit eigenem Text ist sie unnötig |
| Meldung als frühes `return` oben | Das ersetzt die ganze Seite. Die Meldung gehört in den Haupt-`return` |
| Text "nicht gelöscht" beim Speichern (Copy-Paste) | Meldung passend zur Aktion schreiben |
| `try/catch` um reine State-Änderungen (Stift-Button) | Nur um Aufrufe, die fehlschlagen können (`await` auf die API) |

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

## Design: Bootstrap im Cyberpunk-Look

**Ziel:** Minimalistisches, utilitaristisches Design im Stil von Cyberpunk 2077 und Marathon, mit Bootstrap und lucide-Icons. Weniger ist mehr: ein dunkler, flacher Hintergrund, **eine** Akzentfarbe, keine Glows. Nur Optik, keine neue Logik. Branch `design`, kein Issue.

### Setup

```bash
cd frontend
npm i bootstrap @fontsource/jetbrains-mono
```

`index.html`: Dark-Mode von Bootstrap einschalten.

```html
<html lang="en" data-bs-theme="dark">
```

`src/index.tsx`: Bootstrap und Font **vor** `styles.css` importieren.

```tsx
import "bootstrap/dist/css/bootstrap.min.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/700.css";
import App from "./App";
import "./styles.css";
```

### Theme in `styles.css`

Farben stehen als Variablen in `:root`, Bootstrap-Variablen werden überschrieben, nicht mit `!important` übersteuert.

```css
:root {
  --ui-bg: #050505;
  --ui-panel: #111112;
  --ui-yellow: #fcee09;
  --ui-cyan: #02d7f2;
  --ui-red: #ff003c;
  --cut: 8px;
  /* ... */
}

[data-bs-theme="dark"] {
  --bs-body-bg: var(--ui-bg);
  --bs-body-font-family: "JetBrains Mono", ui-monospace, monospace;
  --bs-border-radius: 0;
  /* ... */
}
```

Gestaltungsregeln:
Anlehnung an das UI von Cyberpunk 2077:
- Schwarz als Grund, Gelb (`#fcee09`) als Markenfarbe, Cyan (`#02d7f2`) für Zweitaktionen und Nummern, Rot (`#ff003c`) für Löschen und Fehler.
- Die Kopfzeile ist ein gelber Balken mit schwarzer Schrift, in Großbuchstaben und weit gesperrt.
- Alle Flächen (Kopfzeile, Karten, Buttons) haben zwei abgeschnittene Ecken, oben links und unten rechts. Das macht `clip-path: polygon(...)` mit der Variable `--cut`.
- Buttons sind gefüllt und haben keinen Rahmen. Hover und Fokus füllen sie mit der Akzentfarbe.
- Das Eingabefeld hat eine linke Kante in Cyan, die beim Fokus gelb wird.
- Die Karte ist die Checkbox. Das `<input type="checkbox">` bleibt im Markup (Klasse `visually-hidden`), damit Tastatur und Screenreader funktionieren. Das `::after` des Labels spannt sich mit `position: absolute; inset: 0` über die ganze Karte (Elternelement hat `position: relative`), ein Klick irgendwo auf der Karte schaltet um. Die Buttons haben `position: relative; z-index: 1`, sonst liegt das Label darüber.
- Lesbarkeit: Der Titel ist das Wichtigste der Karte. Er ist weiß, fett und 1.125rem groß (`line-height: 1.35`). Die Nummer ist kleiner und gesperrt, die Karte hat mehr Innenabstand (`0.875rem 1rem`). Das Kreuz ist mit 30 % Deckkraft so blass, dass es den Text nicht stört.
- Erledigt: rote linke Kante und ein rotes Kreuz über die ganze Karte. Das Kreuz sind zwei `linear-gradient`s (`to top right` und `to bottom right`) als `background-image`, ausgelöst mit `:has(.todo-title.done)`.
- Fokus per Tastatur: `:has(input:focus-visible)` zeichnet einen gelben Innenrahmen. Ein normaler `outline` würde von `clip-path` abgeschnitten.
- Jede Zeile hat eine Nummer, ohne extra Markup: `counter-reset` an der Liste, `counter-increment` und `::before` am Eintrag.
- Ein blinkender Cursor `_` steht bei Lade- und Leer-Zustand (aus bei `prefers-reduced-motion`).
- Kein Raster, kein Glow, keine Schatten.

Die alten globalen Regeln für `button` und `input` sind weg, sie kollidieren mit Bootstrap. Ebenso `.todo-form`, die Klasse hat die Form nie benutzt.

### Markup

`App.tsx`: Bootstrap-Klassen am bestehenden Markup, Logik und `aria-label`s unverändert.

```tsx
<ul className="todo-list list-group">
  <li className="todo-item list-group-item d-flex flex-column gap-3" key={todo.id}>
```

Die Liste ist ein CSS-Grid mit drei Karten pro Reihe (`grid-template-columns: repeat(3, 1fr)`). Unter 768px sind es zwei, unter 480px eine Spalte. Die Buttons einer Karte stehen in `<div className="todo-actions">`, `margin-top: auto` schiebt sie nach unten.

```tsx
<button
  type="button"
  className="btn btn-sm btn-outline-danger"
  aria-label={`delete todo: ${todo.title}`}
  onClick={async () => {
    await deleteTodo(todo.id);
    await mutate("todos");
  }}
>
  <Trash size={16} />
</button>
```

`Form.tsx`: `input-group`, Placeholder und ein `Plus`-Icon statt des Textes "submit".

```tsx
<form className="input-group mb-4" onSubmit={handleSubmit}>
  <input className="form-control" placeholder="NEW TASK..." aria-label="new todo title" ... />
  <button className="btn btn-accent" aria-label="add todo" disabled={title.trim() === ""} type="submit">
    <Plus size={18} />
  </button>
</form>
```

**Merke:**
- Reihenfolge der Imports: erst Bootstrap, dann das eigene CSS. Sonst überschreibt Bootstrap deine Regeln.
- `data-bs-theme="dark"` am `<html>` schaltet alle Bootstrap-Komponenten auf dunkel.
- Farbe von Buttons kommt von der Klasse (`btn-accent`, `btn-outline-danger`), nicht vom Icon. Das Inline-`color="red"` am `Trash` ist weg.
- `btn-accent` ist eine eigene Klasse. Sie setzt nur die Bootstrap-Button-Variablen (`--bs-btn-bg` und so weiter), so bleibt Bootstrap intakt.
- Bei `clip-path` wird auch ein Rahmen an der Ecke abgeschnitten. Deshalb haben Buttons und Zeilen keinen Rahmen, sondern eine Füllung und nur eine linke Kante.
- Ein Button, der nur ein Icon zeigt, braucht ein `aria-label`. Das gilt auch für den neuen Add-Button.
- Jeder Button hat jetzt `type="button"`, nur der Submit-Button im Formular nicht.
- `npm run check` und `npm run build` prüfen keine Optik. Aussehen, Fokus und schmale Breite (~375px) prüft nur der Browser.

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
