// Validateur JSON Schema minimal du moteur et racine de l'atelier.
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = resolve(moduleDirectory, '../..');

function describe(value) {
    if (Array.isArray(value)) return 'array';
    if (value === null) return 'null';
    return typeof value;
}

function schemaTypeMatches(value, expected) {
    if (expected === 'null') return value === null;
    if (expected === 'array') return Array.isArray(value);
    if (expected === 'object') {
        return (
            value !== null && typeof value === 'object' && !Array.isArray(value)
        );
    }
    if (expected === 'integer') return Number.isInteger(value);
    return typeof value === expected;
}

function resolveLocalReference(reference, rootSchema) {
    if (!reference.startsWith('#/')) {
        throw new Error(`unsupported non-local schema reference: ${reference}`);
    }

    return reference
        .slice(2)
        .split('/')
        .map((token) => token.replaceAll('~1', '/').replaceAll('~0', '~'))
        .reduce((current, token) => current?.[token], rootSchema);
}

export function validateJsonSchema(
    value,
    schema,
    rootSchema = schema,
    path = '$'
) {
    const errors = [];
    let currentSchema = schema;

    if (currentSchema.$ref) {
        currentSchema = resolveLocalReference(currentSchema.$ref, rootSchema);
        if (!currentSchema) {
            return [`${path}: unresolved schema reference ${schema.$ref}`];
        }
    }

    if (
        Object.hasOwn(currentSchema, 'const') &&
        JSON.stringify(value) !== JSON.stringify(currentSchema.const)
    ) {
        errors.push(
            `${path}: expected constant ${JSON.stringify(currentSchema.const)}`
        );
    }

    if (
        currentSchema.enum &&
        !currentSchema.enum.some(
            (candidate) => JSON.stringify(candidate) === JSON.stringify(value)
        )
    ) {
        errors.push(
            `${path}: expected one of ${currentSchema.enum.join(', ')}`
        );
    }

    if (currentSchema.type && !schemaTypeMatches(value, currentSchema.type)) {
        errors.push(
            `${path}: expected ${currentSchema.type}, received ${describe(value)}`
        );
        return errors;
    }

    // Audit staff 2026-08-29 : allOf n'était lu par aucune branche ci-dessus,
    // donc un schéma combinant plusieurs sous-schémas (ex. change-set.schema.json
    // #/properties/targets/items) passait silencieusement quelle que soit la
    // valeur — fail-open avéré, reproduit indépendamment avant ce correctif.
    // JSON Schema exige que value soit valide contre CHAQUE sous-schéma
    // d'allOf, chacun évalué indépendamment (additionalProperties d'une
    // branche ne doit pas rejeter les propriétés d'une autre branche) : on
    // valide donc chaque sous-schéma séparément puis on concatène les
    // erreurs, sans early-return pour ne pas masquer les branches suivantes.
    if (Array.isArray(currentSchema.allOf)) {
        for (const subschema of currentSchema.allOf) {
            errors.push(
                ...validateJsonSchema(value, subschema, rootSchema, path)
            );
        }
    }

    // oneOf : JSON Schema exige que value valide EXACTEMENT un sous-schéma.
    // Sans cette branche, un schéma `oneOf` passait quelle que soit la valeur
    // (même angle mort que `allOf` avant le correctif 2026-08-29). Utilisé par
    // conventions/libraries/library-setup.schema.json pour discriminer
    // `install` selon `method` (union fermée : chaque branche a son propre
    // `additionalProperties:false`, donc une valeur valide n'en matche qu'une).
    if (Array.isArray(currentSchema.oneOf)) {
        const matched = currentSchema.oneOf.filter(
            (subschema) =>
                validateJsonSchema(value, subschema, rootSchema, path)
                    .length === 0
        ).length;
        if (matched !== 1) {
            errors.push(
                `${path}: must match exactly one subschema of oneOf (matched ${matched})`
            );
        }
    }

    // Audit staff 2026-09-06 : `anyOf` était le dernier combinateur non lu —
    // même angle mort fail-open que `allOf` (2026-08-29) et `oneOf`. Un schéma
    // `anyOf` passait quelle que soit la valeur. Utilisé par
    // conventions/libraries/library-setup.schema.json pour exiger qu'un bloc
    // `coexistence` porte AU MOINS un contrôle (invariant statique ou
    // acceptance runtime), sans interdire d'en porter les deux — ce que `oneOf`
    // refuserait à tort.
    if (Array.isArray(currentSchema.anyOf)) {
        const matched = currentSchema.anyOf.some(
            (subschema) =>
                validateJsonSchema(value, subschema, rootSchema, path)
                    .length === 0
        );
        if (!matched) {
            errors.push(`${path}: must match at least one subschema of anyOf`);
        }
    }

    if (typeof value === 'number') {
        if (
            currentSchema.minimum !== undefined &&
            value < currentSchema.minimum
        ) {
            errors.push(`${path}: must be >= ${currentSchema.minimum}`);
        }
        if (
            currentSchema.maximum !== undefined &&
            value > currentSchema.maximum
        ) {
            errors.push(`${path}: must be <= ${currentSchema.maximum}`);
        }
    }

    if (typeof value === 'string') {
        if (
            currentSchema.minLength !== undefined &&
            value.length < currentSchema.minLength
        ) {
            errors.push(
                `${path}: must contain at least ${currentSchema.minLength} chars`
            );
        }
        if (
            currentSchema.maxLength !== undefined &&
            value.length > currentSchema.maxLength
        ) {
            errors.push(
                `${path}: must contain at most ${currentSchema.maxLength} chars`
            );
        }
        if (
            currentSchema.pattern &&
            !new RegExp(currentSchema.pattern).test(value)
        ) {
            errors.push(`${path}: does not match ${currentSchema.pattern}`);
        }
    }

    if (Array.isArray(value)) {
        if (
            currentSchema.minItems !== undefined &&
            value.length < currentSchema.minItems
        ) {
            errors.push(
                `${path}: must contain at least ${currentSchema.minItems} items`
            );
        }
        if (currentSchema.uniqueItems === true) {
            const identities = value.map((item) => JSON.stringify(item));
            if (new Set(identities).size !== identities.length) {
                errors.push(`${path}: items must be unique`);
            }
        }
        if (currentSchema.items) {
            value.forEach((item, index) => {
                errors.push(
                    ...validateJsonSchema(
                        item,
                        currentSchema.items,
                        rootSchema,
                        `${path}[${index}]`
                    )
                );
            });
        }
    }

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        for (const key of currentSchema.required ?? []) {
            if (!Object.hasOwn(value, key))
                errors.push(`${path}.${key}: is required`);
        }

        for (const [key, child] of Object.entries(value)) {
            const propertySchema = currentSchema.properties?.[key];
            if (!propertySchema) {
                if (currentSchema.additionalProperties === false) {
                    errors.push(
                        `${path}.${key}: additional property is not allowed`
                    );
                }
                continue;
            }
            errors.push(
                ...validateJsonSchema(
                    child,
                    propertySchema,
                    rootSchema,
                    `${path}.${key}`
                )
            );
        }
    }

    return errors;
}

export async function loadJson(path) {
    return JSON.parse(await readFile(path, 'utf8'));
}
