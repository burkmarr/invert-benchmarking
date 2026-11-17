import { parse } from 'csv-parse';
import { createReadStream } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const mothTaxa = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'data',
    'Moth Lancs status 2026-10-06',
    'Lancs_Moths_status_index_Oct_2026.csv',
);

const tanHubTaxa = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'data',
    'TanHub all taxa 2026-11-16',
    'taxa-babd18ee5ba9aa9e463c6fffd413be14.csv',
);

const tvkColMoth = "Taxon Version Key"
const tvkColTanHub = "Scientific name identifier"

function createTaxaParser(filePath, columnName) {
    return createReadStream(filePath).pipe(parse({
        bom: true,
        columns: (headers) => {
            if (!headers.includes(columnName)) {
                throw new Error(`Column "${columnName}" not found in ${filePath}`);
            }
            return headers;
        },
        skip_empty_lines: true,
    }));
}

const tanHubTaxonKeys = new Set();
for await (const record of createTaxaParser(tanHubTaxa, tvkColTanHub)) {
    const taxonKey = record[tvkColTanHub]?.trim();
    if (taxonKey) tanHubTaxonKeys.add(taxonKey);
}

let matchedTaxa = 0;
let unmatchedTaxa = 0;
for await (const record of createTaxaParser(mothTaxa, tvkColMoth)) {
    const taxonKey = record[tvkColMoth]?.trim();
    if (taxonKey && tanHubTaxonKeys.has(taxonKey)) {
        matchedTaxa += 1;
    } else {
        unmatchedTaxa += 1;
    }
}

console.log(`Moth taxa with a TanHub match: ${matchedTaxa}`);
console.log(`Moth taxa without a TanHub match: ${unmatchedTaxa}`);
