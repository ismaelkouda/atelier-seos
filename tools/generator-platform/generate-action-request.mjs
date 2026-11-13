import { pathToFileURL } from 'node:url';

import {
    planExternalActionRequest,
    publicExternalActionRequestPlan,
    publishExternalActionRequest,
} from './core/external-action-request.mjs';
import { dependentPagesNotice } from './core/external-cli.mjs';
import { repositoryRoot } from './validate-ir.mjs';

// X2 : mode extérieur, fermé. Plan relu obligatoire ; Angular seulement ; la
// sortie et les liaisons d'hôte sont fixées par l'application du produit.
export function parseExternalArguments(arguments_) {
    const options = {};
    const keys = {
        '--target-root': 'targetRoot',
        '--app': 'appName',
        '--definition': 'definitionPath',
        '--target': 'target',
        '--apply': 'expectedPlanId',
    };
    for (let index = 0; index < arguments_.length; index += 1) {
        const argument = arguments_[index];
        // M-8 : l'aide reste accessible en mode extérieur.
        if (argument === '--help') return { help: true };
        if (argument === '--dry-run') {
            if (options.dryRun) throw new Error('--dry-run is repeated');
            options.dryRun = true;
            continue;
        }
        if (!Object.hasOwn(keys, argument))
            throw new Error(
                `argument not allowed with --target-root: ${argument}`
            );
        const value = arguments_[index + 1];
        if (!value || value.startsWith('--'))
            throw new Error(`${argument} requires a value`);
        if (Object.hasOwn(options, keys[argument]))
            throw new Error(`${argument} is repeated`);
        options[keys[argument]] = value;
        index += 1;
    }
    if (!options.targetRoot || !options.appName || !options.definitionPath)
        throw new Error('--target-root, --app and --definition are required');
    if ((options.target ?? 'angular') !== 'angular')
        throw new Error(
            'external action-request supports --target angular only'
        );
    if (Boolean(options.dryRun) === Boolean(options.expectedPlanId))
        throw new Error(
            'external action-request requires --dry-run or --apply <plan_id>'
        );
    return { external: true, ...options };
}

function usage() {
    return `Usage (produit extérieur, version 2.1, Angular seulement) :\n  bun run generate:action-request --target-root <absolute> --app <app> --definition <product-relative.json> (--dry-run | --apply <plan_id>)\n`;
}

async function mainExternal(options) {
    const common = {
        workspaceRoot: repositoryRoot,
        targetRoot: options.targetRoot,
        appName: options.appName,
        definitionPath: options.definitionPath,
    };
    if (options.dryRun) {
        const plan = await planExternalActionRequest(common);
        process.stdout.write(
            `${JSON.stringify(publicExternalActionRequestPlan(plan), null, 2)}\n`
        );
        dependentPagesNotice(plan.dependent_pages);
        return;
    }
    const result = await publishExternalActionRequest({
        ...common,
        expectedPlanId: options.expectedPlanId,
    });
    process.stdout.write(
        `${JSON.stringify(
            {
                schema_version: '1.0.0',
                plan_id: result.plan_id,
                app_name: options.appName,
                action_id: result.action_id,
                dependent_pages: result.dependent_pages,
                status: result.replayed ? 'already-published' : 'published',
                recovered: result.recovered,
            },
            null,
            2
        )}\n`
    );
    dependentPagesNotice(result.dependent_pages);
}

async function main() {
    const arguments_ = process.argv.slice(2);
    if (
        arguments_.includes('--help') &&
        !arguments_.includes('--target-root')
    ) {
        process.stdout.write(usage());
        return;
    }
    if (!arguments_.includes('--target-root')) {
        console.error(
            '❌ --target-root est requis : seul le mode produit extérieur existe.'
        );
        process.stderr.write(usage());
        process.exitCode = 1;
        return;
    }
    const options = parseExternalArguments(arguments_);
    if (options.help) {
        process.stdout.write(usage());
        return;
    }
    return mainExternal(options);
}

if (
    process.argv[1] &&
    import.meta.url === pathToFileURL(process.argv[1]).href
) {
    try {
        await main();
    } catch (error) {
        if (!process.argv.includes('--target-root')) throw error;
        // Mode extérieur : message fermé, sans pile ni chemin de l'atelier.
        const known =
            error.message.startsWith('external application:') ||
            error.message.startsWith('external action-request') ||
            error.message.startsWith('argument not allowed') ||
            error.message.startsWith('--') ||
            /^AR_GRAPH_[A-Z_]+$/.test(error.message);
        const locked = error.message.startsWith('another generation owns');
        console.error(
            `❌ ${known ? error.message : locked ? 'Une autre commande tient le verrou de cette application ; relancer quand elle est terminée.' : 'Génération extérieure refusée ; inspecter les entrées localement.'}`
        );
        process.exitCode = 1;
    }
}
