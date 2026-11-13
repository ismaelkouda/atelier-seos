# Generator Platform — moteur de l'étape B

Ce répertoire contient le moteur déterministe qui produit des **produits Angular
extérieurs**. Chaque commande lit les entrées d'un produit préparé hors de
l'atelier, calcule un plan relu (`--dry-run`), puis publie seulement ce plan
(`--apply <plan_id>`). Aucune commande n'écrit dans `apps/` ou `libs/` de
l'atelier pour un produit.

La chaîne est décrite pour les humains dans
[`docs/etape-b/runbook-commandes-creation.md`](../../docs/etape-b/runbook-commandes-creation.md)
et en détail dans
[`docs/etape-b/external-application-creation.md`](../../docs/etape-b/external-application-creation.md).

## Contrat backend canonique

`schemas/backend-contract.schema.json` définit le contrat fermé, indépendant de
la source, consommé par les conceptions et les pages. OpenAPI, Postman et les
déclarations structurées sont des entrées d'adaptateurs ; aucune n'obtient
d'échappatoire propre dans le modèle canonique. Chaque service, schéma de
sécurité, modèle, champ, paramètre, corps, réponse et opération porte une preuve
qui pointe vers un instantané immuable.

`core/backend-contract.mjs` ajoute les invariants que JSON Schema ne prouve pas
seul : identités uniques, références résolues, formes de types exactes,
cohérence accès/sécurité, au moins une réponse de succès, enveloppes fermées et
provenance SHA-256 exacte.

Le cycle de vie est monotone et fondé sur des preuves : un analogue reste
`reference` ; le contrat cible commence `planned`, devient `implemented`
seulement avec une preuve d'implémentation, et `verified-live` seulement avec la
preuve correspondante.

### Compiler un contrat ou une conception

```bash
bun run compile:backend-contract -- --target-root <racine> \
  --adapter structured --definition <source.json> --out <contrat.json> --dry-run
bun run compile:backend-contract -- --target-root <racine> \
  --adapter openapi --definition <openapi.yaml> --out <contrat.json> --dry-run
bun run compile:backend-contract -- --target-root <racine> \
  --adapter postman --definition <collection.json> --out <reference.json> --dry-run
bun run compile:application-design -- --target-root <racine> \
  --source <conception.yaml> --out <conception.json> --dry-run
```

Après revue, remplacer `--dry-run` par `--apply <plan_id>`. Une collection
Postman reste toujours une observation `reference`.

## Chaîne extérieure

| Étape             | Commande                                               | Module principal                         |
| ----------------- | ------------------------------------------------------ | ---------------------------------------- |
| Racine du produit | `prepare:application-workspace`                        | `core/application-workspace.mjs`         |
| Coque             | `create-app --target-root`                             | `core/application-shell-publication.mjs` |
| Lecture           | `generate:list-query --target-root`                    | `core/external-list-query.mjs`           |
| Action            | `generate:action-request --target-root`                | `core/external-action-request.mjs`       |
| Plan de page      | `compile:page-execution-plan`                          | `core/external-page-plan.mjs`            |
| Composition       | `generate:page-composition --target-root`              | `core/external-page-composition.mjs`     |
| Réalisation       | `prepare:page-realization` / `verify:page-realization` | `core/external-page-realization.mjs`     |
| Reprise           | `recover:application-publication`                      | `core/application-publication.mjs`       |

Les profils pris en charge pour la racine et la coque sont `angular-pwa` et
`react-spa`. Les lectures, actions, compositions et réalisations de page sont
Angular avec session.

La coque Angular fournit la session, le relais nginx de même origine et la
politique de sécurité de contenu. Sept sources génériques de
`libs/core/src/lib/interceptors/` et `libs/shared/domain/src/lib/errors/` sont
recopiées octet pour octet dans chaque produit
(`renderers/angular-application-session-renderer.mjs`).

## Réalisation d'une page par l'IA

`prepare:page-realization` lie un contrat de page, le plan d'exécution et
l'inventaire protégé du produit à un bon de travail. L'IA écrit exactement les
fichiers listés ; elle est libre de l'interface dans ce cadre. Le bon de travail
porte aussi le nœud de rôle `screen`, le profil et le contrat d'archétype haché
(`shape` + `forbid`). `verify:page-realization` refuse une dérive de
l'inventaire protégé, un fichier non autorisé ou absent, un appel réseau direct,
un littéral d'endpoint ou une correspondance `data-cmz-id` manquante, puis
exécute compilation, build de production, lint et tests dans un candidat jetable
et confiné.

## Validation

```bash
bun run test:external-application-shells
bun run check:generator-platform
```

- `test:external-application-shells` exécute les tests de chemins, plans,
  propriété, reprise, lectures, actions, compositions, grammaire et réalisation
  de l'étape B.
- `check:generator-platform:core` exécute tous les tests `node:test` de ce
  répertoire.
- `check:generator-platform:angular` prépare les deux produits de session
  fictifs (`observatory`, `equipment-hire`), type-check leurs sources et leurs
  specs, puis lance le test natif Angular du produit `observatory`.

Le job CI requis **External application shells** ajoute la preuve native
complète : installation réelle des produits, outils confinés, relais nginx et
navigateur.

Le validateur JSON Schema (`validate-ir.mjs`) n'a pas de dépendance. Il
n'implémente que les mots-clés utilisés par ces contrats ; tout nouveau mot-clé
exige ses tests.
