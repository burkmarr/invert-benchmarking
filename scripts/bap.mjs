import { rename, rm, stat } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const gdb = 'E:\\Tanyptera\\benchmarking\\work\\bap';
const lern = "E:\\Tanyptera\\benchmarking\\data\\sites\\lern.geojson";
const gdalImage = 'ghcr.io/osgeo/gdal:ubuntu-small-latest';
const outputDirectory = dirname(gdb);
const output = join(outputDirectory, 'bap.geojson');
const temporaryOutput = join(outputDirectory, '.bap.geojson.tmp');
const habitatLayer = 'Priority_Habitat_Inventory_England';
const extractHelper = fileURLToPath(new URL('./bap-extract.py', import.meta.url));

function getCrsName(coordinateSystem) {
	const projjson = coordinateSystem?.projjson;
	const wkt = coordinateSystem?.wkt ?? '';
	const name = projjson?.name
		?? wkt.match(/(?:PROJCRS|GEOGCRS|PROJCS|GEOGCS)\["([^"]+)"/)?.[1]
		?? 'Unknown CRS';
	const identifier = projjson?.id;
	if (identifier?.authority && identifier?.code) {
		return `${name} (${identifier.authority}:${identifier.code})`;
	}

	const epsgCodes = [...wkt.matchAll(/ID\["EPSG",\s*(\d+)\]/g)];
	const epsgCode = epsgCodes[epsgCodes.length - 1]?.[1];
	return epsgCode ? `${name} (EPSG:${epsgCode})` : name;
}

function formatExtent(extent, unit) {
	const coordinates = extent
		.map(value => Number(value).toLocaleString('en-GB', { maximumFractionDigits: 2 }))
		.join(', ');
	return unit ? `[${coordinates}] ${unit}` : `[${coordinates}]`;
}

const gdbInfo = await stat(gdb);
if (!gdbInfo.isDirectory()) {
	throw new Error(`Expected a geodatabase directory at ${gdb}`);
}

const lernInfo = await stat(lern);
if (!lernInfo.isFile()) {
	throw new Error(`Expected a LERN boundary GeoJSON file at ${lern}`);
}

const result = spawnSync('docker', [
	'run',
	'--rm',
	'--volume',
	`${gdb}:/data/input.gdb:ro`,
	gdalImage,
	'ogrinfo',
	'-ro',
	'-json',
	'/data/input.gdb',
], {
	encoding: 'utf8',
	maxBuffer: 16 * 1024 * 1024,
	stdio: ['ignore', 'pipe', 'inherit'],
	timeout: 5 * 60 * 1000,
});

if (result.error) throw result.error;
if (result.status !== 0) {
	throw new Error(`GDAL inspection failed with exit code ${result.status}.`);
}

const dataset = JSON.parse(result.stdout);
console.log(`Geodatabase: ${gdb}`);
console.log(`Driver: ${dataset.driverLongName ?? dataset.driverShortName}`);
console.log(`Layers: ${dataset.layers.length}`);

for (const [index, layer] of dataset.layers.entries()) {
	console.log(`\n${index + 1}. ${layer.name}`);
	console.log(`   Features: ${Number.isInteger(layer.featureCount)
		? layer.featureCount.toLocaleString('en-GB')
		: 'not reported'}`);

	const geometryFields = layer.geometryFields ?? [];
	if (geometryFields.length === 0) {
		console.log('   Geometry: non-spatial table');
	} else {
		for (const geometryField of geometryFields) {
			const coordinateSystem = geometryField.coordinateSystem;
			const unit = coordinateSystem?.projjson?.coordinate_system?.axis?.[0]?.unit;
			console.log(`   Geometry: ${geometryField.type} (${geometryField.name})`);
			console.log(`   CRS: ${getCrsName(coordinateSystem)}`);
			if (geometryField.extent) {
				console.log(`   Extent (min X, min Y, max X, max Y): ${
					formatExtent(geometryField.extent, unit)
				}`);
			}
		}
	}

	const fields = layer.fields ?? [];
	const fieldSummary = fields.map(field => {
		const width = field.width ? `, width ${field.width}` : '';
		return `${field.name} (${field.type}${width})`;
	});
	console.log(`   Fields (${fields.length}): ${fieldSummary.join(', ') || 'none'}`);
}

if (!dataset.layers.some(layer => layer.name === habitatLayer)) {
	throw new Error(`Layer "${habitatLayer}" was not found in the geodatabase.`);
}

console.log(`\nFinding ${habitatLayer} features that intersect the LERN boundary.`);
console.log('Original feature geometries will be retained; they will not be clipped.');
console.log(`Writing output to ${output}`);
console.log('Progress reports spatial candidates checked and exact intersections found.');

try {
	await new Promise((resolve, reject) => {
		const child = spawn('docker', [
		'run',
		'--rm',
		'--volume',
		`${gdb}:/data/input.gdb:ro`,
		'--volume',
		`${lern}:/data/lern.geojson:ro`,
		'--volume',
		`${outputDirectory}:/data/output`,
		'--volume',
		`${extractHelper}:/scripts/bap-extract.py:ro`,
		gdalImage,
		'python3',
		'/scripts/bap-extract.py',
		'/data/input.gdb',
		'/data/lern.geojson',
		'/data/output/.bap.geojson.tmp',
		habitatLayer,
		], {
		stdio: ['ignore', 'pipe', 'inherit'],
		});

		child.stdout.on('data', chunk => {
		process.stdout.write(chunk);
		});

		child.once('error', reject);
		child.once('close', (code, signal) => {
			if (code !== 0) {
				reject(new Error(
				`GDAL extraction failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}.`,
				));
			} else {
				resolve();
			}
		});
	});

	await rename(temporaryOutput, output);
} catch (error) {
	await rm(temporaryOutput, { force: true });
	throw error;
}

console.log(`\nExtraction complete: ${output}`);
