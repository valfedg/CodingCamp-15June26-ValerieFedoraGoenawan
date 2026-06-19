# Implementation Plan: To-Do Life Dashboard

## Overview

Build a single-page, zero-dependency productivity dashboard that runs from the local file system. The implementation progresses from project scaffolding through the Storage/State layer, then each of the six widget function groups, finishing with the test suite. All code lives in three files: `index.html`, `css/style.css`, and `js/app.js` (one IIFE).

---

## Tasks

- [~] 1. Scaffold project structure and base HTML
  - Create `index.html` at the project root with semantic HTML5 structure: `<head>` (meta charset, viewport, title, link to `css/style.css`), an inline one-liner `<script>` in `<head>` that reads `localStorage.getItem('dashboard_theme')` and sets `document.documentElement.dataset.theme` to prevent flash, and `<body>` containing placeholder sections for each of the six widgets plus a `<div id="toast">` and `<div id="timer-notification">`.
  - Create `css/style.css` with CSS custom properties on `:root` (light theme defaults) and `:root[data-theme="dark"]` overrides; include a CSS Grid / Flexbox page layout, base widget card styles, strikethrough style for completed tasks, and toast/notification transition styles.
  - Create `js/app.js` with the outer IIFE skeleton `(function() { 'use strict'; /* … */ })();` and a `DOMContentLoaded` listener.
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 14.2, 11.4_

- [ ] 2. Implement the Storage module
  - [x] 2.1 Write the `Storage` object inside the IIFE with `save(key, value)`, `load(key)`, `remove(key)`, and `loadAll()` methods.
    - `save`: `JSON.stringify` + `localStorage.setItem`, wrapped in `try/catch`; on `QuotaExceededError` or any error, call `showToast()` with a persistence-failure message.
    - `load`: `localStorage.getItem` + `JSON.parse` wrapped in `try/catch`; on parse failure remove the bad key and return `null`.
    - `remove`: `localStorage.removeItem`.
    - `loadAll`: reads all six keys (`dashboard_name`, `dashboard_theme`, `dashboard_timer_duration`, `dashboard_tasks`, `dashboard_sort`, `dashboard_links`) into `State`, falling back to defaults for any missing or corrupt entry; shows one consolidated toast if any corruption was detected.
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [~] 2.2 Write example-based unit tests for the Storage module
    - Mock `localStorage` with a simple in-memory Map; test `save`/`load` round-trip for each of the six keys.
    - Test that `save` calls `showToast` when `localStorage.setItem` throws.
    - Test that `load` returns `null` and removes the key when the stored value is malformed JSON.
    - Test `loadAll` with a mix of valid, missing, and corrupt entries; verify defaults are applied and toast is shown once for corruption.
    - _Requirements: 12.3, 12.6_

- [x] 3. Implement the State object and initialisation
  - [x] 3.1 Define the `State` object with all fields: `name`, `theme`, `timer` (with `durationMin`, `remainingSec`, `running`, `intervalId`), `tasks`, `sortOption`, `links`, and `now`.
    - Wire `DOMContentLoaded` to call `Storage.loadAll()` (populates `State`) followed by each widget's `init()` function in order: `ThemeToggle.init()`, `Greeting.init()`, `NameSetting.init()`, `Timer.init()`, `TaskManager.init()`, `LinkManager.init()`.
    - _Requirements: 12.4, 12.5, 13.3_

- [ ] 4. Implement the ThemeToggle widget
  - [-] 4.1 Write `ThemeToggle.init()` and `ThemeToggle.toggle()`.
    - `init()`: reads `State.theme`, sets `document.documentElement.dataset.theme`, and updates the toggle button label/icon.
    - `toggle()`: flips `State.theme` between `"light"` and `"dark"`, sets `document.documentElement.dataset.theme`, calls `Storage.save('dashboard_theme', State.theme)`, and updates the button label within 100 ms.
    - If `localStorage` is unavailable, the in-memory state still flips silently (no error toast per requirement 11.6).
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [-] 4.2 Write property test for ThemeToggle — Property 9: Theme toggle round-trip
    - **Property 9: Theme toggle is a round-trip over the two-value domain**
    - **Validates: Requirements 11.2, 11.3**
    - Use `fc.constantFrom('light', 'dark')` as the starting theme; call `toggle()` twice; assert the theme returns to the starting value and that both intermediate and final values are members of `{"light", "dark"}`.

- [ ] 5. Implement the Greeting widget
  - [-] 5.1 Write the `getGreetingPhrase(hour)` pure function and `Greeting.render()` / `Greeting.tick()`.
    - `getGreetingPhrase(h)`: maps integer hours 0–23 to the four phrases per requirements 1.3–1.6.
    - `render()`: reads `State.now` and `State.name`; formats time as HH:MM and date as a human-readable string; falls back to `"--:--"` / `"Date unavailable"` / no phrase if `isNaN(State.now.getTime())`; appends `, ${State.name}` only when name is a 1–50 char string.
    - `tick()`: sets `State.now = new Date()`, calls `Greeting.render()`.
    - Start the 1-second `setInterval` for `Greeting.tick()` in `Greeting.init()`.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

  - [-] 5.2 Write property test for Greeting — Property 1: Greeting phrase covers every hour exactly once
    - **Property 1: Greeting phrase covers every hour exactly once**
    - **Validates: Requirements 1.3, 1.4, 1.5, 1.6**
    - Use `fc.integer({min: 0, max: 23})`; assert `getGreetingPhrase(h)` returns exactly one of the four valid phrases; assert the mapping matches the specified time ranges.

- [ ] 6. Implement the NameSetting widget
  - [-] 6.1 Write `NameSetting.init()` and `NameSetting.save(inputValue)`.
    - `init()`: populates the name input field with `State.name` (empty string if null).
    - `save()`: trims `inputValue`; if non-empty and ≤ 50 chars, sets `State.name` and calls `Storage.save('dashboard_name', State.name)`; if empty/whitespace, sets `State.name = null` and calls `Storage.remove('dashboard_name')`; calls `Greeting.render()` immediately after either branch.
    - Show inline error if trimmed value exceeds 50 characters (input is already limited via `maxlength="50"` in HTML but guard in JS too).
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [-] 6.2 Write property test for NameSetting — Property 10: Name save trims input and updates greeting
    - **Property 10: Name save trims input and is immediately reflected in the greeting**
    - **Validates: Requirements 2.2, 1.7**
    - Use `fc.string({minLength: 1})` filtered to strings that have at least one non-whitespace character and whose trimmed length is ≤ 50; after `NameSetting.save()`, assert `State.name === inputValue.trim()` and that the greeting element's text content contains `, ${inputValue.trim()}`.

- [ ] 7. Implement the Timer widget (state machine + display)
  - [-] 7.1 Write `Timer.init()`, `Timer.start()`, `Timer.stop()`, `Timer.reset()`, `Timer.tick()`, and `Timer.render()`.
    - `init()`: reads `State.timer.durationMin` (from `State` populated by `Storage.loadAll()`), sets `State.timer.remainingSec = durationMin * 60`, renders MM:SS, and sets correct button states.
    - `start()`: only if not running; starts `setInterval(Timer.tick, 1000)` stored in `State.timer.intervalId`; sets `State.timer.running = true`; calls `Timer.render()`.
    - `stop()`: clears interval; sets `State.timer.running = false`; calls `Timer.render()`.
    - `reset()`: clears interval if running; restores `State.timer.remainingSec = State.timer.durationMin * 60`; sets `running = false`; calls `Timer.render()`.
    - `tick()`: decrements `State.timer.remainingSec`; if it reaches 0, calls `Timer.stop()` and shows `#timer-notification`; calls `Timer.render()`.
    - `render()`: formats MM:SS; toggles Start/Stop disabled states (Start disabled while running, Stop disabled while stopped).
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

  - [-] 7.2 Write property test for Timer — Property 7: Running-flag invariant across event sequences
    - **Property 7: Timer running-flag invariant holds across all event sequences**
    - **Validates: Requirements 3.3, 3.4, 3.5, 3.7, 3.8, 3.9**
    - Use `fc.array(fc.constantFrom('start', 'stop', 'reset'), {minLength: 1, maxLength: 20})` interleaved with random `tick` counts; assert `running === false` after any `stop` or `reset`, `running === true` only after `start` when `remainingSec > 0`.

  - [-] 7.3 Write example-based unit tests for the Timer
    - Test: `start()` → five `tick()` calls → verify `remainingSec` decremented by 5.
    - Test: `reset()` while running stops the interval and restores duration.
    - Test: `tick()` reaching zero shows `#timer-notification` and sets `running = false`.
    - _Requirements: 3.6, 3.9_

- [ ] 8. Implement the configurable timer duration
  - [x] 8.1 Write `Timer.setDuration(rawInput)`.
    - Parse `rawInput` as a number; validate it is a whole number with no fractional part (`Number.isInteger`) and in [1, 180]; if valid, update `State.timer.durationMin`, call `Storage.save('dashboard_timer_duration', ...)`, and call `Timer.reset()`; if invalid, show inline error message adjacent to the duration input and leave the previous duration unchanged.
    - On `DOMContentLoaded` populate the numeric input field with `State.timer.durationMin`.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [~] 8.2 Write property test for Timer duration — Property 6: Accept iff integer in [1, 180]
    - **Property 6: Timer duration validation — accept iff integer in [1, 180]**
    - **Validates: Requirements 4.2, 4.4**
    - Use `fc.oneof(fc.integer(), fc.float(), fc.string())` as arbitrary inputs; assert `setDuration` accepts and updates `durationMin` if and only if the value is a whole number in [1, 180]; for all other inputs, assert previous `durationMin` is unchanged.

- [ ] 9. Implement the Task Manager widget
  - [x] 9.1 Write `TaskManager.init()` and `TaskManager.render()`.
    - `init()`: reads `State.tasks` and `State.sortOption`; sets up the task input, Add button, and sort control (pre-selecting the saved sort option); calls `TaskManager.render()`.
    - `render()`: calls `TaskManager.sort()` to get a display-order copy; re-renders the task list DOM — each item includes a checkbox (checked if `task.complete`), a title `<span>` (with strikethrough CSS class if complete), an Edit button, and a Delete button; shows an empty-state message when the list is empty.
    - _Requirements: 5.1, 5.6, 7.1, 7.2, 7.4, 8.1, 8.4_

  - [~] 9.2 Write `TaskManager.add(title)`.
    - Trim `title`; if empty/whitespace, show inline error and return.
    - Check for case-insensitive duplicate among `State.tasks`; if found, show inline error "Task already exists" and return.
    - Push `{ id: crypto.randomUUID() || Date.now().toString(), title: trimmed, complete: false, createdAt: Date.now() }` to `State.tasks`; call `Storage.save('dashboard_tasks', State.tasks)`; call `TaskManager.render()`.
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 12.2_

  - [~] 9.3 Write property test for Task add — Property 2: Add round-trip title trimming and complete defaults
    - **Property 2: Task add round-trip — title is trimmed and complete defaults to false**
    - **Validates: Requirements 5.2, 5.3, 7.1, 12.2**
    - Use `fc.string({minLength: 1})` filtered to non-whitespace-only, non-duplicate titles; call `TaskManager.add()`; JSON-stringify and parse `State.tasks`; assert the newest task's `title === input.trim()` and `complete === false`.

  - [~] 9.4 Write property test for Task duplicate rejection — Property 3: Case-insensitive duplicate check
    - **Property 3: Duplicate task rejection is case-insensitive and preserves list**
    - **Validates: Requirements 5.4, 8.2**
    - Use `fc.string({minLength: 1})` for an initial title; add it once; then attempt to add a casing variant (uppercase/lowercase transform); assert the second add is rejected and `State.tasks.length` is unchanged.

  - [~] 9.5 Write property test for Task whitespace rejection — Property 4: Whitespace-only inputs rejected for add and edit
    - **Property 4: Whitespace-only inputs are always rejected for both add and edit**
    - **Validates: Requirements 5.5, 6.2**
    - Use `fc.stringOf(fc.constantFrom(' ', '\t', '\n'), {minLength: 1})`; call `TaskManager.add()` and `TaskManager.edit()` with whitespace-only strings; assert `State.tasks` length and titles are unchanged after each call.

  - [~] 9.6 Write `TaskManager.edit(id, newTitle)`.
    - Trim `newTitle`; run empty-check and duplicate-check (excluding the task being edited from duplicate check); if valid, update the task's `title` in `State.tasks`, call `Storage.save`; on localStorage failure, show non-blocking toast and roll back displayed title; if invalid, show inline error.
    - Implement the Edit control UI: clicking Edit replaces the title `<span>` with a pre-populated `<input maxlength="255">`; Escape or Cancel discards changes; Save / Enter commits.
    - _Requirements: 6.1, 6.2, 6.3, 6.7_

  - [~] 9.7 Write `TaskManager.delete(id)` and `TaskManager.toggleComplete(id)`.
    - `delete()`: show `window.confirm("Delete this task?")` before removing; on confirm, splice from `State.tasks`, call `Storage.save`; on localStorage failure, show toast.
    - `toggleComplete()`: flip `task.complete`; call `Storage.save('dashboard_tasks', State.tasks)`; call `TaskManager.render()` to update strikethrough styling.
    - _Requirements: 6.4, 6.5, 6.6, 6.7, 7.2, 7.3, 12.2_

  - [x] 9.8 Write `TaskManager.sort()`.
    - Reads `State.sortOption`; returns a sorted shallow copy of `State.tasks` without mutating `State.tasks`; case-insensitive for `"az"` and `"za"` (compare `title.toLowerCase()`); tie-break by `createdAt` for `"incomplete"` and `"complete"`.
    - Wire the sort control's `change` event: update `State.sortOption`, call `Storage.save('dashboard_sort', State.sortOption)`, call `TaskManager.render()`.
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [~] 9.9 Write property test for Task sort — Property 5: Sort reorders display only, storage unchanged
    - **Property 5: Sort reorders display only — storage order is never mutated**
    - **Validates: Requirements 8.2**
    - Use `fc.array(taskArb, {minLength: 1, maxLength: 20})` and `fc.constantFrom('az', 'za', 'incomplete', 'complete', 'insertion')`; capture `State.tasks` reference before sort; assert `State.tasks` order unchanged after `TaskManager.sort()`; assert display array is correctly ordered per sort option.

- [~] 10. Checkpoint — wire Task Manager and verify core task flows
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Implement the Link Manager widget
  - [x] 11.1 Write `LinkManager.init()` and `LinkManager.render()`.
    - `init()`: reads `State.links`, wires the Add button and two inputs (label max 50, URL max 2048); calls `LinkManager.render()`.
    - `render()`: renders each Quick Link as a `<a>` or `<button>` element with `target="_blank" rel="noopener noreferrer"`; shows empty-state message `"No quick links saved yet. Add one above."` when `State.links.length === 0`; adds a Delete control next to each link.
    - _Requirements: 9.1, 9.3, 9.6, 9.7, 10.1, 10.4_

  - [x] 11.2 Write `LinkManager.add(label, url)` and `validateURL(url)`.
    - `validateURL(url)`: returns `true` iff `url` matches `/^https?:\/\/.+/`.
    - `add()`: trim both fields; if label is empty show `"Label is required"`; if URL fails validation show `"URL must begin with http:// or https://"`; if both valid, push `{ id, label: trimmed, url: trimmed }` to `State.links`, call `Storage.save`, call `LinkManager.render()`.
    - _Requirements: 9.2, 9.4, 9.5_

  - [~] 11.3 Write property test for Link Manager URL validation — Property 8: URL matches spec pattern
    - **Property 8: Quick Link URL validation matches the spec pattern**
    - **Validates: Requirements 9.2, 9.5**
    - Use `fc.string()` as arbitrary inputs plus crafted valid examples (e.g., `"https://example.com"`); assert `validateURL(s)` returns `true` iff `s` matches `/^https?:\/\/.+/`; explicitly test `"ftp://…"`, `"http://"` (no trailing char), empty string, and no-scheme strings are all rejected.

  - [x] 11.4 Write `LinkManager.delete(id)`.
    - Show `window.confirm("Remove this link?")` before deleting; on confirm, splice from `State.links`, call `Storage.save`; on localStorage failure, remove from display only, retain in-memory, show toast; call `LinkManager.render()` to update display and empty-state.
    - _Requirements: 10.2, 10.3, 10.4_

- [~] 12. Implement the toast notification utility
  - Write `showToast(message, durationMs = 4000)`: sets `#toast` text content, adds `visible` CSS class, removes it after `durationMs` ms using `setTimeout`; clear any pending timeout before setting a new one to prevent overlapping toasts.
  - _Requirements: 2.5, 4.7, 6.7, 10.3, 12.3, 12.6_

- [~] 13. Implement responsive layout and theme CSS
  - Complete `css/style.css` with:
    - Responsive grid layout supporting viewport widths from 320px to 2560px using `@media` breakpoints and CSS Grid / Flexbox; no horizontal scroll or overlap.
    - All colour values expressed as CSS custom properties; dark theme overrides on `:root[data-theme="dark"]`.
    - Focus/active states for keyboard accessibility on all interactive controls.
    - Strikethrough style (`.task-complete`) applied via CSS class toggling in JS.
    - Toast (`#toast`) and timer notification (`#timer-notification`) CSS transitions.
  - _Requirements: 11.1, 11.2, 13.2, 14.1, 14.2, 15.1, 15.2, 15.3_

- [ ] 14. Set up the test environment and run the full test suite
  - [~] 14.1 Create a minimal `package.json` (dev-only) with `vitest` and `fast-check` as `devDependencies`; add a `"test"` script: `"vitest --run"`.
    - Create `vitest.config.js` (or inline config in `package.json`) setting the test environment to `jsdom`.
    - Create `tests/` directory; add `tests/storage.test.js`, `tests/greeting.test.js`, `tests/timer.test.js`, `tests/taskManager.test.js`, `tests/linkManager.test.js`, `tests/themeToggle.test.js`.
    - Export the pure functions under test (or expose via a `window.__test__` object) from `js/app.js` behind a guard so the IIFE stays intact for browser use: `if (typeof module !== 'undefined') module.exports = { getGreetingPhrase, validateURL, … }`.
    - _Requirements: 13.3, 14.2_

  - [~] 14.2 Write all ten property-based tests in the test files
    - Consolidate the property-based tests from tasks 4.2, 5.2, 6.2, 7.2, 8.2, 9.3, 9.4, 9.5, 9.9, and 11.3 into the appropriate test files.
    - Each test must be tagged with: `// Feature: todo-life-dashboard, Property N: <property_text>`
    - Each `fc.assert` must run a minimum of 100 iterations.
    - _Requirements: All correctness property requirements_

  - [~] 14.3 Write remaining example-based unit tests
    - Timer: `start()` → 5 `tick()` calls → verify decrement; `reset()` while running; session-complete notification.
    - Task Manager: exactly 255-char title accepted; exactly 256-char title rejected; 50-char name accepted in NameSetting.
    - Link Manager: deletion of last link shows empty-state message.
    - Theme: `document.documentElement.dataset.theme` correct after toggle.
    - _Requirements: 3.6, 3.9, 5.3, 6.1, 9.7, 10.4, 11.2_

- [~] 15. Final checkpoint — run full suite and verify browser compatibility
  - Run `npx vitest --run` and confirm all tests pass.
  - Open `index.html` via `file://` in Chrome, Firefox, Edge, and Safari; verify no console errors, all six widgets render, and `localStorage` keys are written after one interaction per widget.
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP.
- Each task references specific requirements for traceability.
- Checkpoints ensure incremental validation throughout development.
- Property tests validate the 10 universal correctness properties; unit tests validate specific examples and edge cases.
- The IIFE in `js/app.js` avoids ES module restrictions on `file://`; pure functions are conditionally exported for test access behind a `typeof module !== 'undefined'` guard.
- `window.confirm()` is used for destructive confirmations (delete task, delete link) — no custom modal required.
- The one-liner theme script in `<head>` is the only permitted inline script in `index.html` (per requirement 13.4 intent); it reads `localStorage` directly and sets `dataset.theme` to eliminate a light-flash on dark-theme load.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "3.1"] },
    { "id": 1, "tasks": ["4.1", "5.1", "6.1", "7.1", "8.1", "9.1", "9.8", "11.1", "11.2", "11.4"] },
    { "id": 2, "tasks": ["4.2", "5.2", "6.2", "7.2", "7.3", "8.2", "9.2", "9.6", "9.7"] },
    { "id": 3, "tasks": ["9.3", "9.4", "9.5", "9.9", "11.3", "2.2"] },
    { "id": 4, "tasks": ["14.1"] },
    { "id": 5, "tasks": ["14.2", "14.3"] }
  ]
}
```
