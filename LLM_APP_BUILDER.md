# Guide LLM — concevoir une application page par page

> Lire d'abord [`PROJECT_AUTHORITY.md`](./PROJECT_AUTHORITY.md). Ce guide décrit
> le parcours de construction ; il ne redéfinit ni le cap produit, ni la
> maturité des capacités.

## Mission

Tu es la LLM chargée d’aider l’utilisateur à concevoir puis construire une
application avec cet atelier. L’application vit dans sa propre racine de
produit, hors de l’atelier.

L’utilisateur n’a pas à connaître l’architecture, les générateurs ou les formats
JSON du dépôt. Tu dois transformer son besoin exprimé en langage simple en une
conception vérifiable, puis en code conforme au produit.

Le travail se fait progressivement :

```text
vision du produit
→ périmètre du MVP
→ carte des pages
→ conception d’une page
→ validation humaine
→ implémentation de cette page
→ vérification
→ page suivante
```

Ne commence jamais à construire toutes les pages en une seule fois.

## Principes impératifs

1. Inspecte le workspace avant de poser des questions techniques.
2. Pose une à trois questions courtes à la fois, puis attends les réponses.
3. Utilise des mots métier avec l’utilisateur, pas le vocabulaire interne du
   générateur.
4. Ne demande jamais à l’utilisateur de remplir directement un JSON, un DTO, un
   `project.json` ou une configuration Nx.
5. N’invente jamais un endpoint, un champ backend, un type, une permission ou
   une règle métier.
6. Distingue toujours les informations confirmées, déduites et inconnues.
7. Recherche dans le dépôt toute information qui peut y être découverte avant de
   la demander à l’utilisateur.
8. Obtiens une validation explicite avant de créer une application, une page ou
   d’appliquer un changement destructif.
9. Une validation d’une page n’autorise pas implicitement la construction des
   pages suivantes.
10. Ne contourne jamais une gate en supprimant un test, en élargissant une
    allowlist ou en affaiblissant une règle.

## Chaîne exécutable obligatoire

L’utilisateur valide les décisions et fournit les faits métier. Il ne rédige ni
JSON, ni YAML, ni TypeScript, ni HTML, ni configuration. L'agent peut exécuter
les commandes locales réversibles dans l'autorité accordée ; la LLM de
conception écrit les artefacts source, la LLM de réalisation écrit l’interface
dans le périmètre borné de chaque page, et les scripts calculent les plans,
publient et vérifient.

Chaque produit vit dans **sa propre racine**, hors de l’atelier. L’atelier ne
reçoit jamais les faits, contrats ou conceptions d’un produit.

```text
entretien produit
→ racine du produit préparée
→ source backend immuable
→ contrat backend canonique
→ source de conception applicative
→ conception canonique validée
→ coque Angular
→ lectures et actions
→ plan et composition d’une page
→ bon de travail d’une page
→ réalisation UI par la LLM
→ oracles
→ page suivante
```

Chaque commande extérieure exige `--target-root <racine absolue>`, calcule un
plan avec `--dry-run`, puis publie seulement le plan relu avec
`--apply <plan_id>` (`--expect-plan <plan_id>` pour `create-app`). Ne jamais
transposer les options d'une CLI à une autre : vérifier son aide (`--explain` ou
`--help`) dans la version présente du dépôt.

### 1. Préparer la racine du produit

```bash
bun run prepare:application-workspace -- --target-root <racine> \
  --profiles angular-pwa --github-repository <owner/repo> \
  --review-owner <login> --dry-run
```

La racine reçoit ses propres configurations Nx/Bun et son verrou. Elle ne
partage aucun runtime avec l’atelier.

### 2. Compiler le contrat backend

Choisir exactement un adaptateur :

```bash
bun run compile:backend-contract -- --target-root <racine> --adapter structured --definition <source.json> --out <contrat.json> --dry-run
bun run compile:backend-contract -- --target-root <racine> --adapter openapi --definition <openapi.json|yaml> --out <contrat.json> --dry-run
bun run compile:backend-contract -- --target-root <racine> --adapter postman --definition <collection.json> --out <contrat-reference.json> --dry-run
```

Les chemins sont relatifs à la racine du produit. Une collection Postman est
toujours une observation `reference`. Une spécification OpenAPI cible `planned`
doit être distincte de toute API analogue.

### 3. Compiler la conception complète

La LLM écrit une source JSON ou YAML conforme à
`tools/generator-platform/schemas/application-design.schema.json`. Elle y
déclare les sources immuables, contrats backend, audiences, expériences, pages,
états, contrôles, actions, données et preuves.

```bash
bun run compile:application-design -- --target-root <racine> --source <conception.json|yaml> --out <conception.json> --dry-run
```

Une conception `approved` échoue si une inconnue subsiste, si une page est
inaccessible, si un champ ou endpoint n’existe pas dans le contrat cible, ou si
une source `reference` pilote l’implémentation.

### 4. Créer la coque de l’application

```bash
bun run create-app -- --target-root <racine> --design <conception.json> --experience <experience-id> --app <app> --profile angular-pwa --dry-run
bun run create-app -- --target-root <racine> --design <conception.json> --experience <experience-id> --app <app> --profile angular-pwa --expect-plan <plan_id>
```

La coque porte la session, le relais nginx de même origine et la politique de
sécurité de contenu. Elle ne contient aucune règle métier.

### 5. Générer les lectures, les actions et la composition

```bash
bun run generate:list-query -- --target-root <racine> --app <app> --definition <lecture.json> --dry-run
bun run generate:action-request -- --target-root <racine> --app <app> --definition <action.json> --dry-run
bun run compile:page-execution-plan -- --target-root <racine> --app <app> --page <page_id> --dry-run
bun run generate:page-composition -- --target-root <racine> --app <app> --page <page_id> --dry-run
```

Une page peut porter plusieurs lectures et plusieurs actions indépendantes
(chargements sur entrée + actions, sans dépendance ni ordre entre eux). Une
dépendance ordonnée entre nœuds n’est pas prise en charge. Une autre composition
n’est jamais simulée.

### 6. Réaliser une page par LLM

```bash
bun run prepare:page-realization -- --target-root <racine> --app <app> --page <page_id> --dry-run
bun run prepare:page-realization -- --target-root <racine> --app <app> --page <page_id> --apply <plan_id>
```

La LLM lit le bon de travail publié, y compris le nœud de rôle `screen`, le
profil de l'application et le contrat d'archétype haché (`shape` + `forbid`),
puis écrit uniquement les fichiers autorisés. Elle est libre de l’interface
dans ce cadre. Elle ne fait aucun appel HTTP direct et mappe chaque identifiant
du contrat vers un sélecteur `data-cmz-id` exact. Ensuite :

```bash
bun run verify:page-realization -- --target-root <racine> --app <app> --page <page_id> --dry-run
```

En cas d’échec, la LLM corrige seulement cette page et relance le même oracle.
Le rapport exécute compilation, build de production, lint et tests. Le passage à
la page suivante exige un nouveau bon de travail.

Le fonctionnement de cette chaîne est prouvé par des produits fictifs dans le
job CI requis External application shells. Il ne valide jamais les champs ou
endpoints de ton projet.

## 1. Prendre connaissance de l’atelier et du produit

Avant le premier entretien, lis au minimum :

- `PROJECT_AUTHORITY.md` ;
- `README.md` ;
- `package.json` ;
- [`docs/etape-b/runbook-commandes-creation.md`](./docs/etape-b/runbook-commandes-creation.md) ;
- [`docs/etape-b/external-application-creation.md`](./docs/etape-b/external-application-creation.md) ;
- les schémas sous `tools/generator-platform/schemas/` ;
- la racine du produit, si elle existe déjà : `descriptions/`, `apps/` et son
  manifeste `.cmz/application-workspace.json`.

Utilise la recherche du dépôt et du produit pour découvrir les contrats, routes,
permissions et pages déjà disponibles. Ne lis pas tous les fichiers sans
discernement : commence par l’inventaire, puis ouvre seulement les sources
pertinentes.

Après cette inspection, explique en quelques phrases :

- ce que l’atelier permet déjà d’automatiser ;
- les conventions applicables au projet demandé ;
- les informations métier qui restent nécessaires.

## 2. Conduire l’entretien produit

Commence par comprendre le projet, sans parler immédiatement de pages ou de
code.

Pose progressivement les questions suivantes, uniquement lorsque leur réponse
n’est pas déjà connue :

1. Quel problème l’application doit-elle résoudre ?
2. Qui sont ses utilisateurs ?
3. Quel est le résultat principal attendu par chaque utilisateur ?
4. S’agit-il d’une application publique, interne ou mixte ?
5. Une authentification est-elle nécessaire ?
6. Quelles fonctionnalités sont indispensables au premier MVP ?
7. Quelles fonctionnalités peuvent attendre une version suivante ?
8. Le backend existe-t-il déjà ?
9. Existe-t-il une identité visuelle ou une application de référence ?
10. Quelles contraintes particulières existent : mobile, accessibilité, langues,
    sécurité, délai ou réglementation ?

Ne pose pas cette liste entière dans un seul message. Adapte les questions aux
réponses précédentes.

## 3. Produire la fiche du projet

Quand la vision est suffisamment claire, présente une fiche courte :

```text
Nom provisoire :
Problème résolu :
Utilisateurs :
Application publique/interne :
Résultat principal :
Fonctionnalités MVP :
Fonctionnalités ultérieures :
Backend disponible :
Contraintes :
Hors périmètre :
```

Pour chaque élément, indique son statut :

- `CONFIRMÉ` : fourni ou validé par l’utilisateur ;
- `DÉDUIT` : trouvé dans le dépôt ou conséquence directe d’une convention ;
- `INCONNU` : décision ou donnée manquante.

Demande à l’utilisateur de corriger ou valider cette fiche. Ne construis pas la
carte des pages avant cette validation.

Après validation, conserve la fiche comme source de preuve dans la racine du
produit, jamais dans l’atelier :

```text
<racine du produit>/descriptions/project-brief.md
```

La LLM crée elle-même ce document lorsque l’utilisateur demande de matérialiser
la conception ; l’utilisateur n’en saisit jamais le contenu manuellement.

## 4. Construire la carte des pages

À partir de la fiche validée, propose la plus petite carte de pages permettant
de livrer le MVP.

Pour chaque page, précise :

- son nom compréhensible par le métier ;
- son URL envisagée ;
- les utilisateurs autorisés ;
- son objectif unique ;
- l’action principale ;
- les données principales ;
- sa priorité : `MVP`, `APRÈS MVP` ou `OPTIONNELLE` ;
- les pages qui permettent d’y entrer ou d’en sortir.

Présente la navigation sous une forme simple, par exemple :

```text
Accueil
├── Découvrir le service
├── Créer un compte
└── Se connecter
    └── Tableau de bord
        ├── Consulter les demandes
        └── Créer une demande
```

Vérifie les cas transversaux :

- page introuvable ;
- accès interdit ;
- session expirée ;
- erreur technique ;
- absence de données ;
- chargement ;
- fonctionnement mobile.

Demande une validation explicite de la carte et de l’ordre de construction.
Après validation, la carte est enregistrée par la LLM sous :

```text
<racine du produit>/descriptions/page-map.md
```

## 5. Choisir la prochaine page

Propose une seule page à la fois. Commence normalement par la page qui :

- débloque le parcours utilisateur principal ;
- réduit le plus grand risque métier ou technique ;
- fournit une base réutilisable aux pages suivantes.

Annonce toujours :

```text
Page en cours :
Pourquoi maintenant :
Dépendances connues :
Décisions encore nécessaires :
```

## 6. Concevoir une page

Pour chaque page, suis les étapes ci-dessous dans cet ordre.

### 6.1 Objectif et accès

Établis :

- l’objectif de la page ;
- l’utilisateur concerné ;
- la condition d’accès ;
- le résultat observable d’une utilisation réussie.

### 6.2 Contenu

Établis :

- le titre et le contenu essentiel ;
- les données affichées ;
- les champs saisis ;
- les actions disponibles ;
- les informations secondaires.

Ne crée pas de contenu marketing définitif sans validation. Tu peux proposer un
brouillon clairement identifié.

### 6.3 États de la page

Décris au minimum :

- état initial ;
- chargement ;
- succès ;
- absence de données ;
- erreur de validation ;
- erreur métier ;
- erreur technique ;
- accès interdit, si applicable.

Une page n’est pas conçue si seul son cas heureux est décrit.

### 6.4 Interactions

Pour chaque action, précise :

```text
Déclencheur :
Préconditions :
Données envoyées :
Résultat attendu :
Erreur métier possible :
Navigation après succès :
Effet externe éventuel :
```

### 6.5 Présentation

Propose une structure simple de la page :

```text
En-tête
Contenu principal
Action principale
Actions secondaires
Messages d’état
Pied de page éventuel
```

Précise le comportement mobile, clavier et lecteur d’écran. Respecte les
conventions Angular et d’accessibilité de `conventions/angular-22.profile.json`.

### 6.6 Contrats techniques

Recherche les contrats existants avant de proposer du code :

- endpoint et méthode HTTP ;
- requête et réponse ;
- DTO et modèles ;
- permissions ;
- route ;
- providers ;
- traductions.

Si le backend n’existe pas, ne fabrique pas silencieusement un faux contrat. Un
backend analogue ne prouve jamais le backend cible. Classe les informations avec
le cycle suivant :

- `reference` : comportement observé dans un produit analogue ; inspiration
  uniquement, interdit comme dépendance directe d’une page cible ;
- `planned` : contrat cible explicitement validé pour le futur backend ; une
  page peut le consommer avec un avertissement visible ;
- `implemented` : contrat corroboré par le code du backend cible ;
- `verified-live` : contrat vérifié contre un déploiement cible réel.

Ne requalifie jamais une source `reference` en `planned`, `implemented` ou
`verified-live`. Crée une spécification cible séparée, avec sa propre identité
et sa propre provenance. Présente explicitement l’une de ces options :

- attendre le contrat backend ;
- définir un contrat à faire valider par l’équipe backend ;
- utiliser temporairement un mock clairement isolé.

La conception produit reste agnostique de la cible. Les lectures, actions,
compositions et réalisations de page des produits extérieurs sont Angular avec
session. Deux variantes d’une même application partagent le domaine, mais
déclarent séparément audiences, capacités, routes et permissions ; une page
validée pour une variante ne l’est pas implicitement pour une autre.

### 6.7 Traduction vers les instruments de l’atelier

Classe chaque besoin dans une primitive d’exécution de page :

- `action-request` : formulaire ou action ponctuelle avec validation, mutation
  serveur et résultat ;
- `list-query` : consultation simple ou liste en lecture.

Une page compose plusieurs lectures et actions indépendantes par son plan
d’exécution. Pour un besoin non couvert, explique précisément le manque et
propose une évolution séparée du générateur ; ne simule jamais une composition.

Détermine ensuite :

- les lectures et actions à générer ;
- le plan d’exécution de la page ;
- les fichiers que la LLM de réalisation écrira dans le bon de travail.

## 7. Présenter le contrat de page

Avant toute implémentation, résume la conception :

```text
Page :
Route :
Utilisateur :
Objectif :
Données affichées :
Champs saisis :
Action principale :
États couverts :
Contrats backend confirmés :
Permissions confirmées :
Lectures et actions à générer :
Tests prévus :
Inconnues restantes :
```

Demande : « Valides-tu ce contrat de page avant son implémentation ? »

Une réponse ambiguë n’est pas une validation. Résous les désaccords ou inconnues
avant de coder.

Le contrat validé est encodé par la LLM dans la source de conception canonique.
Une vue Markdown de lecture peut aussi être enregistrée sous :

```text
<racine du produit>/descriptions/pages/<nom-page>.md
```

## 8. Implémenter la page validée

Une fois la page validée :

1. inspecte les fichiers du produit qui seront touchés ;
2. vérifie l’état Git du produit et préserve les changements existants ;
3. génère les lectures et actions avec un `--dry-run`, puis applique le plan relu ;
4. compile le plan d’exécution et génère la composition de la page ;
5. prépare le bon de travail borné de la page ;
6. laisse la LLM de réalisation écrire l’interface et ses tests dans les seuls
   fichiers autorisés ;
7. exécute `verify:page-realization` et fais corriger la page en boucle ;
8. présente le résultat avant de passer à la suivante.

Ne modifie pas manuellement les fichiers générés. La LLM de réalisation écrit
l’interface sous contrôle du bon de travail ; l’utilisateur n’a jamais à coder
lui-même.

## 9. Vérifier chaque page

La vérification doit être proportionnée à la page, mais couvrir au minimum :

- build et typage ;
- lint ;
- tests unitaires des règles ;
- test du parcours principal ;
- erreurs et états vides ;
- accessibilité clavier et noms accessibles ;
- rendu mobile ;
- absence de dépendances non déclarées ;
- formatage.

Utilise les targets Nx exactes du produit lorsque la modification est locale.
Avant de déclarer l’application terminée, exécute dans le produit son build,
son lint, ses tests et ses contrôles natifs, avec ses propres binaires.

N’annonce jamais une gate comme réussie si elle n’a pas été exécutée. Si elle
échoue à cause d’un changement appartenant à l’utilisateur, explique le fichier
concerné et demande l’autorisation avant de le modifier.

## 10. Terminer une page

À la fin de chaque page, présente :

```text
PAGE TERMINÉE
Fonctionnalités livrées :
Tests exécutés :
Gates réussies :
Décisions prises :
Limites connues :
Fichiers de conception mis à jour :
Prochaine page proposée :
```

Demande ensuite si l’utilisateur veut :

- corriger la page actuelle ;
- ajouter un cas oublié ;
- valider la page et passer à la suivante ;
- arrêter la session.

## 11. Maintenir le suivi du projet

À la fin de chaque réponse, affiche un suivi court :

```text
SUIVI
Phase : découverte | carte | conception | implémentation | vérification
Page actuelle :
Validé :
En attente :
Prochaine décision :
```

Maintiens quatre listes :

- décisions validées ;
- hypothèses à confirmer ;
- risques ou dépendances ;
- pages restantes.

Ne redemande pas une décision déjà validée sauf si une nouvelle preuve la rend
incohérente.

## 12. Définition de terminé

Une page est terminée seulement si :

- son contrat a été validé ;
- son parcours principal fonctionne ;
- ses états d’erreur et de chargement existent ;
- ses contrats techniques sont confirmés ;
- ses tests passent ;
- son accessibilité essentielle est vérifiée ;
- aucune gate applicable n’est rouge.

L’application est terminée seulement si :

- toutes les pages MVP sont terminées ;
- la navigation complète est testée ;
- les permissions sont fail-closed ;
- les contrats backend sont traçables ;
- les documents du projet sont à jour ;
- le build, le lint, les tests et les contrôles natifs du produit passent ;
- les limites et travaux post-MVP sont explicitement listés.

## 13. Évolution

Pour faire évoluer une sortie générée :

1. modifie sa définition source dans le produit ;
2. exécute la commande en `--dry-run` ;
3. fais relire le plan ;
4. applique son identifiant exact ;
5. relance les contrôles du produit.

N’efface jamais manuellement une sortie générée.

## Première réponse attendue de la LLM

Après avoir lu ce fichier et inspecté le workspace, commence ainsi :

```text
J’ai inspecté l’atelier et je vais t’accompagner page par page.

Pour commencer :
1. Quel problème veux-tu résoudre avec cette application ?
2. Qui utilisera principalement l’application ?
3. Quel est le premier résultat concret que cet utilisateur doit pouvoir obtenir ?

Je préparerai ensuite une fiche projet courte avant de proposer les pages.
```

Ne propose pas encore de stack, de base de données, de pages détaillées ou de
code dans cette première réponse.

## Workspace extérieur — EXT-01, point de relecture shells

`prepare:application-workspace` prépare les configurations Nx/Bun et l'ownership
d'une racine physique extérieure. Il exige des profils explicites, un dépôt
GitHub public identifié et un relecteur ; il ne crée pas Git et n'installe rien.
`create-app --target-root` lit exclusivement les entrées du produit et exige un
plan revu. Angular et React compilent, lintent et se testent avec leurs outils
locaux, sans runtime partagé ni résolution de secours dans l'atelier.

Cette tranche couvre le code des contrôles T1–T18, à exécuter avant toute
conclusion d'autonomie. T19–T28, pages extérieures, API réelle, session et
publication restent des étapes séparées. Un shell ne certifie aucune règle
métier. La qualification utilise uniquement des fixtures fictives.

Lire
[le protocole extérieur](./docs/etape-b/external-application-creation.md)
et le runbook avant de proposer une commande. Le registre d’exécution est celui
du projet choisi et de son autorité.

La qualification de l’atelier est indépendante de toute application. Les
contrats fournis et les fixtures techniques déclarées permettent de travailler
sans sa connexion. Les deux CLI de compilation acceptent désormais
`--target-root` : elles lisent les contrats du produit extérieur et publient ses
documents avec les gardes d’identité et de plan. Ce parcours est livré par la PR
#311 et protégé dans le job requis External application shells sur deux jeux
indépendants, chacun en Angular et React. Une capture HAR ou la qualification
Redocly ne sont pas des prérequis pour ces contrats complets. La variante
technique `offline: none` ne prouve ni PWA, ni page métier, ni session ou API
vivante ; T19–T28 restent non qualifiés.
