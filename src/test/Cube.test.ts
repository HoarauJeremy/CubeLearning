import { describe, expect, it } from 'vitest';
import {
  ALL_MOVES,
  applyMove,
  applyMoves,
  isCrossSolved,
  movesToString,
  parseMoves,
  solvedState,
  statesEqual,
  toFacelets,
} from '../core/Cube';

import type { Face, Move } from "../core/Cube";

/* ------------------------------------------------------------------ */
/* Modèle de référence indépendant, au niveau des 54 stickers.         */
/* Écrit séparément du modèle cubie : si les deux implémentations      */
/* concordent sur des milliers de séquences aléatoires, la probabilité */
/* d'une même erreur des deux côtés est négligeable.                   */
/* ------------------------------------------------------------------ */

const FACE_OFFSET: Record<Face, number> = { U: 0, R: 9, F: 18, D: 27, L: 36, B: 45 };
const fl = (n: string) => FACE_OFFSET[n[0] as Face] + Number(n.slice(1)) - 1;

// Chaque mouvement = cinq 4-cycles de stickers [a,b,c,d] : a→b→c→d→a.
const STICKER_CYCLES: Record<Face, string[][]> = {
  U: [
    ['U1', 'U3', 'U9', 'U7'], ['U2', 'U6', 'U8', 'U4'],
    ['F1', 'L1', 'B1', 'R1'], ['F2', 'L2', 'B2', 'R2'], ['F3', 'L3', 'B3', 'R3'],
  ],
  R: [
    ['R1', 'R3', 'R9', 'R7'], ['R2', 'R6', 'R8', 'R4'],
    ['F3', 'U3', 'B7', 'D3'], ['F6', 'U6', 'B4', 'D6'], ['F9', 'U9', 'B1', 'D9'],
  ],
  F: [
    ['F1', 'F3', 'F9', 'F7'], ['F2', 'F6', 'F8', 'F4'],
    ['U7', 'R1', 'D3', 'L9'], ['U8', 'R4', 'D2', 'L6'], ['U9', 'R7', 'D1', 'L3'],
  ],
  D: [
    ['D1', 'D3', 'D9', 'D7'], ['D2', 'D6', 'D8', 'D4'],
    ['F7', 'R7', 'B7', 'L7'], ['F8', 'R8', 'B8', 'L8'], ['F9', 'R9', 'B9', 'L9'],
  ],
  L: [
    ['L1', 'L3', 'L9', 'L7'], ['L2', 'L6', 'L8', 'L4'],
    ['U1', 'F1', 'D1', 'B9'], ['U4', 'F4', 'D4', 'B6'], ['U7', 'F7', 'D7', 'B3'],
  ],
  B: [
    ['B1', 'B3', 'B9', 'B7'], ['B2', 'B6', 'B8', 'B4'],
    ['U1', 'L7', 'D9', 'R3'], ['U2', 'L4', 'D8', 'R6'], ['U3', 'L1', 'D7', 'R9'],
  ],
};

const SOLVED_FACELETS =
  'UUUUUUUUU' + 'RRRRRRRRR' + 'FFFFFFFFF' + 'DDDDDDDDD' + 'LLLLLLLLL' + 'BBBBBBBBB';

function refApplyMove(facelets: string, move: Move): string {
  let f = facelets.split('');
  for (let k = 0; k < move.turns; k++) {
    const next = [...f];
    for (const cycle of STICKER_CYCLES[move.face]) {
      const idx = cycle.map(fl);
      for (let i = 0; i < 4; i++) next[idx[(i + 1) % 4]] = f[idx[i]];
    }
    f = next;
  }
  return f.join('');
}

function refApplyMoves(facelets: string, moves: Move[]): string {
  return moves.reduce(refApplyMove, facelets);
}

function randomMoves(n: number, rng: () => number): Move[] {
  return Array.from({ length: n }, () => ALL_MOVES[Math.floor(rng() * 18)]);
}

// Petit PRNG déterministe pour des tests reproductibles.
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe('applyMove — propriétés algébriques', () => {
  it('X appliqué 4 fois = identité, pour chaque face', () => {
    for (const face of ['U', 'R', 'F', 'D', 'L', 'B'] as Face[]) {
      let s = solvedState();
      for (let i = 0; i < 4; i++) s = applyMove(s, { face, turns: 1 });
      expect(statesEqual(s, solvedState()), `${face}⁴ devrait être l'identité`).toBe(true);
    }
  });

  it("X2 = X appliqué 2 fois, X' = X appliqué 3 fois", () => {
    const scramble = parseMoves('R U F2 D L B'); // état non trivial
    const base = applyMoves(solvedState(), scramble);
    for (const face of ['U', 'R', 'F', 'D', 'L', 'B'] as Face[]) {
      const twice = applyMove(applyMove(base, { face, turns: 1 }), { face, turns: 1 });
      expect(statesEqual(applyMove(base, { face, turns: 2 }), twice)).toBe(true);
      const thrice = applyMove(twice, { face, turns: 1 });
      expect(statesEqual(applyMove(base, { face, turns: 3 }), thrice)).toBe(true);
    }
  });

  it("(R U R' U') répété 6 fois = identité (sexy move)", () => {
    const sexy = parseMoves("R U R' U'");
    let s = solvedState();
    for (let i = 0; i < 6; i++) s = applyMoves(s, sexy);
    expect(statesEqual(s, solvedState())).toBe(true);
  });

  it("(R U) est d'ordre 105", () => {
    const ru = parseMoves('R U');
    let s = solvedState();
    for (let i = 1; i <= 105; i++) {
      s = applyMoves(s, ru);
      if (i < 105) expect(statesEqual(s, solvedState())).toBe(false);
    }
    expect(statesEqual(s, solvedState())).toBe(true);
  });

  it('le superflip flippe les 12 arêtes sans rien permuter', () => {
    const superflip = parseMoves("U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2");
    const s = applyMoves(solvedState(), superflip);
    expect(s.ep).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(s.eo).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    expect(s.cp).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(s.co).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('les invariants du groupe sont préservés après mélange aléatoire', () => {
    const rng = mulberry32(42);
    for (let trial = 0; trial < 50; trial++) {
      const s = applyMoves(solvedState(), randomMoves(40, rng));
      expect([...s.ep].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      expect([...s.cp].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
      expect(s.eo.reduce((a, b) => a + b, 0) % 2).toBe(0);
      expect(s.co.reduce((a, b) => a + b, 0) % 3).toBe(0);
    }
  });
});

describe('vérification croisée contre un modèle stickers indépendant', () => {
  it('état résolu identique', () => {
    expect(toFacelets(solvedState())).toBe(SOLVED_FACELETS);
  });

  it('identique sur chacun des 18 mouvements isolés', () => {
    for (const m of ALL_MOVES) {
      expect(toFacelets(applyMove(solvedState(), m)), movesToString([m]))
        .toBe(refApplyMove(SOLVED_FACELETS, m));
    }
  });

  it('identique sur 1000 séquences aléatoires de 30 mouvements', () => {
    const rng = mulberry32(2026);
    for (let trial = 0; trial < 1000; trial++) {
      const moves = randomMoves(30, rng);
      expect(toFacelets(applyMoves(solvedState(), moves)), movesToString(moves))
        .toBe(refApplyMoves(SOLVED_FACELETS, moves));
    }
  });
});

describe('isCrossSolved', () => {
  it('vrai sur un cube résolu', () => {
    expect(isCrossSolved(solvedState())).toBe(true);
  });

  it("vrai après U (la croix D n'est pas touchée)", () => {
    expect(isCrossSolved(applyMove(solvedState(), { face: 'U', turns: 1 }))).toBe(true);
  });

  it('faux après D (les arêtes ne correspondent plus aux centres)', () => {
    expect(isCrossSolved(applyMove(solvedState(), { face: 'D', turns: 1 }))).toBe(false);
  });

  it('faux après F, redevient vrai après F inverse', () => {
    const s = applyMove(solvedState(), { face: 'F', turns: 1 });
    expect(isCrossSolved(s)).toBe(false);
    expect(isCrossSolved(applyMove(s, { face: 'F', turns: 3 }))).toBe(true);
  });

  it('un scramble puis son inverse restaure la croix', () => {
    const rng = mulberry32(7);
    const scramble = randomMoves(25, rng);
    const inverse: Move[] = [...scramble].reverse().map((m) => ({
      face: m.face,
      turns: (4 - m.turns) as Move['turns'],
    }));
    const s = applyMoves(solvedState(), [...scramble, ...inverse]);
    expect(isCrossSolved(s)).toBe(true);
    expect(statesEqual(s, solvedState())).toBe(true);
  });
});

describe('notation', () => {
  it('parse et sérialise en aller-retour', () => {
    const alg = "R U2 R' F B2 D' L2";
    expect(movesToString(parseMoves(alg))).toBe(alg);
  });

  it('rejette les mouvements invalides', () => {
    expect(() => parseMoves('R X')).toThrow();
    expect(() => parseMoves("R2'")).toThrow();
  });
});