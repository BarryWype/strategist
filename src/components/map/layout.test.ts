import { corridor, frontAt, ROOM, tokenSlot } from './layout';

describe('room layout', () => {
  it('keeps every corridor end, its seal and its tokens on the parchment, west to east', () => {
    for (const count of [1, 2, 3, 4]) {
      const corridors = Array.from({ length: count }, (_, i) => corridor(i, count, 'open'));
      for (const c of corridors) {
        const end = c.at(c.end);
        expect(end.x).toBeGreaterThanOrEqual(17);
        expect(end.x).toBeLessThanOrEqual(ROOM.width - 17);
        expect(end.y).toBeGreaterThanOrEqual(80);
        expect(c.end).toBeGreaterThan(c.mouth + 60);
        for (let i = 0; i < 4; i++) {
          const t = tokenSlot(c, i, 4);
          expect(t.x).toBeGreaterThan(0);
          expect(t.x).toBeLessThan(ROOM.width);
        }
      }
      const xs = corridors.map((c) => c.at(c.end).x);
      expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    }
  });

  it('draws the front at the mouth when the pack has pushed in and near the end when held', () => {
    const c = corridor(0, 3, 'narrow');
    expect(frontAt(c, 0)).toBeLessThan(frontAt(c, 0.5));
    expect(frontAt(c, 0.5)).toBeLessThan(frontAt(c, 1));
    expect(frontAt(c, 0)).toBeGreaterThan(c.mouth);
    expect(frontAt(c, 1)).toBeLessThan(c.end);
  });
});
