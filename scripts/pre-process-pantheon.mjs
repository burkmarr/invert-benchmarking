import { parse } from 'csv-parse';
import { createReadStream } from 'node:fs';
import { writeFile } from 'node:fs/promises';

const rawPantheon = 'E:\\Tanyptera\\benchmarking\\data\\Pantheon\\PantheonHabitatTraits_v3.7.4.csv';
const processedPantheon = 'E:\\Tanyptera\\benchmarking\\data\\Pantheon\\pantheon-traits-processed.csv';

const satsByTvk = new Map();
for await (const trait of createReadStream(rawPantheon).pipe(parse({
	columns: true,
	bom: true,
	skip_empty_lines: true,
}))) {
	const tvk = trait.SpeciesTVK?.trim();
	if (!tvk) continue;

	const sats = satsByTvk.get(tvk) ?? new Set();
	if (trait.TraitType?.trim() === 'specific assemblage type') {
		const sat = trait.TraitName?.trim();
		if (sat) sats.add(sat);
	}
	satsByTvk.set(tvk, sats);
}

function escapeCsv(value) {
	const text = String(value);
	return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const outputRows = [
	['tvk', 'sats'],
	...[...satsByTvk].map(([tvk, sats]) => [
		tvk,
		`[${[...sats].map(sat => JSON.stringify(sat)).join(', ')}]`,
	]),
];

await writeFile(
	processedPantheon,
	`${outputRows.map(row => row.map(escapeCsv).join(',')).join('\n')}\n`,
	'utf8',
);
