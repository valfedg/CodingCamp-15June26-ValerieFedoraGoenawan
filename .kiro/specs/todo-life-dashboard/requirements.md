# Requirements Document

## Introduction

The To-Do List Life Dashboard is a single-page web application built with HTML, CSS, and Vanilla JavaScript. It provides a personal productivity hub in the browser with no backend server required. All data is stored client-side using the Browser Local Storage API. The app includes a greeting with live time and date, a Pomodoro focus timer, a full-featured to-do list, quick-access links, light/dark mode, and personalization options. It is designed to be clean, fast, and usable as a standalone web page or browser extension.

## Glossary

- **Dashboard**: The single-page web application described in this document.
- **Greeting_Widget**: The UI component that displays the user's name, current time, and date-based greeting.
- **Timer**: The Pomodoro-style countdown timer component.
- **Task_Manager**: The UI component responsible for adding, editing, sorting, and deleting to-do tasks.
- **Task**: A single to-do item containing a title and a completion status.
- **Link_Manager**: The UI component that manages and displays Quick Link buttons.
- **Quick_Link**: A saved URL and label that opens a website when clicked.
- **Local_Storage**: The Browser Local Storage API used to persist all user data client-side.
- **Theme**: The visual color scheme of the Dashboard, either light or dark.
- **Session**: A single countdown interval of the Timer from its configured duration to zero.
- **Duplicate_Task**: A Task whose title matches an existing Task's title exactly (case-insensitive).

---

## Requirements

### Requirement 1: Greeting Widget

**User Story:** As a user, I want to see a personalized greeting with the current time and date, so that I feel welcomed and immediately oriented when I open the Dashboard.

#### Acceptance Criteria

1. THE Greeting_Widget SHALL display the current time in HH:MM format, derived from the device's local system clock, updated every 60 seconds.
2. THE Greeting_Widget SHALL display the current date in a human-readable format (e.g., "Monday, June 15, 2026"), derived from the device's local system clock.
3. WHEN the device's local system clock time is between 05:00 and 11:59, THE Greeting_Widget SHALL display the greeting "Good Morning".
4. WHEN the device's local system clock time is between 12:00 and 17:59, THE Greeting_Widget SHALL display the greeting "Good Afternoon".
5. WHEN the device's local system clock time is between 18:00 and 21:59, THE Greeting_Widget SHALL display the greeting "Good Evening".
6. WHEN the device's local system clock time is between 22:00 and 04:59, THE Greeting_Widget SHALL display the greeting "Good Night".
7. WHEN a user name has been saved and is between 1 and 50 characters in length, THE Greeting_Widget SHALL append the saved name to the greeting (e.g., "Good Morning, Valerie").
8. WHEN no user name has been saved, THE Greeting_Widget SHALL display the greeting without a name suffix.
9. IF the device's local system clock is unavailable or returns an invalid value, THEN THE Greeting_Widget SHALL display "--:--" for the time, "Date unavailable" for the date, and omit the time-of-day greeting phrase.

---

### Requirement 2: Custom Name

**User Story:** As a user, I want to set my own name for the greeting, so that the Dashboard feels personally tailored to me.

#### Acceptance Criteria

1. THE Dashboard SHALL provide a text input field, limited to 50 characters, and a Save button for the user to enter and submit a custom name.
2. WHEN the user submits a custom name, THE Dashboard SHALL trim whitespace from the value, and if the trimmed value is non-empty, save it to Local_Storage and update the Greeting_Widget immediately.
3. WHEN the Dashboard loads, THE Dashboard SHALL retrieve the saved name from Local_Storage and display it in the Greeting_Widget before the first user interaction.
4. WHEN the user clears the name input and submits an empty value, THE Dashboard SHALL remove the name entry from Local_Storage and display the greeting without a name suffix.
5. IF Local_Storage is unavailable when saving or clearing the name, THEN THE Dashboard SHALL apply the name change in-memory for the current session and display a non-blocking error message indicating the name could not be saved persistently.

---

### Requirement 3: Focus Timer

**User Story:** As a user, I want a countdown timer I can start, stop, and reset, so that I can focus on tasks using the Pomodoro technique.

#### Acceptance Criteria

1. THE Timer SHALL initialize to a default duration of 25 minutes (1500 seconds) on first load when no custom duration has been saved.
2. THE Timer SHALL display the remaining time in MM:SS format at all times.
3. WHEN the user presses Start, THE Timer SHALL begin counting down by one second per real-world second using the browser's setInterval or equivalent mechanism.
4. WHEN the user presses Stop, THE Timer SHALL pause the countdown and retain the current remaining time without resetting it.
5. WHEN the user presses Reset, THE Timer SHALL restore the remaining time to the currently configured duration (saved or default) and enter the stopped state without starting automatically.
6. WHEN the remaining time reaches 00:00, THE Timer SHALL stop automatically and display a visible on-page notification message indicating the session is complete; the Timer SHALL enter the stopped state.
7. WHILE the Timer is counting down, THE Timer SHALL disable the Start button and enable the Stop button.
8. WHILE the Timer is stopped or paused, THE Timer SHALL enable the Start button and disable the Stop button.
9. WHEN the user presses Reset WHILE the Timer is counting down, THE Timer SHALL stop the countdown, restore the remaining time to the configured duration, and enter the stopped state without starting automatically.

---

### Requirement 4: Configurable Timer Duration

**User Story:** As a user, I want to change the Pomodoro timer duration, so that I can customize my focus sessions to my preferred length.

#### Acceptance Criteria

1. THE Dashboard SHALL provide a numeric input field, pre-populated with the currently active duration in minutes, for the user to enter a custom timer duration.
2. WHEN the user submits a new duration, THE Dashboard SHALL validate that the value is a whole number (positive integer) between 1 and 180 inclusive.
3. WHEN a valid duration is submitted, THE Dashboard SHALL save the duration to Local_Storage, reset the Timer to the new duration in the stopped state, and update the numeric input field to reflect the saved value.
4. IF the submitted duration is outside the range 1–180, is not a whole number, or is non-numeric, THEN THE Dashboard SHALL display an inline validation error message (e.g., "Please enter a whole number between 1 and 180") adjacent to the input and retain the previously active duration.
5. WHEN the Dashboard loads, THE Dashboard SHALL retrieve the saved duration from Local_Storage, display it in the numeric input field, and initialize the Timer to that duration in the stopped state.
6. WHEN no duration has been saved, THE Dashboard SHALL initialize the Timer and input field to the default duration of 25 minutes.
7. IF Local_Storage is unavailable when saving a valid duration, THEN THE Dashboard SHALL apply the new duration in-memory for the current session and display a non-blocking error message indicating the setting could not be saved persistently.

---

### Requirement 5: To-Do List — Add and Display Tasks

**User Story:** As a user, I want to add tasks to a to-do list, so that I can track what I need to accomplish.

#### Acceptance Criteria

1. THE Task_Manager SHALL provide a text input field and an Add button for creating new Tasks.
2. WHEN the user submits a new task title, THE Task_Manager SHALL trim leading and trailing whitespace from the title before processing.
3. WHEN a trimmed task title is non-empty and is not a Duplicate_Task, THE Task_Manager SHALL add the Task to the list with a default status of incomplete and persist all Tasks to Local_Storage.
4. WHEN the user submits a Duplicate_Task title (case-insensitive match against existing task titles), THE Task_Manager SHALL display an inline error message indicating the task already exists and SHALL NOT add the duplicate.
5. IF the submitted task title is empty after trimming, THEN THE Task_Manager SHALL display an inline validation error and SHALL NOT add the Task.
6. WHEN the Dashboard loads, THE Task_Manager SHALL retrieve and display all Tasks previously saved to Local_Storage, restoring each task's title and completion status.

---

### Requirement 6: To-Do List — Edit and Delete Tasks

**User Story:** As a user, I want to edit and delete tasks, so that I can keep my list accurate and up to date.

#### Acceptance Criteria

1. WHEN the user activates the Edit control for a Task, THE Task_Manager SHALL display an editable input field pre-populated with the Task's current title, limited to 255 characters.
2. WHEN the user saves an edited task title, THE Task_Manager SHALL trim the value, apply the empty-check and duplicate-check rules (excluding the task being edited from the duplicate check), update the Task's title in the list, and persist the updated Task list to Local_Storage.
3. WHEN the user cancels an edit (e.g., presses Escape or a Cancel button), THE Task_Manager SHALL discard the changes, restore the original title in the display, and leave Local_Storage unchanged.
4. THE Task_Manager SHALL provide a Delete control for each Task.
5. WHEN the user activates the Delete control for a Task, THE Task_Manager SHALL display a confirmation prompt (e.g., "Delete this task?") before removing the Task.
6. WHEN the user confirms deletion, THE Task_Manager SHALL remove the Task from the list and update Local_Storage.
7. IF Local_Storage is unavailable when saving an edit or completing a deletion, THEN THE Task_Manager SHALL display a non-blocking error message, and for edits, roll back the displayed title to the pre-edit value.

---

### Requirement 7: To-Do List — Mark Tasks Complete

**User Story:** As a user, I want to mark tasks as done, so that I can track my progress.

#### Acceptance Criteria

1. THE Task_Manager SHALL provide a checkbox for each Task; new Tasks SHALL default to the unchecked (incomplete) state.
2. WHEN a Task is marked complete (checkbox checked), THE Task_Manager SHALL apply a strikethrough style to the task title to differentiate it from incomplete Tasks; WHEN a Task is marked incomplete (checkbox unchecked), THE Task_Manager SHALL remove the strikethrough style.
3. WHEN a Task's completion status changes, THE Task_Manager SHALL persist the updated status to Local_Storage.
4. WHEN the Dashboard loads, THE Task_Manager SHALL restore each Task's persisted completion status, displaying checked Tasks with strikethrough and unchecked Tasks without strikethrough.

---

### Requirement 8: To-Do List — Sort Tasks

**User Story:** As a user, I want to sort my tasks, so that I can view them in a meaningful order.

#### Acceptance Criteria

1. THE Task_Manager SHALL provide a sort control with at least the following options: alphabetical ascending (A–Z), alphabetical descending (Z–A), incomplete tasks first, and completed tasks first.
2. WHEN the user selects a sort option, THE Task_Manager SHALL reorder the displayed Task list according to the selected sort criteria without modifying the underlying saved data order in Local_Storage; alphabetical sorting SHALL be case-insensitive based on the normalized (trimmed, lowercased) task title.
3. WHEN the user selects a sort option, THE Task_Manager SHALL save the selected sort option to Local_Storage immediately.
4. WHEN the Dashboard loads, THE Task_Manager SHALL apply the last-used sort option retrieved from Local_Storage, or default to the original insertion order if no sort option has been saved.

---

### Requirement 9: Quick Links — Add and Display

**User Story:** As a user, I want to save favorite website links as quick-access buttons, so that I can navigate to them with a single click.

#### Acceptance Criteria

1. THE Link_Manager SHALL provide a text input field for a link label (max 50 characters), a text input field for a URL (max 2048 characters), and an Add button.
2. WHEN the user submits a Quick_Link, THE Link_Manager SHALL validate that the trimmed label is non-empty and the trimmed URL matches the pattern ^https?://.+ (i.e., begins with http:// or https:// followed by at least one character).
3. WHEN validation passes, THE Link_Manager SHALL save the Quick_Link to Local_Storage and render it as a labelled button in the Quick Links section.
4. IF the label is empty after trimming, THEN THE Link_Manager SHALL display the inline error "Label is required" and SHALL NOT save the Quick_Link.
5. IF the URL does not match the required pattern, THEN THE Link_Manager SHALL display the inline error "URL must begin with http:// or https://" and SHALL NOT save the Quick_Link.
6. WHEN the user clicks a Quick_Link button, THE Link_Manager SHALL open the corresponding URL in a new browser tab using target="_blank" rel="noopener noreferrer".
7. WHEN the Dashboard loads, THE Link_Manager SHALL retrieve and display all Quick_Links previously saved to Local_Storage as labelled buttons.

---

### Requirement 10: Quick Links — Delete

**User Story:** As a user, I want to remove saved links, so that I can keep my Quick Links relevant.

#### Acceptance Criteria

1. THE Link_Manager SHALL provide a Delete control for each Quick_Link button.
2. WHEN the user activates the Delete control for a Quick_Link, THE Link_Manager SHALL display a confirmation prompt (e.g., "Remove this link?") before deleting.
3. WHEN the user confirms deletion, THE Link_Manager SHALL remove the Quick_Link from the display and from Local_Storage; IF Local_Storage is unavailable, THE Link_Manager SHALL remove the Quick_Link from the display only, retain the in-memory state, and display a non-blocking error message.
4. WHEN the last Quick_Link is deleted, THE Link_Manager SHALL display an empty-state message (e.g., "No quick links saved yet. Add one above.") in the Quick Links section.

---

### Requirement 11: Light / Dark Mode Toggle

**User Story:** As a user, I want to switch between light and dark mode, so that I can use the Dashboard comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE Dashboard SHALL provide a toggle control (e.g., a button or switch) visible in the top navigation bar, labeled or iconified to clearly indicate the currently active Theme (e.g., "🌙 Dark" or "☀️ Light").
2. WHEN the user activates the toggle, THE Dashboard SHALL switch the active Theme and apply the corresponding color scheme to all UI components within 100 milliseconds.
3. WHEN the Theme changes, THE Dashboard SHALL save the selected Theme identifier ("light" or "dark") to Local_Storage.
4. WHEN the Dashboard loads, THE Dashboard SHALL retrieve the saved Theme from Local_Storage and apply it prior to first paint so that no UI components are rendered in a different Theme than the applied Theme.
5. WHEN no Theme has been saved, THE Dashboard SHALL apply the light Theme by default.
6. IF Local_Storage is unavailable when reading or writing the Theme, THE Dashboard SHALL silently fall back to the light Theme for the current session without displaying an error.

---

### Requirement 12: Data Persistence and Storage

**User Story:** As a user, I want my data to be saved automatically, so that my tasks, links, settings, and timer preferences are still present when I reopen the Dashboard.

#### Acceptance Criteria

1. THE Dashboard SHALL use only the Browser Local_Storage API for all client-side data persistence; no backend server or remote database SHALL be used.
2. WHEN any user data changes (Tasks, Quick_Links, Theme, custom name, timer duration, sort preference), THE Dashboard SHALL write the updated data to Local_Storage within 100 milliseconds of the change.
3. IF a Local_Storage write operation fails (e.g., quota exceeded or storage access denied), THEN THE Dashboard SHALL retain the intended change in-memory for the current session and display a non-blocking notification informing the user that the data could not be saved persistently.
4. WHEN the Dashboard loads, THE Dashboard SHALL read all persisted data from Local_Storage and restore all data types (Tasks, Quick_Links, Theme, custom name, timer duration, sort preference) before rendering interactive UI elements.
5. WHEN the Dashboard loads and no data exists in Local_Storage, THE Dashboard SHALL initialize all data types to their defined defaults: empty Task list, empty Quick_Links list, light Theme, no custom name, 25-minute timer duration, and insertion-order sort.
6. IF any Local_Storage value is corrupted or cannot be parsed, THEN THE Dashboard SHALL discard that value, initialize the affected data type to its default, and display a non-blocking notification informing the user that some saved data could not be loaded.

---

### Requirement 13: File Structure and Code Organization

**User Story:** As a developer, I want a clean, well-organized codebase, so that the project is easy to read, maintain, and extend.

#### Acceptance Criteria

1. THE Dashboard SHALL be delivered as a single HTML file (index.html) at the project root.
2. THE Dashboard SHALL include exactly one CSS file located at css/style.css; no additional CSS files SHALL be present in the css/ directory.
3. THE Dashboard SHALL include exactly one JavaScript file located at js/app.js; no additional JavaScript files SHALL be present in the js/ directory.
4. THE Dashboard's index.html SHALL reference only css/style.css and js/app.js; no inline &lt;style&gt; blocks or inline &lt;script&gt; blocks containing application logic SHALL appear in index.html.
5. THE JavaScript in js/app.js SHALL use consistent indentation (2 or 4 spaces), descriptive variable and function names, and inline comments for non-obvious logic sections.

---

### Requirement 14: Browser Compatibility

**User Story:** As a user, I want the Dashboard to work in any modern browser, so that I am not restricted to a specific browser.

#### Acceptance Criteria

1. THE Dashboard SHALL render and function correctly in the current stable releases of Chrome, Firefox, Edge, and Safari without requiring browser-specific flags or extensions.
2. THE Dashboard SHALL function as a standalone web page opened directly from the file system (file:// protocol) without requiring a local development server or build step.
3. THE Dashboard SHALL use only Web APIs available natively in the current stable releases of Chrome, Firefox, Edge, and Safari; no polyfills, transpilers, or build tools SHALL be required at runtime.
4. THE Dashboard SHALL not generate any console errors or unhandled exceptions in any of the four supported browsers during normal use.

---

### Requirement 15: Performance and Responsiveness

**User Story:** As a user, I want the Dashboard to load and respond instantly, so that it does not slow down my workflow.

#### Acceptance Criteria

1. THE Dashboard SHALL achieve a Largest Contentful Paint (LCP) of under 2 seconds when loaded on a device with at least a 4-core CPU, 8 GB RAM, and a network capable of ≥10 Mbps, given that all three files (index.html, css/style.css, js/app.js) are served from the local file system with no additional network requests after initial load.
2. WHEN the user interacts with any UI control (button, input, toggle), THE Dashboard SHALL visually acknowledge the interaction (e.g., updated display, visual state change) within 100 milliseconds.
3. THE Dashboard SHALL adapt its layout to viewport widths from 320px to 2560px without horizontal scrolling or overlapping UI elements, both at initial load and dynamically when the viewport is resized.
4. WHEN an interaction triggers an asynchronous operation (e.g., a Local_Storage write), THE Dashboard SHALL provide immediate visual feedback within 100 milliseconds and complete the operation within 5 seconds; IF the operation does not complete within 5 seconds, THE Dashboard SHALL display an error indication to the user.
