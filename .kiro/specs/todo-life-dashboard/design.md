# Design Document: To-Do Life Dashboard

## Overview

The To-Do Life Dashboard is a zero-dependency, single-page web application that runs entirely in the browser from the local file system. It bundles six interactive widgets — a greeting panel, a Pomodoro timer, a to-do list, a quick-links manager, a theme toggle, and a custom-name setting — into one cohesive productivity hub.

**Technology stack:**
- HTML5 (semantic markup, no frameworks)
- CSS3 (custom properties for theming, CSS Grid / Flexbox layout)
- Vanilla JavaScript ES2020+ (modules are avoided because `file://` blocks ES module imports in some browsers; the entire app lives in a single IIFE in `js/app.js`)
- Browser `localStorage` API for all persistence

**Design goals:**
1. Fully functional via `file://` protocol in Chrome, Firefox, Edge, and Safari current stable.
2. No build tools, no polyfills, no external requests after the three files load.
3. Sub-100 ms visual acknowledgement for every user interaction.
4. Clean separation of concerns through named function groups inside the single IIFE.

---

## Architecture

The application follows a **modular function-group architecture** inside a single IIFE. Each widget corresponds to one JS module-group (a plain object or a set of prefixed functions). A lightweight reactive layer called `State` holds all in-memory data and calls `Storage.save()` on every mutation.

```
┌─────────────────────────────────────────────────────────┐
│                     index.html                          │
│  References css/style.css   References js/app.js        │
└───────────────┬─────────────────────────┬───────────────┘
                │                         │
     ┌──────────▼──────────┐   ┌──────────▼──────────────┐
     │    css/style.css     │   │       js/app.js          │
     │  CSS custom props    │   │  ┌─────────────────────┐ │
     │  Light/Dark themes   │   │  │   State (in-memory) │ │
     │  Grid/Flex layout    │   │  └────────┬────────────┘ │
     └──────────────────────┘   │           │ mutates       │
                                │  ┌────────▼────────────┐ │
                                │  │  Storage (wrapper)  │ │
                                │  │  localStorage r/w   │ │
                                │  └────────┬────────────┘ │
                                │           │               │
                                │  Widget function groups: │
                                │  • Greeting              │
                                │  • Timer                 │
                                │  • TaskManager           │
                                │  • LinkManager           │
                                │  • ThemeToggle           │
                                │  • NameSetting           │
                                └─────────────────────────┘
```

### Data Flow

1. On `DOMContentLoaded` the app calls `Storage.loadAll()` to populate `State`.
2. Each widget's `init()` function reads from `State` and renders its DOM.
3. User interactions call widget functions → mutate `State` → call `Storage.save(key, value)` → re-render affected widget(s).
4. The clock tick (1-second `setInterval`) updates `State.now` and triggers a lightweight re-render of just the greeting time display.

---

## Components and Interfaces

### 1. State Object

The central in-memory store. All widget functions read from and write to this object exclusively. `Storage` is called only from state mutation helpers, never from widgets directly.

```
State = {
  name:         string | null,
  theme:        "light" | "dark",
  timer: {
    durationMin: number,        // 1–180
    remainingSec: number,
    running:     boolean,
    intervalId:  number | null
  },
  tasks:        Task[],
  sortOption:   SortOption,
  links:        QuickLink[],
  now:          Date             // updated every second, never persisted
}
```

### 2. Storage Module

Thin wrapper around `localStorage` with error handling.

```
Storage.save(key, value)   // JSON.stringify(value), catch QuotaExceededError
Storage.load(key)          // JSON.parse, return null on parse error or missing
Storage.remove(key)        // localStorage.removeItem
Storage.loadAll()          // loads all persisted keys into State
```

Keys used:
| Key | Value type |
|-----|-----------|
| `dashboard_name` | string |
| `dashboard_theme` | `"light"` \| `"dark"` |
| `dashboard_timer_duration` | number |
| `dashboard_tasks` | `Task[]` |
| `dashboard_sort` | `SortOption` |
| `dashboard_links` | `QuickLink[]` |

### 3. Greeting Widget

**Functions:** `Greeting.render()`, `Greeting.tick()`

Reads `State.now` and `State.name`. Derives time-of-day bucket, formats time and date strings, builds greeting text, and updates three DOM text nodes (time, date, greeting).

- `tick()` is called every second by the global clock interval; it updates `State.now = new Date()` then calls `Greeting.render()`.
- If `new Date()` yields an invalid date the fallback strings `"--:--"`, `"Date unavailable"`, and no greeting phrase are used.

### 4. Name Setting

**Functions:** `NameSetting.init()`, `NameSetting.save(inputValue)`

- `save()` trims the input; if non-empty saves to `State.name` + `Storage`; if empty clears both.
- Calls `Greeting.render()` immediately after.

### 5. Timer

**Functions:** `Timer.init()`, `Timer.start()`, `Timer.stop()`, `Timer.reset()`, `Timer.tick()`, `Timer.render()`

State machine transitions:

```
STOPPED ──start()──► RUNNING
RUNNING ──stop()───► STOPPED
RUNNING ──reset()──► STOPPED (duration restored)
STOPPED ──reset()──► STOPPED (duration restored)
RUNNING ──tick() reaching 0──► STOPPED + notification
```

- `tick()` is called by a 1-second `setInterval` stored in `State.timer.intervalId`.
- `render()` updates the MM:SS display and button enabled/disabled states.
- On session complete: clears interval, shows an on-page `<div id="timer-notification">`.

### 6. Configurable Timer Duration

Part of the Timer component. `Timer.setDuration(rawInput)` validates the input (integer 1–180), updates `State.timer.durationMin`, saves to Storage, then calls `Timer.reset()`.

### 7. Task Manager

**Functions:** `TaskManager.init()`, `TaskManager.add(title)`, `TaskManager.edit(id, newTitle)`, `TaskManager.delete(id)`, `TaskManager.toggleComplete(id)`, `TaskManager.sort()`, `TaskManager.render()`

- Tasks are stored in `State.tasks` as an array.
- `add()` trims, checks empty, checks duplicate (case-insensitive), then pushes a new `Task` and saves.
- `edit()` trims, runs the same checks (excluding the task being edited), updates, saves.
- `delete()` shows a `window.confirm()` dialog for confirmation before removing.
- `sort()` applies the current `State.sortOption` to a *copy* of the array for display; `State.tasks` retains insertion order.
- `render()` re-renders the task list DOM using the sorted copy.

### 8. Link Manager

**Functions:** `LinkManager.init()`, `LinkManager.add(label, url)`, `LinkManager.delete(id)`, `LinkManager.render()`

- `add()` trims both fields, validates label non-empty and URL matches `/^https?:\/\/.+/`.
- Each rendered link button has `target="_blank" rel="noopener noreferrer"`.
- Empty state message shown when `State.links.length === 0`.

### 9. Theme Toggle

**Functions:** `ThemeToggle.init()`, `ThemeToggle.toggle()`

- Applies theme by setting `document.documentElement.dataset.theme = theme`.
- CSS custom properties on `:root[data-theme="dark"]` override the light-mode defaults.
- Theme is applied before first paint by an inline `<script>` in `<head>` that reads `localStorage` directly (this is the only permitted inline script — it contains no application logic, just the one-liner theme read to prevent flash).

---

## Data Models

### Task

```typescript
interface Task {
  id:        string;   // crypto.randomUUID() or Date.now().toString() fallback
  title:     string;   // trimmed, 1–255 chars
  complete:  boolean;  // default false
  createdAt: number;   // Date.now() at creation, used for insertion-order sort
}
```

### QuickLink

```typescript
interface QuickLink {
  id:    string;   // crypto.randomUUID() or Date.now().toString() fallback
  label: string;   // trimmed, 1–50 chars
  url:   string;   // trimmed, matches /^https?:\/\/.+/
}
```

### SortOption

```typescript
type SortOption =
  | "insertion"   // default — order by Task.createdAt ascending
  | "az"          // case-insensitive A→Z by title
  | "za"          // case-insensitive Z→A by title
  | "incomplete"  // incomplete first, then complete; ties by createdAt
  | "complete";   // complete first, then incomplete; ties by createdAt
```

### Storage Schema (localStorage keys)

All values are JSON-serialised. On parse failure the affected key is discarded and re-initialised to its default.

| Key | JSON type | Default |
|-----|-----------|---------|
| `dashboard_name` | `string \| null` | `null` |
| `dashboard_theme` | `"light" \| "dark"` | `"light"` |
| `dashboard_timer_duration` | `number` | `25` |
| `dashboard_tasks` | `Task[]` | `[]` |
| `dashboard_sort` | `SortOption` | `"insertion"` |
| `dashboard_links` | `QuickLink[]` | `[]` |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

**Property reflection notes:** After prework analysis, the following consolidations were applied:
- Requirements 1.3–1.6 (four greeting-phrase time ranges) are combined into one exhaustive partition property — testing all 24 hours in a single property is more comprehensive than four separate properties.
- Requirements 5.2 (trimming) and 5.3 (add round-trip) are combined: the round-trip property already implies correct trimming if we check that the stored title equals the trimmed input.
- Requirements 5.4 and 6.2 are kept separate because edit adds the "excluding self from duplicate check" nuance not present in add.
- Requirements 11.2 and 11.3 are combined into one toggle round-trip property since saving is always part of the toggle operation.
- Requirements 2.2 and 1.7 are combined: name trim/persistence and greeting display are two halves of the same operation.

---

### Property 1: Greeting phrase covers every hour exactly once

*For any* integer `h` in [0, 23], the greeting phrase derivation function should return exactly one of "Good Morning", "Good Afternoon", "Good Evening", or "Good Night", with the specific phrase determined by: 5–11 → "Good Morning", 12–17 → "Good Afternoon", 18–21 → "Good Evening", 22–23 and 0–4 → "Good Night". No hour should produce a different phrase or an error.

**Validates: Requirements 1.3, 1.4, 1.5, 1.6**

---

### Property 2: Task add round-trip — title is trimmed and complete defaults to false

*For any* string containing at least one non-whitespace character that is not a case-insensitive match for any existing task title, adding it to the task list and then serialising and deserialising the task array via the Storage module should produce a task list where the newly added task has a title equal to the trimmed input and a `complete` value of `false`.

**Validates: Requirements 5.2, 5.3, 7.1, 12.2**

---

### Property 3: Duplicate task rejection is case-insensitive and preserves list

*For any* task list containing a task with title `T`, attempting to add any string whose trimmed, lowercased form equals the lowercased form of `T` should be rejected, and the task list length should remain unchanged after the attempt.

**Validates: Requirements 5.4, 8.2**

---

### Property 4: Whitespace-only inputs are always rejected for both add and edit

*For any* string composed entirely of Unicode whitespace characters (spaces, tabs, newlines), the `add` operation and the `edit` operation should both reject it and leave the task list in its pre-operation state (same length, same task titles).

**Validates: Requirements 5.5, 6.2**

---

### Property 5: Sort reorders display only — storage order is never mutated

*For any* non-empty task list and any valid sort option ("az", "za", "incomplete", "complete", "insertion"), applying `TaskManager.sort()` should produce a correctly ordered display array while leaving `State.tasks` in its original insertion order; alphabetical sorts should be case-insensitive (a lowercased "Banana" sorts the same as "banana").

**Validates: Requirements 8.2**

---

### Property 6: Timer duration validation — accept iff integer in [1, 180]

*For any* value passed to `Timer.setDuration()`, the function should accept the value and update the duration if and only if the value is a whole number (no fractional part) in the closed integer range [1, 180]; for all other values (fractions, strings, negative numbers, zero, values > 180), the function should reject the input and leave the previously active duration unchanged.

**Validates: Requirements 4.2, 4.4**

---

### Property 7: Timer running-flag invariant holds across all event sequences

*For any* sequence of `start()`, `stop()`, and `reset()` calls interleaved with any number of `tick()` calls (where remaining time > 0), the timer's `running` flag should be `false` immediately after any `stop()` or `reset()` call, and `true` only immediately after a `start()` call while remaining time is greater than zero; this invariant should hold regardless of the order or length of the event sequence.

**Validates: Requirements 3.3, 3.4, 3.5, 3.7, 3.8, 3.9**

---

### Property 8: Quick Link URL validation matches the spec pattern

*For any* string, the URL validation function should return `true` if and only if the string matches `/^https?:\/\/.+/` (i.e., starts with `http://` or `https://` followed by at least one character); strings that begin with `ftp://`, are empty, contain only `http://`, or have no scheme should all be rejected.

**Validates: Requirements 9.2, 9.5**

---

### Property 9: Theme toggle is a round-trip over the two-value domain

*For any* initial theme value ("light" or "dark"), calling `ThemeToggle.toggle()` once should produce the opposite theme and save it to the localStorage mock, and calling it a second time should return to the original theme; at no point should the theme be a value outside {"light", "dark"}.

**Validates: Requirements 11.2, 11.3**

---

### Property 10: Name save trims input and is immediately reflected in the greeting

*For any* string containing at least one non-whitespace character and whose length after trimming is between 1 and 50 characters, calling `NameSetting.save()` with that string should store the trimmed value in `State.name` and in the localStorage mock, and the immediately rendered greeting text should contain the trimmed name as a suffix.

**Validates: Requirements 2.2, 1.7**

---

## Error Handling

### localStorage Unavailability

All `Storage.save()` calls are wrapped in `try/catch`. On error:
- The in-memory `State` is still updated (change is applied for the current session).
- A non-blocking toast notification is shown for 4 seconds using a `<div id="toast">` element with CSS transitions.
- The error is logged to `console.warn` with the key and original error.

Affected requirements: 2.5, 4.7, 6.7, 10.3, 11.6, 12.3.

### Corrupted localStorage Values

`Storage.load(key)` wraps `JSON.parse` in `try/catch`. On parse error:
- The key is removed via `localStorage.removeItem(key)`.
- The default value for that data type is returned.
- A single consolidated non-blocking toast is shown once on load if any corruption was detected.

Affected requirements: 12.6.

### Invalid User Input

Each widget's input handler validates before state mutation:
- Empty / whitespace-only strings: inline error message adjacent to the input field, no state change.
- Duplicate task titles: inline error message, no state change.
- Timer duration out of range: inline error message adjacent to the input, previous duration retained.
- Invalid Quick Link URL: inline error message, no state change.

All inline errors are cleared on the next valid submission or when the user modifies the input.

### Timer Reaching Zero

When `State.timer.remainingSec` reaches 0 during `Timer.tick()`:
- `clearInterval(State.timer.intervalId)` is called.
- `State.timer.running = false`.
- `State.timer.remainingSec` is set to 0 (stays at `00:00`).
- An on-page notification div (`#timer-notification`) is shown.
- Button states are updated via `Timer.render()`.

### Date / Clock Unavailability

If `new Date()` returns an invalid date (checked via `isNaN(date.getTime())`):
- Time display: `"--:--"`.
- Date display: `"Date unavailable"`.
- Greeting phrase: omitted (only name, if set, is shown).

---

## Testing Strategy

### Overview

This feature is a Vanilla JS browser application with pure business-logic functions that operate on plain data structures. The core functions (greeting derivation, task CRUD, URL validation, timer state machine, sort logic, Storage serialisation) are all pure or near-pure and amenable to **property-based testing** using [fast-check](https://github.com/dubzzz/fast-check) in a Node.js + jsdom test environment.

UI rendering and `localStorage` integration will be covered by **example-based unit tests** using jsdom mocks.

### Property-Based Tests (fast-check)

Each property from the Correctness Properties section is implemented as a single `fc.assert(fc.property(...))` test running a minimum of **100 iterations**.

Each test is tagged with a comment:
```
// Feature: todo-life-dashboard, Property N: <property_text>
```

| Property | Test description |
|----------|-----------------|
| 1 | Generate integers 0–23 with `fc.integer({min:0, max:23})`; verify `getGreetingPhrase(h)` returns the correct phrase for every hour; verify the 4 phrases are the only possible outputs |
| 2 | Generate non-empty task titles with `fc.string({minLength:1})`; add → JSON.stringify → JSON.parse; verify stored title === trimmed input and `complete === false` |
| 3 | Generate task title + casing variants with `fc.string` + uppercase/lowercase transform; verify second add rejected and list length unchanged |
| 4 | Generate whitespace-only strings with `fc.stringOf(fc.constantFrom(' ', '\t', '\n'))`; verify both add and edit reject them |
| 5 | Generate task arrays with `fc.array(taskArb)` + `fc.constantFrom(...sortOptions)`; apply sort; verify original `State.tasks` reference unchanged and display order is correctly sorted |
| 6 | Generate `fc.oneof(fc.integer(), fc.float(), fc.string())`; verify `setDuration` accepts iff integer in [1, 180] |
| 7 | Generate event sequences `fc.array(fc.constantFrom('start','stop','reset'))` interleaved with tick counts; verify `running` flag invariant after each event |
| 8 | Generate `fc.string()` + crafted valid URLs; verify URL validation accepts iff `/^https?:\/\/.+/` matches |
| 9 | Generate starting theme with `fc.constantFrom('light','dark')`; toggle twice; verify round-trip and intermediate validity |
| 10 | Generate strings with at least one non-whitespace char, length 1–50 after trim; verify `State.name === trimmed` and greeting text ends with `, ${trimmed}` |

### Example-Based Unit Tests

- **Storage module**: mock `localStorage`, test `save`/`load`/`remove`/`loadAll` with normal and error paths.
- **Timer**: test `start` → multiple `tick()` → reaches zero notification; test `reset` while running.
- **Task Manager**: test add/edit/delete/toggleComplete with specific examples including edge cases (exactly 255 chars, exactly 50 chars for name).
- **Link Manager**: test deletion with empty list produces empty-state message.
- **Theme**: test that `document.documentElement.dataset.theme` is set correctly on toggle.

### Integration / Smoke Tests

- Open `index.html` in a real browser (or Playwright headless) and verify:
  - No console errors on initial load.
  - All six widgets render.
  - `localStorage` keys exist after one interaction per widget.
  - LCP < 2 s (Lighthouse CI or manual check).

### Test Runner

**Vitest** (or Jest) with **jsdom** environment for unit and property tests. No build step is needed for the app itself; a minimal `package.json` (dev-only) provides the test runner.

Run tests with:
```
npx vitest --run
```

### Coverage Goals

- 100% of Correctness Properties covered by property-based tests.
- All error-handling branches covered by example-based tests.
- All validation paths (empty, duplicate, out-of-range) covered by example-based tests.
