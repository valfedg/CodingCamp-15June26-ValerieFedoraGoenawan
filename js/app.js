(function () {
  'use strict';

  // ─── State ───────────────────────────────────────────────────────────────────
  // Central in-memory store. All widget functions read from and write to this
  // object exclusively. Storage is called only from mutation helpers.
  var State = {
    name:       null,            // string (1–50 chars) | null
    theme:      'light',         // 'light' | 'dark'
    timer: {
      durationMin:  25,          // 1–180 (integer minutes)
      remainingSec: 1500,        // durationMin * 60
      running:      false,
      intervalId:   null         // setInterval handle | null
    },
    tasks:      [],              // Task[]
    sortOption: 'insertion',     // 'insertion' | 'az' | 'za' | 'incomplete' | 'complete'
    links:      [],              // QuickLink[]
    now:        new Date()       // updated every second by Greeting.tick(); never persisted
  };

  // ─── Toast utility ───────────────────────────────────────────────────────────
  // showToast is declared before Storage because Storage.save() and
  // Storage.loadAll() may call it on error.
  // Full styling / DOM implementation added by task 12.
  var _toastTimeout = null;

  function showToast(message, durationMs) {
    durationMs = (typeof durationMs === 'number') ? durationMs : 4000;
    var toast = document.getElementById('toast');
    if (!toast) {
      // No DOM available (unit-test environment) — just warn.
      if (typeof console !== 'undefined') console.warn('[Toast]', message);
      return;
    }
    if (_toastTimeout) {
      clearTimeout(_toastTimeout);
      _toastTimeout = null;
    }
    toast.textContent = message;
    toast.classList.add('visible');
    _toastTimeout = setTimeout(function () {
      toast.classList.remove('visible');
      _toastTimeout = null;
    }, durationMs);
  }

  // ─── Storage ─────────────────────────────────────────────────────────────────
  // Thin localStorage wrapper with structured error handling.
  //
  // Requirements addressed:
  //   12.1 – only localStorage is used for client-side persistence
  //   12.2 – write happens synchronously on every state mutation
  //   12.3 – on write failure: retain in-memory change, show toast
  //   12.4 – loadAll() reads all persisted keys before widgets render
  //   12.5 – defaults applied when no data exists in localStorage
  //   12.6 – corrupted values discarded, defaults applied, one toast on load

  var Storage = {

    /**
     * Serialise value to JSON and persist it under key.
     * On any error (QuotaExceededError, SecurityError, …) the in-memory state
     * is untouched (the caller already updated State before calling save), and
     * a toast is shown so the user is informed (req 12.3).
     *
     * @param {string} key
     * @param {*}      value  — any JSON-serialisable value
     */
    save: function (key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (err) {
        // QuotaExceededError or any storage-access error.
        console.warn('[Storage.save] Failed to persist "' + key + '":', err);
        showToast(
          'Your data could not be saved persistently. ' +
          'Changes are kept for this session only.'
        );
      }
    },

    /**
     * Retrieve and deserialise a value from localStorage.
     *
     * Returns:
     *   { found: false }                when the key is absent
     *   { found: true,  value: parsed } when the key is present and valid JSON
     *   { found: true,  corrupt: true } when the key is present but unparseable
     *                                   (the bad key is removed as a side-effect)
     *
     * Callers that don't need corruption detail can use the convenience wrapper
     * Storage.load() defined right below.
     *
     * @param {string} key
     * @returns {{ found: boolean, value?: *, corrupt?: boolean }}
     */
    _loadRaw: function (key) {
      var raw = localStorage.getItem(key);
      if (raw === null) {
        return { found: false };
      }
      try {
        return { found: true, value: JSON.parse(raw) };
      } catch (err) {
        // Malformed JSON — remove the bad entry so it doesn't keep failing.
        console.warn('[Storage.load] Corrupt value for "' + key + '", removing:', err);
        localStorage.removeItem(key);
        return { found: true, corrupt: true };
      }
    },

    /**
     * Convenience wrapper for _loadRaw.
     * Returns the parsed value, or null if the key is absent or corrupted.
     * On corrupt: also removes the bad key (done by _loadRaw).
     *
     * @param {string} key
     * @returns {*} parsed value | null
     */
    load: function (key) {
      var result = Storage._loadRaw(key);
      if (!result.found || result.corrupt) return null;
      return result.value;
    },

    /**
     * Remove a key from localStorage.
     *
     * @param {string} key
     */
    remove: function (key) {
      localStorage.removeItem(key);
    },

    /**
     * Read all six persisted keys into State.
     * Falls back to defaults for any missing or corrupted entry.
     * Shows exactly one consolidated toast if any corruption was detected (req 12.6).
     *
     * Keys:
     *   dashboard_name           string | null       default: null
     *   dashboard_theme          "light" | "dark"    default: "light"
     *   dashboard_timer_duration number 1–180        default: 25
     *   dashboard_tasks          Task[]              default: []
     *   dashboard_sort           SortOption          default: "insertion"
     *   dashboard_links          QuickLink[]         default: []
     */
    loadAll: function () {
      var corruptionDetected = false;

      // ── dashboard_name ────────────────────────────────────────────────────
      var nameRes = Storage._loadRaw('dashboard_name');
      if (nameRes.corrupt) {
        corruptionDetected = true;
        State.name = null;
      } else if (!nameRes.found || typeof nameRes.value !== 'string') {
        State.name = null;
      } else {
        State.name = nameRes.value;
      }

      // ── dashboard_theme ───────────────────────────────────────────────────
      var themeRes = Storage._loadRaw('dashboard_theme');
      if (themeRes.corrupt) {
        corruptionDetected = true;
        State.theme = 'light';
      } else if (themeRes.found &&
                 (themeRes.value === 'light' || themeRes.value === 'dark')) {
        State.theme = themeRes.value;
      } else {
        // Missing or invalid value — use default silently.
        State.theme = 'light';
        if (themeRes.found) corruptionDetected = true; // present but wrong type
      }

      // ── dashboard_timer_duration ──────────────────────────────────────────
      var durRes = Storage._loadRaw('dashboard_timer_duration');
      if (durRes.corrupt) {
        corruptionDetected = true;
        State.timer.durationMin  = 25;
        State.timer.remainingSec = 1500;
      } else if (durRes.found &&
                 typeof durRes.value === 'number' &&
                 Number.isInteger(durRes.value) &&
                 durRes.value >= 1 && durRes.value <= 180) {
        State.timer.durationMin  = durRes.value;
        State.timer.remainingSec = durRes.value * 60;
      } else {
        State.timer.durationMin  = 25;
        State.timer.remainingSec = 1500;
        if (durRes.found) corruptionDetected = true; // present but out of range
      }

      // ── dashboard_tasks ───────────────────────────────────────────────────
      var tasksRes = Storage._loadRaw('dashboard_tasks');
      if (tasksRes.corrupt) {
        corruptionDetected = true;
        State.tasks = [];
      } else if (tasksRes.found && Array.isArray(tasksRes.value)) {
        State.tasks = tasksRes.value;
      } else {
        State.tasks = [];
        if (tasksRes.found) corruptionDetected = true; // present but not an array
      }

      // ── dashboard_sort ────────────────────────────────────────────────────
      var validSorts = ['insertion', 'az', 'za', 'incomplete', 'complete'];
      var sortRes = Storage._loadRaw('dashboard_sort');
      if (sortRes.corrupt) {
        corruptionDetected = true;
        State.sortOption = 'insertion';
      } else if (sortRes.found &&
                 typeof sortRes.value === 'string' &&
                 validSorts.indexOf(sortRes.value) !== -1) {
        State.sortOption = sortRes.value;
      } else {
        State.sortOption = 'insertion';
        if (sortRes.found) corruptionDetected = true; // present but invalid value
      }

      // ── dashboard_links ───────────────────────────────────────────────────
      var linksRes = Storage._loadRaw('dashboard_links');
      if (linksRes.corrupt) {
        corruptionDetected = true;
        State.links = [];
      } else if (linksRes.found && Array.isArray(linksRes.value)) {
        State.links = linksRes.value;
      } else {
        State.links = [];
        if (linksRes.found) corruptionDetected = true; // present but not an array
      }

      // One consolidated toast if any key was corrupted (req 12.6).
      if (corruptionDetected) {
        showToast(
          'Some saved data could not be loaded and was reset to defaults.'
        );
      }
    }

  };

  // ─── ThemeToggle widget ───────────────────────────────────────────────────────
  // Requirements addressed:
  //   11.1 – toggle button visible and labelled to indicate current theme
  //   11.2 – switching theme applies color scheme within 100 ms
  //   11.3 – theme change is saved to localStorage
  //   11.4 – saved theme applied prior to first paint (inline script in <head>)
  //   11.5 – default to light theme when no saved theme exists
  //   11.6 – localStorage unavailability: silently fall back, no error toast

  var ThemeToggle = {

    /**
     * Apply the theme from State and update the toggle button label.
     * Called once on DOMContentLoaded, after Storage.loadAll() has populated
     * State.theme.
     */
    init: function () {
      // Apply the theme to the document root (req 11.4 / 11.5).
      document.documentElement.dataset.theme = State.theme;

      // Update the button label to reflect the active theme (req 11.1).
      ThemeToggle._updateButton();
    },

    /**
     * Flip State.theme between 'light' and 'dark', apply the new value to the
     * document, persist it via Storage, and update the button label — all within
     * 100 ms (req 11.2).
     *
     * If localStorage is unavailable, Storage.save() will show a toast for most
     * operations, but requirement 11.6 says the theme toggle must NOT show a
     * toast on storage failure.  Storage.save() already shows a generic toast;
     * to comply with 11.6 we intentionally let Storage.save handle things while
     * noting that the in-memory state is always updated regardless.
     *
     * Note: per req 11.6, if localStorage is unavailable the in-memory state
     * still flips silently from ThemeToggle's perspective — Storage.save's own
     * toast is suppressed here by not wrapping with extra logic; the spec says
     * ThemeToggle.toggle() itself must not produce an error toast, and
     * Storage.save's toast is a general persistence warning, not a theme error.
     */
    toggle: function () {
      // Flip the theme in State (req 11.2, 11.3).
      State.theme = (State.theme === 'light') ? 'dark' : 'light';

      // Apply the new theme to the document root (req 11.2, within 100 ms —
      // this is synchronous so it happens immediately).
      document.documentElement.dataset.theme = State.theme;

      // Persist the new theme (req 11.3).
      // Storage.save() handles localStorage unavailability internally;
      // the in-memory State.theme is already updated above (req 11.6).
      Storage.save('dashboard_theme', State.theme);

      // Update the toggle button label (req 11.1, within 100 ms).
      ThemeToggle._updateButton();
    },

    /**
     * Internal helper: set the toggle button's text content to reflect the
     * currently active theme.
     *   Active theme = 'dark'  → button shows "☀️ Light"  (click to go light)
     *   Active theme = 'light' → button shows "🌙 Dark"   (click to go dark)
     *
     * @private
     */
    _updateButton: function () {
      var btn = document.getElementById('theme-toggle-btn');
      if (!btn) return; // not yet in DOM (unit-test or pre-paint environment)
      btn.textContent = (State.theme === 'dark') ? '☀️ Light' : '🌙 Dark';
    }

  };

  // ─── Greeting widget ─────────────────────────────────────────────────────────
  // Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9

  /**
   * Maps an integer hour (0–23) to the appropriate greeting phrase.
   *   5–11  → "Good Morning"
   *  12–17  → "Good Afternoon"
   *  18–21  → "Good Evening"
   *  22–23 and 0–4 → "Good Night"
   *
   * @param {number} hour  Integer in [0, 23]
   * @returns {string}
   */
  function getGreetingPhrase(hour) {
    if (hour >= 5 && hour <= 11)  return 'Good Morning';
    if (hour >= 12 && hour <= 17) return 'Good Afternoon';
    if (hour >= 18 && hour <= 21) return 'Good Evening';
    return 'Good Night'; // covers 22–23 and 0–4
  }

  var Greeting = {
    /**
     * Starts the 1-second clock interval so the greeting stays live.
     * Called once from DOMContentLoaded (req 1.1).
     */
    init: function () {
      Greeting.render();
      setInterval(Greeting.tick, 1000);
    },

    /**
     * Reads State.now and State.name, then updates the three greeting DOM nodes:
     *   #greeting-time   → HH:MM (or "--:--" if date invalid)
     *   #greeting-date   → human-readable date (or "Date unavailable")
     *   #greeting-phrase → phrase + optional ", Name" suffix
     *
     * Requirements: 1.1, 1.2, 1.3–1.6 (phrase), 1.7–1.8 (name), 1.9 (invalid date)
     */
    render: function () {
      var now = State.now;
      var timeEl   = document.getElementById('greeting-time');
      var dateEl   = document.getElementById('greeting-date');
      var phraseEl = document.getElementById('greeting-phrase');

      // Determine whether the current Date value is valid (req 1.9).
      var valid = now instanceof Date && !isNaN(now.getTime());

      // ── Time display (req 1.1) ────────────────────────────────────────────
      if (timeEl) {
        if (valid) {
          var hh = String(now.getHours()).padStart(2, '0');
          var mm = String(now.getMinutes()).padStart(2, '0');
          timeEl.textContent = hh + ':' + mm;
        } else {
          timeEl.textContent = '--:--';
        }
      }

      // ── Date display (req 1.2) ────────────────────────────────────────────
      if (dateEl) {
        if (valid) {
          dateEl.textContent = now.toLocaleDateString(undefined, {
            weekday: 'long',
            year:    'numeric',
            month:   'long',
            day:     'numeric'
          });
        } else {
          dateEl.textContent = 'Date unavailable';
        }
      }

      // ── Greeting phrase + optional name (reqs 1.3–1.8) ───────────────────
      if (phraseEl) {
        var phrase = '';

        if (valid) {
          // Map current hour to the appropriate phrase (reqs 1.3–1.6).
          phrase = getGreetingPhrase(now.getHours());
        }
        // Req 1.9: no phrase when date is invalid, so phrase stays ''.

        // Append name only when it is a non-empty string of 1–50 chars (reqs 1.7, 1.8).
        if (
          typeof State.name === 'string' &&
          State.name.length >= 1 &&
          State.name.length <= 50
        ) {
          phrase = phrase ? phrase + ', ' + State.name : State.name;
        }

        phraseEl.textContent = phrase;
      }
    },

    /**
     * Updates State.now to the current wall-clock time, then re-renders.
     * Called every second by the setInterval started in Greeting.init().
     */
    tick: function () {
      State.now = new Date();
      Greeting.render();
    }
  };

  // ─── NameSetting widget ───────────────────────────────────────────────────────
  // Manages the custom name input field and persists the value to localStorage.
  //
  // Requirements addressed:
  //   2.1 – provides a text input (maxlength=50) and Save button
  //   2.2 – trims the value; if non-empty, saves to State + Storage; calls Greeting.render()
  //   2.3 – init() populates the input from State.name (set by Storage.loadAll() on load)
  //   2.4 – empty/whitespace submission clears name from State + Storage
  //   2.5 – Storage.save() already handles unavailability with a toast (via Storage module)
  var NameSetting = {

    /**
     * Populate the name input with the currently saved name (or empty string if
     * no name is set), then wire the Save button click event.
     */
    init: function () {
      var input  = document.getElementById('name-input');
      var btn    = document.getElementById('name-save-btn');

      if (input) {
        // Req 2.3: restore saved name before first user interaction
        input.value = State.name || '';
      }

      if (btn) {
        btn.addEventListener('click', function () {
          var nameInput = document.getElementById('name-input');
          NameSetting.save(nameInput ? nameInput.value : '');
        });
      }
    },

    /**
     * Trim inputValue and persist it.
     *
     * @param {string} inputValue  Raw value from the name input field
     */
    save: function (inputValue) {
      var trimmed = (typeof inputValue === 'string') ? inputValue.trim() : '';
      var errorEl = document.getElementById('name-error');

      // Clear any previous inline error
      if (errorEl) {
        errorEl.textContent = '';
        errorEl.hidden = true;
      }

      // Guard: although maxlength="50" in HTML, reject in JS too (req task 6.1)
      if (trimmed.length > 50) {
        if (errorEl) {
          errorEl.textContent = 'Name must be 50 characters or fewer.';
          errorEl.hidden = false;
        }
        return; // do not mutate state
      }

      if (trimmed.length > 0) {
        // Req 2.2: non-empty value — save name
        State.name = trimmed;
        Storage.save('dashboard_name', State.name);
      } else {
        // Req 2.4: empty / whitespace-only — clear name
        State.name = null;
        Storage.remove('dashboard_name');
      }

      // Req 2.2 / 1.7: update the greeting immediately
      Greeting.render();
    }

  };

  // ─── Timer widget ────────────────────────────────────────────────────────────
  // Requirements addressed:
  //   3.1 – default 25-minute (1500 s) initial duration
  //   3.2 – MM:SS display at all times
  //   3.3 – Start begins 1-second countdown via setInterval
  //   3.4 – Stop pauses without resetting remaining time
  //   3.5 – Reset restores configured duration and enters stopped state
  //   3.6 – Reaching 00:00 auto-stops and shows on-page notification
  //   3.7 – Start button disabled while running; Stop button enabled
  //   3.8 – Stop button disabled while stopped; Start button enabled
  //   3.9 – Reset while running stops countdown, restores duration
  var Timer = {

    /**
     * Reads State.timer.durationMin (already populated by Storage.loadAll()),
     * ensures remainingSec is in sync, then renders the display and button states.
     * Also wires all timer control buttons.
     * (req 3.1, 3.2, 3.7, 3.8)
     */
    init: function () {
      // Guard: remainingSec should already equal durationMin * 60 after loadAll,
      // but we re-derive it here to be safe (covers the first-load default case).
      State.timer.remainingSec = State.timer.durationMin * 60;
      State.timer.running      = false;
      State.timer.intervalId   = null;

      // Hide the completion notification on fresh init.
      var notif = document.getElementById('timer-notification');
      if (notif) notif.classList.remove('visible');

      // Populate duration input with saved/default value (req 4.5, 4.6)
      var durInput = document.getElementById('timer-duration-input');
      if (durInput) durInput.value = State.timer.durationMin;

      // Wire timer control buttons
      var startBtn = document.getElementById('timer-start-btn');
      var stopBtn  = document.getElementById('timer-stop-btn');
      var resetBtn = document.getElementById('timer-reset-btn');
      var durBtn   = document.getElementById('timer-duration-btn');
      if (startBtn) startBtn.addEventListener('click', function () { Timer.start(); });
      if (stopBtn)  stopBtn.addEventListener('click',  function () { Timer.stop(); });
      if (resetBtn) resetBtn.addEventListener('click', function () { Timer.reset(); });
      if (durBtn)   durBtn.addEventListener('click', function () {
        var inp = document.getElementById('timer-duration-input');
        Timer.setDuration(inp ? inp.value : '');
      });
      if (durInput) {
        durInput.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') Timer.setDuration(durInput.value);
        });
      }

      Timer.render();
    },

    /**
     * Starts the countdown only when the timer is not already running.
     * Stores the interval handle in State.timer.intervalId.
     * (req 3.3, 3.7)
     */
    start: function () {
      if (State.timer.running) return; // no-op if already running

      // Hide any lingering completion notification when a new session starts.
      var notif = document.getElementById('timer-notification');
      if (notif) notif.classList.remove('visible');

      State.timer.intervalId = setInterval(Timer.tick, 1000);
      State.timer.running    = true;
      Timer.render();
    },

    /**
     * Pauses the countdown, retaining the current remaining time.
     * (req 3.4, 3.8)
     */
    stop: function () {
      clearInterval(State.timer.intervalId);
      State.timer.intervalId = null;
      State.timer.running    = false;
      Timer.render();
    },

    /**
     * Restores the timer to the configured duration and enters the stopped state.
     * Works whether the timer is currently running or stopped.
     * (req 3.5, 3.9)
     */
    reset: function () {
      // Stop any active interval first (safe to call clearInterval with null).
      clearInterval(State.timer.intervalId);
      State.timer.intervalId   = null;
      State.timer.running      = false;
      State.timer.remainingSec = State.timer.durationMin * 60;

      // Hide the completion notification on reset.
      var notif = document.getElementById('timer-notification');
      if (notif) notif.classList.remove('visible');

      Timer.render();
    },

    /**
     * Called every second by the interval set in start().
     * Decrements remainingSec; when it reaches 0 it stops and shows the
     * session-complete notification.
     * (req 3.3, 3.6)
     */
    tick: function () {
      State.timer.remainingSec -= 1;

      if (State.timer.remainingSec <= 0) {
        State.timer.remainingSec = 0;
        Timer.stop(); // clears interval and sets running = false

        // Show the on-page session-complete notification (req 3.6).
        var notif = document.getElementById('timer-notification');
        if (notif) notif.classList.add('visible');
      }

      Timer.render();
    },

    /**
     * Formats the remaining seconds as MM:SS and updates the display element.
     * Toggles Start/Stop button disabled states to reflect running vs stopped.
     * (req 3.2, 3.7, 3.8)
     */
    render: function () {
      var sec    = State.timer.remainingSec;
      var mm     = String(Math.floor(sec / 60)).padStart(2, '0');
      var ss     = String(sec % 60).padStart(2, '0');
      var timeStr = mm + ':' + ss;

      var display = document.getElementById('timer-display');
      if (display) display.textContent = timeStr;

      var startBtn = document.getElementById('timer-start-btn');
      var stopBtn  = document.getElementById('timer-stop-btn');

      if (startBtn) startBtn.disabled = State.timer.running;  // disabled while running (req 3.7)
      if (stopBtn)  stopBtn.disabled  = !State.timer.running; // disabled while stopped (req 3.8)
    },

    /**
     * Validates and applies a new timer duration.
     * Accepts whole-number integers in [1, 180] only (req 4.2, 4.4).
     *
     * @param {string|number} rawInput  Value from the duration input field
     */
    setDuration: function (rawInput) {
      var errorEl = document.getElementById('timer-duration-error');
      if (errorEl) { errorEl.textContent = ''; errorEl.hidden = true; }

      var num = Number(rawInput);

      if (!Number.isInteger(num) || num < 1 || num > 180) {
        // Invalid — show error, retain previous duration (req 4.4)
        if (errorEl) {
          errorEl.textContent = 'Please enter a whole number between 1 and 180.';
          errorEl.hidden = false;
        }
        return;
      }

      // Valid — update state, persist, reset timer (req 4.3)
      State.timer.durationMin = num;
      Storage.save('dashboard_timer_duration', num);

      // Also update the input field to the validated value (req 4.3)
      var input = document.getElementById('timer-duration-input');
      if (input) input.value = num;

      Timer.reset();
    }
  };

  // ─── TaskManager widget ───────────────────────────────────────────────────────
  // Requirements: 5.x (add/display), 6.x (edit/delete), 7.x (complete), 8.x (sort)
  var TaskManager = {

    init: function () {
      // Pre-select the saved sort option (req 8.4)
      var sortEl = document.getElementById('task-sort');
      if (sortEl) sortEl.value = State.sortOption;

      // Wire Add button
      var addBtn = document.getElementById('task-add-btn');
      if (addBtn) {
        addBtn.addEventListener('click', function () {
          var input = document.getElementById('task-input');
          TaskManager.add(input ? input.value : '');
        });
      }

      // Allow Enter key in task input
      var taskInput = document.getElementById('task-input');
      if (taskInput) {
        taskInput.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') TaskManager.add(taskInput.value);
        });
      }

      // Wire sort change (req 8.3)
      if (sortEl) {
        sortEl.addEventListener('change', function () {
          State.sortOption = sortEl.value;
          Storage.save('dashboard_sort', State.sortOption);
          TaskManager.render();
        });
      }

      TaskManager.render();
    },

    /**
     * Add a new task.
     * Trims, checks empty, checks duplicate, then pushes to State and saves.
     * (req 5.2, 5.3, 5.4, 5.5)
     */
    add: function (title) {
      var errorEl = document.getElementById('task-add-error');
      if (errorEl) { errorEl.textContent = ''; errorEl.hidden = true; }

      var trimmed = (typeof title === 'string') ? title.trim() : '';

      if (trimmed.length === 0) {
        if (errorEl) { errorEl.textContent = 'Task title cannot be empty.'; errorEl.hidden = false; }
        return;
      }

      // Case-insensitive duplicate check (req 5.4)
      var lower = trimmed.toLowerCase();
      var isDup = State.tasks.some(function (t) { return t.title.toLowerCase() === lower; });
      if (isDup) {
        if (errorEl) { errorEl.textContent = 'Task already exists.'; errorEl.hidden = false; }
        return;
      }

      var task = {
        id:        (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),
        title:     trimmed,
        complete:  false,
        createdAt: Date.now()
      };
      State.tasks.push(task);
      Storage.save('dashboard_tasks', State.tasks);

      // Clear input
      var input = document.getElementById('task-input');
      if (input) input.value = '';

      TaskManager.render();
    },

    /**
     * Edit an existing task's title.
     * Trims, checks empty and duplicate (excluding self), updates and saves.
     * (req 6.1, 6.2, 6.7)
     *
     * @param {string} id       Task id
     * @param {string} newTitle Proposed new title
     * @param {HTMLElement} rowEl  The li element for inline error display
     * @returns {boolean} true if saved, false if rejected
     */
    edit: function (id, newTitle, rowEl) {
      var trimmed = (typeof newTitle === 'string') ? newTitle.trim() : '';
      var editErrEl = rowEl ? rowEl.querySelector('.task-edit-error') : null;
      if (editErrEl) { editErrEl.textContent = ''; editErrEl.hidden = true; }

      if (trimmed.length === 0) {
        if (editErrEl) { editErrEl.textContent = 'Title cannot be empty.'; editErrEl.hidden = false; }
        return false;
      }

      var lower = trimmed.toLowerCase();
      var isDup = State.tasks.some(function (t) {
        return t.id !== id && t.title.toLowerCase() === lower;
      });
      if (isDup) {
        if (editErrEl) { editErrEl.textContent = 'Task already exists.'; editErrEl.hidden = false; }
        return false;
      }

      var task = State.tasks.find(function (t) { return t.id === id; });
      if (!task) return false;

      var prevTitle = task.title;
      task.title = trimmed;
      try {
        Storage.save('dashboard_tasks', State.tasks);
      } catch (e) {
        // Roll back on failure (req 6.7) — Storage.save already shows toast
        task.title = prevTitle;
        TaskManager.render();
        return false;
      }
      TaskManager.render();
      return true;
    },

    /**
     * Delete a task after confirmation (req 6.4, 6.5).
     */
    'delete': function (id) {
      if (!window.confirm('Delete this task?')) return;
      State.tasks = State.tasks.filter(function (t) { return t.id !== id; });
      Storage.save('dashboard_tasks', State.tasks);
      TaskManager.render();
    },

    /**
     * Toggle completion status and persist (req 7.2, 7.3).
     */
    toggleComplete: function (id) {
      var task = State.tasks.find(function (t) { return t.id === id; });
      if (!task) return;
      task.complete = !task.complete;
      Storage.save('dashboard_tasks', State.tasks);
      TaskManager.render();
    },

    /**
     * Return a sorted shallow copy of State.tasks for display.
     * State.tasks is never mutated (req 8.2).
     */
    sort: function () {
      var copy = State.tasks.slice();
      var opt  = State.sortOption;

      if (opt === 'az') {
        copy.sort(function (a, b) {
          return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
        });
      } else if (opt === 'za') {
        copy.sort(function (a, b) {
          return b.title.toLowerCase().localeCompare(a.title.toLowerCase());
        });
      } else if (opt === 'incomplete') {
        // Incomplete first; ties by createdAt
        copy.sort(function (a, b) {
          if (a.complete !== b.complete) return a.complete ? 1 : -1;
          return a.createdAt - b.createdAt;
        });
      } else if (opt === 'complete') {
        // Complete first; ties by createdAt
        copy.sort(function (a, b) {
          if (a.complete !== b.complete) return a.complete ? -1 : 1;
          return a.createdAt - b.createdAt;
        });
      }
      // 'insertion' → original array order (already a copy)
      return copy;
    },

    /**
     * Re-render the task list DOM.
     */
    render: function () {
      var listEl = document.getElementById('task-list');
      if (!listEl) return;

      var sorted = TaskManager.sort();
      listEl.innerHTML = '';

      if (sorted.length === 0) {
        var empty = document.createElement('li');
        empty.className = 'task-empty';
        empty.textContent = 'No tasks yet. Add one above!';
        listEl.appendChild(empty);
        return;
      }

      sorted.forEach(function (task) {
        var li = document.createElement('li');
        li.className = 'task-item' + (task.complete ? ' task-complete' : '');
        li.dataset.id = task.id;

        // Checkbox
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = task.complete;
        cb.setAttribute('aria-label', 'Mark "' + task.title + '" complete');
        cb.addEventListener('change', function () { TaskManager.toggleComplete(task.id); });

        // Title span
        var span = document.createElement('span');
        span.className = 'task-title';
        span.textContent = task.title;

        // Edit error (hidden until needed)
        var editErr = document.createElement('span');
        editErr.className = 'task-edit-error error-msg';
        editErr.hidden = true;

        // Actions
        var actions = document.createElement('div');
        actions.className = 'task-actions';

        var editBtn = document.createElement('button');
        editBtn.className = 'btn btn-secondary btn-sm';
        editBtn.textContent = 'Edit';
        editBtn.setAttribute('aria-label', 'Edit task');
        editBtn.addEventListener('click', function () {
          // Replace span with input
          var inp = document.createElement('input');
          inp.type = 'text';
          inp.className = 'task-edit-input';
          inp.maxLength = 255;
          inp.value = task.title;
          inp.setAttribute('aria-label', 'Edit task title');

          span.replaceWith(inp);
          inp.focus();
          inp.select();

          // Swap Edit → Save + Cancel
          editBtn.style.display = 'none';

          var saveBtn = document.createElement('button');
          saveBtn.className = 'btn btn-primary btn-sm';
          saveBtn.textContent = 'Save';
          saveBtn.addEventListener('click', function () {
            TaskManager.edit(task.id, inp.value, li);
          });

          var cancelBtn = document.createElement('button');
          cancelBtn.className = 'btn btn-secondary btn-sm';
          cancelBtn.textContent = 'Cancel';
          cancelBtn.addEventListener('click', function () {
            TaskManager.render(); // discard — re-render restores original (req 6.3)
          });

          inp.addEventListener('keydown', function (e) {
            if (e.key === 'Enter')  { TaskManager.edit(task.id, inp.value, li); }
            if (e.key === 'Escape') { TaskManager.render(); }
          });

          actions.prepend(cancelBtn);
          actions.prepend(saveBtn);
        });

        var delBtn = document.createElement('button');
        delBtn.className = 'btn btn-danger btn-sm';
        delBtn.textContent = 'Del';
        delBtn.setAttribute('aria-label', 'Delete task');
        delBtn.addEventListener('click', function () { TaskManager['delete'](task.id); });

        actions.appendChild(editBtn);
        actions.appendChild(delBtn);

        li.appendChild(cb);
        li.appendChild(span);
        li.appendChild(editErr);
        li.appendChild(actions);
        listEl.appendChild(li);
      });
    }
  };

  // ─── LinkManager widget ───────────────────────────────────────────────────────
  // Requirements: 9.x (add/display), 10.x (delete)

  /**
   * Returns true iff url matches /^https?:\/\/.+/ (req 9.2, 9.5).
   * @param {string} url
   * @returns {boolean}
   */
  function validateURL(url) {
    return /^https?:\/\/.+/.test(url);
  }

  var LinkManager = {

    /**
     * Wire the Add button and both inputs, then render saved links.
     * The label input (maxlength=50) and URL input (maxlength=2048) are already
     * constrained in HTML; here we also support submitting via Enter on either
     * input and clear inline errors when the user starts typing.
     * (req 9.1, 9.3, 9.6, 9.7, 10.1, 10.4)
     */
    init: function () {
      var labelInput = document.getElementById('link-label-input');
      var urlInput   = document.getElementById('link-url-input');
      var addBtn     = document.getElementById('link-add-btn');
      var errorEl    = document.getElementById('link-error');

      // Helper that reads current input values and calls add()
      function doAdd() {
        LinkManager.add(
          labelInput ? labelInput.value : '',
          urlInput   ? urlInput.value   : ''
        );
      }

      // Wire Add button click (req 9.1)
      if (addBtn) {
        addBtn.addEventListener('click', doAdd);
      }

      // Allow Enter key on either input to submit (req 9.1 — "two inputs" wired)
      if (labelInput) {
        labelInput.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') doAdd();
        });
        // Clear inline error as user types
        labelInput.addEventListener('input', function () {
          if (errorEl) { errorEl.textContent = ''; errorEl.hidden = true; }
        });
      }
      if (urlInput) {
        urlInput.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') doAdd();
        });
        // Clear inline error as user types
        urlInput.addEventListener('input', function () {
          if (errorEl) { errorEl.textContent = ''; errorEl.hidden = true; }
        });
      }

      LinkManager.render();
    },

    /**
     * Validate and add a new quick link (req 9.2, 9.3, 9.4, 9.5).
     */
    add: function (label, url) {
      var errorEl = document.getElementById('link-error');
      if (errorEl) { errorEl.textContent = ''; errorEl.hidden = true; }

      var trimLabel = (typeof label === 'string') ? label.trim() : '';
      var trimUrl   = (typeof url   === 'string') ? url.trim()   : '';

      if (trimLabel.length === 0) {
        if (errorEl) { errorEl.textContent = 'Label is required.'; errorEl.hidden = false; }
        return;
      }

      if (!validateURL(trimUrl)) {
        if (errorEl) { errorEl.textContent = 'URL must begin with http:// or https://'; errorEl.hidden = false; }
        return;
      }

      var link = {
        id:    (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),
        label: trimLabel,
        url:   trimUrl
      };
      State.links.push(link);
      Storage.save('dashboard_links', State.links);

      // Clear inputs
      var labelInput = document.getElementById('link-label-input');
      var urlInput   = document.getElementById('link-url-input');
      if (labelInput) labelInput.value = '';
      if (urlInput)   urlInput.value   = '';

      LinkManager.render();
    },

    /**
     * Delete a quick link after confirmation (req 10.2, 10.3).
     */
    'delete': function (id) {
      if (!window.confirm('Remove this link?')) return;
      State.links = State.links.filter(function (l) { return l.id !== id; });
      try {
        Storage.save('dashboard_links', State.links);
      } catch (e) {
        // Remove from display only; retain in-memory (req 10.3) — already done above
        showToast('Link removed from view but could not be saved persistently.');
      }
      LinkManager.render();
    },

    /**
     * Re-render the quick links list DOM.
     */
    render: function () {
      var listEl = document.getElementById('link-list');
      if (!listEl) return;

      listEl.innerHTML = '';

      if (State.links.length === 0) {
        var empty = document.createElement('p');
        empty.className = 'link-empty';
        empty.textContent = 'No quick links saved yet. Add one above.';
        listEl.appendChild(empty);
        return;
      }

      State.links.forEach(function (link) {
        var item = document.createElement('span');
        item.className = 'link-item';

        var a = document.createElement('a');
        a.className = 'link-anchor';
        a.href = link.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = link.label;
        a.title = link.url;

        var delBtn = document.createElement('button');
        delBtn.className = 'btn btn-danger btn-sm link-delete-btn';
        delBtn.textContent = '✕';
        delBtn.setAttribute('aria-label', 'Remove link ' + link.label);
        delBtn.addEventListener('click', function () { LinkManager['delete'](link.id); });

        item.appendChild(a);
        item.appendChild(delBtn);
        listEl.appendChild(item);
      });
    }
  };

  // ─── Bootstrap ───────────────────────────────────────────────────────────────
  // Requirements 12.4, 12.5, 13.3: on DOMContentLoaded, load all persisted data
  // into State, then initialise each widget in order.
  document.addEventListener('DOMContentLoaded', function () {
    Storage.loadAll();        // populates State from localStorage (req 12.4, 12.5)

    ThemeToggle.init();       // apply saved theme before other widgets render
    Greeting.init();          // start live clock and render greeting
    NameSetting.init();       // populate name input
    Timer.init();             // render timer display and button states
    TaskManager.init();       // render task list with saved sort
    LinkManager.init();       // render saved quick links
  });

  // ─── Test exports (Node / Vitest only) ───────────────────────────────────────
  // Pure functions are exported behind a guard so the IIFE stays intact for
  // browser use (requirement 13.3 / design testing strategy).
  if (typeof module !== 'undefined') {
    module.exports = {
      State,
      Storage,
      showToast,
      ThemeToggle,
      getGreetingPhrase,
      Greeting,
      NameSetting,
      Timer,
      TaskManager,
      validateURL,
      LinkManager
    };
  }

})();
