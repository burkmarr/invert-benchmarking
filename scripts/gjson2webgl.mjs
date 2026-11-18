import { spawn, spawnSync } from 'node:child_process';
import { copyFile, readdir, rm, stat } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');
const dataFolder = resolve(repositoryRoot, 'map', 'data');
const dockerfile = join(scriptDirectory, 'Dockerfile.gjson2webgl');
const tippecanoeImage = 'benchmarking-tippecanoe:2.79.0';

function run(command, args, options = {}) {
	return new Promise((resolvePromise, rejectPromise) => {
		const child = spawn(command, args, {
			cwd: options.cwd,
			stdio: 'inherit',
		});

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

function hasTippecanoeImage() {
	const result = spawnSync('docker', ['image', 'inspect', tippecanoeImage], {
		stdio: 'ignore',
	});
	if (result.error) throw result.error;
	return result.status === 0;
}

const dataEntries = await readdir(dataFolder, { withFileTypes: true });
const files = dataEntries
	.filter(entry => entry.isFile() && extname(entry.name).toLowerCase() === '.geojson')
	.map(entry => entry.name)
	.sort((first, second) => first.localeCompare(second));

if (files.length === 0) {
	throw new Error(`No GeoJSON files found in ${dataFolder}`);
}

const existingOutputLayers = new Set(
	dataEntries
		.filter(entry => entry.isFile() && extname(entry.name).toLowerCase() === '.pmtiles')
		.map(entry => basename(entry.name, extname(entry.name)).toLowerCase()),
);
const filesToConvert = files.filter(file => {
	const outputName = `${basename(file, extname(file))}.pmtiles`;
	if (!existingOutputLayers.has(basename(outputName, extname(outputName)).toLowerCase())) {
		return true;
	}

	console.log(`Skipping ${file}; output ${outputName} already exists.`);
	return false;
});

if (filesToConvert.length === 0) {
	console.log('All eligible GeoJSON files already have PMTiles outputs; nothing to convert.');
}

if (filesToConvert.length > 0 && !hasTippecanoeImage()) {
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

for (const [index, inputName] of filesToConvert.entries()) {
	const inputPath = join(dataFolder, inputName);
	const outputName = `${basename(inputName, extname(inputName))}.pmtiles`;
	const outputPath = join(dataFolder, outputName);
	const stagedOutputName = `${basename(inputName, extname(inputName))}.tmp-${process.pid}.pmtiles`;
	const stagedOutputPath = join(dataFolder, stagedOutputName);
	const layerName = basename(inputName, extname(inputName));
	const zoomArgs = ['monads', 'tetrads'].includes(layerName)
		? ['--maximum-zoom=14']
		: ['-zg'];
	const startedAt = Date.now();
	const inputSize = (await stat(inputPath)).size;

	console.log(
		`[${index + 1}/${filesToConvert.length}] Converting ${inputName} `
		+ `(${(inputSize / 1024 / 1024).toFixed(1)} MB) to ${outputName}`,
	);

	try {
		await run('docker', [
			'run',
			'--rm',
			'--volume',
			`${dataFolder}:/data`,
			tippecanoeImage,
			'--force',
			'--output',
			`/data/${stagedOutputName}`,
			'--layer',
			layerName,
			...zoomArgs,
			'--drop-densest-as-needed',
			'--extend-zooms-if-still-dropping',
			`/data/${inputName}`,
		]);

		await copyFile(stagedOutputPath, outputPath);
		const outputSize = (await stat(outputPath)).size;
		console.log(
			`[${index + 1}/${filesToConvert.length}] Wrote ${outputName} `
			+ `(${(outputSize / 1024 / 1024).toFixed(1)} MB) `
			+ `in ${((Date.now() - startedAt) / 1000).toFixed(1)} seconds`,
		);
	} finally {
		await rm(stagedOutputPath, { force: true });
	}
}
