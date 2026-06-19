// Feature: todo-life-dashboard, Property 1: Greeting phrase covers every hour exactly once

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getGreetingPhrase } from '../js/app.js';

/**
 * Property 1: Greeting phrase covers every hour exactly once
 * Validates: Requirements 1.3, 1.4, 1.5, 1.6
 *
 * For any integer h in [0, 23]:
 *   - getGreetingPhrase(h) returns exactly one of the four valid phrases
 *   - the specific phrase matches the specified time ranges:
 *       5–11  → "Good Morning"
 *      12–17  → "Good Afternoon"
 *      18–21  → "Good Evening"
 *      22–23 and 0–4 → "Good Night"
 */

const VALID_PHRASES = [
  'Good Morning',
  'Good Afternoon',
  'Good Evening',
  'Good Night',
];

describe('Greeting — Property 1: Greeting phrase covers every hour exactly once', () => {

  it('returns exactly one of the four valid phrases for every hour in [0, 23]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),
        (h) => {
          const phrase = getGreetingPhrase(h);
          // Must be one of the four valid phrases (and only one, since it's a string)
          return VALID_PHRASES.includes(phrase);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('maps hours 5–11 to "Good Morning" (req 1.3)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 11 }),
        (h) => getGreetingPhrase(h) === 'Good Morning'
      ),
      { numRuns: 100 }
    );
  });

  it('maps hours 12–17 to "Good Afternoon" (req 1.4)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 12, max: 17 }),
        (h) => getGreetingPhrase(h) === 'Good Afternoon'
      ),
      { numRuns: 100 }
    );
  });

  it('maps hours 18–21 to "Good Evening" (req 1.5)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 18, max: 21 }),
        (h) => getGreetingPhrase(h) === 'Good Evening'
      ),
      { numRuns: 100 }
    );
  });

  it('maps hours 22–23 and 0–4 to "Good Night" (req 1.6)', () => {
    // Use oneof to cover both night ranges: [0,4] and [22,23]
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: 0, max: 4 }),
          fc.integer({ min: 22, max: 23 })
        ),
        (h) => getGreetingPhrase(h) === 'Good Night'
      ),
      { numRuns: 100 }
    );
  });

  it('the mapping is exhaustive — every hour in [0, 23] is assigned a phrase (partition completeness)', () => {
    // Deterministically walk all 24 hours to confirm no hour is unhandled
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const results = hours.map((h) => ({ h, phrase: getGreetingPhrase(h) }));

    // All phrases are in the valid set
    expect(results.every(({ phrase }) => VALID_PHRASES.includes(phrase))).toBe(true);

    // Exact expected mapping per requirements 1.3–1.6
    const expectedMapping = {
      0: 'Good Night',
      1: 'Good Night',
      2: 'Good Night',
      3: 'Good Night',
      4: 'Good Night',
      5: 'Good Morning',
      6: 'Good Morning',
      7: 'Good Morning',
      8: 'Good Morning',
      9: 'Good Morning',
      10: 'Good Morning',
      11: 'Good Morning',
      12: 'Good Afternoon',
      13: 'Good Afternoon',
      14: 'Good Afternoon',
      15: 'Good Afternoon',
      16: 'Good Afternoon',
      17: 'Good Afternoon',
      18: 'Good Evening',
      19: 'Good Evening',
      20: 'Good Evening',
      21: 'Good Evening',
      22: 'Good Night',
      23: 'Good Night',
    };

    hours.forEach((h) => {
      expect(getGreetingPhrase(h)).toBe(expectedMapping[h]);
    });
  });
});
