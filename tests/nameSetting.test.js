// Feature: todo-life-dashboard, Property 10: Name save trims input and is immediately reflected in the greeting
import { describe, it, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ── jsdom DOM setup ───────────────────────────────────────────────────────────
// The module is a browser IIFE that reads DOM on load; we set up the required
// elements BEFORE requiring app.js so that Greeting.render() can locate them.

function setupDOM() {
  document.body.innerHTML = `
    <span id="greeting-phrase"></span>
    <span id="greeting-time"></span>
    <span id="greeting-date"></span>
    <input id="name-input" type="text" maxlength="50" />
    <button id="name-save-btn"></button>
    <span id="name-error" hidden></span>
  `;
}

// ── localStorage mock ─────────────────────────────────────────────────────────
function mockLocalStorage() {
  const store = new Map();
  return {
    getItem:    (k) => store.has(k) ? store.get(k) : null,
    setItem:    (k, v) => { store.set(k, v); },
    removeItem: (k) => { store.delete(k); },
    clear:      () => { store.clear(); },
    _store:     store,
  };
}

// ── Load the module fresh for each test ───────────────────────────────────────
// Because app.js is an IIFE that closes over State, we need a fresh require
// for each test so State is reset.  Vitest's module cache is cleared via
// dynamic import with a cache-busting query string (supported in Node ESM),
// but since this project uses CJS interop we use resetModules + require.

async function loadApp() {
  // Use a dynamic import with a timestamp to get a fresh module every time.
  // The IIFE runs immediately on import and closes over a fresh State object.
  const mod = await import('../js/app.js?t=' + Date.now());
  return mod.default ?? mod;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Re-require app.js each time so State starts fresh.
 * Uses Node's require + delete cache trick compatible with Vitest CJS mode.
 */
function freshApp() {
  const appPath = require.resolve('../js/app.js');
  delete require.cache[appPath];
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../js/app.js');
}

// ═════════════════════════════════════════════════════════════════════════════
// Property 10: Name save trims input and is immediately reflected in greeting
// Validates: Requirements 2.2, 1.7
// ═════════════════════════════════════════════════════════════════════════════
describe('Property 10: Name save trims input and updates greeting', () => {

  beforeEach(() => {
    // Fresh DOM for every test run
    setupDOM();
    // Replace the global localStorage with our in-memory mock
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage(),
      writable: true,
      configurable: true,
    });
  });

  it('State.name equals inputValue.trim() and greeting contains ", <trimmedName>" after save', () => {
    // Feature: todo-life-dashboard, Property 10: Name save trims input and is immediately reflected in the greeting
    // Validates: Requirements 2.2, 1.7

    // Arbitrary: any string that has ≥1 non-whitespace char and trimmed length ≤ 50
    const validNameArb = fc.string({ minLength: 1 }).filter(
      (s) => s.trim().length >= 1 && s.trim().length <= 50
    );

    fc.assert(
      fc.property(validNameArb, (inputValue) => {
        // Load a fresh copy of the module (fresh State) for isolation
        const { State, NameSetting, Greeting } = freshApp();

        // Ensure State.now is a valid Date so the greeting phrase renders
        State.now = new Date();

        // Re-render to ensure DOM is current before we call save()
        Greeting.render();

        // Act: save the (potentially padded) input
        NameSetting.save(inputValue);

        // Assert 1 – State.name stores the trimmed value (req 2.2)
        const trimmed = inputValue.trim();
        if (State.name !== trimmed) {
          throw new Error(
            `State.name expected "${trimmed}" but got "${State.name}" ` +
            `(inputValue was "${inputValue}")`
          );
        }

        // Assert 2 – Greeting phrase element contains ", <trimmedName>" (req 1.7)
        const phraseEl = document.getElementById('greeting-phrase');
        const text = phraseEl ? phraseEl.textContent : '';
        const expectedSuffix = `, ${trimmed}`;
        if (!text.includes(expectedSuffix)) {
          throw new Error(
            `Greeting text "${text}" does not contain expected suffix "${expectedSuffix}" ` +
            `(inputValue was "${inputValue}")`
          );
        }
      }),
      { numRuns: 100 }
    );
  });
});
