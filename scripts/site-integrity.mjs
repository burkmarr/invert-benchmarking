import { area } from '@turf/area';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const geojsonFile = resolve(dataDirectory, 'bhs.geojson');

function featureArea(geometry) {
	if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') {
		throw new Error(`Unsupported geometry type: ${geometry.type}`);
	}

	return area({ type: 'Feature', properties: {}, geometry });
}

const geojson = JSON.parse(await readFile(geojsonFile, 'utf8'));
let featureNumber = 0;
let warnings = 0;


for (const feature of geojson.features) {
	featureNumber += 1;
	const calculatedHectares = featureArea(feature.geometry) / 10_000;
	const recordedHectares = Number(feature.properties.Hectares);
	const differenceRatio = recordedHectares === 0
		? (calculatedHectares === 0 ? 0 : Infinity)
		: Math.abs(calculatedHectares - recordedHectares) / Math.abs(recordedHectares);
	const warning = differenceRatio > 0.05 ? ' WARNING!' : '';
	if (warning) warnings += 1;

	console.log(
		`Feature ${featureNumber}: calculated ${calculatedHectares.toFixed(2)} ha; `
		+ `Hectares attribute ${recordedHectares.toFixed(2)} ha.${warning}`,
	);
}
console.log(`Total warnings: ${warnings}`);