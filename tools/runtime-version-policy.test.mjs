import assert from 'node:assert/strict';
import test from 'node:test';
import {
    readFileSync,
    writeFileSync,
    readdirSync,
    mkdtempSync,
    mkdirSync,
    rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';
import {
    versions,
    sourceErrors,
    nodeCompatible,
    repositoryRuntimeErrors,
    SOURCE_PATHS,
} from './runtime-version-policy.mjs';
import {
    runtimeWorkflowErrors,
    runtimeAssertion,
} from './runtime-version-workflow.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = () =>
    Object.fromEntries(
        SOURCE_PATHS.map((p) => [p, readFileSync(join(ROOT, p), 'utf8')])
    );
const workflows = () =>
    readdirSync(join(ROOT, '.github/workflows'))
        .filter((p) => /\.ya?ml$/.test(p))
        .map((file) => ({
            file,
            workflow: parse(
                readFileSync(join(ROOT, '.github/workflows', file), 'utf8')
            ),
        }));

test('runtime: sources, toutes les assertions, Oracle et workflow réels conformes', () => {
    assert.deepEqual(repositoryRuntimeErrors(ROOT), []);
    assert.deepEqual(sourceErrors(files()), []);
    for (const path of [
        'tools/check-ci-wiring.mjs',
        'tools/check-workflow-privileges.mjs',
    ]) {
        const source = readFileSync(join(ROOT, path), 'utf8');
        assert.match(source, /repositoryRuntimeErrors\(ROOT\)/);
        assert.match(source, /import\('\.\/runtime-version-policy\.mjs'\)/);
    }
    for (const path of [
        'tools/check-ci-wiring.test.mjs',
        'tools/check-workflow-privileges.test.mjs',
    ])
        assert.match(
            readFileSync(join(ROOT, path), 'utf8'),
            /import '\.\/runtime-version-policy\.test\.mjs'/
        );
});

test('runtime: une source non exacte est rouge, restauration verte', () => {
    const original = files();
    assert.deepEqual(Object.keys(original).sort(), ['.nvmrc', 'package.json']);
    for (const invalid of [
        'latest',
        'lts',
        'v22.22.3',
        '22.x',
        '22.22.3+sha.abc',
        '22.22.3-alpha',
        '022.22.3',
        '',
        '22.22.3\n\n',
    ]) {
        assert.ok(
            sourceErrors({ ...original, '.nvmrc': invalid }).length,
            invalid
        );
    }
    for (const invalid of [
        'bun@latest',
        'bun@1.3',
        'bun@1.3.14+sha.abc',
        'bun@v1.3.14',
        'bun@1.3.14-alpha',
        'npm@1.3.14',
        '',
    ]) {
        const bad = {
            ...original,
            'package.json': original['package.json'].replace(
                '"packageManager": "bun@' + versions(original).bunSource + '"',
                '"packageManager": "' + invalid + '"'
            ),
        };
        assert.notEqual(bad['package.json'], original['package.json']);
        assert.ok(sourceErrors(bad).length, invalid);
    }
    assert.deepEqual(sourceErrors(original), []);
});

test('runtime: engines.node exacts de main, y compris limites et données invalides', () => {
    const range = versions(files()).nodeRange;
    for (const v of ['22.22.2', '23.0.0', '24.14.99', '25.0.0'])
        assert.equal(nodeCompatible(v, range), false, v);
    for (const v of ['22.22.3', '24.15.0', '26.0.0'])
        assert.equal(nodeCompatible(v, range), true, v);
    for (const range of [undefined, null, '', 'not-a-range'])
        assert.equal(nodeCompatible('26.0.0', range), false);
});

test('runtime: chaque paire source/CI refuse un pin et une assertion neutralisée', () => {
    const good = workflows();
    const mutations = [
        (w, s) => {
            s.with['node-version'] = '26.0.0';
        },
        (w, s) => {
            s.with['node-version-file'] = 'other';
        },
        (w, s) => {
            s['continue-on-error'] = true;
        },
        (w, s, job, i) => {
            job.steps.splice(i + 1, 1);
        },
        (w, s, job, i) => {
            job.steps[i + 1].run = 'echo accepted';
        },
        (w, s, job, i) => {
            job.steps[i + 1].if = 'false';
        },
        (w, s, job, i) => {
            job.steps[i + 1]['continue-on-error'] = true;
        },
        (w) => {
            w.env = { NODE_VERSION: '24.15.0' };
        },
    ];
    for (const runtime of ['node', 'bun'])
        for (const mutate of mutations) {
            const bad = structuredClone(good);
            const w = bad.find((e) => e.file === 'ci.yml').workflow;
            const job = w.jobs.guardrails;
            const index = job.steps.findIndex((s) =>
                s.uses?.startsWith(
                    runtime === 'node'
                        ? 'actions/setup-node@'
                        : 'oven-sh/setup-bun@'
                )
            );
            mutate(w, job.steps[index], job, index);
            assert.ok(
                runtimeWorkflowErrors(bad).length,
                runtime + ': mutant accepté'
            );
        }
    for (const change of [
        (w) => {
            w.on.pull_request.paths = ['package.json'];
        },
        (w) => {
            w.jobs.oracle.if = false;
        },
        (w) => {
            w.jobs.oracle['continue-on-error'] = true;
        },
        (w) => {
            w.jobs.oracle['timeout-minutes'] = 46;
        },
        (w) => {
            w.jobs.oracle.steps.push({ run: 'docker image push arbitrary' });
        },
        (w) => {
            w.jobs.oracle.steps.find((s) =>
                s.uses?.startsWith('actions/checkout@')
            ).with['persist-credentials'] = true;
        },
    ]) {
        const bad = structuredClone(good);
        change(bad.find((e) => e.file === 'ci.yml').workflow);
        assert.ok(runtimeWorkflowErrors(bad).length);
    }
    assert.deepEqual(runtimeWorkflowErrors(good), []);
});

const shellEnv = (input = process.env) => {
    const env = Object.fromEntries(
        Object.entries(input).filter(([key]) => !key.startsWith('GIT_'))
    );
    return {
        ...env,
        PATH: dirname(process.execPath) + ':/usr/bin:/bin:/usr/sbin:/sbin',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_TERMINAL_PROMPT: '0',
        GIT_ALLOW_PROTOCOL: 'file',
    };
};
function temporary(t) {
    const root = mkdtempSync(join(tmpdir(), 'runtime-policy-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    return root;
}
function executable(path, source) {
    writeFileSync(path, '#!' + process.execPath + '\n' + source, {
        mode: 0o755,
    });
}

test('runtime: assertions exécutées, binaire incorrect rouge puis version correcte verte', (t) => {
    const root = temporary(t),
        bin = join(root, 'bin');
    mkdirSync(bin);
    writeFileSync(join(root, '.nvmrc'), '22.22.3\n');
    writeFileSync(
        join(root, 'package.json'),
        '{"packageManager":"bun@1.3.14"}\n'
    );
    for (const runtime of ['node', 'bun']) {
        const binary = join(bin, runtime);
        const expected = runtime === 'node' ? 'v22.22.3' : '1.3.14';
        const run = () =>
            spawnSync(
                '/bin/bash',
                ['-e', '-o', 'pipefail', '-c', runtimeAssertion(runtime).run],
                {
                    cwd: root,
                    env: { ...shellEnv(), PATH: bin + ':' + shellEnv().PATH },
                    encoding: 'utf8',
                }
            );
        // Le faux node ne remplace que --version ; la lecture JSON reste native.
        const script = (v) =>
            'const {execFileSync}=require("node:child_process");\n' +
            'if(process.argv[2]==="--version")console.log(' +
            JSON.stringify(v) +
            ');else process.stdout.write(execFileSync(' +
            JSON.stringify(process.execPath) +
            ',process.argv.slice(2)));';
        executable(binary, script('0.0.0'));
        assert.notEqual(
            run().status,
            0,
            runtime + ' incorrect doit être refusé'
        );
        executable(binary, script(expected));
        assert.equal(run().status, 0, runtime + ' exact doit être accepté');
    }
});
