/**
 * Modèle du cube (représentation "cubie") + application des mouvements.
 *
 * Conventions (identiques à celles de Kociemba, la référence du domaine) :
 *
 * Slots d'arêtes (ep/eo) :
 *   0=UR 1=UF 2=UL 3=UB 4=DR 5=DF 6=DL 7=DB 8=FR 9=FL 10=BL 11=BR
 *   → les 4 arêtes de la croix (blanc en bas) sont les slots 4 à 7.
 *
 * Slots de coins (cp/co) :
 *   0=URF 1=UFL 2=ULB 3=UBR 4=DFR 5=DLF 6=DBL 7=DRB
 *
 * Orientations :
 *   eo : 0 = bien orientée, 1 = flippée. Seuls les quarts de tour F et B
 *        modifient l'orientation des arêtes qu'ils déplacent.
 *   co : nombre de rotations horaires (0, 1, 2) du coin par rapport à
 *        sa position résolue. U et D ne modifient jamais co.
 *
 * ep[i] = quelle arête occupe le slot i (de même pour cp).
 */

export type Face = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';
export type Turns = 1 | 2 | 3; // 90°, 180°, 270° (= anti-horaire)

export interface Move {
    face: Face;
    turns: Turns;
}

export interface State {
  ep: number[]; // 12 — permutation des arêtes
  eo: number[]; // 12 — orientation des arêtes (0 | 1)
  cp: number[]; // 8  — permutation des coins
  co: number[]; // 8  — orientation des coins (0 | 1 | 2)
}

export const EDGE_NAMES = [
  'UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR',
] as const;

export const CORNER_NAMES = [
  'URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB',
] as const;

/** Slots des 4 arêtes de la croix (couche D) : DR, DF, DL, DB. */
export const CROSS_SLOTS = [4, 5, 6, 7] as const;

export function solvedState(): State {
    return {
      ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      cp: [0, 1, 2, 3, 4, 5, 6, 7],
      co: [0, 0, 0, 0, 0, 0, 0, 0],
    };
}

export function cloneState(s: State): State {
  return { ep: [...s.ep], eo: [...s.eo], cp: [...s.cp], co: [...s.co] };
}

export function statesEqual(a: State, b: State): boolean {
  return (
    a.ep.every((v, i) => v === b.ep[i]) &&
    a.eo.every((v, i) => v === b.eo[i]) &&
    a.cp.every((v, i) => v === b.cp[i]) &&
    a.co.every((v, i) => v === b.co[i])
  );
}

/* ------------------------------------------------------------------ */
/* Tables de mouvements (quart de tour horaire de chaque face).        */
/* table.ep[i] = le slot dont le contenu arrive dans le slot i.        */
/* table.eo[i] / table.co[i] = delta d'orientation ajouté à l'arrivée. */
/* ------------------------------------------------------------------ */

interface MoveTable {
  cp: number[];
  co: number[];
  ep: number[];
  eo: number[];
}

const Z8 = [0, 0, 0, 0, 0, 0, 0, 0];
const Z12 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

const MOVE_TABLES: Record<Face, MoveTable> = {
  U: {
    cp: [3, 0, 1, 2, 4, 5, 6, 7],
    co: Z8,
    ep: [3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11],
    eo: Z12,
  },
  R: {
    cp: [4, 1, 2, 0, 7, 5, 6, 3],
    co: [2, 0, 0, 1, 1, 0, 0, 2],
    ep: [8, 1, 2, 3, 11, 5, 6, 7, 4, 9, 10, 0],
    eo: Z12,
  },
  F: {
    cp: [1, 5, 2, 3, 0, 4, 6, 7],
    co: [1, 2, 0, 0, 2, 1, 0, 0],
    ep: [0, 9, 2, 3, 4, 8, 6, 7, 1, 5, 10, 11],
    eo: [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0],
  },
  D: {
    cp: [0, 1, 2, 3, 5, 6, 7, 4],
    co: Z8,
    ep: [0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11],
    eo: Z12,
  },
  L: {
    cp: [0, 2, 6, 3, 4, 1, 5, 7],
    co: [0, 1, 2, 0, 0, 2, 1, 0],
    ep: [0, 1, 10, 3, 4, 5, 9, 7, 8, 2, 6, 11],
    eo: Z12,
  },
  B: {
    cp: [0, 1, 3, 7, 4, 5, 2, 6],
    co: [0, 0, 1, 2, 0, 0, 2, 1],
    ep: [0, 1, 2, 11, 4, 5, 6, 10, 8, 9, 3, 7],
    eo: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1],
  },
};

function applyQuarterTurn(s: State, t: MoveTable): State {
  const ep = new Array<number>(12); 
  const eo = new Array<number>(12); 
  const cp = new Array<number>(8); 
  const co = new Array<number>(8); 
  
  for (let i = 0; i < 12; i++) {
    ep[i] = s.ep[t.ep[i]];
    eo[i] = s.eo[t.ep[i]] ^ t.eo[i];
  }
  for (let i = 0; i < 8; i++) {
    cp[i] = s.cp[t.cp[i]];
    co[i] = (s.co[t.cp[i]] + t.co[i]) % 3;
  }

  return { ep, eo, cp, co };
}

/** Applique un mouvement. Ne mute pas l'état d'entrée. */
export function applyMove(state: State, move: Move): State {
  let s = state;
  for (let k = 0; k < move.turns; k++) {
    s = applyQuarterTurn(s, MOVE_TABLES[move.face]);
  }
  return s;
}

export function applyMoves(state: State, moves: Move[]): State {
  return moves.reduce(applyMove, state);
}

/** Les 18 mouvements possibles (utile pour le solveur BFS). */
export const ALL_MOVES: Move[] = (['U', 'R', 'F', 'D', 'L', 'B'] as Face[]).flatMap(
  (face) => ([1, 2, 3] as Turns[]).map((turns) => ({ face, turns })),
);

/* ------------------------------------------------------------------ */
/* Notation                                                            */
/* ------------------------------------------------------------------ */

export function moveToString(m: Move): string {
  return m.face + (m.turns === 2 ? '2' : m.turns === 3 ? "'" : '');
}

export function movesToString(moves: Move[]): string {
  return moves.map(moveToString).join(' ');
}

/** Parse une séquence en notation standard, ex. "R U R' U2 F'". */
export function parseMoves(alg: string): Move[] {
  const moves: Move[] = [];
  for (const token of alg.trim().split(/\s+/)) {
    if (token === '') continue;
    const face = token[0] as Face;
    if (!'URFDLB'.includes(face) || token.length > 2) {
      throw new Error(`Mouvement invalide : "${token}"`);
    }
    const suffix = token.slice(1);
    const turns: Turns = suffix === '' ? 1 : suffix === '2' ? 2 : suffix === "'" ? 3 : (() => {
      throw new Error(`Mouvement invalide : "${token}"`);
    })();
    moves.push({ face, turns });
  }
  return moves;
}

/* ------------------------------------------------------------------ */
/* Détection de la croix                                               */
/* ------------------------------------------------------------------ */

/**
 * Croix (blanche) résolue sur la face D : les 4 arêtes DR, DF, DL, DB
 * sont chacune dans son slot, bien orientée. Centres fixes (blanc en bas).
 */
export function isCrossSolved(s: State): boolean {
  return CROSS_SLOTS.every((slot) => s.ep[slot] === slot && s.eo[slot] === 0);
}

/* ------------------------------------------------------------------ */
/* Conversion vers les 54 stickers (pour l'affichage)                  */
/* ------------------------------------------------------------------ */

/**
 * Ordre des faces dans la chaîne retournée : U(0-8) R(9-17) F(18-26)
 * D(27-35) L(36-44) B(45-53), chaque face lue ligne par ligne :
 *
 *              |U1 U2 U3|
 *              |U4 U5 U6|
 *              |U7 U8 U9|
 *  |L1 L2 L3|  |F1 F2 F3|  |R1 R2 R3|  |B1 B2 B3|
 *  |L4 L5 L6|  |F4 F5 F6|  |R4 R5 R6|  |B4 B5 B6|
 *  |L7 L8 L9|  |F7 F8 F9|  |R7 R8 R9|  |B7 B8 B9|
 *              |D1 D2 D3|
 *              |D4 D5 D6|
 *              |D7 D8 D9|
 *
 * Chaque sticker est la lettre de la face d'origine ('U' = couleur du
 * centre U, etc.) — à mapper vers de vraies couleurs dans l'UI.
 */
const FACE_OFFSET: Record<Face, number> = { U: 0, R: 9, F: 18, D: 27, L: 36, B: 45 };

function fl(name: string): number {
  const face = name[0] as Face;
  return FACE_OFFSET[face] + (Number(name.slice(1)) - 1);
}

// Facelettes de chaque slot de coin, dans l'ordre horaire en partant
// du sticker U/D. Même convention que cornerColor ci-dessous.
const CORNER_FACELETS: number[][] = [
  ['U9', 'R1', 'F3'], // URF
  ['U7', 'F1', 'L3'], // UFL
  ['U1', 'L1', 'B3'], // ULB
  ['U3', 'B1', 'R3'], // UBR
  ['D3', 'F9', 'R7'], // DFR
  ['D1', 'L9', 'F7'], // DLF
  ['D7', 'B9', 'L7'], // DBL
  ['D9', 'R9', 'B7'], // DRB
].map((c) => c.map(fl));

const EDGE_FACELETS: number[][] = [
  ['U6', 'R2'], // UR
  ['U8', 'F2'], // UF
  ['U4', 'L2'], // UL
  ['U2', 'B2'], // UB
  ['D6', 'R8'], // DR
  ['D2', 'F8'], // DF
  ['D4', 'L8'], // DL
  ['D8', 'B8'], // DB
  ['F6', 'R4'], // FR
  ['F4', 'L6'], // FL
  ['B6', 'L4'], // BL
  ['B4', 'R6'], // BR
].map((e) => e.map(fl));

const CORNER_COLORS: Face[][] = [
  ['U', 'R', 'F'], ['U', 'F', 'L'], ['U', 'L', 'B'], ['U', 'B', 'R'],
  ['D', 'F', 'R'], ['D', 'L', 'F'], ['D', 'B', 'L'], ['D', 'R', 'B'],
];

const EDGE_COLORS: Face[][] = [
  ['U', 'R'], ['U', 'F'], ['U', 'L'], ['U', 'B'],
  ['D', 'R'], ['D', 'F'], ['D', 'L'], ['D', 'B'],
  ['F', 'R'], ['F', 'L'], ['B', 'L'], ['B', 'R'],
];

export function toFacelets(s: State): string {
  const f = new Array<string>(54);
  for (const face of ['U', 'R', 'F', 'D', 'L', 'B'] as Face[]) {
    f[FACE_OFFSET[face] + 4] = face; // centres
  }
  for (let i = 0; i < 8; i++) {
    const cubie = s.cp[i];
    const ori = s.co[i];
    for (let k = 0; k < 3; k++) {
      f[CORNER_FACELETS[i][(k + ori) % 3]] = CORNER_COLORS[cubie][k];
    }
  }
  for (let i = 0; i < 12; i++) {
    const cubie = s.ep[i];
    const ori = s.eo[i];
    for (let k = 0; k < 2; k++) {
      f[EDGE_FACELETS[i][(k + ori) % 2]] = EDGE_COLORS[cubie][k];
    }
  }
  return f.join('');
}