import { copyFile, mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const bap = 'E:\\Tanyptera\\benchmarking\\work\\bap.geojson';
const outputDirectory = 'E:\\Tanyptera\\benchmarking\\map\\data\\bap';
const gdalImage = 'ghcr.io/osgeo/gdal:ubuntu-small-latest';
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');
const dockerfile = join(scriptDirectory, 'Dockerfile.gjson2webgl');
const tippecanoeImage = 'benchmarking-tippecanoe:2.79.0';
const extractHelper = join(scriptDirectory, 'bap2-extract.py');

function run(command, args) {
	return new Promise((resolvePromise, rejectPromise) => {
		const child = spawnSync(command, args, {
			stdio: 'inherit',
		});

		if (child.error) {
			rejectPromise(child.error);
		} else if (child.status === 0) {
			resolvePromise();
		} else {
			rejectPromise(new Error(
				`${command} exited with ${child.signal ? `signal ${child.signal}` : `code ${child.status}`}`,
			));
		}
	});
}

function safeOutputName(value) {
	const safeName = value
		.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
		.replace(/[. ]+$/g, '')
		.trim();
	if (!safeName) throw new Error(`Habitat value cannot be used as a filename: "${value}"`);
	return `${safeName}.pmtiles`;
}

const inputInfo = await stat(bap);
if (!inputInfo.isFile()) {
	throw new Error(`Expected a GeoJSON file at ${bap}`);
}

const result = spawnSync('docker', [
	'run',
	'--rm',
	'--volume',
	`${bap}:/data/bap.geojson:ro`,
	gdalImage,
	'ogrinfo',
	'-ro',
	'-json',
	'-features',
	'-geom=NO',
	'-sql',
	'SELECT mainhabs FROM bap',
	'/data/bap.geojson',
], {
	encoding: 'utf8',
	maxBuffer: 64 * 1024 * 1024,
	stdio: ['ignore', 'pipe', 'inherit'],
});

if (result.error) throw result.error;
if (result.status !== 0) {
	throw new Error(`Could not read habitat values from ${bap} (exit code ${result.status}).`);
}

const dataset = JSON.parse(result.stdout);
const layer = dataset.layers?.find(candidate => candidate.name === 'bap');
if (!layer) {
	throw new Error('The GeoJSON does not contain the expected "bap" layer.');
}
if (!layer.fields?.some(field => field.name === 'mainhabs')) {
	throw new Error('The GeoJSON layer does not contain a "mainhabs" field.');
}

const featureCounts = new Map();
let featureCount = 0;

for (const feature of layer.features ?? []) {
	const mainhabs = feature.properties?.mainhabs;
	if (typeof mainhabs !== 'string' || mainhabs.trim() === '') continue;

	featureCount += 1;
	const habitatsInFeature = new Set(
		mainhabs.split(',').map(value => value.trim()).filter(Boolean),
	);
	for (const habitat of habitatsInFeature) {
		featureCounts.set(habitat, (featureCounts.get(habitat) ?? 0) + 1);
	}
}

console.log(`Features with a mainhabs value: ${featureCount.toLocaleString('en-GB')}`);
console.log(`Unique habitat values: ${featureCounts.size.toLocaleString('en-GB')}\n`);
console.log('Habitat value'.padEnd(50) + 'Feature count');
console.log('-'.repeat(65));

for (const [habitat, count] of [...featureCounts].sort(([a], [b]) => a.localeCompare(b, 'en-GB'))) {
	console.log(`${habitat.padEnd(50)}${count.toLocaleString('en-GB')}`);
}

const habitats = [...featureCounts.keys()].sort((a, b) => a.localeCompare(b, 'en-GB'));
const outputNames = new Map();
const outputNamesLowercase = new Set();
for (const habitat of habitats) {
	const outputName = safeOutputName(habitat);
	const normalizedName = outputName.toLocaleLowerCase('en-GB');
	if (outputNamesLowercase.has(normalizedName)) {
		throw new Error(`Multiple habitat values map to the same output filename: ${outputName}`);
	}
	outputNamesLowercase.add(normalizedName);
	outputNames.set(habitat, outputName);
}

await mkdir(outputDirectory, { recursive: true });

const imageCheck = spawnSync('docker', ['image', 'inspect', tippecanoeImage], {
	stdio: 'ignore',
});
if (imageCheck.error) throw imageCheck.error;
if (imageCheck.status !== 0) {
	console.log('\nBuilding the Tippecanoe Docker image (first run only).');
	await run('docker', [
		'build',
		'--tag',
		tippecanoeImage,
		'--file',
		dockerfile,
		repositoryRoot,
	]);
}

const stagingDirectory = await mkdtemp(join(outputDirectory, '.bap-pmtiles-'));
try {
	await run('docker', [
		'run',
		'--rm',
		'--volume',
		`${bap}:/data/bap.geojson:ro`,
		'--volume',
		`${stagingDirectory}:/data/output`,
		'--volume',
		`${extractHelper}:/scripts/bap2-extract.py:ro`,
		gdalImage,
		'python3',
		'/scripts/bap2-extract.py',
		'/data/bap.geojson',
		'/data/output',
		JSON.stringify(habitats),
	]);

	for (const [index, habitat] of habitats.entries()) {
		const stagedName = `habitat-${String(index).padStart(3, '0')}.geojson`;
		const stagedOutputName = `habitat-${String(index).padStart(3, '0')}.pmtiles`;
		const stagedOutputPath = join(stagingDirectory, stagedOutputName);
		const outputName = outputNames.get(habitat);
		const outputPath = join(outputDirectory, outputName);

		console.log(`\n[${index + 1}/${habitats.length}] Creating ${outputName}`);
		await run('docker', [
			'run',
			'--rm',
			'--volume',
			`${stagingDirectory}:/data`,
			tippecanoeImage,
			'--force',
			'--output',
			`/data/${stagedOutputName}`,
			'--layer',
			habitat,
			'--maximum-zoom=14',
			'--drop-densest-as-needed',
			'--extend-zooms-if-still-dropping',
			'--quiet',
			`/data/${stagedName}`,
		]);

		await copyFile(stagedOutputPath, outputPath);
		const outputSize = (await stat(outputPath)).size;
		console.log(`Wrote ${outputPath} (${(outputSize / 1024 / 1024).toFixed(1)} MB)`);
	}
} finally {
	await rm(stagingDirectory, { recursive: true, force: true });
}