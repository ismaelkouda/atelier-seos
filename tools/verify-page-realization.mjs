#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

import {
    parseClosedArguments,
    publicationResult,
    reportExternalFailure,
} from './generator-platform/core/external-cli.mjs';
import {
    planExternalPageRealization,
    publicExternalPageRealizationPlan,
    publishExternalPageRealization,
} from './generator-platform/core/external-page-realization.mjs';
import { repositoryRoot } from './generator-platform/validate-ir.mjs';

const EXTERNAL_USAGE =
    'Produit extérieur (X4) :\n  bun run verify:page-realization --target-root <absolu> --app <app> --page <page_id> (--dry-run | --apply <plan_id>)\n';

// X4 : brouillon vérifié contre le bon de travail publié, puis page publiée
// sous plan à la place de la page d'attente. Les violations sont listées.
async function mainExternal(argv) {
    try {
        const options = parseClosedArguments(
            argv,
            {
                '--target-root': 'targetRoot',
                '--app': 'appName',
                '--page': 'pageId',
            },
            'external page realization'
        );
        if (options.help) {
            process.stdout.write(EXTERNAL_USAGE);
            return;
        }
        const common = {
            workspaceRoot: repositoryRoot,
            targetRoot: options.targetRoot,
            appName: options.appName,
            pageId: options.pageId,
        };
        if (options.dryRun) {
            const plan = await planExternalPageRealization(common);
            process.stdout.write(
                `${JSON.stringify({ ok: true, ...publicExternalPageRealizationPlan(plan) }, null, 2)}\n`
            );
            return;
        }
        const result = await publishExternalPageRealization({
            ...common,
            expectedPlanId: options.expectedPlanId,
        });
        process.stdout.write(
            `${JSON.stringify(
                publicationResult(result, options.appName, {
                    page_id: options.pageId,
                    work_order_id: result.work_order_id,
                }),
                null,
                2
            )}\n`
        );
    } catch (error) {
        if (error.violations) {
            process.stdout.write(
                `${JSON.stringify({ ok: false, violations: error.violations }, null, 2)}\n`
            );
        }
        reportExternalFailure(error);
    }
}

export async function main(argv = process.argv.slice(2)) {
    if (argv.includes('--target-root')) return mainExternal(argv);
    if (argv.includes('--help')) {
        process.stdout.write(EXTERNAL_USAGE);
        return;
    }
    console.error(
        '❌ --target-root est requis : seul le mode produit extérieur existe.'
    );
    process.stderr.write(EXTERNAL_USAGE);
    process.exitCode = 1;
}

if (
    process.argv[1] &&
    pathToFileURL(process.argv[1]).href === import.meta.url
) {
    main().catch((error) => {
        console.error(`❌ ${error.message}`);
        process.exitCode = 1;
    });
}
