/**
 * Configuration Vitest partagée pour les libs pures (domain, data, application).
 *
 * Usage Nx (`project.json`) :
 * ```
 * bunx vitest run --config tools/vitest-lib.config.ts
 * env: { CMZ_VITEST_LIB_ROOT: "libs/<module>/<layer>" }
 * ```
 *
 * Le builder `@angular/build:unit-test` cible les apps Angular complètes
 * (avec angular.json). Pour les libs isolées en mode package-based, on utilise
 * Vitest directement via `nx:run-commands`.
 *
 * ADR-0008 : Vitest — même moteur esbuild que le build applicatif.
 */
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..');

export function defineLibTestConfig(libRoot: string) {
    return defineConfig({
        test: {
            globals: true,
            environment: 'node',
            setupFiles: [resolve(workspaceRoot, 'tools/vitest-setup.ts')],
            // Ne pas dépendre du flag CLI `nx … --passWithNoTests` : Nx le
            // propage à tous les targets test ; le builder app
            // `@angular/build:unit-test` le rejette (schéma strict). SSoT
            // côté libs : exit 0 si aucun fichier de test (CI H-2 / affected).
            passWithNoTests: true,
            // Chemins absolus — Vitest est lancé depuis la racine du monorepo
            include: [
                resolve(libRoot, 'src/**/*.spec.ts'),
                resolve(libRoot, 'src/**/*.test.ts'),
            ],
            reporters: ['verbose'],
            coverage: {
                provider: 'v8',
                reporter: ['text', 'lcov'],
                include: [resolve(libRoot, 'src/**/*.ts')],
                exclude: [
                    resolve(libRoot, 'src/**/*.spec.ts'),
                    resolve(libRoot, 'src/**/*.test.ts'),
                    resolve(libRoot, 'src/index.ts'),
                ],
            },
        },
        resolve: {
            alias: buildAliases(),
        },
    });
}

/**
 * Alias `@cmz/*` → sources TypeScript, pour que les tests résolvent sans
 * build préalable des libs dépendantes.
 */
function buildAliases(): Record<string, string> {
    const root = workspaceRoot;
    return {
        '@cmz/shared-domain': resolve(root, 'libs/shared/domain/src/index.ts'),
        '@cmz/core': resolve(root, 'libs/core/src/index.ts'),
    };
}

/** Config Vitest — exige `CMZ_VITEST_LIB_ROOT` quand lancé par Vitest/Nx. */
export default () => {
    const libRootEnv = process.env.CMZ_VITEST_LIB_ROOT;
    if (!libRootEnv) {
        // Hors cible Nx (knip, analyse IDE) le fichier de config partagé est
        // chargé sans env. Ne pas throw : ce n'est pas une exécution de tests.
        // Vitest via project.json injecte toujours CMZ_VITEST_LIB_ROOT.
        const underVitest =
            process.env.VITEST === 'true' ||
            process.argv.some((a) => /(^|[\\/])vitest(\.m?js)?$/.test(a));
        if (underVitest) {
            throw new Error(
                'CMZ_VITEST_LIB_ROOT manquant — définir le chemin de la lib ' +
                    '(ex. libs/shared/domain) via project.json options.env.'
            );
        }
        return defineConfig({ test: { include: [] } });
    }
    return defineLibTestConfig(resolve(workspaceRoot, libRootEnv));
};
