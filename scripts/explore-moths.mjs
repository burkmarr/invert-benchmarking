import { parse } from 'csv-parse';
import { createReadStream } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const mothData = resolve(
	dirname(fileURLToPath(import.meta.url)),
	'..',
	'data',
	'Moth data 2026-11-05',
	'Mapmate_records_final_except_stage.csv',
);

let hasHeader = false;
let columnNames = [];
const firstRecords = [];

for await (const row of createReadStream(mothData).pipe(parse({
	bom: true,
	skip_empty_lines: true,
}))) {
	if (!hasHeader) {
		columnNames = row;
		hasHeader = true;
		continue;
	}

	firstRecords.push(Object.fromEntries(
		columnNames.map((columnName, index) => [columnName, row[index]]),
	));
	if (firstRecords.length === 10) break;
}

console.log('Column names:', JSON.stringify(columnNames));
console.log('First 10 records:', JSON.stringify(firstRecords, null, 2));