import assert from 'node:assert/strict';
import test from 'node:test';

import { validateJsonSchema } from './validate-ir.mjs';

test('applique chaque mot-clé JSON Schema utilisé par les schémas du moteur', () => {
    assert.deepEqual(
        validateJsonSchema('abc', { type: 'string', maxLength: 2 }),
        ['$: must contain at most 2 chars']
    );
    assert.deepEqual(
        validateJsonSchema(['same', 'same'], {
            type: 'array',
            uniqueItems: true,
        }),
        ['$: items must be unique']
    );
    assert.deepEqual(validateJsonSchema(null, { type: 'null' }), []);
    assert.deepEqual(validateJsonSchema('null', { type: 'null' }), [
        '$: expected null, received string',
    ]);
});

test('oneOf exige exactement un sous-schéma satisfait', () => {
    const schema = {
        type: 'object',
        oneOf: [
            {
                type: 'object',
                additionalProperties: false,
                required: ['method', 'command'],
                properties: {
                    method: { const: 'official-schematic' },
                    command: { type: 'string' },
                },
            },
            {
                type: 'object',
                additionalProperties: false,
                required: ['method', 'reference_tool'],
                properties: {
                    method: { const: 'reference-derived' },
                    reference_tool: { type: 'string' },
                },
            },
        ],
    };
    assert.deepEqual(
        validateJsonSchema(
            { method: 'official-schematic', command: 'ng add x' },
            schema
        ),
        []
    );
    // zéro branche : method inconnue
    assert.deepEqual(
        validateJsonSchema({ method: 'llm', command: 'x' }, schema),
        ['$: must match exactly one subschema of oneOf (matched 0)']
    );
    // deux branches : official-schematic sans sa clé command mais avec
    // reference_tool ne matche qu'une ; on force l'ambiguïté avec un objet vide
    assert.deepEqual(
        validateJsonSchema(
            { method: 'reference-derived', reference_tool: 't', command: 'c' },
            schema
        ),
        ['$: must match exactly one subschema of oneOf (matched 0)']
    );
});

test('anyOf exige au moins un sous-schéma satisfait', () => {
    // Même angle mort fail-open que allOf et oneOf avant leurs correctifs :
    // sans cette branche, tout passait. Un bloc de coexistence doit porter au
    // moins un contrôle, sans que porter les deux soit une faute.
    const schema = {
        type: 'object',
        anyOf: [
            { type: 'object', required: ['static_invariants'] },
            { type: 'object', required: ['runtime_acceptance'] },
        ],
    };
    assert.deepEqual(validateJsonSchema({ static_invariants: [] }, schema), []);
    assert.deepEqual(
        validateJsonSchema({ runtime_acceptance: [] }, schema),
        []
    );
    assert.deepEqual(
        validateJsonSchema(
            { static_invariants: [], runtime_acceptance: [] },
            schema
        ),
        [],
        'porter les deux reste valide'
    );
    assert.deepEqual(validateJsonSchema({ with: 'tailwind' }, schema), [
        '$: must match at least one subschema of anyOf',
    ]);
});
