import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { parse } from 'csv-parse';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import RBush from 'rbush';
import { fileURLToPath } from 'node:url';

// The records CSV has about 241,000 rows, so a full scan against 
// all 1,231 polygons would mean roughly 300 million 
// point-in-polygon checks. Use a streaming CSV parser 
// and an RBush spatial index to narrow each record to candidate 
// BHS polygons, then use Turf for exact containment; that keeps 
// memory and work bounded without changing the requested counts.

// Load SQS traits from data, match SpeciesTVK 
// to each BHS’s distinct TaxonVersionKeys, and sum the scores 
// into the new SQI column. Blank keys and nonnumeric TraitValues 
// such as Not reviewed contribute zero; duplicate numeric 
// entries for a TVK have matching values.

const dataDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const outputDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'output');
const geojsonFile = resolve(dataDirectory, 'bhs.geojson');
const csvRecords = resolve(dataDirectory, 'irecord-data.csv');
const csvPantheon = resolve(dataDirectory, 'PantheonHabitatTraits_v3.7.4.csv');
const csvConStat = resolve(dataDirectory, 'PantheonConservationStatus_v3.7.4-modified.csv');
const geojson = JSON.parse(await readFile(geojsonFile, 'utf8'));

const sqsByTvk = new Map();
const satsByTvk = new Map();
for await (const trait of createReadStream(csvPantheon).pipe(parse({
	columns: true,
	bom: true,
	skip_empty_lines: true,
}))) {
	const taxonVersionKey = trait.SpeciesTVK?.trim();
	if (!taxonVersionKey) continue;

	if (trait.TraitName?.trim() === 'SQS') {
		const traitValueText = trait.TraitValue?.trim();
		const traitValue = Number(traitValueText);
		if (traitValueText && Number.isFinite(traitValue)) {
			sqsByTvk.set(taxonVersionKey, traitValue);
		}
	}

	if (trait.TraitType?.trim() === 'specific assemblage type') {
		const satName = trait.TraitName?.trim();
		if (!satName) continue;

		const tvkSats = satsByTvk.get(taxonVersionKey) ?? new Set();
		tvkSats.add(satName);
		satsByTvk.set(taxonVersionKey, tvkSats);
	}
}

const statusCategoriesByTvk = new Map();
for await (const status of createReadStream(csvConStat).pipe(parse({
	columns: true,
	bom: true,
	skip_empty_lines: true,
}))) {
	const taxonVersionKey = status.PreferredTVK?.trim();
	const reportingCategory = status.ReportingCategory?.trim();
	const designation = status.Designation?.trim();
	if (!taxonVersionKey || !reportingCategory || !designation) continue;

	const category = `${reportingCategory} - ${designation}`;
	const tvkCategories = statusCategoriesByTvk.get(taxonVersionKey) ?? new Set();
	tvkCategories.add(category);
	statusCategoriesByTvk.set(taxonVersionKey, tvkCategories);
}

function getBounds(coordinates) {
	const bounds = {
		minX: Infinity,
		minY: Infinity,
		maxX: -Infinity,
		maxY: -Infinity,
	};

	function visit(part) {
		if (typeof part[0] === 'number') {
			const [longitude, latitude] = part;
			bounds.minX = Math.min(bounds.minX, longitude);
			bounds.minY = Math.min(bounds.minY, latitude);
			bounds.maxX = Math.max(bounds.maxX, longitude);
			bounds.maxY = Math.max(bounds.maxY, latitude);
			return;
		}

		for (const child of part) visit(child);
	}

	visit(coordinates);
	return bounds;
}

const bhsFeatures = geojson.features;
const index = new RBush();
index.load(bhsFeatures.map((feature, featureIndex) => ({
	...getBounds(feature.geometry.coordinates),
	feature,
	featureIndex,
})));

const counts = new Array(bhsFeatures.length).fill(0);
const speciesByBhs = Array.from({ length: bhsFeatures.length }, () => new Set());
const satNamesPresentInBhs = new Set();
const statusCategoriesPresentInBhs = new Set();

for await (const record of createReadStream(csvRecords).pipe(parse({
	columns: true,
	bom: true,
	skip_empty_lines: true,
}))) {
	const latitudeText = record.Latitude?.trim();
	const longitudeText = record.Longitude?.trim();
	const latitude = Number(latitudeText);
	const longitude = Number(longitudeText);

	if (
		!latitudeText
		|| !longitudeText
		|| !Number.isFinite(latitude)
		|| !Number.isFinite(longitude)
		|| latitude < -90
		|| latitude > 90
		|| longitude < -180
		|| longitude > 180
	) {
		continue;
	}

	const candidates = index.search({
		minX: longitude,
		minY: latitude,
		maxX: longitude,
		maxY: latitude,
	});

	for (const candidate of candidates) {
		if (booleanPointInPolygon([longitude, latitude], candidate.feature)) {
			counts[candidate.featureIndex] += 1;
			const taxonVersionKey = record.TaxonVersionKey?.trim();
			if (taxonVersionKey) {
				const siteSpecies = speciesByBhs[candidate.featureIndex];
				if (!siteSpecies.has(taxonVersionKey)) {
					siteSpecies.add(taxonVersionKey);
					for (const satName of satsByTvk.get(taxonVersionKey) ?? []) {
						satNamesPresentInBhs.add(satName);
					}
					for (const category of statusCategoriesByTvk.get(taxonVersionKey) ?? []) {
						statusCategoriesPresentInBhs.add(category);
					}
				}
			}
		}
	}
}
const satColumns = [...satNamesPresentInBhs].sort((first, second) => first.localeCompare(second));
const statusColumns = [...statusCategoriesPresentInBhs].sort((first, second) => first.localeCompare(second));

	function escapeCsv(value) {
		const text = String(value);
		return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
	}

	const outputRows = [[
		'siteID',
		'siteName',
		'hectares',
		'totalRecords',
		'speciesRichness',
		'SQI',
		...satColumns,
	]];
	const statusRows = [[
		'siteID',
		'siteName',
		'hectares',
		'totalRecords',
		'speciesRichness',
		...statusColumns,
	]];
	for (let featureIndex = 0; featureIndex < bhsFeatures.length; featureIndex += 1) {
		const properties = bhsFeatures[featureIndex].properties;
		const siteId = properties.SiteID ?? `BHS ${featureIndex + 1}`;
		const siteName = properties.SiteName ?? 'Unnamed site';
		const hectares = Number(properties.Hectares).toFixed(1);
		const satCounts = new Map(satColumns.map(satName => [satName, 0]));
		const statusCounts = new Map(statusColumns.map(category => [category, 0]));
		const sqi = [...speciesByBhs[featureIndex]].reduce(
			(total, taxonVersionKey) => total + (sqsByTvk.get(taxonVersionKey) ?? 0),
			0,
		);
		for (const taxonVersionKey of speciesByBhs[featureIndex]) {
			for (const satName of satsByTvk.get(taxonVersionKey) ?? []) {
				satCounts.set(satName, satCounts.get(satName) + 1);
			}
			for (const category of statusCategoriesByTvk.get(taxonVersionKey) ?? []) {
				statusCounts.set(category, statusCounts.get(category) + 1);
			}
		}
		outputRows.push([
			siteId,
			siteName,
			hectares,
			counts[featureIndex],
			speciesByBhs[featureIndex].size,
			sqi,
			...satColumns.map(satName => satCounts.get(satName)),
		]);
		statusRows.push([
			siteId,
			siteName,
			hectares,
			counts[featureIndex],
			speciesByBhs[featureIndex].size,
			...statusColumns.map(category => statusCounts.get(category)),
		]);
	}

	const now = new Date();
	const timestamp = [
		now.getFullYear(),
		String(now.getMonth() + 1).padStart(2, '0'),
		String(now.getDate()).padStart(2, '0'),
	].join('-') + `-${String(now.getHours()).padStart(2, '0')}`
		+ `-${String(now.getMinutes()).padStart(2, '0')}`
		+ `-${String(now.getSeconds()).padStart(2, '0')}`;
	const outputFile = resolve(outputDirectory, `sats-and-sqi-${timestamp}.csv`);
	const statusOutputFile = resolve(outputDirectory, `cons-status-${timestamp}.csv`);

	await mkdir(outputDirectory, { recursive: true });
	await writeFile(
		outputFile,
		`${outputRows.map(row => row.map(escapeCsv).join(',')).join('\n')}\n`,
		'utf8',
	);
	await writeFile(
		statusOutputFile,
		`${statusRows.map(row => row.map(escapeCsv).join(',')).join('\n')}\n`,
		'utf8',
	);
