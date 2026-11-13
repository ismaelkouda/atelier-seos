import { pathToFileURL } from 'node:url';

import {
    dependentPagesNotice,
    parseClosedArguments,
    publicationResult,
    reportExternalFailure,
} from './core/external-cli.mjs';
import {
    planExternalListQuery,
    publicExternalListQueryPlan,
    publishExternalListQuery,
} from './core/external-list-query.mjs';
import { repositoryRoot } from './validate-ir.mjs';

// X5 C3a : mode extérieur, fermé, sur le modèle de l'action-request (X2).
// Plan relu obligatoire ; Angular avec session ; la sortie, le profil et les
// liaisons d'hôte sont fixés par l'application du produit.
export function parseExternalArguments(arguments_) {
    return parseClosedArguments(
        arguments_,
        {
            '--target-root': 'targetRoot',
            '--app': 'appName',
            '--definition': 'definitionPath',
        },
        'external list-query'
    );
}

function usage() {
    return `Usage (produit extérieur, Angular avec session seulement) :\n  bun run generate:list-query --target-root <absolute> --app <app> --definition <product-relative.json> (--dry-run | --apply <plan_id>)\n`;
}

async function mainExternal(options) {
    const common = {
        workspaceRoot: repositoryRoot,
        targetRoot: options.targetRoot,
        appName: options.appName,
        definitionPath: options.definitionPath,
    };
    if (options.dryRun) {
        const plan = await planExternalListQuery(common);
        process.stdout.write(
            `${JSON.stringify(publicExternalListQueryPlan(plan), null, 2)}\n`
        );
        dependentPagesNotice(plan.dependent_pages, 'cette lecture');
        return;
    }
    const result = await publishExternalListQuery({
        ...common,
        expectedPlanId: options.expectedPlanId,
    });
    process.stdout.write(
        `${JSON.stringify(publicationResult(result, options.appName, { query_id: result.query_id, dependent_pages: result.dependent_pages }), null, 2)}\n`
    );
    dependentPagesNotice(result.dependent_pages, 'cette lecture');
}

async function main() {
    const arguments_ = process.argv.slice(2);
    if (!arguments_.includes('--target-root')) {
        if (arguments_.includes('--help')) {
            process.stdout.write(usage());
            return;
        }
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
        reportExternalFailure(error);
    }
}
