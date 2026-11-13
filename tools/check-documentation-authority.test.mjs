import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import {
    CHARTER_REQUIREMENTS,
    collectAuthorityViolations,
    collectDeadLinks,
    readAuthorityDocuments,
    relativeLinkTargets,
    trackedMarkdown,
} from './check-documentation-authority.mjs';

function rejects(documents, diagnostic) {
    assert.ok(
        collectAuthorityViolations(documents).some((message) =>
            diagnostic.test(message)
        ),
        `diagnostic attendu : ${diagnostic}`
    );
}

function tree(t, files) {
    const root = mkdtempSync(join(tmpdir(), 'cmz-doc-links-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    for (const [path, content] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), content);
    }
    return root;
}

test('la charte réelle, ses routages et les liens du dépôt sont cohérents', () => {
    assert.deepEqual(collectAuthorityViolations(readAuthorityDocuments()), []);
    assert.deepEqual(
        collectDeadLinks(
            new URL('..', import.meta.url).pathname,
            trackedMarkdown()
        ),
        []
    );
});

test('chaque élément de la charte est exigé, même découpé par la mise en forme', () => {
    const documents = readAuthorityDocuments();
    for (const [text] of CHARTER_REQUIREMENTS) {
        const altered = {
            ...documents,
            authority: documents.authority
                .replace(/\*\*/g, '')
                .replace(/\s+/g, ' ')
                .split(text)
                .join('—'),
        };
        rejects(
            altered,
            new RegExp(
                `« ${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} » absent`
            )
        );
    }
});

test('README et AGENTS doivent router vers la charte', () => {
    const documents = readAuthorityDocuments();
    for (const key of ['readme', 'agents'])
        rejects(
            {
                ...documents,
                [key]: documents[key].replaceAll(
                    'PROJECT_AUTHORITY.md',
                    'x.md'
                ),
            },
            /doit router vers PROJECT_AUTHORITY\.md/
        );
});

test('le guide de construction garde le protocole extérieur de create-app', () => {
    const documents = readAuthorityDocuments();
    rejects(
        {
            ...documents,
            appBuilder: `${documents.appBuilder}\nbun run create-app --apply x\n`,
        },
        /--apply pour create-app/
    );
    rejects(
        {
            ...documents,
            appBuilder: documents.appBuilder.replaceAll('--target-root', ''),
        },
        /protocole extérieur de create-app/
    );
    rejects({ ...documents, docsIndex: '' }, /docs\/README\.md est absent/);
});

test('un lien relatif mort est signalé ; ancres, URL et code sont ignorés', (t) => {
    const root = tree(t, {
        'docs/a.md': [
            '[présent](./b.md#section)',
            '[absent](../missing.md)',
            '[externe](https://example.test/x)',
            '[ancre](#titre)',
            '`[code](./ignored.md)`',
            '```',
            '[bloc](./ignored-too.md)',
            '```',
            '![image](./img.png)',
        ].join('\n'),
        'docs/b.md': '# B\n',
    });
    assert.deepEqual(relativeLinkTargets('[x](./y.md "titre")'), ['./y.md']);
    assert.deepEqual(collectDeadLinks(root, ['docs/a.md', 'docs/b.md']), [
        'docs/a.md → ../missing.md',
        'docs/a.md → ./img.png',
    ]);
    writeFileSync(join(root, 'missing.md'), '# présent\n');
    writeFileSync(join(root, 'docs/img.png'), '');
    assert.deepEqual(collectDeadLinks(root, ['docs/a.md']), []);
});

test('un lien qui sort du dépôt est refusé', (t) => {
    const root = tree(t, { 'a.md': '[hors](../dehors.md)\n' });
    assert.deepEqual(collectDeadLinks(root, ['a.md']), ['a.md → ../dehors.md']);
});
