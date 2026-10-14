import shapefile from 'shapefile';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Uses the Node shapefile package to read shapefiles and 
// compare calculated polygon areas with recorded Hectares 
// attributes, warning if there is any mis-match of more
// than 5%.
// This is basically an integrity check to ensure that all
// the features in the shapefile have valid geometry.

const dataDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const shpFile = resolve(dataDirectory, 'BHS_Boundaries.shp');
const dbfFile = resolve(dataDirectory, 'BHS_Boundaries.dbf');

function ringArea(ring) {
	let twiceArea = 0;

	for (let index = 0; index < ring.length; index += 1) {
		const [x1, y1] = ring[index];
		const [x2, y2] = ring[(index + 1) % ring.length];
		twiceArea += x1 * y2 - x2 * y1;
	}

	return Math.abs(twiceArea) / 2;
}

function polygonArea(rings) {
	if (rings.length === 0) return 0;

	const outerArea = ringArea(rings[0]);
	const holesArea = rings.slice(1).reduce((sum, ring) => sum + ringArea(ring), 0);
	return Math.max(0, outerArea - holesArea);
}

function featureArea(geometry) {
	if (geometry.type === 'Polygon') {
		return polygonArea(geometry.coordinates);
	}

	if (geometry.type === 'MultiPolygon') {
		return geometry.coordinates.reduce((sum, polygon) => sum + polygonArea(polygon), 0);
	}

	throw new Error(`Unsupported geometry type: ${geometry.type}`);
}

const source = await shapefile.open(shpFile, dbfFile);
let result = await source.read();
let featureNumber = 0;
let warnings = 0;

while (!result.done) {
	featureNumber += 1;
	const feature = result.value;
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

	result = await source.read();
}
console.log(`Total warnings: ${warnings}`);