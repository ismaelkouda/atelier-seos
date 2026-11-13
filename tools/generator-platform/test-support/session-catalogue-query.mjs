// Lecture « catalogue » de la fixture de session (X5 C2). Une lecture de
// session est au profil EXTÉRIEUR : politique honnête `bypass`, échec qui
// efface les lignes (`on_error: clear`), décodeur projeté sur les champs lus
// (D-X5-2, D-X5-4, D-X5-6).
import { EXTERNAL_LIST_QUERY_EXECUTION } from '../core/list-query-external-profile.mjs';
import { compileListQueryV2ExecutionModel } from '../core/list-query-v2-compiler.mjs';

// Définition de la lecture « catalogue » (profil extérieur), aussi écrite dans
// un produit extérieur par la fixture de C3a. Gabarit fictif en ligne : même
// objet, clés dans le même ordre, que l'ancien gabarit lu sur disque.
export async function sessionCatalogueDefinition({ domain, backendReference }) {
    const id = domain + '-catalogue';
    return {
        schema_version: '2.0.0',
        kind: 'list-query',
        feature: {
            id: domain + '-catalogue-feature',
            name: 'Fixture catalogue',
            description: 'Synthetic fixture.',
        },
        backend_contract: backendReference,
        operations: [
            {
                id,
                operation_ref: { operation_id: id },
                success_response_status: 200,
                read_model: {
                    id: domain + '-item-projection',
                    description: 'Fixture row.',
                    fields: [
                        { name: 'id', source_field: 'id' },
                        { name: 'label', source_field: 'label' },
                    ],
                },
                execution: structuredClone(EXTERNAL_LIST_QUERY_EXECUTION),
            },
        ],
    };
}

export async function compileSessionCatalogueQuery({
    domain,
    backend,
    backendReference,
}) {
    const definition = await sessionCatalogueDefinition({
        domain,
        backendReference,
    });
    return compileListQueryV2ExecutionModel({
        definition,
        backendContractDocument: backend.document,
        backendContractUri: backend.uri,
        profile: 'external',
    });
}
