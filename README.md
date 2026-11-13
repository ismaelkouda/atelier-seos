# cmz-platform — atelier générique

Monorepo Nx d'un **atelier générique assisté par IA**. Il génère des
**produits Angular extérieurs** : chaque produit vit dans sa propre racine, hors
de l'atelier, avec ses propres outils. L'atelier sert à générer plusieurs
applications différentes ; il ne contient aucune donnée d'application.

> Commencer par [`PROJECT_AUTHORITY.md`](./PROJECT_AUTHORITY.md) : c'est la
> charte unique de l'atelier.

> 🤖 **Agents IA :** [`AGENTS.md`](./AGENTS.md) est chargé automatiquement et
> impose la lecture de [`PROJECT_AUTHORITY.md`](./PROJECT_AUTHORITY.md). Choisir
> ensuite un rôle dans le
> [modèle opératoire](./docs/agents/operating-model.md). Le propriétaire dispose
> d'un [guide simple d'orchestration](./docs/agents/guide-utilisateur.md).

---

## ⚡ Démarrage

```bash
nvm use                       # version Node de .nvmrc
bun install --frozen-lockfile # installe sans réécrire le lockfile
bunx nx show projects         # liste les projets du monorepo
bun run check:all             # contrôles locaux de l'atelier
```

## 🧭 Étape B — produire une application extérieure

```bash
bun run prepare:application-workspace --explain
bun run create-app --explain
```

La chaîne complète (préparation de la racine, contrats, coque, lectures,
actions, composition et réalisation de page) est décrite dans le
[runbook des commandes](./docs/etape-b/runbook-commandes-creation.md) et le
[protocole extérieur](./docs/etape-b/external-application-creation.md).

---

## 📁 Arborescence

```
tools/                      Outils de l'atelier (générateur, gardes, bibliothèques)
tools/generator-platform/   Moteur déterministe de l'étape B
conventions/                Contrats d'archétypes, recettes de bibliothèques, agents
designs/, examples/         Conceptions et exemples fictifs utilisés par les preuves
libs/core, libs/shared      Sources génériques recopiées dans chaque produit
apps/                       Bancs fictifs de qualification des bibliothèques
docs/                       Guides de l'étape B et modèle des agents
PROJECT_AUTHORITY.md        Charte de l'atelier
AGENTS.md                   Instructions automatiques et routage des rôles
.agents/skills/             Skills de rôle découvertes par l'agent
```

## 📚 Documentation

- [Charte de l'atelier](./PROJECT_AUTHORITY.md) — direction, étape B,
  protections minimales
- [Guide de construction](./LLM_APP_BUILDER.md) — entretien, contrats, pages et
  vérification
- [Documentation](./docs/README.md) — index des guides
- [Modèle opératoire des agents](./docs/agents/operating-model.md) — rôles,
  permissions, gates, preuves et handoffs
