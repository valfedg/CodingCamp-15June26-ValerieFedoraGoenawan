// Feature: todo-life-dashboard, Property 9: Theme toggle is a round-trip over the two-value domain

import { describe, it, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * ThemeToggle.toggle() needs:
 *   1. localStorage  — used by Storage.save('dashboard_theme', …)
 *   2. document.documentElement.dataset.theme — set inside toggle()
 *   3. #theme-toggle-btn                      — optional; _updateButton() guards against missing
 *   4. #toast                                 — optional; showToast() guards against missing
 *
 * jsdom provides (2)–(4) automatically.  We mock localStorage with a simple
 * in-memory store so tests are isolated from any real storage.
 */

// ─── localStorage mock ────────────────────────────────────────────────────────

function makeLocalStorageMock() {
  const store = {};
  return {
    getItem:    (k)    => (k in store ? store[k] : null),
    setItem:    (k, v) => { store[k] = String(v); },
    removeItem: (k)    => { delete store[k]; },
    clear:      ()     => { Object.keys(store).forEach(k => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key:        (i)    => Object.keys(store)[i] ?? null,
    _store:     store,
  };
}

// ─── Module import helpers ─────────────────────────────────────────────────────

/**
 * Re-import app.js with a fresh localStorage mock each time so State and
 * Storage are reset between property iterations.
 *
 * Vitest caches modules by default.  We bypass this by deleting the cache
 * entry before each require() call.
 */
function loadFreshAppModule(localStorageMock) {
  // Replace the global localStorage with our mock.
  Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });

  // Clear Node's require cache so app.js is re-evaluated with the fresh mock.
  const appPath = require.resolve('../js/app.js');
  delete require.cache[appPath];

  return require('../js/app.js');
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('ThemeToggle — Property 9: Theme toggle round-trip', () => {
  let originalLocalStorage;

  beforeEach(() => {
    // Stash real localStorage so we can restore it after each test.
    originalLocalStorage = global.localStorage;
  });

  afterEach(() => {
    global.localStorage = originalLocalStorage;
    // Clear require cache to prevent state leakage between tests.
    const appPath = require.resolve('../js/app.js');
    delete require.cache[appPath];
  });

  /**
   * **Validates: Requirements 11.2, 11.3**
   *
   * For any starting theme ∈ {"light", "dark"}:
   *   - After toggle() #1 the theme is the opposite value.
   *   - After toggle() #2 the theme equals the starting value.
   *   - At every point (initial, intermediate, final) the theme ∈ {"light", "dark"}.
   *   - The localStorage key 'dashboard_theme' reflects the current State.theme
   *     after each toggle (req 11.3).
   */
  it('toggle twice returns to starting theme and all intermediate values are valid', () => {
    const VALID_THEMES = new Set(['light', 'dark']);

    fc.assert(
      fc.property(
        fc.constantFrom('light', 'dark'),
        (startingTheme) => {
          // ── Fresh module + mock per iteration ──────────────────────────────
          const lsMock = makeLocalStorageMock();
          const { State, ThemeToggle } = loadFreshAppModule(lsMock);

          // Set the starting theme directly in State (simulates Storage.loadAll
          // having run before ThemeToggle is used).
          State.theme = startingTheme;

          // ── Initial invariant ──────────────────────────────────────────────
          if (!VALID_THEMES.has(State.theme)) return false;

          // ── Toggle #1: should flip to the opposite ─────────────────────────
          ThemeToggle.toggle();
          const afterFirstToggle = State.theme;

          if (!VALID_THEMES.has(afterFirstToggle)) return false;
          if (afterFirstToggle === startingTheme) return false;          // must have flipped

          // Req 11.3: persisted value must match in-memory state.
          const persisted1 = JSON.parse(lsMock.getItem('dashboard_theme'));
          if (persisted1 !== afterFirstToggle) return false;

          // ── Toggle #2: should return to starting value ─────────────────────
          ThemeToggle.toggle();
          const afterSecondToggle = State.theme;

          if (!VALID_THEMES.has(afterSecondToggle)) return false;
          if (afterSecondToggle !== startingTheme) return false;         // must have round-tripped

          // Req 11.3: persisted value must match in-memory state.
          const persisted2 = JSON.parse(lsMock.getItem('dashboard_theme'));
          if (persisted2 !== afterSecondToggle) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
