# Trainer de croix (CFOP) — Algorithme et architecture

Objectif : entraîner la planification de la croix pendant l'inspection (comme en compétition), en forçant la résolution « à l'aveugle » une fois le cube masqué, puis comparer avec la solution optimale.

## Architecture générale

Un cœur logique unique en TypeScript pur (aucune dépendance UI), consommé par une interface fine. Recommandation : une **PWA** (React ou Svelte) couvre web + mobile (installable) + desktop en un seul codebase. Si un desktop natif est voulu plus tard : Tauri. Modules du cœur : `cube-model`, `scrambler`, `cross-solver`, `session` (machine à états), `stats`.

## 1. Modèle du cube

Modèle « cubie » (bien plus pratique qu'un tableau de 54 stickers pour le solveur) :

```ts
type State = {
  ep: number[12]; // permutation des arêtes (quelle arête occupe chaque slot)
  eo: number[12]; // orientation des arêtes (0 ou 1)
  cp: number[8];  // permutation des coins
  co: number[8];  // orientation des coins (0, 1, 2)
}
```

Slots d'arêtes indexés : `0=UF, 1=UR, 2=UB, 3=UL, 4=DF, 5=DR, 6=DB, 7=DL, 8=FR, 9=FL, 10=BR, 11=BL`.

Chaque mouvement est une table de permutation précalculée (convention standard : les quarts de tour F et B inversent l'orientation des arêtes touchées) :

```
applyMove(state, move):            // move ∈ {F,R,U,B,L,D} × {90°, 180°, 270°}
  table = MOVE_TABLES[move.face]
  répéter move.turns fois:
    state = permuter(state, table)
```

Pour l'affichage, une fonction `toFacelets(state)` dérive les 54 stickers (rendu 3D ou patron 2D). Les centres sont fixes — les boutons n'incluent pas de rotations de cube (x, y, z), donc l'orientation est constante : **blanc en bas**, cohérent avec ce que tu travailles déjà.

## 2. Générateur de mélange

```
generateScramble(n = 20):
  moves = []
  tant que moves.length < n:
    face = aléatoire(F, R, U, B, L, D)
    si face == face du dernier mouvement: continuer
    si face est opposée au dernier ET même axe que l'avant-dernier: continuer  // évite R L R
    turns = aléatoire(1, 2, 3)      // 90°, 180°, −90°
    moves.push({face, turns})
  retourner moves
```

20 mouvements aléatoires suffisent largement à randomiser la croix. Le vrai standard WCA (état aléatoire + solveur de Kociemba) est inutile ici.

## 3. Machine à états de l'application

```
SETTINGS ──démarrer──▶ INSPECTION ──timer=0 ou « GO »──▶ SOLVE ──croix détectée──▶ RESULT
    ▲                                                      │ « révéler / abandonner »
    └───────────────── « nouveau mélange » ◀───────────────┘
```

**SETTINGS** : choix du temps d'analyse (15 s, 30 s, 45 s, 60 s, illimité), options (afficher/masquer la liste des mouvements saisis, chrono d'exécution).

**INSPECTION** : appliquer le scramble à l'état résolu, afficher le cube (3D orbitable, avec patron 2D en option), lancer le compte à rebours. Un bouton « Je suis prêt » permet de passer avant la fin.

**SOLVE** : le cube devient une silhouette blanche (ou disparaît). Affichage des boutons `F R U B L D`, `'`, `2`, plus « annuler » et « révéler ». Après chaque saisie → recalcul et vérification.

**RESULT** : voir §7.

## 4. Saisie des mouvements

`'` et `2` modifient **le dernier mouvement saisi** (en bascule), ce qui est le plus naturel : on tape `R` puis `'` pour obtenir `R'`.

```
surBoutonFace(face):  moves.push({face, turns: 1}); recalculer()
surBoutonPrime():     si moves non vide: dernier.turns = (dernier.turns == 3 ? 1 : 3); recalculer()
surBoutonDouble():    si moves non vide: dernier.turns = (dernier.turns == 2 ? 1 : 2); recalculer()
surAnnuler():         moves.pop(); recalculer()

recalculer():
  state = clone(SCRAMBLED_STATE)
  pour chaque m dans moves: applyMove(state, m)
  si isCrossSolved(state): aller à RESULT
```

Point clé : **on recalcule toujours l'état depuis le scramble** au lieu de maintenir un état incrémental. Avec les tables de permutation, rejouer 30 mouvements prend quelques microsecondes, et cela élimine toute la classe de bugs « le modificateur arrive après que le mouvement a été appliqué ».

## 5. Détection de la croix

Croix blanche en bas, centres fixes : les 4 arêtes blanches doivent être dans leur slot avec la bonne orientation.

```
isCrossSolved(state):
  pour slot dans [DF, DR, DB, DL]:        // indices 4, 5, 6, 7
    si state.ep[slot] != slot: retourner faux
    si state.eo[slot] != 0:    retourner faux
  retourner vrai
```

(Une variante « color neutral » testerait les 6 couleurs, mais sans rotations de cube dans l'interface, rester sur blanc-en-bas est plus cohérent avec ton entraînement actuel.)

## 6. Solveur optimal — nombre minimum de mouvements

L'état « croix » se réduit à la position et l'orientation des 4 arêtes blanches :
12×11×10×9 positions × 2⁴ orientations = **190 080 états**. C'est assez petit pour précalculer un **BFS complet** au démarrage (moins d'une seconde, ~190 Ko, à faire dans un web worker).

Encodage d'un état en index :

```
crossIndex(state):
  pos = positions des 4 arêtes blanches parmi les 12 slots
  ori = leurs 4 orientations
  retourner rangLexicographique(pos) * 16 + bits(ori)   // rang parmi les arrangements 12P4
```

Précalcul de la table des distances :

```
buildDistanceTable():
  dist = tableau(190080, rempli de ∞)
  dist[crossIndex(RESOLU)] = 0
  file = [état croix résolu]
  tant que file non vide:
    s = file.retirer()
    pour chacun des 18 mouvements m:          // 6 faces × 3 rotations
      s2 = applyMove(s, m)
      si dist[crossIndex(s2)] == ∞:
        dist[crossIndex(s2)] = dist[crossIndex(s)] + 1
        file.ajouter(s2)
```

La croix est toujours résoluble en **8 mouvements maximum** (métrique HTM), donc le BFS converge très vite.

Extraction d'une séquence optimale par descente gloutonne sur la table :

```
solveCross(state):
  solution = []
  tant que dist[crossIndex(state)] > 0:
    pour chacun des 18 mouvements m:
      s2 = applyMove(state, m)
      si dist[crossIndex(s2)] < dist[crossIndex(state)]:
        solution.push(m); state = s2; sortir de la boucle
  retourner solution
```

Métrique : **HTM** (`R2` compte pour 1 mouvement) — le standard du speedcubing. Compter les mouvements de l'utilisateur de la même façon pour que la comparaison soit honnête.

## 7. Écran de résultat

Afficher : nombre de mouvements de l'utilisateur (HTM), minimum possible, la séquence optimale et celle de l'utilisateur, un ratio d'efficacité (optimal / effectué), et un **replay animé** des deux solutions sur le cube révélé. Persister chaque session en local (localStorage sur PWA, SQLite si natif) : scramble, temps d'analyse choisi, mouvements, optimal, réussite ou abandon, date. Cela permet des courbes de progression : efficacité moyenne, taux de réussite sans révéler, évolution selon le temps d'inspection choisi.

## 8. Extension vers le CFOP complet

Le moteur est générique : chaque étape d'entraînement ne nécessite que deux briques interchangeables — un `goalChecker(state)` (condition de fin) et un solveur ou des solutions de référence. Étapes suivantes naturelles : croix + 1 paire (X-cross, même BFS avec un coin et une arête de plus — l'espace d'états reste calculable), F2L slot par slot (checker = croix + slot rempli), puis trainers OLL/PLL où l'enjeu devient la reconnaissance de cas plutôt que la résolution à l'aveugle. Le mode « cube masqué » se recycle alors en entraînement du lookahead.
