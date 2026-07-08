# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.


Voici l'ordre que je suivrais, pensé pour que chaque étape soit testable avant de passer à la suivante. La règle d'or : tout le cœur d'abord, l'UI ensuite — un bug dans le modèle du cube empoisonnerait tout le reste, donc on le verrouille avec des tests avant d'écrire le moindre composant React.

### Phase 0 — Setup (une soirée)

- 1. Créer le projet : npm create vite@latest (template react-ts), ajouter Vitest pour les tests unitaires, et poser la structure src/core/ (logique pure, zéro import React) / src/ui/ (composants).

### Phase 1 — Le cœur, sans aucune UI

- 2. Modèle du cube : types State, constante état résolu, tables de permutation des 18 mouvements, fonction applyMove. C'est la tâche la plus délicate du projet — les tables se font à la main et une erreur est sournoise.

- 3. Tests unitaires du modèle : R appliqué 4 fois = identité (pour les 6 faces), R U R' U' répété 6 fois = identité, R2 = R deux fois. Si ces tests passent, ton modèle est quasi certainement juste.

- 4. toFacelets(state) : conversion vers les 54 stickers pour l'affichage, testable en affichant l'état résolu en console.

- 5. Générateur de scramble avec les contraintes (pas deux fois la même face, pas de motif R L R).

- 6. isCrossSolved(state) + un test : scramble aléatoire → faux, état résolu → vrai.

- 7. Le solveur : crossIndex (encodage), buildDistanceTable (BFS), solveCross (descente gloutonne). Tests : distance de l'état résolu = 0, aucune distance > 8 dans la table, et pour quelques scrambles la solution retournée résout bien la croix quand on la rejoue.

À la fin de la phase 1, tu peux jouer une partie entière en console Node : c'est le vrai jalon.

### Phase 2 — UI minimale (fonctionnelle avant d'être jolie)

- 8. Rendu du cube en patron 2D (SVG ou CSS grid alimenté par toFacelets).
- 9. Machine à états de session avec useReducer : SETTINGS → INSPECTION → SOLVE → RESULT, et les transitions.
- 10. Écran settings : choix du temps d'analyse.
- 11. Écran inspection : cube affiché + compte à rebours + bouton « Je suis prêt ».
- 12. Écran solve : les boutons F R U B L D, ', 2, annuler, révéler, la liste des mouvements saisis, avec recalculer() et détection automatique de la croix.
- 13. Écran résultat : tes mouvements vs l'optimal, les deux séquences, bouton « nouveau mélange ».

À ce stade l'app est jouable de bout en bout — deuxième jalon.

### Phase 3 — Finitions

- 14. Déplacer buildDistanceTable dans un web worker (ou au minimum le lancer en async au démarrage).
- 15. Replay animé des deux solutions sur le cube révélé.
- 16. Persistance localStorage + écran historique/stats (efficacité moyenne, taux de réussite).
- 17. PWA avec vite-plugin-pwa + passage responsive mobile (gros boutons tactiles).
- 18. Déploiement sur Netlify, Vercel ou GitHub Pages.


### Phase 4 — Plus tard

- 19. X-cross, trainer F2L slot par slot, éventuellement cube 3D en Three.js — le moteur de la phase 1 se réutilise tel quel.

Un conseil sur la tâche 2 : ne tape pas les tables de permutation de tête. Prends un vrai cube en main, fais physiquement le mouvement R, et note quelle arête va où — c'est le moyen le plus fiable de les écrire juste du premier coup. Si tu veux, je peux te donner directement le code de applyMove avec les tables déjà vérifiées, pour t'épargner cette partie ingrate.