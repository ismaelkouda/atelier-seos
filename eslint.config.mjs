import nx from '@nx/eslint-plugin';

export default [
    ...nx.configs['flat/base'],
    ...nx.configs['flat/typescript'],
    ...nx.configs['flat/javascript'],
    {
        ignores: [
            '**/dist',
            '**/out-tsc',
            '**/build',
            '**/.react-router',
            '**/vite.config.*.timestamp*',
            '**/vitest.config.*.timestamp*',
        ],
    },
    // Fichiers d'outillage de test — exclus de enforce-module-boundaries.
    // Configs Vitest locales (s'il en reste) et tools/vitest-lib.config.ts :
    // hors code applicatif, frontières de couche non applicables.
    {
        ignores: [
            '**/vite.config.ts',
            '**/vite.config.js',
            '**/vitest.config.ts',
            '**/vitest.config.js',
        ],
    },
    {
        files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
        rules: {
            '@nx/enforce-module-boundaries': [
                'error',
                {
                    // false : les libs cmz-platform sont applicatives (non publiées npm).
                    // `enforceBuildableLibDependency: true` est réservé aux monorepos
                    // publicateurs (ng-packagr, changesets). Ici il produirait des
                    // faux-positifs dès qu'un target `build: tsc --noEmit` est déclaré
                    // pour le pipeline Oracle de vérification.
                    enforceBuildableLibDependency: false,
                    allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
                    depConstraints: [
                        // ---- Contraintes par COUCHE (type:*) ----
                        // `constants` = feuille : dépendable par toutes les couches.
                        {
                            sourceTag: 'type:constants',
                            onlyDependOnLibsWithTags: ['type:constants'],
                        },
                        {
                            sourceTag: 'type:domain',
                            onlyDependOnLibsWithTags: [
                                'type:domain',
                                'type:constants',
                            ],
                        },
                        // `core` = config runtime + interceptors (feuille kernel).
                        {
                            sourceTag: 'type:core',
                            onlyDependOnLibsWithTags: [
                                'type:core',
                                'type:domain',
                                'type:constants',
                            ],
                        },
                        {
                            sourceTag: 'type:browser',
                            onlyDependOnLibsWithTags: [
                                'type:domain',
                                'type:browser',
                                'type:constants',
                            ],
                        },
                        {
                            sourceTag: 'type:data',
                            onlyDependOnLibsWithTags: [
                                'type:domain',
                                'type:data',
                                'type:core',
                                'type:constants',
                            ],
                        },
                        {
                            sourceTag: 'type:application',
                            onlyDependOnLibsWithTags: [
                                'type:domain',
                                'type:application',
                                'type:constants',
                            ],
                        },
                        {
                            sourceTag: 'type:ui',
                            onlyDependOnLibsWithTags: [
                                'type:domain',
                                'type:application',
                                'type:ui',
                                'type:constants',
                            ],
                        },
                        // `app` = composition root — liste explicite (pas de joker `*`).
                        // `type:browser` (@cmz/shared-browser) n'est autorisé QUE depuis
                        // type:app : adaptateurs navigateur réservés au wiring root
                        // (audit D-5 / P2-18). Aucune couche lib (ui/application/data/…)
                        // ne liste type:browser → import interdit ailleurs.
                        {
                            sourceTag: 'type:app',
                            onlyDependOnLibsWithTags: [
                                'type:constants',
                                'type:domain',
                                'type:core',
                                'type:browser',
                                'type:data',
                                'type:application',
                                'type:ui',
                                'type:app',
                            ],
                        },
                        // ---- Contraintes par SCOPE (isolation des modules) ----
                        // Le kernel ne dépend que de lui-même.
                        {
                            sourceTag: 'scope:shared',
                            onlyDependOnLibsWithTags: ['scope:shared'],
                        },
                        {
                            sourceTag: 'scope:app',
                            onlyDependOnLibsWithTags: ['*'],
                        },
                    ],
                },
            ],
        },
    },
    {
        files: [
            '**/*.ts',
            '**/*.tsx',
            '**/*.cts',
            '**/*.mts',
            '**/*.js',
            '**/*.jsx',
            '**/*.cjs',
            '**/*.mjs',
        ],
        rules: {
            // Un paramètre préfixé `_` est délibérément non utilisé — cas
            // légitime quand la signature est imposée par un contrat de
            // type (ex. extension point humain AfterSuccessExtension,
            // callback avec position fixe) et que l'implémentation
            // n'exploite pas (encore) cet argument, sans que la règle par
            // défaut du preset Nx le reconnaisse — rendu explicite ici
            // plutôt que contourné au cas par cas.
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
        },
    },
    {
        files: ['tools/**/*.mjs'],
        rules: {
            'no-undef': ['error', { typeof: true }],
        },
    },
];
