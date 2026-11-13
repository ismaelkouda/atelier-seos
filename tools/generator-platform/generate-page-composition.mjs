import { pathToFileURL } from 'node:url';

import {
    parseClosedArguments,
    publicationResult,
    reportExternalFailure,
} from './core/external-cli.mjs';
import {
    planExternalPageComposition,
    publicExternalPageCompositionPlan,
    publishExternalPageComposition,
} from './core/external-page-composition.mjs';
import { repositoryRoot } from './validate-ir.mjs';

// X3 : mode extérieur, fermé. Plan relu obligatoire ; Angular avec session ; le
// plan, la sortie et les liaisons d'hôte sont fixés par l'application.
export function parseExternalArguments(arguments_) {
    return parseClosedArguments(
        arguments_,
        {
            '--target-root': 'targetRoot',
            '--app': 'appName',
            '--page': 'pageId',
        },
        'external page composition'
    );
}

function usage() {
    return `Usage (produit extérieur, Angular avec session seulement) :\n  bun run generate:page-composition --target-root <absolute> --app <app> --page <page_id> (--dry-run | --apply <plan_id>)\n`;
}

async function mainExternal(options) {
    const common = {
        workspaceRoot: repositoryRoot,
        targetRoot: options.targetRoot,
        appName: options.appName,
        pageId: options.pageId,
    };
    if (options.dryRun) {
        const plan = await planExternalPageComposition(common);
        process.stdout.write(
            `${JSON.stringify(publicExternalPageCompositionPlan(plan), null, 2)}\n`
        );
        return;
    }
    const result = await publishExternalPageComposition({
        ...common,
        expectedPlanId: options.expectedPlanId,
    });
    process.stdout.write(
        `${JSON.stringify(publicationResult(result, options.appName, { page_id: result.page_id }), null, 2)}\n`
    );
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
