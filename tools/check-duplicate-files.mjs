#!/usr/bin/env node
/**
 * check-duplicate-files.mjs
 *
 * Détecte les fichiers source byte-identiques (MD5) partagés entre modules
 * sous `libs/` : un helper recopié au lieu d'être partagé.
 *
 * Usage :
 *   bun run check:duplicates
 *   node tools/check-duplicate-files.mjs [--all-modules] [--module=<name>]
 *
 * Par défaut : uniquement les groupes **cross-module** (modules distincts
 * sous libs/<module>/…). `--all-modules` signale aussi les doublons internes
 * à un même module. `--module=<name>` : ne signale que les groupes où ce
 * module participe.
 *
 * Exit 1 si au moins un groupe est trouvé.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LIBS = join(ROOT, 'libs');
const SOURCE_EXTS = new Set(['.ts', '.html', '.scss', '.css']);
const SKIP_DIRS = new Set([
    'node_modules',
    'dist',
    'out-tsc',
    '.git',
    '.angular',
]);
/** Ignore les stubs triviaux (barrels vides, re-exports d'une ligne). */
const MIN_BYTES = 40;

/**
 * Exceptions cross-module explicites et motivées, au cas par cas.
 * Périmètre strictement borné aux chemins listés ; toute autre
 * duplication cross-module reste bloquante.
 */
const CROSS_MODULE_ALLOWLIST = new Set([]);

const reportIntraModule = process.argv.includes('--all-modules');
const moduleArg = process.argv.find((a) => a.startsWith('--module='));
const moduleIdx = process.argv.indexOf('--module');
const moduleFilter =
    moduleArg?.slice('--module='.length) ||
    (moduleIdx !== -1 ? process.argv[moduleIdx + 1] : undefined);

function walkSources(dir, out = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const abs = join(dir, entry.name);
        if (entry.isDirectory()) {
            walkSources(abs, out);
            continue;
        }
        if (!SOURCE_EXTS.has(extname(entry.name))) continue;
        out.push(abs);
    }
    return out;
}

/** `libs/<module>/…` → `<module>` (shared, core, …). */
function moduleOf(absPath) {
    const rel = relative(LIBS, absPath).split(/[/\\]/);
    return rel[0] || '';
}

function runByteIdenticalCheck() {
    const byHash = new Map();

    for (const abs of walkSources(LIBS)) {
        const size = statSync(abs).size;
        if (size < MIN_BYTES) continue;
        const digest = createHash('md5')
            .update(readFileSync(abs))
            .digest('hex');
        let group = byHash.get(digest);
        if (!group) {
            group = [];
            byHash.set(digest, group);
        }
        group.push(abs);
    }

    const groups = [];

    for (const [digest, paths] of byHash) {
        if (paths.length < 2) continue;
        const modules = [...new Set(paths.map(moduleOf))].sort();
        const crossModule = modules.length > 1;
        if (!crossModule && !reportIntraModule) continue;
        if (moduleFilter && !modules.includes(moduleFilter)) continue;
        const relPaths = paths.map((p) => relative(ROOT, p)).sort();
        if (relPaths.every((p) => CROSS_MODULE_ALLOWLIST.has(p))) continue;
        groups.push({
            digest,
            crossModule,
            modules,
            paths: relPaths,
        });
    }

    groups.sort(
        (a, b) =>
            b.paths.length - a.paths.length ||
            a.paths[0].localeCompare(b.paths[0])
    );

    if (groups.length === 0) {
        const scope = moduleFilter
            ? `module « ${moduleFilter} »`
            : reportIntraModule
              ? 'libs/ (intra + cross)'
              : 'cross-module sous libs/';
        console.log(
            `OK  check:duplicates — aucun doublon byte-identique (${scope})`
        );
        process.exit(0);
    }

    console.error(
        `FAIL check:duplicates — ${groups.length} groupe(s) byte-identique(s) (MD5)` +
            (moduleFilter ? ` · module=${moduleFilter}` : '') +
            `\n`
    );

    for (const group of groups) {
        const kind = group.crossModule ? 'cross-module' : 'intra-module';
        console.error(
            `── ${kind} · md5=${group.digest} · modules=${group.modules.join(', ')}`
        );
        for (const p of group.paths) {
            console.error(`   ${p}`);
        }
        console.error('');
    }

    console.error(
        'Remonter le code commun dans une lib partagée (ou tools/) et supprimer' +
            ' les copies.'
    );
    process.exit(1);
}

runByteIdenticalCheck();
