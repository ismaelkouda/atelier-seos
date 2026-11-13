#!/usr/bin/env node
// Politique des runtimes : Node et Bun sont lus seulement depuis `.nvmrc` et
// `package.json` (`packageManager`, `engines.node`). Aucune autre source.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import semver from 'semver';
import { parse } from 'yaml';
import { runtimeWorkflowErrors } from './runtime-version-workflow.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SOURCE_PATHS = ['package.json', '.nvmrc'];
export const stable = (v) =>
    typeof v === 'string' &&
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(v) &&
    semver.valid(v) === v;
const fail = (message) => {
    throw new Error('runtime-policy: ' + message);
};

function one(text, regex, label) {
    const matches = [...text.matchAll(regex)];
    if (matches.length !== 1)
        fail(label + ': une seule déclaration exacte attendue');
    return matches[0];
}

export function versions(files) {
    const pkg = JSON.parse(files['package.json']);
    const pm = one(
        files['package.json'],
        /"packageManager"\s*:\s*"([^"]*)"/g,
        'packageManager'
    )[1];
    if (
        typeof pm !== 'string' ||
        !pm.startsWith('bun@') ||
        !stable(pm.slice(4)) ||
        pkg.packageManager !== pm
    )
        fail('packageManager non exact');
    const nvm = files['.nvmrc'];
    if (
        typeof nvm !== 'string' ||
        !/^[^\r\n]+\n?$/.test(nvm) ||
        !stable(nvm.replace(/\n$/, ''))
    )
        fail('.nvmrc non exact');
    return {
        bunSource: pm.slice(4),
        nodeSource: nvm.replace(/\n$/, ''),
        nodeRange: pkg.engines?.node,
    };
}

export function nodeCompatible(version, range) {
    return (
        stable(version) &&
        typeof range === 'string' &&
        range.trim() !== '' &&
        semver.validRange(range) !== null &&
        semver.satisfies(version, range)
    );
}

export function sourceErrors(files) {
    try {
        const v = versions(files);
        return nodeCompatible(v.nodeSource, v.nodeRange)
            ? []
            : ['Node: cible hors engines.node ou plage invalide'];
    } catch (error) {
        return [error.message];
    }
}

function readFiles(directory) {
    return Object.fromEntries(
        SOURCE_PATHS.map((path) => [
            path,
            readFileSync(join(directory, path), 'utf8'),
        ])
    );
}

export function repositoryRuntimeErrors(root) {
    const files = readFiles(root);
    const workflows = readdirSync(join(root, '.github/workflows'))
        .filter((name) => /\.ya?ml$/.test(name))
        .map((file) => ({
            file,
            workflow: parse(
                readFileSync(join(root, '.github/workflows', file), 'utf8')
            ),
        }));
    return [...sourceErrors(files), ...runtimeWorkflowErrors(workflows)];
}

function main() {
    const [command] = process.argv.slice(2);
    if (command === 'check') {
        const errors = repositoryRuntimeErrors(ROOT);
        if (errors.length) fail(errors.join('\n'));
        console.log('runtime-policy: sources et assertions natives conformes');
        return;
    }
    fail('commande inconnue');
}

if (
    process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
    try {
        main();
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
