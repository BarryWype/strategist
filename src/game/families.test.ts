import { startingHeroes } from '@/content/heroes';

import { answers, familyCounts, familyLevels } from './families';

const hero = (id: string) => ({ hero: startingHeroes.find((h) => h.id === id)! });

describe('answering threats', () => {
  it('answers a threat at level N with N tags of its family on the crossing, not with family level N', () => {
    // Odo (Cleric, mace) carries 2 Faith tags: Faith level 1, but enough for Holy 2.
    const odo = familyCounts([hero('odo')]);
    expect(familyLevels(odo).faith).toBe(1);
    expect(answers(odo, { id: 'holy', level: 2 })).toBe(true);
    expect(answers(odo, { id: 'holy', level: 3 })).toBe(false);
    expect(answers(familyCounts([hero('bram')]), { id: 'holy', level: 1 })).toBe(false);
  });

  it('counts earned tags and holy water', () => {
    expect(answers(familyCounts([{ ...hero('bram'), extraTags: { faith: 1 } }], { faith: 1 }), { id: 'holy', level: 2 })).toBe(true);
  });
});
