# Archétypes de la cible Angular

> **Un jeu d'archétypes par stack — celui-ci décrit la sortie Angular.** Une
> cible React a son propre jeu sous `conventions/archetypes/reactjs/`,
> structurellement parallèle mais rédigé depuis la documentation officielle de
> sa plateforme.

## Rôle

`roles.json` associe chaque rôle produit par le moteur à un archétype. Le seul
rôle courant est `screen` : la page d'une application, réalisée par l'IA.

Un archétype machine est un fichier `<archetype>.contract.md` dont l'en-tête
YAML porte `archetype`, `role`, `shape` et `forbid`. Le moteur le valide contre
`tools/generator-platform/schemas/archetype-contract.schema.json`, le
sélectionne (`core/archetype-selection.mjs`) et l'inscrit, avec son chemin et
son empreinte SHA-256, dans le bon de travail de la page.

| Archétype   | Rôle     | Fichier                                            |
| ----------- | -------- | -------------------------------------------------- |
| `component` | `screen` | [`component.contract.md`](./component.contract.md) |

L'IA reste libre de l'interface à l'intérieur de ce cadre : elle ne choisit ni
ne réécrit l'archétype, et respecte ses interdits.
