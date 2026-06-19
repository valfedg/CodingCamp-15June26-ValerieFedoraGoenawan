/**
 * Example-based unit tests for the Timer widget.
 * Requirements: 3.6, 3.9
 *
 * Test environment: Vitest + jsdom
 * Imports from js/app.js via the conditional module.exports guard.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Setup ────────────────────────────────────────────────────────────────────
// app.js is a self-executing IIFE that accesses localStorage and document on
// load.  We must stub these before the module is required.

// Mock localStorage with an in-memory store.
const localStorageStore = {};
const localStorageMock = {
  getItem:    (k) => Object.prototype.hasOwnProperty.call(localStorageStore, k) ? localStorageStore[k] : null,
  setItem:    (k, v) => { localStorageStore[k] = String(v); },
  removeItem: (k) => { delete localStorageStore[k]; },
  clear:      () => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); },
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// Provide the required Timer DOM elements in jsdom before the module loads.
function buildTimerDOM() {
  document.body.innerHTML = `
    <div id="timer-display"></div>
    <button id="timer-start-btn"></button>
    <button id="timer-stop-btn"></button>
    <button id="timer-reset-btn"></button>
    <div id="timer-notification"></div>
    <input id="timer-duration-input" />
    <div id="timer-duration-error"></div>
    <div id="toast"></div>
  `;
}

// Import the module under test.  Because app.js uses an IIFE with a single
// module.exports at the bottom, all exports share the same State object.
const appModule = await import('../js/app.js');
const { State, Timer } = appModule;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Reset timer state and DOM to a known baseline before each test.
 * Uses a short 10-second duration so tick-to-zero tests are fast.
 *
 * @param {number} durationMin  Duration in minutes (default 1 min = 60 s)
 */
function resetTimer(durationMin = 1) {
  // Clear any running interval from a previous test.
  if (State.timer.intervalId !== null) {
    clearInterval(State.timer.intervalId);
    State.timer.intervalId = null;
  }

  // Rebuild the DOM to get fresh elements.
  buildTimerDOM();

  // Put State into a clean stopped state with the requested duration.
  State.timer.durationMin  = durationMin;
  State.timer.remainingSec = durationMin * 60;
  State.timer.running      = false;
  State.timer.intervalId   = null;

  // Render once so DOM reflects the clean state.
  Timer.render();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Timer — example-based unit tests', () => {

  beforeEach(() => {
    // Use fake timers so setInterval / clearInterval are fully controlled.
    vi.useFakeTimers();
    resetTimer(25); // default 25-minute session
  });

  afterEach(() => {
    vi.useRealTimers();
    // Ensure any lingering interval is cleared between tests.
    if (State.timer.intervalId !== null) {
      clearInterval(State.timer.intervalId);
      State.timer.intervalId = null;
    }
  });

  // ── Test 1 ─────────────────────────────────────────────────────────────────
  // Requirements 3.3 (countdown by 1 s/tick) — five ticks decrement by 5 s.
  it('start() → five tick() calls → remainingSec decrements by 5', () => {
    const initialSec = State.timer.remainingSec; // 1500

    Timer.start();
    expect(State.timer.running).toBe(true);

    // Manually invoke tick() five times (simulating five elapsed seconds).
    for (let i = 0; i < 5; i++) {
      Timer.tick();
    }

    expect(State.timer.remainingSec).toBe(initialSec - 5);
  });

  // ── Test 2 ─────────────────────────────────────────────────────────────────
  // Requirements 3.9 — reset() while running stops the interval and restores
  // the configured duration.
  it('reset() while running stops the interval and restores the configured duration', () => {
    Timer.start();
    expect(State.timer.running).toBe(true);
    expect(State.timer.intervalId).not.toBeNull();

    // Tick a few times to move the remaining time away from the initial value.
    Timer.tick();
    Timer.tick();
    Timer.tick();
    expect(State.timer.remainingSec).toBe(State.timer.durationMin * 60 - 3);

    // Now reset while it's still running.
    Timer.reset();

    // Timer should be stopped.
    expect(State.timer.running).toBe(false);
    expect(State.timer.intervalId).toBeNull();

    // Remaining time should be back to the full configured duration.
    expect(State.timer.remainingSec).toBe(State.timer.durationMin * 60);

    // The DOM display should reflect the restored duration.
    const display = document.getElementById('timer-display');
    const expectedMM = String(State.timer.durationMin).padStart(2, '0');
    expect(display.textContent).toBe(`${expectedMM}:00`);

    // Start button should be re-enabled; stop button should be disabled.
    const startBtn = document.getElementById('timer-start-btn');
    const stopBtn  = document.getElementById('timer-stop-btn');
    expect(startBtn.disabled).toBe(false);
    expect(stopBtn.disabled).toBe(true);
  });

  // ── Test 3 ─────────────────────────────────────────────────────────────────
  // Requirements 3.6, 3.9 — tick() reaching zero shows #timer-notification
  // and sets running = false.
  it('tick() reaching zero shows #timer-notification and sets running = false', () => {
    // Use a very short duration (1 second) for this test.
    resetTimer(); // 1 minute = 60 s
    State.timer.remainingSec = 1; // set to 1 so the next tick hits zero

    Timer.start();
    expect(State.timer.running).toBe(true);

    // One tick should bring remainingSec to 0.
    Timer.tick();

    // Timer must have auto-stopped.
    expect(State.timer.running).toBe(false);
    expect(State.timer.intervalId).toBeNull();
    expect(State.timer.remainingSec).toBe(0);

    // The on-page notification must be visible.
    const notif = document.getElementById('timer-notification');
    expect(notif.classList.contains('visible')).toBe(true);

    // DOM display should show 00:00.
    const display = document.getElementById('timer-display');
    expect(display.textContent).toBe('00:00');

    // Button states: start enabled, stop disabled.
    const startBtn = document.getElementById('timer-start-btn');
    const stopBtn  = document.getElementById('timer-stop-btn');
    expect(startBtn.disabled).toBe(false);
    expect(stopBtn.disabled).toBe(true);
  });

});
