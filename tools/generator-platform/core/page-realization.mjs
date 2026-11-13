// Contrat de réalisation d'une page : nœud de rôle `screen` et archétype
// sélectionné, partagé par la réalisation de page des produits extérieurs.
import { lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
    loadArchetypeSystem,
    selectArchetype,
} from './archetype-selection.mjs';
import { producePageRoleNode } from './role-production.mjs';

function fail(message) {
    throw new Error(`page realization: ${message}`);
}

function readJsonFile(path, label) {
    const metadata = lstatSync(path);
    if (!metadata.isFile() || metadata.isSymbolicLink())
        fail(`${label} must be a regular file`);
    try {
        return JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
        fail(`${label} is invalid JSON (${error.message})`);
    }
}

export function resolveRealizationContract(
    root,
    pageContract,
    pageContractHash,
    target
) {
    const roleNodeSchema = readJsonFile(
        resolve(root, 'tools/generator-platform/schemas/role-node.schema.json'),
        'role node schema'
    );
    const roleNode = producePageRoleNode(
        pageContract,
        pageContractHash,
        roleNodeSchema
    );
    const selection = selectArchetype(
        loadArchetypeSystem(root, target.archetypeStack),
        roleNode
    );
    return { role_node: roleNode, selection };
}
