# Charte de l'atelier

> Point d'entrée obligatoire de toute personne ou de tout agent qui découvre le
> dépôt. Cette charte est la seule source de direction. Elle ne remplace pas la
> lecture du code, des contrats et des tests concernés par une tâche.

`AGENTS.md` est chargé automatiquement. Il impose la lecture de cette charte et
route vers un rôle borné décrit sous [`docs/agents/`](./docs/agents/README.md).

## 1. Ordre d'autorité

En cas de contradiction, appliquer cet ordre :

1. la demande explicite actuelle du propriétaire ;
2. les contrats, schémas et gardes exécutables présents sur la base Git de
   travail ;
3. cette charte ;
4. les guides sous `docs/` et les conventions sous `conventions/`.

Un statut GitHub, une PR ou un résultat CI est une donnée vivante : la vérifier.
Une note « fait localement » ne prouve ni un commit, ni une fusion, ni une CI
verte.

## 2. Un atelier générique

Ce dépôt est un **atelier générique**. Il sert à générer **plusieurs
applications différentes**. Il n'est lié à aucune application particulière.

- L'atelier ne contient aucune donnée d'application : ni contrat backend réel,
  ni règle métier, ni identifiant, ni domaine réel, ni capture d'un produit.
- Ses tests et ses preuves utilisent uniquement des fixtures fictives,
  déclarées comme telles.
- Les faits d'un produit réel (brief, contrats, conception, données) vivent dans
  le dépôt de ce produit, jamais dans l'atelier.

## 3. Étape B : des produits extérieurs

L'atelier produit des **produits Angular extérieurs**. Un produit vit dans sa
propre racine physique, hors de l'atelier, avec ses propres outils installés.

La chaîne de l'étape B :

1. `prepare:application-workspace` prépare la racine du produit ;
2. `compile:backend-contract` et `compile:application-design` compilent les
   contrats du produit (`--target-root`) ;
3. `create-app --target-root` crée la coque de l'application ;
4. `generate:list-query` et `generate:action-request` génèrent les lectures et
   les actions ;
5. `compile:page-execution-plan` et `generate:page-composition` composent une
   page ;
6. `prepare:page-realization` et `verify:page-realization` encadrent la
   réalisation de la page ;
7. la session, le relais nginx et la politique de sécurité sont fournis par la
   coque.

Chaque commande lit les entrées du produit, publie sous plan relu
(`--dry-run`, puis `--apply <plan_id>`) et refuse toute sortie hors du produit.
Le protocole détaillé est dans
[`docs/etape-b/external-application-creation.md`](./docs/etape-b/external-application-creation.md).
Le runbook des commandes est
[`docs/etape-b/runbook-commandes-creation.md`](./docs/etape-b/runbook-commandes-creation.md).

Le job CI requis **External application shells** prouve cette chaîne sur deux
produits fictifs (`observatory`, `equipment-hire`) et sur des produits A et B
indépendants.

## 4. Une interface libre, dans un cadre fourni

L'IA est libre d'écrire l'interface d'une page. Cette liberté s'exerce dans un
**cadre d'éléments fourni** par l'atelier :

- le bon de travail de la page (fichiers autorisés, contrats, routes) ;
- les lectures, actions et compositions générées ;
- la session, les jetons de service et les erreurs fournis par la coque ;
- les primitives officielles de la pile (Angular, CDK, Material si qualifié).

L'IA n'invente jamais une règle métier, une permission, un endpoint ou une
donnée. Une inconnue reste visible et bloque seulement ce qu'elle concerne.

## 5. Protections minimales

Toute contribution à l'atelier et tout produit généré passent ces protections :

| Protection       | Preuve minimale                                              |
| ---------------- | ------------------------------------------------------------ |
| build            | compilation et `ngc --strictTemplates` sans erreur            |
| lint             | ESLint sans avertissement                                    |
| tests            | tests unitaires et tests de l'étape B verts                  |
| licences         | dépendances de production permissives (`check:licenses`)     |
| smoke navigateur | coque servie et ouverte dans un vrai navigateur              |
| aucun secret     | `check:secrets` (gitleaks) vert ; aucun secret dans Git      |
| aucune donnée    | aucune donnée d'application dans l'atelier (§ 2)             |

Une gate, un hook ou une revue ne se contourne jamais (`--no-verify`, fusion
forcée, baisse silencieuse d'exigence). Un test vert ne prouve que ce qu'il
exerce.

## 6. Agents

Tout agent choisit un seul rôle parmi `steward`, `step-executor`,
`task-specialist` et `orchestrator`. Les permissions, gates et handoffs sont
définis dans [`docs/agents/operating-model.md`](./docs/agents/operating-model.md)
et bornés par
[`conventions/agents/operating-model.json`](./conventions/agents/operating-model.json).
Le propriétaire dispose du
[guide simple d'orchestration](./docs/agents/guide-utilisateur.md).

## 7. Git, revue et fusion

- branche dédiée et PR ciblée ;
- historique linéaire et `main` protégé ;
- approbation indépendante : le dernier pousseur n'approuve pas son propre
  changement ;
- aucune fusion tant qu'une gate est rouge ou en cours ;
- après fusion, vérifier le run de `main`.

Rapporter séparément : commit, push, revue, approbation, fusion et CI
post-fusion.
