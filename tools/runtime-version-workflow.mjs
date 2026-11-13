// Contrat des étapes natives de runtime, partagé avec les gardes et leurs
// mutants. Node et Bun ne sont lus que depuis `.nvmrc` et `package.json`.
export const expr = (text) => '$' + '{{ ' + text + ' }}';
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function runtimeAssertion(
    runtime,
    prefix = '',
    condition,
    nodeSeen = false
) {
    const lines = ['set -euo pipefail'];
    if (runtime === 'node' || nodeSeen)
        lines.push('test "$(node --version)" = "v$(cat ' + prefix + '.nvmrc)"');
    if (runtime === 'bun')
        lines.push(
            'expected="$(node -p \'require("./' +
                prefix +
                'package.json").packageManager.slice(4)\')"',
            'test "$(bun --version)" = "$expected"'
        );
    return {
        name: 'Verify ' + runtime + ' runtime against source',
        ...(condition === undefined ? {} : { if: condition }),
        shell: 'bash',
        run: lines.join('\n') + '\n',
    };
}

export function runtimeWorkflowErrors(entries) {
    const errors = [];
    let ci;
    for (const { file, workflow: w } of entries) {
        if (file === 'ci.yml') ci = w;
        if (/\b(?:NODE_VERSION|BUN_VERSION)\b/.test(JSON.stringify(w)))
            errors.push(file + ': pin de runtime concurrent');
        if (/\bdocker\s+(?:image\s+)?(?:push|login)\b/.test(JSON.stringify(w)))
            errors.push(file + ': publication/login Docker interdit');
        for (const [jobId, job] of Object.entries(w?.jobs ?? {})) {
            let nodeSeen = false;
            for (const [index, step] of (job.steps ?? []).entries()) {
                const type = step.uses?.startsWith('actions/setup-node@')
                    ? 'node'
                    : step.uses?.startsWith('oven-sh/setup-bun@')
                      ? 'bun'
                      : null;
                if (!type) continue;
                const source = type === 'node' ? '.nvmrc' : 'package.json';
                const key =
                    type === 'node' ? 'node-version-file' : 'bun-version-file';
                const qualification =
                    file === 'nx-migrations.yml' && jobId === 'qualification';
                const candidateRuntime =
                    qualification &&
                    (type === 'bun' ||
                        (type === 'node' &&
                            index >
                                job.steps.findIndex(
                                    (s) => s.id === 'qualification-checkout'
                                )));
                const candidate =
                    expr('runner.temp') + '/nx-qualified-candidate';
                if (
                    !same(step.with, {
                        [key]: candidateRuntime
                            ? candidate + '/' + source
                            : source,
                    }) ||
                    step['continue-on-error'] !== undefined
                )
                    errors.push(
                        file +
                            ': sélection native unique manquante (' +
                            type +
                            ')'
                    );
                const expected = runtimeAssertion(type, '', step.if, nodeSeen);
                if (candidateRuntime) expected['working-directory'] = candidate;
                if (!same(job.steps[index + 1], expected))
                    errors.push(
                        file +
                            ': assertion immédiate manquante/neutralisée (' +
                            type +
                            ')'
                    );
                if (type === 'node') nodeSeen = true;
            }
        }
    }
    if (
        !same(ci?.on, {
            push: { branches: ['main'] },
            pull_request: { branches: ['main'] },
            workflow_dispatch: null,
        })
    )
        errors.push('CI: événements ou chemins filtrés');
    const oracle = ci?.jobs?.oracle;
    if (
        oracle?.if !== undefined ||
        oracle?.['continue-on-error'] !== undefined ||
        oracle?.['timeout-minutes'] !== 45 ||
        oracle.steps?.find((s) => s.uses?.startsWith('actions/checkout@'))
            ?.with?.['persist-credentials'] !== false
    )
        errors.push('Oracle: plafond ou checkout non conformes');
    return errors;
}
