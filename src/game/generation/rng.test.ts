import { createRng, restoreRng } from './rng';

describe('rng', () => {
  it('gives the same stream for the same seed', () => {
    const a = createRng('seed');
    const b = createRng('seed');
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(Array.from({ length: 5 }, () => b.next()));
  });

  it('continues exactly as the original when resumed from a saved state', () => {
    const original = createRng('fight-42');
    for (let i = 0; i < 17; i++) original.next();
    const saved = JSON.parse(JSON.stringify(original.state()));

    const expected = Array.from({ length: 20 }, () => original.int(1, 100));
    const resumed = restoreRng(saved);
    expect(Array.from({ length: 20 }, () => resumed.int(1, 100))).toEqual(expected);
  });

  it('is not moved by taking its state', () => {
    const a = createRng('seed');
    const b = createRng('seed');
    a.state();
    expect(a.next()).toBe(b.next());
  });
});
