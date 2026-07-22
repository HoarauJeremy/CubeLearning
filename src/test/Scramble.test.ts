import { describe, expect, it } from 'vitest';
import {
  applyMoves,
  generateScramble,
  isCrossSolved,
  solvedState,
} from '../core/Cube';
import type { Face } from '../core/Cube';

const OPPOSITE: Record<Face, Face> = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };
const FACES = new Set<Face>(['U', 'R', 'F', 'D', 'L', 'B']);

// PRNG déterministe pour des tests reproductibles.
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('generateScramble', () => {
  it('produit le nombre de mouvements demandé', () => {
    const rng = mulberry32(1);
    expect(generateScramble(20, rng)).toHaveLength(20);
    expect(generateScramble(5, rng)).toHaveLength(5);
    expect(generateScramble(0, rng)).toHaveLength(0);
    expect(generateScramble(undefined, rng)).toHaveLength(20); // défaut
  });

  it('ne produit que des mouvements valides', () => {
    const rng = mulberry32(2);
    for (const m of generateScramble(500, rng)) {
      expect(FACES.has(m.face)).toBe(true);
      expect([1, 2, 3]).toContain(m.turns);
    }
  });

  it("jamais deux fois la même face d'affilée (200 scrambles)", () => {
    for (let seed = 0; seed < 200; seed++) {
      const moves = generateScramble(25, mulberry32(seed));
      for (let i = 1; i < moves.length; i++) {
        expect(moves[i].face, `seed ${seed}, position ${i}`).not.toBe(moves[i - 1].face);
      }
    }
  });

  it('jamais de sandwich même-axe type R L R (200 scrambles)', () => {
    for (let seed = 0; seed < 200; seed++) {
      const moves = generateScramble(25, mulberry32(seed));
      for (let i = 2; i < moves.length; i++) {
        const sandwich =
          moves[i].face === moves[i - 2].face &&
          moves[i - 1].face === OPPOSITE[moves[i].face];
        expect(sandwich, `seed ${seed}, position ${i}`).toBe(false);
      }
    }
  });

  it('est déterministe à seed égal', () => {
    expect(generateScramble(20, mulberry32(99))).toEqual(generateScramble(20, mulberry32(99)));
  });

  it('varie selon le seed', () => {
    const a = generateScramble(20, mulberry32(1));
    const b = generateScramble(20, mulberry32(2));
    expect(a).not.toEqual(b);
  });

  it('casse la croix une fois appliqué (seeds fixés)', () => {
    for (const seed of [3, 17, 42, 123, 2026]) {
      const s = applyMoves(solvedState(), generateScramble(20, mulberry32(seed)));
      expect(isCrossSolved(s), `seed ${seed}`).toBe(false);
    }
  });

  it('fonctionne aussi avec Math.random par défaut', () => {
    const moves = generateScramble(20);
    expect(moves).toHaveLength(20);
    for (let i = 1; i < moves.length; i++) {
      expect(moves[i].face).not.toBe(moves[i - 1].face);
    }
  });
});