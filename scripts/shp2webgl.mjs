import { spawn, spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const inFolder = 'F:\\GIS\\QGIS Data\\UK\\Lancs LNRS';
const outFolder = 'E:\\Tanyptera\\benchmarking\\map\\data\\lnrs';
const gdalImage = 'ghcr.io/osgeo/gdal:ubuntu-small-latest';
const tippecanoeImage = 'benchmarking-tippecanoe:2.79.0';
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');
const dockerfile = join(scriptDirectory, 'Dockerfile.gjson2webgl');

function run(command, args) {
	return new Promise((resolvePromise, rejectPromise) => {
		const child = spawn(command, args, { stdio: 'inherit' });

		child.once('error', rejectPromise);
		child.once('close', (code, signal) => {
			if (code === 0) {
				resolvePromise();
			} else {
				rejectPromise(new Error(
					`${command} exited with ${signal ? `signal ${signal}` : `code ${code}`}`,
				));
			}
		});
	});
}

function hasDockerImage(image) {
	const result = spawnSync('docker', ['image', 'inspect', image], {
		stdio: 'ignore',
	});
	if (result.error) throw result.error;
	return result.status === 0;
}

const inputDirectory = resolve(inFolder);
const outputDirectory = resolve(outFolder);
const inputInfo = await stat(inputDirectory);
if (!inputInfo.isDirectory()) {
	throw new Error(`Input path is not a directory: ${inputDirectory}`);
}

const shapefiles = (await readdir(inputDirectory, { withFileTypes: true }))
	.filter(entry => entry.isFile() && extname(entry.name).toLowerCase() === '.shp')
	.map(entry => entry.name)
	.sort((first, second) => first.localeCompare(second));

if (shapefiles.length === 0) {
	throw new Error(`No shapefiles found in ${inputDirectory}`);
}

await mkdir(outputDirectory, { recursive: true });

if (!hasDockerImage(gdalImage)) {
	console.log(`Pulling GDAL Docker image ${gdalImage}`);
	await run('docker', ['pull', gdalImage]);
}

if (!hasDockerImage(tippecanoeImage)) {
	console.log('Building the Tippecanoe Docker image (first run only)');
	await run('docker', [
		'build',
		'--tag',
		tippecanoeImage,
		'--file',
		dockerfile,
		repositoryRoot,
	]);
}

const stagingDirectory = await mkdtemp(join(outputDirectory, '.shp2webgl-'));
try {
	for (const [index, inputName] of shapefiles.entries()) {
		const layerName = basename(inputName, extname(inputName));
		const outputName = `${layerName}.pmtiles`;
		const geojsonName = `layer-${String(index).padStart(3, '0')}.geojson`;
		const stagedOutputName = `layer-${String(index).padStart(3, '0')}.pmtiles`;
		const outputPath = join(outputDirectory, outputName);
		const stagedOutputPath = join(stagingDirectory, stagedOutputName);
		const inputPath = join(inputDirectory, inputName);
		const inputSize = (await stat(inputPath)).size;
		const startedAt = Date.now();

		console.log(
			`[${index + 1}/${shapefiles.length}] Converting ${inputName} `
			+ `(${(inputSize / 1024 / 1024).toFixed(1)} MB) to ${outputName}`,
		);

		await run('docker', [
			'run',
			'--rm',
			'--volume',
			`${inputDirectory}:/input:ro`,
			'--volume',
			`${stagingDirectory}:/output`,
			gdalImage,
			'ogr2ogr',
			'-f',
			'GeoJSON',
			'-s_srs',
			'EPSG:27700',
			'-t_srs',
			'EPSG:4326',
			'-dim',
			'XY',
			'-lco',
			'RFC7946=YES',
			'-lco',
			'COORDINATE_PRECISION=6',
			`/output/${geojsonName}`,
			`/input/${inputName}`,
		]);

		await run('docker', [
			'run',
			'--rm',
			'--volume',
			`${stagingDirectory}:/output`,
			tippecanoeImage,
			'--force',
			'--output',
			`/output/${stagedOutputName}`,
			'--layer',
			layerName,
			'-zg',
			'--drop-densest-as-needed',
			'--extend-zooms-if-still-dropping',
			`/output/${geojsonName}`,
		]);

		await copyFile(stagedOutputPath, outputPath);
		const outputSize = (await stat(outputPath)).size;
		console.log(
			`[${index + 1}/${shapefiles.length}] Wrote ${outputName} `
			+ `(${(outputSize / 1024 / 1024).toFixed(1)} MB) `
			+ `in ${((Date.now() - startedAt) / 1000).toFixed(1)} seconds`,
		);
	}
} finally {
	await rm(stagingDirectory, { recursive: true, force: true });
}
