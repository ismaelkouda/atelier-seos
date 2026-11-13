#!/usr/bin/env node
// Garde de la charte et des liens documentaires.
//
// 1. PROJECT_AUTHORITY.md est la charte unique de l'atelier : elle doit
//    déclarer un atelier générique, l'étape B, l'interface libre dans un cadre
//    fourni et les protections minimales. README.md et AGENTS.md y renvoient.
// 2. Aucun lien Markdown relatif d'un document suivi ne pointe vers un fichier
//    absent : un lien mort trompe les agents.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const AUTHORITY_FILES = Object.freeze({
    authority: 'PROJECT_AUTHORITY.md',
    readme: 'README.md',
    agents: 'AGENTS.md',
    appBuilder: 'LLM_APP_BUILDER.md',
    docsIndex: 'docs/README.md',
});

// Éléments que la charte doit porter, avec leur raison.
export const CHARTER_REQUIREMENTS = Object.freeze([
    ['atelier générique', 'la charte doit déclarer un atelier générique'],
    [
        'plusieurs applications différentes',
        'la charte doit viser plusieurs applications',
    ],
    ['Étape B', "la charte doit décrire l'étape B"],
    [
        'produits Angular extérieurs',
        'la charte doit viser des produits extérieurs',
    ],
    [
        "cadre d'éléments fourni",
        "la charte doit borner l'interface libre de l'IA",
    ],
    [
        "aucune donnée d'application",
        "la charte doit interdire les données d'application",
    ],
    ['build', 'la charte doit exiger le build'],
    ['lint', 'la charte doit exiger le lint'],
    ['tests', 'la charte doit exiger les tests'],
    ['licences', 'la charte doit exiger le contrôle des licences'],
    ['smoke navigateur', 'la charte doit exiger un smoke navigateur'],
    ['aucun secret', 'la charte doit interdire les secrets'],
]);

/**
 * @param {Record<string, string>} documents
 * @returns {string[]}
 */
// Le texte est comparé sans mise en forme : gras et retours à la ligne.
const plain = (text = '') => text.replace(/\*\*/g, '').replace(/\s+/g, ' ');

export function collectAuthorityViolations(documents) {
    const violations = [];
    const charter = plain(documents.authority);
    for (const [key, path] of Object.entries(AUTHORITY_FILES)) {
        if (!documents[key]?.trim())
            violations.push(`${path} est absent ou vide`);
    }
    for (const [text, reason] of CHARTER_REQUIREMENTS) {
        if (!charter.includes(text))
            violations.push(`${reason} (« ${text} » absent)`);
    }
    for (const key of ['readme', 'agents']) {
        if (!documents[key]?.includes('PROJECT_AUTHORITY.md'))
            violations.push(
                `${AUTHORITY_FILES[key]} doit router vers PROJECT_AUTHORITY.md`
            );
    }
    if (/create-app[^\n]*--apply\b/.test(documents.appBuilder ?? '')) {
        violations.push(
            'LLM_APP_BUILDER.md ne doit pas réintroduire --apply pour create-app'
        );
    }
    if (
        !documents.appBuilder?.includes('--target-root') ||
        !documents.appBuilder?.includes('--expect-plan <plan_id>')
    ) {
        violations.push(
            'LLM_APP_BUILDER.md doit documenter le protocole extérieur de create-app'
        );
    }
    return violations;
}

const LINK = /!?\[[^\]\n]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

/** Cibles relatives des liens Markdown d'un document, hors blocs de code. */
export function relativeLinkTargets(markdown) {
    const targets = [];
    let fenced = false;
    for (const line of markdown.split(/\r?\n/)) {
        if (/^\s*(?:```|~~~)/.test(line)) {
            fenced = !fenced;
            continue;
        }
        if (fenced) continue;
        const prose = line.replace(/`[^`]*`/g, '');
        for (const match of prose.matchAll(LINK)) {
            const target = match[1].replace(/^<|>$/g, '');
            if (/^(?:[a-z][a-z0-9+.-]*:|#|\/)/i.test(target)) continue;
            const path = decodeURIComponent(target.split(/[?#]/)[0]);
            if (path) targets.push(path);
        }
    }
    return targets;
}

/**
 * @param {string} root
 * @param {string[]} files chemins POSIX relatifs des documents Markdown suivis
 * @param {(path: string) => string} [read]
 * @returns {string[]}
 */
export function collectDeadLinks(
    root,
    files,
    read = (path) => readFileSync(join(root, path), 'utf8')
) {
    const dead = [];
    for (const file of files) {
        for (const target of relativeLinkTargets(read(file))) {
            const resolved = posix.normalize(
                posix.join(posix.dirname(file), target)
            );
            if (resolved.startsWith('../') || !existsSync(join(root, resolved)))
                dead.push(`${file} → ${target}`);
        }
    }
    return dead;
}

export function trackedMarkdown(root = ROOT) {
    return execFileSync('git', ['-C', root, 'ls-files', '-z', '--', '*.md'], {
        encoding: 'utf8',
    })
        .split('\0')
        .filter(Boolean)
        .sort();
}

export function readAuthorityDocuments(root = ROOT) {
    return Object.fromEntries(
        Object.entries(AUTHORITY_FILES).map(([key, path]) => {
            try {
                return [key, readFileSync(join(root, path), 'utf8')];
            } catch (error) {
                if (error.code === 'ENOENT') return [key, ''];
                throw error;
            }
        })
    );
}

function main() {
    const violations = [
        ...collectAuthorityViolations(readAuthorityDocuments()),
        ...collectDeadLinks(ROOT, trackedMarkdown()).map(
            (link) => `lien mort : ${link}`
        ),
    ];
    if (violations.length > 0) {
        console.error('FAIL  charte ou liens documentaires incohérents');
        for (const violation of violations) console.error(`  - ${violation}`);
        process.exitCode = 1;
        return;
    }
    console.log('OK  charte de l’atelier et liens documentaires cohérents');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
