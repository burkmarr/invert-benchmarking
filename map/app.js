import * as L from 'leaflet';
import html2canvas from 'html2canvas';
import * as maplibregl from 'maplibre-gl';
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import { Protocol } from 'pmtiles';

const protocol = new Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);

const benchmarkingLayers = [
	{
		id: 'bhs',
		name: 'BHS',
		file: 'bm-layers/bhs.pmtiles',
		siteProperty: 'SiteName',
		statisticsCsv: 'sat-sites-bhs.csv',
		color: '#18836a',
	},
	{
		id: 'sssi-in-lern',
		name: 'SSSI in LERN',
		file: 'bm-layers/sssi-in-lern.pmtiles',
		siteProperty: 'SSSI_NAME',
		statisticsCsv: 'sat-sites-sssi-in-lern.csv',
		color: '#7856a5',
	},
	{
		id: 'tetrads',
		name: 'Tetrads',
		file: 'bm-layers/tetrads.pmtiles',
		siteProperty: 'GridRef',
		statisticsCsv: 'sat-sites-tetrads.csv',
		color: '#3978b8',
	},
	{
		id: 'monads',
		name: 'Monads',
		file: 'bm-layers/monads.pmtiles',
		siteProperty: 'GridRef',
		statisticsCsv: 'sat-sites-monads.csv',
		color: '#bd5260',
	},
];
const otherLayers = [
	{ id: 'lern', name: 'LERN', file: 'other/lern.pmtiles', color: '#d07a34' },
	{ id: 'sssi', name: 'SSSI', file: 'other/sssi.pmtiles', color: '#9b4f7c' },
];

const bapHabitats = [
	'Blanket bog',
	'Coastal and floodplain grazing marsh',
	'Coastal saltmarsh',
	'Coastal sand dunes',
	'Deciduous woodland',
	'Fragmented heath',
	'Good quality semi improved grassland',
	'Grass moorland',
	'Lakes',
	'Limestone pavement',
	'Lowland calcareous grassland',
	'Lowland dry acid grassland',
	'Lowland fens',
	'Lowland heathland',
	'Lowland meadows',
	'Lowland raised bog',
	'Maritime cliff and slope',
	'Mudflats',
	'No main habitat but additional habitats present',
	'Ponds',
	'Purple moor grass and rush pastures',
	'Reedbeds',
	'Traditional orchard',
	'Upland calcareous grassland',
	'Upland flushes fens and swamps',
	'Upland hay meadow',
	'Upland heathland',
];
const bapColors = [
	'#a65f3f', '#3c8d74', '#3b83a6', '#d2a339', '#687a47', '#8367a8',
	'#ae5f84', '#638e8a', '#a27b3d', '#5270a0', '#8a754f', '#b26c4f',
	'#4b8c63', '#86668d', '#aa8550', '#527c87', '#9d5c62', '#75864a',
	'#7c6b59', '#4b8f91', '#9b6b9d', '#5f7c50', '#a66f3c', '#5678a6',
	'#86734a', '#4e8875', '#a65c79',
];
const bapLayers = bapHabitats.map((name, index) => {
	const id = `bap-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
	return {
		id,
		name,
		file: `bap/${name}.pmtiles`,
		sourceLayer: name,
		color: bapColors[index],
	};
});
const lnrsLayers = [
	{
		id: 'lnrs-apib',
		name: 'Areas of Particular Importance for Biodiversity (APIB)',
		file: 'lnrs/Areas_of_Particular_Importance_for_Biodiversity_(APIB).pmtiles',
		sourceLayer: 'Areas_of_Particular_Importance_for_Biodiversity_(APIB)',
		color: '#a65f3f',
	},
	{
		id: 'lnrs-potential-apib',
		name: 'Areas that Could Become of Particular Importance',
		file: 'lnrs/Areas_that_Could_Become_of_Particular_Importance.pmtiles',
		sourceLayer: 'Areas_that_Could_Become_of_Particular_Importance',
		color: '#527c87',
	},
	{
		id: 'lnrs-potential-measures',
		name: 'Potential Measures',
		file: 'lnrs/PotentialMeasures.pmtiles',
		sourceLayer: 'PotentialMeasures',
		color: '#75864a',
	},
];
const allLayers = [...benchmarkingLayers, ...otherLayers, ...bapLayers, ...lnrsLayers];
const benchmarkingLayerIds = new Set(benchmarkingLayers.map(layer => layer.id));
const attributePopupLayerIds = new Set([...bapLayers, ...lnrsLayers].map(layer => layer.id));

const basemaps = {
	'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		maxZoom: 19,
		className: 'basemap-tile-layer',
		crossOrigin: 'anonymous',
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
	}),
	'OpenTopoMap': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
		maxZoom: 17,
		className: 'basemap-tile-layer',
		crossOrigin: 'anonymous',
		attribution: '&copy; OpenStreetMap contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
	}),
};

const map = L.map('map', {
	minZoom: 2,
	zoomControl: false,
	worldCopyJump: true,
}).setView([54.05, -2.8], 8);
const lernBoundaryBounds = L.latLngBounds(
	[53.48278165, -3.08454577],
	[54.23956838, -2.04507549],
);

document.querySelector('#recentre-map').addEventListener('click', () => {
	const padding = L.point(24, 24);
	const zoom = map.getBoundsZoom(lernBoundaryBounds, false, padding) + 1;
	map.setView(lernBoundaryBounds.getCenter(), zoom);
});

L.control.zoom({ position: 'topright' }).addTo(map);
L.control.scale({ position: 'bottomleft', imperial: false, maxWidth: 120 }).addTo(map);

const basemapGreyscaleControl = document.querySelector('#basemap-greyscale');
const basemapOpacityInput = document.querySelector('#basemap-opacity');
const basemapOpacityValue = document.querySelector('#basemap-opacity-value');
const mapStatus = document.querySelector('#map-status');
const mapShell = document.querySelector('.map-shell');
const mapLoadingIndicator = document.querySelector('#map-loading');
const mapLoadingMessage = document.querySelector('#map-loading-message');
const basemapDisplayOptionsStorageKey = 'site-explorer.basemap-options.v1';

function defaultBasemapDisplayOptions() {
	return { name: 'OpenStreetMap', greyscale: false, opacity: 100 };
}

function loadBasemapDisplayOptions() {
	try {
		const storedValue = localStorage.getItem(basemapDisplayOptionsStorageKey);
		if (storedValue === null) return defaultBasemapDisplayOptions();

		const options = JSON.parse(storedValue);
		if (
			!options
			|| typeof options !== 'object'
			|| Array.isArray(options)
			|| !Object.prototype.hasOwnProperty.call(basemaps, options.name)
			|| typeof options.greyscale !== 'boolean'
			|| !Number.isInteger(options.opacity)
			|| options.opacity < 0
			|| options.opacity > 100
		) {
			throw new Error('Saved basemap display options are invalid.');
		}

		return options;
	} catch (error) {
		console.error('Unable to load saved basemap display options:', error);
		mapStatus.textContent = 'Unable to load saved basemap display options. Using defaults.';
		return defaultBasemapDisplayOptions();
	}
}

function saveBasemapDisplayOptions() {
	try {
		localStorage.setItem(basemapDisplayOptionsStorageKey, JSON.stringify({
			name: activeBasemapName,
			greyscale: basemapGreyscaleControl.checked,
			opacity: Number(basemapOpacityInput.value),
		}));
	} catch (error) {
		console.error('Unable to save basemap display options:', error);
		mapStatus.textContent = 'Unable to save basemap display options in this browser.';
	}
}

const savedBasemapDisplayOptions = loadBasemapDisplayOptions();
let activeBasemapName = savedBasemapDisplayOptions.name;
let activeBasemap = basemaps[activeBasemapName];
basemapGreyscaleControl.checked = savedBasemapDisplayOptions.greyscale;
basemapOpacityInput.value = String(savedBasemapDisplayOptions.opacity);
activeBasemap.addTo(map);

function updateBasemapOpacity() {
	const opacity = Number(basemapOpacityInput.value);
	basemapOpacityValue.value = `${opacity}%`;
	basemapOpacityValue.textContent = `${opacity}%`;
	activeBasemap.setOpacity(opacity / 100);
}

function updateBasemapGreyscale() {
	const container = activeBasemap.getContainer();
	if (container) {
		container.classList.toggle('basemap-greyscale', basemapGreyscaleControl.checked);
	}
}

updateBasemapOpacity();
updateBasemapGreyscale();
basemapOpacityInput.addEventListener('input', updateBasemapOpacity);
basemapOpacityInput.addEventListener('change', saveBasemapDisplayOptions);
basemapGreyscaleControl.addEventListener('change', () => {
	updateBasemapGreyscale();
	saveBasemapDisplayOptions();
});

const basemapOptions = document.querySelector('#basemap-options');
for (const [name, layer] of Object.entries(basemaps)) {
	const id = `basemap-${name.toLowerCase().replaceAll(' ', '-')}`;
	const label = document.createElement('label');
	label.className = 'choice-row';
	label.htmlFor = id;
	label.innerHTML = `<input id="${id}" type="radio" name="basemap" ${name === activeBasemapName ? 'checked' : ''}>`
		+ `<span>${name}</span>`;
	label.querySelector('input').addEventListener('change', () => {
		map.removeLayer(activeBasemap);
		activeBasemapName = name;
		activeBasemap = layer;
		activeBasemap.addTo(map);
		updateBasemapOpacity();
		updateBasemapGreyscale();
		saveBasemapDisplayOptions();
	});
	basemapOptions.append(label);
}

const selectedLayers = new Set();
let vectorLayer;
let vectorMap;
let vectorMapReady;
const pendingLayerLoads = new Map();
let layerLoadRequest = 0;
let featurePopupRequest = 0;
const featureHighlightLayerId = 'feature-attribute-highlight';
let highlightedFeatureSourceId = null;
let highlightedFeatureButton = null;

function updateLayerLoadingIndicator() {
	const layerNames = [...pendingLayerLoads.keys()]
		.map(layerId => allLayers.find(layer => layer.id === layerId)?.name)
		.filter(Boolean);
	mapLoadingIndicator.hidden = layerNames.length === 0;
	mapShell.setAttribute('aria-busy', String(layerNames.length > 0));
	mapLoadingMessage.textContent = layerNames.length === 0
		? 'Loading map layers...'
		: layerNames.length === 1
			? `Loading ${layerNames[0]}...`
			: `Loading ${layerNames.length} map layers...`;
}

function beginLayerLoad(layer) {
	const request = ++layerLoadRequest;
	pendingLayerLoads.set(layer.id, { request, waitingForSource: false });
	updateLayerLoadingIndicator();
	return request;
}

function waitForLayerSource(layer, request) {
	const pendingLoad = pendingLayerLoads.get(layer.id);
	if (!pendingLoad || pendingLoad.request !== request) return;
	pendingLoad.waitingForSource = true;
}

function finishLayerLoad(layerId, request) {
	const pendingLoad = pendingLayerLoads.get(layerId);
	if (!pendingLoad || pendingLoad.request !== request) return;
	pendingLayerLoads.delete(layerId);
	updateLayerLoadingIndicator();
}

function cancelLayerLoad(layerId) {
	if (!pendingLayerLoads.delete(layerId)) return;
	updateLayerLoadingIndicator();
}

function finishLoadedLayerSources() {
	if (!vectorMap) return;
	for (const [layerId, pendingLoad] of pendingLayerLoads) {
		const sourceId = `${layerId}-source`;
		if (
			pendingLoad.waitingForSource
			&& vectorMap.getSource(sourceId)
			&& vectorMap.isSourceLoaded(sourceId)
		) {
			finishLayerLoad(layerId, pendingLoad.request);
		}
	}
}

map.on('click', event => {
	if (vectorMap) void handleVectorFeatureClick(event);
});
const benchmarkingLayerOptions = document.querySelector('#layer-options');
const otherLayerOptions = document.querySelector('#other-layer-options');
const bapLayerOptions = document.querySelector('#bap-layer-options');
const lnrsLayerOptions = document.querySelector('#lnrs-layer-options');
const layerLists = [benchmarkingLayerOptions, otherLayerOptions, bapLayerOptions, lnrsLayerOptions];
const selectedCount = document.querySelector('#selected-count');
const otherSelectedCount = document.querySelector('#other-selected-count');
const bapSelectedCount = document.querySelector('#bap-selected-count');
const lnrsSelectedCount = document.querySelector('#lnrs-selected-count');
const downloadMapButton = document.querySelector('#download-map');
const benchmarkLegend = document.querySelector('#benchmark-legend');
const benchmarkLegendTitle = document.querySelector('#benchmark-legend-title');
const benchmarkLegendGradient = document.querySelector('#benchmark-legend-gradient');
const benchmarkLegendTicks = document.querySelector('#benchmark-legend-ticks');
const layerStyleStorageKey = 'site-explorer.layer-styles.v1';
const benchmarkSharedStyleStorageKey = 'site-explorer.benchmark-style.v1';
const benchmarkOptionsStorageKey = 'site-explorer.benchmark-options.v1';
const defaultFillOpacity = 60;
const defaultBenchmarkBorderWidth = 1;
const maximumBenchmarkBorderWidth = 5;
const benchmarkBorderColor = '#000000';
const layerStyles = loadLayerStyles();
const benchmarkSharedStyle = loadBenchmarkSharedStyle();
const benchmarkColourInput = document.querySelector('#benchmark-colour');
const benchmarkOpacityInput = document.querySelector('#benchmark-opacity');
const benchmarkOpacityValue = document.querySelector('#benchmark-opacity-value');
const benchmarkBorderWidthInput = document.querySelector('#benchmark-border-width');
const benchmarkBorderWidthValue = document.querySelector('#benchmark-border-width-value');
const benchmarkColumnSelect = document.querySelector('#benchmark-column');
const benchmarkTransformSelect = document.querySelector('#benchmark-transform');
const benchmarkRampSelect = document.querySelector('#benchmark-ramp');
const benchmarkCsvPromises = new Map();
const benchmarkColorExpressions = new Map();
const benchmarkMetricSites = new Map();
const benchmarkHideNullValuesControl = document.querySelector('#benchmark-hide-null-values');
let activeBenchmarkLayerId = null;
let selectedBenchmarkColumn = '';
let selectedBenchmarkTransform = benchmarkTransformSelect.value;
let selectedBenchmarkRamp = benchmarkRampSelect.value;
let benchmarkLayerRequest = 0;
const colorRamps = {
	viridis: [
		'#440154', '#482878', '#3e4989', '#31688e', '#26828e',
		'#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725',
	],
	cividis: [
		'#00224e', '#0c3470', '#35456c', '#50576c', '#666970',
		'#7d7c78', '#948e77', '#aea371', '#c8b866', '#e5cf52', '#fee838',
	],
	blues: [
		'#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6',
		'#4292c6', '#2171b5', '#08519c', '#08306b',
	],
	purples: [
		'#fcfbfd', '#efedf5', '#dadaeb', '#bcbddc', '#9e9ac8',
		'#807dba', '#6a51a3', '#54278f', '#3f007d',
	],
	bupu: [
		'#f7fcfd', '#e0ecf4', '#bfd3e6', '#9ebcda', '#8c96c6',
		'#8c6bb1', '#88419d', '#810f7c', '#4d004b',
	],
	pubugn: [
		'#fff7fb', '#ece2f0', '#d0d1e6', '#a6bddb', '#67a9cf',
		'#3690c0', '#02818a', '#016c59', '#014636',
	],
	ylgn: [
		'#ffffe5', '#f7fcb9', '#d9f0a3', '#addd8e', '#78c679',
		'#41ab5d', '#238443', '#006837', '#004529',
	],
	ylorrd: [
		'#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c',
		'#fc4e2a', '#e31a1c', '#bd0026', '#800026',
	],
};
let draggedLayerEntry = null;
let draggedLayerList = null;
let dropTargetEntry = null;
let dropBeforeTarget = true;

function setupLayerAccordion(buttonId, panelId) {
	const button = document.querySelector(buttonId);
	const panel = document.querySelector(panelId);
	button.addEventListener('click', () => {
		const expanded = button.getAttribute('aria-expanded') === 'true';
		button.setAttribute('aria-expanded', String(!expanded));
		panel.hidden = expanded;
	});
}

setupLayerAccordion('#layers-toggle', '#benchmarking-panel');
setupLayerAccordion('#basemap-toggle', '#basemap-panel');
setupLayerAccordion('#other-layers-toggle', '#other-layer-options');
setupLayerAccordion('#bap-layers-toggle', '#bap-layer-options');
setupLayerAccordion('#lnrs-layers-toggle', '#lnrs-layer-options');

benchmarkColourInput.value = benchmarkSharedStyle.color;
benchmarkOpacityInput.value = String(benchmarkSharedStyle.fillOpacity);
benchmarkOpacityValue.value = `${benchmarkSharedStyle.fillOpacity}%`;
benchmarkOpacityValue.textContent = `${benchmarkSharedStyle.fillOpacity}%`;
benchmarkBorderWidthInput.value = String(benchmarkSharedStyle.borderWidth);
benchmarkBorderWidthValue.value = `${benchmarkSharedStyle.borderWidth} px`;
benchmarkBorderWidthValue.textContent = `${benchmarkSharedStyle.borderWidth} px`;

function defaultLayerStyles() {
	return Object.fromEntries(allLayers.map(layer => [
		layer.id,
		{ color: layer.color, fillOpacity: defaultFillOpacity },
	]));
}

function loadLayerStyles() {
	const styles = defaultLayerStyles();

	try {
		const storedValue = localStorage.getItem(layerStyleStorageKey);
		if (storedValue === null) return styles;

		const storedStyles = JSON.parse(storedValue);
		if (!storedStyles || typeof storedStyles !== 'object' || Array.isArray(storedStyles)) {
			throw new Error('Saved layer styles are not an object.');
		}

		for (const layer of allLayers) {
			const storedStyle = storedStyles[layer.id];
			if (storedStyle === undefined) continue;
			if (
				!storedStyle
				|| typeof storedStyle !== 'object'
				|| !/^#[\da-f]{6}$/i.test(storedStyle.color)
				|| !Number.isInteger(storedStyle.fillOpacity)
				|| storedStyle.fillOpacity < 0
				|| storedStyle.fillOpacity > 100
			) {
				throw new Error(`Saved style for "${layer.name}" is invalid.`);
			}

			styles[layer.id] = {
				color: storedStyle.color,
				fillOpacity: storedStyle.fillOpacity,
			};
		}
	} catch (error) {
		console.error('Unable to load saved layer styles:', error);
		mapStatus.textContent = 'Unable to load saved layer styles. Using defaults.';
	}

	return styles;
}

function loadBenchmarkSharedStyle() {
	const defaultStyle = {
		...layerStyles.bhs,
		borderWidth: defaultBenchmarkBorderWidth,
	};

	try {
		const storedValue = localStorage.getItem(benchmarkSharedStyleStorageKey);
		if (storedValue === null) return defaultStyle;

		const storedStyle = JSON.parse(storedValue);
		const borderWidth = storedStyle?.borderWidth === undefined
			? defaultBenchmarkBorderWidth
			: storedStyle.borderWidth;
		if (
			!storedStyle
			|| typeof storedStyle !== 'object'
			|| !/^#[\da-f]{6}$/i.test(storedStyle.color)
			|| !Number.isInteger(storedStyle.fillOpacity)
			|| storedStyle.fillOpacity < 0
			|| storedStyle.fillOpacity > 100
			|| !Number.isFinite(borderWidth)
			|| borderWidth < 0
			|| borderWidth > maximumBenchmarkBorderWidth
		) {
			throw new Error('Saved shared benchmarking style is invalid.');
		}

		return { color: storedStyle.color, fillOpacity: storedStyle.fillOpacity, borderWidth };
	} catch (error) {
		console.error('Unable to load saved benchmarking style:', error);
		mapStatus.textContent = 'Unable to load saved benchmarking style. Using defaults.';
		return defaultStyle;
	}
}

function saveLayerStyles() {
	try {
		localStorage.setItem(layerStyleStorageKey, JSON.stringify(layerStyles));
	} catch (error) {
		console.error('Unable to save layer styles:', error);
		mapStatus.textContent = 'Unable to save layer styles in this browser.';
	}
}

function saveBenchmarkSharedStyle() {
	try {
		localStorage.setItem(benchmarkSharedStyleStorageKey, JSON.stringify(benchmarkSharedStyle));
	} catch (error) {
		console.error('Unable to save benchmarking style:', error);
		mapStatus.textContent = 'Unable to save benchmarking style in this browser.';
	}
}

function defaultBenchmarkOptions() {
	return {
		layerId: null,
		column: '',
		transform: benchmarkTransformSelect.value,
		ramp: benchmarkRampSelect.value,
		hideNullValues: false,
	};
}

function loadBenchmarkOptions() {
	try {
		const storedValue = localStorage.getItem(benchmarkOptionsStorageKey);
		if (storedValue === null) return defaultBenchmarkOptions();

		const options = JSON.parse(storedValue);
		const validTransforms = new Set(
			[...benchmarkTransformSelect.options].map(option => option.value),
		);
		if (
			!options
			|| typeof options !== 'object'
			|| Array.isArray(options)
			|| (options.layerId !== null && !benchmarkingLayerIds.has(options.layerId))
			|| typeof options.column !== 'string'
			|| !validTransforms.has(options.transform)
			|| !Object.prototype.hasOwnProperty.call(colorRamps, options.ramp)
			|| typeof options.hideNullValues !== 'boolean'
		) {
			throw new Error('Saved benchmarking options are invalid.');
		}

		return options;
	} catch (error) {
		console.error('Unable to load saved benchmarking options:', error);
		mapStatus.textContent = 'Unable to load saved benchmarking options. Using defaults.';
		return defaultBenchmarkOptions();
	}
}

function saveBenchmarkOptions() {
	try {
		localStorage.setItem(benchmarkOptionsStorageKey, JSON.stringify({
			layerId: activeBenchmarkLayerId,
			column: selectedBenchmarkColumn,
			transform: selectedBenchmarkTransform,
			ramp: selectedBenchmarkRamp,
			hideNullValues: benchmarkHideNullValuesControl.checked,
		}));
	} catch (error) {
		console.error('Unable to save benchmarking options:', error);
		mapStatus.textContent = 'Unable to save benchmarking options in this browser.';
	}
}

function ensureVectorMap() {
	if (!vectorLayer) {
		vectorLayer = maplibreGL({
			pane: 'overlayPane',
			canvasContextAttributes: { preserveDrawingBuffer: true },
			style: { version: 8, sources: {}, layers: [] },
		});
		vectorLayer.addTo(map);
		vectorMap = vectorLayer.getMaplibreMap();
		vectorMapReady = new Promise(resolve => {
			if (vectorMap.isStyleLoaded()) {
				resolve();
			} else {
				vectorMap.once('load', resolve);
			}
		});
		vectorMap.on('error', event => {
			const failedLayer = allLayers.find(layer => event.sourceId === `${layer.id}-source`);
			if (!failedLayer) {
				console.error('MapLibre overlay error:', event.error);
				mapStatus.textContent = 'Unable to load vector tiles. Check the local server and PMTiles files.';
				return;
			}
			console.error(`Map layer "${failedLayer.name}" failed to load:`, event.error);
			mapStatus.textContent = `Unable to load ${failedLayer.name}. Check the local server and PMTiles file.`;
			finishLayerLoad(failedLayer.id, pendingLayerLoads.get(failedLayer.id)?.request);
		});
		vectorMap.on('sourcedata', event => {
			if (event.sourceDataType !== 'content' || !event.isSourceLoaded) return;
			const layer = allLayers.find(candidate => event.sourceId === `${candidate.id}-source`);
			const pendingLoad = layer && pendingLayerLoads.get(layer.id);
			if (pendingLoad?.waitingForSource) finishLayerLoad(layer.id, pendingLoad.request);
		});
		vectorMap.on('idle', finishLoadedLayerSources);
	}

	return vectorMapReady;
}

function addMapLayer(layer) {
	const style = makeLayerStyle(layer);
	const sourceId = `${layer.id}-source`;
	if (vectorMap.getSource(sourceId)) return;

	vectorMap.addSource(sourceId, style.sources[sourceId]);
	for (const mapLayer of style.layers) {
		vectorMap.addLayer(mapLayer);
	}
}

function removeMapLayer(layer) {
	const sourceId = `${layer.id}-source`;
	if (highlightedFeatureSourceId === sourceId) clearFeatureHighlight();

	for (const suffix of ['fill', 'outline']) {
		const layerId = `${layer.id}-${suffix}`;
		if (vectorMap.getLayer(layerId)) vectorMap.removeLayer(layerId);
	}

	if (vectorMap.getSource(sourceId)) vectorMap.removeSource(sourceId);
}

function getFeatureSiteName(layer, properties) {
	const propertyNames = [
		layer.siteProperty,
		'SiteName',
		'SSSI_NAME',
		'GridRef',
		'Site_Name',
		'SITE_NAME',
		'site_name',
		'grid_ref',
		'Name',
		'name',
		'NAME',
	];
	for (const propertyName of propertyNames) {
		if (!propertyName) continue;
		const value = properties[propertyName];
		if (value === null || value === undefined) continue;
		const siteName = String(value).trim();
		if (siteName) return siteName;
	}
	return 'Not available';
}

function invalidateFeaturePopup() {
	featurePopupRequest += 1;
	clearFeatureHighlight();
	map.closePopup();
}

function clearFeatureHighlight() {
	if (vectorMap?.getLayer(featureHighlightLayerId)) {
		vectorMap.removeLayer(featureHighlightLayerId);
	}
	highlightedFeatureSourceId = null;
	if (highlightedFeatureButton) {
		highlightedFeatureButton.textContent = 'Highlight boundary';
		highlightedFeatureButton.setAttribute('aria-pressed', 'false');
		highlightedFeatureButton = null;
	}
}

function getFeatureHighlightFilter(feature) {
	if (feature.id !== undefined && feature.id !== null) {
		return ['==', ['id'], feature.id];
	}

	const propertyFilters = Object.entries(feature.properties ?? {})
		.filter(([, value]) => (
			value === null
			|| ['string', 'number', 'boolean'].includes(typeof value)
		))
		.map(([key, value]) => ['==', ['get', key], value]);
	if (propertyFilters.length === 0) return null;
	return propertyFilters.length === 1 ? propertyFilters[0] : ['all', ...propertyFilters];
}

function highlightFeatureBoundary(layer, feature, button) {
	clearFeatureHighlight();
	const sourceId = `${layer.id}-source`;
	const filter = getFeatureHighlightFilter(feature);
	if (!vectorMap?.getSource(sourceId) || !filter) {
		mapStatus.textContent = `Unable to highlight ${layer.name}; the feature is no longer available.`;
		return;
	}

	try {
		vectorMap.addLayer({
			id: featureHighlightLayerId,
			type: 'line',
			source: sourceId,
			'source-layer': layer.sourceLayer ?? layer.id,
			filter,
			paint: {
				'line-color': '#fff200',
				'line-width': ['interpolate', ['linear'], ['zoom'], 0, 2, 14, 5],
				'line-opacity': 1,
			},
		});
		highlightedFeatureSourceId = sourceId;
		highlightedFeatureButton = button;
		button.textContent = 'Boundary highlighted';
		button.setAttribute('aria-pressed', 'true');
	} catch (error) {
		console.error(`Unable to highlight feature in "${layer.name}":`, error);
		mapStatus.textContent = `Unable to highlight a feature in ${layer.name}.`;
	}
}

function makeFeaturePopupDraggable(popup, content) {
	const dragHandle = content.querySelector('.map-feature-popup-drag-handle');
	if (!dragHandle) return;

	dragHandle.addEventListener('pointerdown', event => {
		if (event.button !== 0) return;
		event.preventDefault();
		event.stopPropagation();

		const pointerId = event.pointerId;
		const startX = event.clientX;
		const startY = event.clientY;
		const startPoint = map.latLngToContainerPoint(popup.getLatLng());
		const wasDraggingEnabled = map.dragging.enabled();
		const originalAutoPan = popup.options.autoPan;
		dragHandle.setPointerCapture(pointerId);
		map.dragging.disable();
		popup.options.autoPan = false;

		const onPointerMove = moveEvent => {
			if (moveEvent.pointerId !== pointerId) return;
			const point = startPoint.add([
				moveEvent.clientX - startX,
				moveEvent.clientY - startY,
			]);
			popup.setLatLng(map.containerPointToLatLng(point));
		};
		const finishDragging = finishEvent => {
			if (finishEvent.pointerId !== pointerId) return;
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('pointerup', finishDragging);
			window.removeEventListener('pointercancel', finishDragging);
			popup.options.autoPan = originalAutoPan;
			if (wasDraggingEnabled) map.dragging.enable();
		};

		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup', finishDragging);
		window.addEventListener('pointercancel', finishDragging);
	});

	L.DomEvent.disableClickPropagation(dragHandle);
}

function appendFeaturePopupRow(content, label, value) {
	const row = document.createElement('p');
	row.className = 'map-feature-popup-row';
	const labelElement = document.createElement('strong');
	labelElement.textContent = `${label}: `;
	row.append(labelElement, document.createTextNode(String(value)));
	content.append(row);
}

function formatFeatureAttribute(value) {
	if (value === null) return 'null';
	if (typeof value === 'object') return JSON.stringify(value);
	return String(value);
}

function appendFeatureAttributes(content, layer, feature) {
	const section = document.createElement('section');
	section.className = 'map-feature-popup-section';
	const heading = document.createElement('h3');
	heading.textContent = layer.name;
	section.append(heading);

	const highlightButton = document.createElement('button');
	highlightButton.className = 'map-feature-highlight-button';
	highlightButton.type = 'button';
	highlightButton.textContent = 'Highlight boundary';
	highlightButton.setAttribute('aria-pressed', 'false');
	highlightButton.addEventListener('click', event => {
		event.stopPropagation();
		highlightFeatureBoundary(layer, feature, highlightButton);
	});
	section.append(highlightButton);

	const properties = feature.properties ?? {};
	const entries = Object.entries(properties);
	if (entries.length === 0) {
		const emptyMessage = document.createElement('p');
		emptyMessage.textContent = 'No attributes available.';
		section.append(emptyMessage);
	} else {
		for (const [label, value] of entries) {
			appendFeaturePopupRow(section, label, formatFeatureAttribute(value));
		}
	}

	content.append(section);
}

async function handleVectorFeatureClick(event) {
	clearFeatureHighlight();
	const queryableLayerIds = allLayers.flatMap(layer => {
		const suffixes = attributePopupLayerIds.has(layer.id)
			? ['fill']
			: ['fill', 'outline'];
		return suffixes
			.map(suffix => `${layer.id}-${suffix}`)
			.filter(layerId => vectorMap.getLayer(layerId));
	});
	if (queryableLayerIds.length === 0) return;

	const features = vectorMap.queryRenderedFeatures(
		vectorMap.project([event.latlng.lng, event.latlng.lat]),
		{
			layers: queryableLayerIds,
		},
	);
	const feature = features[0];
	if (!feature) {
		invalidateFeaturePopup();
		return;
	}

	const layer = allLayers.find(candidate => (
		feature.layer.id === `${candidate.id}-fill`
		|| feature.layer.id === `${candidate.id}-outline`
	));
	if (!layer) return;

	const request = ++featurePopupRequest;
	if (attributePopupLayerIds.has(layer.id)) {
		const content = document.createElement('div');
		content.className = 'map-feature-popup';
		const dragHandle = document.createElement('div');
		dragHandle.className = 'map-feature-popup-drag-handle';
		dragHandle.textContent = 'Feature information · drag to move';
		dragHandle.title = 'Drag to move this information box';
		content.append(dragHandle);
		for (const candidate of features) {
			const candidateLayer = allLayers.find(item => (
				candidate.layer.id === `${item.id}-fill`
				|| candidate.layer.id === `${item.id}-outline`
			));
			if (!candidateLayer || !attributePopupLayerIds.has(candidateLayer.id)) continue;
			appendFeatureAttributes(content, candidateLayer, candidate);
		}

		if (request !== featurePopupRequest) return;
		L.DomEvent.disableClickPropagation(content);
		const popup = L.popup()
			.setLatLng(event.latlng)
			.setContent(content);
		makeFeaturePopupDraggable(popup, content);
		popup.openOn(map);
		return;
	}

	const properties = feature.properties ?? {};
	const siteName = getFeatureSiteName(layer, properties);
	const siteKey = layer.siteProperty && properties[layer.siteProperty] !== undefined
		? String(properties[layer.siteProperty]).trim()
		: '';
	const metricColumn = benchmarkingLayerIds.has(layer.id)
		&& activeBenchmarkLayerId === layer.id
		? selectedBenchmarkColumn
		: '';
	let metricValue = '';

	if (metricColumn) {
		try {
			const { rows } = await loadBenchmarkCsv(layer);
			const metricRow = rows.find(row => row.site.trim() === siteKey);
			metricValue = metricRow?.[metricColumn]?.trim() || 'No data';
		} catch (error) {
			console.error(`Unable to load popup metric for "${layer.name}":`, error);
			mapStatus.textContent = `Unable to load ${metricColumn} for ${layer.name}.`;
			metricValue = 'Unable to load';
		}
	}

	if (request !== featurePopupRequest) return;
	const content = document.createElement('div');
	content.className = 'map-feature-popup';
	appendFeaturePopupRow(content, 'Layer', layer.name);
	appendFeaturePopupRow(content, 'Site', siteName);
	if (metricColumn) appendFeaturePopupRow(content, metricColumn, metricValue);

	L.popup()
		.setLatLng(event.latlng)
		.setContent(content)
		.openOn(map);
}

function getLayerStyle(layer) {
	return benchmarkingLayerIds.has(layer.id) ? benchmarkSharedStyle : layerStyles[layer.id];
}

function getBenchmarkSiteFilter(layer) {
	const sites = benchmarkMetricSites.get(layer.id);
	if (!benchmarkHideNullValuesControl.checked || !selectedBenchmarkColumn || !sites) return null;
	return ['in', ['get', layer.siteProperty], ['literal', [...sites]]];
}

function updateBenchmarkNullValueFilter(layer) {
	if (!vectorMap) return;

	const filter = getBenchmarkSiteFilter(layer);
	for (const suffix of ['fill', 'outline']) {
		const layerId = `${layer.id}-${suffix}`;
		if (vectorMap.getLayer(layerId)) vectorMap.setFilter(layerId, filter);
	}
}

function updateMapLayerStyle(layer) {
	if (!vectorMap) return;

	const style = getLayerStyle(layer);
	const fillColor = benchmarkColorExpressions.get(layer.id) ?? style.color;
	const outlineColor = benchmarkingLayerIds.has(layer.id) ? benchmarkBorderColor : style.color;
	const fillId = `${layer.id}-fill`;
	const outlineId = `${layer.id}-outline`;
	if (vectorMap.getLayer(fillId)) {
		vectorMap.setPaintProperty(fillId, 'fill-color', fillColor);
		vectorMap.setPaintProperty(fillId, 'fill-opacity', style.fillOpacity / 100);
	}
	if (vectorMap.getLayer(outlineId)) {
		vectorMap.setPaintProperty(outlineId, 'line-color', outlineColor);
		if (benchmarkingLayerIds.has(layer.id)) {
			vectorMap.setPaintProperty(outlineId, 'line-width', style.borderWidth);
			vectorMap.setPaintProperty(outlineId, 'line-opacity', 1);
		}
	}
}

async function reorderMapLayers() {
	if (!vectorLayer) return;
	await vectorMapReady;

	const orderedIds = [
		...benchmarkingLayerOptions.querySelectorAll('.layer-entry'),
		...otherLayerOptions.querySelectorAll('.layer-entry'),
		...bapLayerOptions.querySelectorAll('.layer-entry'),
		...lnrsLayerOptions.querySelectorAll('.layer-entry'),
	]
		.map(entry => entry.dataset.layerId);
	for (const layerId of orderedIds.reverse()) {
		for (const suffix of ['fill', 'outline']) {
			const mapLayerId = `${layerId}-${suffix}`;
			if (vectorMap.getLayer(mapLayerId)) vectorMap.moveLayer(mapLayerId);
		}
	}
	if (vectorMap.getLayer(featureHighlightLayerId)) {
		vectorMap.moveLayer(featureHighlightLayerId);
	}
}

async function syncMapLayer(layer, checkbox) {
	const loadRequest = checkbox.checked ? beginLayerLoad(layer) : null;
	if (!checkbox.checked) cancelLayerLoad(layer.id);

	try {
		if (checkbox.checked) {
			await ensureVectorMap();
			if (checkbox.checked) {
				addMapLayer(layer);
				waitForLayerSource(layer, loadRequest);
				await reorderMapLayers();
			} else finishLayerLoad(layer.id, loadRequest);
		} else if (vectorLayer) {
			await vectorMapReady;
			if (!checkbox.checked) removeMapLayer(layer);
		}
	} catch (error) {
		console.error(`Unable to update map layer "${layer.name}":`, error);
		mapStatus.textContent = `Unable to load ${layer.name}. Check the local server and PMTiles file.`;
		if (loadRequest !== null) finishLayerLoad(layer.id, loadRequest);
	}
}

function waitForMapEvent(target, eventName, errorMessage) {
	return new Promise((resolve, reject) => {
		const timeoutId = window.setTimeout(() => {
			target.off(eventName, onEvent);
			reject(new Error(errorMessage));
		}, 15000);
		function onEvent() {
			window.clearTimeout(timeoutId);
			resolve();
		}
		target.once(eventName, onEvent);
	});
}

async function waitForMapRender() {
	if (activeBasemap.isLoading()) {
		await waitForMapEvent(activeBasemap, 'load', 'Basemap tiles did not finish loading.');
	}
	if (vectorMap) {
		await vectorMapReady;
		if (!vectorMap.areTilesLoaded()) {
			await waitForMapEvent(vectorMap, 'idle', 'Vector map tiles did not finish loading.');
		}
	}
	await new Promise(resolve => {
		window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
	});
}

async function drawMapOverlay(context, element, mapBounds, pixelRatio) {
	const styles = window.getComputedStyle(element);
	if (element.hidden || styles.display === 'none' || styles.visibility === 'hidden') return;
	const bounds = element.getBoundingClientRect();
	if (bounds.width === 0 || bounds.height === 0) return;
	const overlay = await html2canvas(element, {
		allowTaint: false,
		backgroundColor: null,
		imageTimeout: 15000,
		logging: false,
		scale: pixelRatio,
		useCORS: true,
	});
	context.drawImage(
		overlay,
		(bounds.left - mapBounds.left) * pixelRatio,
		(bounds.top - mapBounds.top) * pixelRatio,
		bounds.width * pixelRatio,
		bounds.height * pixelRatio,
	);
}

async function downloadMapImage() {
	downloadMapButton.disabled = true;
	downloadMapButton.textContent = 'Preparing...';
	mapStatus.textContent = 'Preparing map image...';
	try {
		await waitForMapRender();
		const mapShell = document.querySelector('.map-shell');
		const mapElement = document.querySelector('#map');
		const tileContainer = activeBasemap.getContainer();
		if (!mapShell || !mapElement || !tileContainer) throw new Error('Map container is unavailable.');

		const mapBounds = mapShell.getBoundingClientRect();
		const pixelRatio = window.devicePixelRatio || 1;
		const canvas = document.createElement('canvas');
		canvas.width = Math.round(mapBounds.width * pixelRatio);
		canvas.height = Math.round(mapBounds.height * pixelRatio);
		const context = canvas.getContext('2d', { willReadFrequently: basemapGreyscaleControl.checked });
		if (!context || canvas.width === 0 || canvas.height === 0) {
			throw new Error('Map image canvas could not be created.');
		}

		context.fillStyle = window.getComputedStyle(mapElement).backgroundColor;
		context.fillRect(0, 0, canvas.width, canvas.height);
		const tiles = [...tileContainer.querySelectorAll('img.leaflet-tile')].filter(tile => (
			tile.complete && tile.naturalWidth > 0
		));
		if (tiles.length === 0) throw new Error('No basemap tiles are available to capture.');

		const parsedLayerOpacity = Number.parseFloat(window.getComputedStyle(tileContainer).opacity);
		const layerOpacity = Number.isFinite(parsedLayerOpacity) ? parsedLayerOpacity : 1;
		for (const tile of tiles) {
			const bounds = tile.getBoundingClientRect();
			if (
				bounds.right <= mapBounds.left
				|| bounds.left >= mapBounds.right
				|| bounds.bottom <= mapBounds.top
				|| bounds.top >= mapBounds.bottom
			) continue;

			let tileSource = tile;
			if (basemapGreyscaleControl.checked) {
				const tileCanvas = document.createElement('canvas');
				tileCanvas.width = tile.naturalWidth;
				tileCanvas.height = tile.naturalHeight;
				const tileContext = tileCanvas.getContext('2d', { willReadFrequently: true });
				if (!tileContext) throw new Error('Basemap tile could not be prepared for greyscale.');
				tileContext.drawImage(tile, 0, 0);
				const pixels = tileContext.getImageData(0, 0, tileCanvas.width, tileCanvas.height);
				for (let index = 0; index < pixels.data.length; index += 4) {
					const grey = Math.round(
						0.2126 * pixels.data[index]
						+ 0.7152 * pixels.data[index + 1]
						+ 0.0722 * pixels.data[index + 2],
					);
					pixels.data[index] = grey;
					pixels.data[index + 1] = grey;
					pixels.data[index + 2] = grey;
				}
				tileContext.putImageData(pixels, 0, 0);
				tileSource = tileCanvas;
			}

			const parsedTileOpacity = Number.parseFloat(window.getComputedStyle(tile).opacity);
			const tileOpacity = Number.isFinite(parsedTileOpacity) ? parsedTileOpacity : 1;
			context.globalAlpha = layerOpacity * tileOpacity;
			context.drawImage(
				tileSource,
				(bounds.left - mapBounds.left) * pixelRatio,
				(bounds.top - mapBounds.top) * pixelRatio,
				bounds.width * pixelRatio,
				bounds.height * pixelRatio,
			);
		}
		context.globalAlpha = 1;

		const vectorCanvas = vectorMap?.getCanvas();
		if (vectorCanvas) {
			const bounds = vectorCanvas.getBoundingClientRect();
			let vectorOpacity = 1;
			for (let element = vectorCanvas; element && element !== mapElement; element = element.parentElement) {
				const opacity = Number.parseFloat(window.getComputedStyle(element).opacity);
				vectorOpacity *= Number.isFinite(opacity) ? opacity : 1;
			}
			context.globalAlpha = vectorOpacity;
			context.drawImage(
				vectorCanvas,
				(bounds.left - mapBounds.left) * pixelRatio,
				(bounds.top - mapBounds.top) * pixelRatio,
				bounds.width * pixelRatio,
				bounds.height * pixelRatio,
			);
			context.globalAlpha = 1;
		}

		await drawMapOverlay(context, document.querySelector('#coordinates'), mapBounds, pixelRatio);
		await drawMapOverlay(context, benchmarkLegend, mapBounds, pixelRatio);
		for (const control of mapElement.querySelectorAll('.leaflet-control')) {
			await drawMapOverlay(context, control, mapBounds, pixelRatio);
		}

		const image = await new Promise((resolve, reject) => {
			canvas.toBlob(blob => {
				if (blob) resolve(blob);
				else reject(new Error('Map image could not be encoded.'));
			}, 'image/png');
		});
		const imageUrl = URL.createObjectURL(image);
		const downloadLink = document.createElement('a');
		downloadLink.href = imageUrl;
		downloadLink.download = `lern-bhs-map-${new Date().toISOString().slice(0, 10)}.png`;
		document.body.append(downloadLink);
		downloadLink.click();
		window.setTimeout(() => {
			downloadLink.remove();
			URL.revokeObjectURL(imageUrl);
		}, 1000);
		mapStatus.textContent = 'Map image downloaded.';
	} catch (error) {
		console.error('Unable to download map image:', error);
		mapStatus.textContent = 'Unable to download map image. Check that the map tiles have loaded, then try again.';
	} finally {
		downloadMapButton.disabled = false;
		downloadMapButton.textContent = 'Download';
	}
}

function makeLayerStyle(layer) {
	const sourceId = `${layer.id}-source`;
	const sourceUrl = new URL(`./data/${layer.file}`, window.location.href).href;
	const style = getLayerStyle(layer);
	const fillColor = benchmarkColorExpressions.get(layer.id) ?? style.color;
	const outlineColor = benchmarkingLayerIds.has(layer.id) ? benchmarkBorderColor : style.color;
	const siteFilter = getBenchmarkSiteFilter(layer);
	return {
		version: 8,
		sources: {
			[sourceId]: {
				type: 'vector',
				url: `pmtiles://${sourceUrl}`,
			},
		},
		layers: [
			{
				id: `${layer.id}-fill`,
				type: 'fill',
				source: sourceId,
				'source-layer': layer.sourceLayer ?? layer.id,
				...(siteFilter ? { filter: siteFilter } : {}),
				paint: {
					'fill-color': fillColor,
					'fill-opacity': style.fillOpacity / 100,
				},
			},
			{
				id: `${layer.id}-outline`,
				type: 'line',
				source: sourceId,
				'source-layer': layer.sourceLayer ?? layer.id,
				...(siteFilter ? { filter: siteFilter } : {}),
				paint: {
					'line-color': outlineColor,
					'line-width': benchmarkingLayerIds.has(layer.id) ? style.borderWidth : 1.4,
					'line-opacity': benchmarkingLayerIds.has(layer.id) ? 1 : 0.92,
				},
			},
		],
	};
}

function updateSelectedCounts() {
	selectedCount.textContent = String(
		benchmarkingLayers.filter(layer => selectedLayers.has(layer.id)).length,
	);
	otherSelectedCount.textContent = String(
		otherLayers.filter(layer => selectedLayers.has(layer.id)).length,
	);
	bapSelectedCount.textContent = String(
		bapLayers.filter(layer => selectedLayers.has(layer.id)).length,
	);
	lnrsSelectedCount.textContent = String(
		lnrsLayers.filter(layer => selectedLayers.has(layer.id)).length,
	);
}

function parseCsv(csvText) {
	const text = csvText.replace(/^\uFEFF/, '');
	const records = [];
	let record = [];
	let field = '';
	let inQuotes = false;

	for (let index = 0; index < text.length; index += 1) {
		const character = text[index];
		if (inQuotes) {
			if (character === '"' && text[index + 1] === '"') {
				field += '"';
				index += 1;
			} else if (character === '"') {
				inQuotes = false;
			} else {
				field += character;
			}
		} else if (character === '"' && field.length === 0) {
			inQuotes = true;
		} else if (character === ',') {
			record.push(field);
			field = '';
		} else if (character === '\r' || character === '\n') {
			record.push(field);
			records.push(record);
			record = [];
			field = '';
			if (character === '\r' && text[index + 1] === '\n') index += 1;
		} else {
			field += character;
		}
	}

	if (inQuotes) throw new Error('The CSV contains an unterminated quoted field.');
	if (field.length > 0 || record.length > 0) {
		record.push(field);
		records.push(record);
	}

	const headers = records.shift()?.map(header => header.trim()) ?? [];
	if (!headers.includes('site')) throw new Error('The CSV does not contain a "site" column.');
	const rows = records
		.filter(values => values.some(value => value.trim() !== ''))
		.map(values => Object.fromEntries(
			headers.map((header, index) => [header, values[index] ?? '']),
		));
	return { headers, rows };
}

function loadBenchmarkCsv(layer) {
	if (!benchmarkCsvPromises.has(layer.id)) {
		const csvUrl = new URL(
			`./data/benchmarking/${layer.statisticsCsv}`,
			window.location.href,
		);
		benchmarkCsvPromises.set(layer.id, fetch(csvUrl).then(response => {
			if (!response.ok) {
				throw new Error(`Request failed with status ${response.status}`);
			}
			return response.text();
		}).then(parseCsv));
	}
	return benchmarkCsvPromises.get(layer.id);
}

function restoreBenchmarkOptions(columns) {
	const options = loadBenchmarkOptions();
	selectedBenchmarkTransform = options.transform;
	benchmarkTransformSelect.value = options.transform;
	selectedBenchmarkRamp = options.ramp;
	benchmarkRampSelect.value = options.ramp;
	benchmarkHideNullValuesControl.checked = options.hideNullValues;

	selectedBenchmarkColumn = columns.includes(options.column) ? options.column : '';
	benchmarkColumnSelect.value = selectedBenchmarkColumn;
	if (options.column && !selectedBenchmarkColumn) {
		console.warn(`Saved benchmarking column "${options.column}" is unavailable.`);
		mapStatus.textContent = 'Saved benchmarking column is unavailable. Using no selected column.';
	}

	let layerId = options.layerId;
	const layerRadio = layerId ? document.querySelector(`#layer-${layerId}`) : null;
	if (layerId && !layerRadio) {
		console.error(`Saved benchmarking layer "${layerId}" has no matching control.`);
		mapStatus.textContent = 'Unable to restore the saved benchmarking layer.';
		layerId = null;
	}
	if (layerRadio && layerId) layerRadio.checked = true;
	else document.querySelector('#benchmarking-none').checked = true;
	selectBenchmarkLayer(layerId);
}

async function populateBenchmarkColumns() {
	try {
		const tetradsLayer = benchmarkingLayers.find(layer => layer.id === 'tetrads');
		if (!tetradsLayer) throw new Error('The Tetrads benchmarking layer is not configured.');

		const { headers } = await loadBenchmarkCsv(tetradsLayer);
		const columns = headers.filter(column => column !== 'site');
		if (columns.length === 0) throw new Error('The CSV contains no statistic columns.');

		benchmarkColumnSelect.replaceChildren(new Option('None selected', ''));
		for (const column of columns) benchmarkColumnSelect.add(new Option(column, column));
		benchmarkColumnSelect.disabled = false;
		restoreBenchmarkOptions(columns);
	} catch (error) {
		console.error('Unable to load shared benchmarking columns:', error);
		mapStatus.textContent = 'Unable to load benchmarking columns.';
		benchmarkColumnSelect.replaceChildren(new Option('Unable to load columns', ''));
		benchmarkColumnSelect.disabled = true;
	}
}

function colorRamp(value, minimum, maximum, rampName) {
	const stops = colorRamps[rampName];
	if (!stops) throw new Error(`Unknown benchmarking colour ramp "${rampName}".`);

	const normalized = minimum === maximum
		? 0.5
		: Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)));
	const position = normalized * (stops.length - 1);
	const lowerIndex = Math.floor(position);
	const upperIndex = Math.min(lowerIndex + 1, stops.length - 1);
	const fraction = position - lowerIndex;
	const lower = stops[lowerIndex].slice(1);
	const upper = stops[upperIndex].slice(1);
	const channels = [0, 2, 4].map(offset => {
		const start = Number.parseInt(lower.slice(offset, offset + 2), 16);
		const end = Number.parseInt(upper.slice(offset, offset + 2), 16);
		return Math.round(start + (end - start) * fraction).toString(16).padStart(2, '0');
	});
	return `#${channels.join('')}`;
}

function transformBenchmarkValue(value, transform) {
	switch (transform) {
		case 'none':
			return value;
		case 'sqrt':
			return Math.sqrt(value);
		case 'cbrt':
			return Math.cbrt(value);
		case 'log':
			return Math.log1p(value);
		case 'log10':
			return Math.log10(value + 1);
		default:
			throw new Error(`Unknown benchmarking transform "${transform}".`);
	}
}

async function createBenchmarkColorExpression(layer, column, transform, ramp) {
	const { rows } = await loadBenchmarkCsv(layer);
	const valuesBySite = new Map();
	let minimum = Infinity;
	let maximum = -Infinity;
	let rawMinimum = Infinity;
	let rawMaximum = -Infinity;
	for (const row of rows) {
		const site = row.site.trim();
		const rawValue = row[column].trim();
		if (!site || !rawValue) continue;
		const value = Number(rawValue);
		if (!Number.isFinite(value) || value < 0) continue;
		const transformedValue = transformBenchmarkValue(value, transform);

		valuesBySite.set(site, transformedValue);
		rawMinimum = Math.min(rawMinimum, value);
		rawMaximum = Math.max(rawMaximum, value);
		minimum = Math.min(minimum, transformedValue);
		maximum = Math.max(maximum, transformedValue);
	}
	if (valuesBySite.size === 0) {
		throw new Error(`Column "${column}" contains no numeric site values.`);
	}

	const expression = ['match', ['get', layer.siteProperty]];
	for (const [site, value] of valuesBySite) {
		expression.push(site, colorRamp(value, minimum, maximum, ramp));
	}
	expression.push('rgba(0, 0, 0, 0)');
	return {
		expression,
		sites: [...valuesBySite.keys()],
		minimum: rawMinimum,
		maximum: rawMaximum,
	};
}

function inverseTransformBenchmarkValue(value, transform) {
	switch (transform) {
		case 'none':
			return value;
		case 'sqrt':
			return value ** 2;
		case 'cbrt':
			return value ** 3;
		case 'log':
			return Math.expm1(value);
		case 'log10':
			return (10 ** value) - 1;
		default:
			throw new Error(`Unknown benchmarking transform "${transform}".`);
	}
}

function niceIntegerTickStep(range) {
	const roughStep = range / 10;
	const magnitude = 10 ** Math.floor(Math.log10(roughStep));
	const normalizedStep = roughStep / magnitude;
	const multiplier = normalizedStep <= 1
		? 1
		: normalizedStep <= 2
			? 2
			: normalizedStep <= 5
				? 5
				: 10;
	return Math.max(1, multiplier * magnitude);
}

function getBenchmarkLegendTickValues(minimum, maximum, transform) {
	const firstInteger = Math.ceil(minimum);
	const lastInteger = Math.floor(maximum);
	if (firstInteger > lastInteger) return [...new Set([minimum, maximum])];

	const integerCount = lastInteger - firstInteger + 1;
	if (integerCount <= 21) {
		return Array.from({ length: integerCount }, (_, index) => firstInteger + index);
	}

	const values = [firstInteger];
	if (transform === 'none') {
		const step = niceIntegerTickStep(lastInteger - firstInteger);
		const firstStep = Math.ceil(firstInteger / step) * step;
		for (let value = firstStep; value < lastInteger; value += step) {
			values.push(value);
		}
	} else {
		const transformedMinimum = transformBenchmarkValue(firstInteger, transform);
		const transformedMaximum = transformBenchmarkValue(lastInteger, transform);
		const intervals = 10;
		for (let index = 1; index < intervals; index += 1) {
			const transformedValue = transformedMinimum
				+ ((transformedMaximum - transformedMinimum) * index) / intervals;
			const value = Math.round(inverseTransformBenchmarkValue(transformedValue, transform));
			if (value > values[values.length - 1] && value < lastInteger) values.push(value);
		}
	}
	if (lastInteger > values[values.length - 1]) values.push(lastInteger);
	return values;
}

function formatBenchmarkLegendTick(value) {
	return new Intl.NumberFormat(undefined, {
		maximumFractionDigits: 0,
	}).format(Math.round(value));
}

function hideBenchmarkLegend() {
	benchmarkLegend.hidden = true;
}

function updateBenchmarkLegend(layer, column, minimum, maximum) {
	benchmarkLegend.hidden = false;
	benchmarkLegendTitle.textContent = `${layer.name} · ${column}`;
	benchmarkLegendGradient.style.backgroundImage = `linear-gradient(to right, ${colorRamps[selectedBenchmarkRamp].join(', ')})`;
	benchmarkLegendTicks.replaceChildren();

	const tickValues = getBenchmarkLegendTickValues(
		minimum,
		maximum,
		selectedBenchmarkTransform,
	);
	const transformedMinimum = transformBenchmarkValue(minimum, selectedBenchmarkTransform);
	const transformedMaximum = transformBenchmarkValue(maximum, selectedBenchmarkTransform);
	const gradientWidth = benchmarkLegendGradient.clientWidth;
	const labelMeasure = document.createElement('canvas').getContext('2d');
	if (!labelMeasure) throw new Error('Unable to measure benchmarking legend labels.');
	labelMeasure.font = window.getComputedStyle(benchmarkLegendTicks).font;

	const ticks = tickValues.map(value => {
		const position = minimum === maximum
			? 50
			: (
				(transformBenchmarkValue(value, selectedBenchmarkTransform) - transformedMinimum)
				/ (transformedMaximum - transformedMinimum)
			) * 100;
		const label = formatBenchmarkLegendTick(value);
		return {
			label,
			labelWidth: labelMeasure.measureText(label).width + 2,
			position,
			value,
		};
	});
	const labelBounds = (tick, index) => {
		const x = (tick.position / 100) * gradientWidth;
		if (index === 0 && ticks.length > 1) return { left: x, right: x + tick.labelWidth };
		if (index === ticks.length - 1 && ticks.length > 1) {
			return { left: x - tick.labelWidth, right: x };
		}
		return { left: x - tick.labelWidth / 2, right: x + tick.labelWidth / 2 };
	};
	const visibleLabels = new Set();
	if (ticks.length > 0) {
		visibleLabels.add(0);
		let lastVisibleIndex = 0;
		const finalBounds = labelBounds(ticks[ticks.length - 1], ticks.length - 1);
		for (let index = 1; index < ticks.length - 1; index += 1) {
			const bounds = labelBounds(ticks[index], index);
			const previousBounds = labelBounds(ticks[lastVisibleIndex], lastVisibleIndex);
			if (bounds.left >= previousBounds.right + 2 && bounds.right <= finalBounds.left - 2) {
				visibleLabels.add(index);
				lastVisibleIndex = index;
			}
		}
		if (ticks.length > 1) visibleLabels.add(ticks.length - 1);
	}

	for (const [index, tickValue] of ticks.entries()) {
		const tick = document.createElement('span');
		tick.className = 'benchmark-legend-tick';
		tick.style.left = `${tickValue.position}%`;
		if (ticks.length === 1) tick.classList.add('benchmark-legend-tick--single');
		else if (index === 0) tick.classList.add('benchmark-legend-tick--start');
		else if (index === ticks.length - 1) tick.classList.add('benchmark-legend-tick--end');

		const mark = document.createElement('span');
		mark.className = 'benchmark-legend-tick-mark';
		mark.setAttribute('aria-hidden', 'true');
		tick.append(mark);

		const label = document.createElement('span');
		label.className = 'benchmark-legend-tick-label';
		label.textContent = tickValue.label;
		label.hidden = !visibleLabels.has(index);
		tick.append(label);
		benchmarkLegendTicks.append(tick);
	}
}

async function syncSelectedBenchmarkLayer(request) {
	const layer = benchmarkingLayers.find(candidate => candidate.id === activeBenchmarkLayerId);
	const loadRequest = layer ? beginLayerLoad(layer) : null;
	try {
		if (layer) {
			await ensureVectorMap();
		} else if (vectorLayer) {
			await vectorMapReady;
		}
		if (request !== benchmarkLayerRequest) return;

		hideBenchmarkLegend();
		benchmarkColorExpressions.clear();
		benchmarkMetricSites.clear();
		if (vectorMap) {
			for (const benchmarkLayer of benchmarkingLayers) removeMapLayer(benchmarkLayer);
		}
		if (!layer) {
			if (vectorLayer) await reorderMapLayers();
			return;
		}

		if (selectedBenchmarkColumn) {
			try {
				const { expression, sites, minimum, maximum } = await createBenchmarkColorExpression(
					layer,
					selectedBenchmarkColumn,
					selectedBenchmarkTransform,
					selectedBenchmarkRamp,
				);
				if (request !== benchmarkLayerRequest) return;
				benchmarkColorExpressions.set(layer.id, expression);
				benchmarkMetricSites.set(layer.id, new Set(sites));
				updateBenchmarkLegend(layer, selectedBenchmarkColumn, minimum, maximum);
			} catch (error) {
				if (request !== benchmarkLayerRequest) return;
				hideBenchmarkLegend();
				console.error(`Unable to style "${layer.name}" by "${selectedBenchmarkColumn}":`, error);
				mapStatus.textContent = `Unable to style ${layer.name} by ${selectedBenchmarkColumn}.`;
				selectedBenchmarkColumn = '';
				benchmarkColumnSelect.value = '';
			}
		}

		if (request !== benchmarkLayerRequest) return;
		addMapLayer(layer);
		waitForLayerSource(layer, loadRequest);
		await reorderMapLayers();
	} catch (error) {
		if (request !== benchmarkLayerRequest) return;
		hideBenchmarkLegend();
		console.error('Unable to update the selected benchmarking layer:', error);
		mapStatus.textContent = layer
			? `Unable to load ${layer.name}. Check the local server and PMTiles file.`
			: 'Unable to update the benchmarking layers.';
		if (layer && loadRequest !== null) finishLayerLoad(layer.id, loadRequest);
	}
}

function selectBenchmarkLayer(layerId) {
	invalidateFeaturePopup();
	for (const layer of benchmarkingLayers) cancelLayerLoad(layer.id);
	activeBenchmarkLayerId = layerId;
	for (const layer of benchmarkingLayers) selectedLayers.delete(layer.id);
	if (layerId) selectedLayers.add(layerId);
	updateSelectedCounts();
	hideBenchmarkLegend();
	benchmarkColorExpressions.clear();
	benchmarkLayerRequest += 1;
	saveBenchmarkOptions();
	void syncSelectedBenchmarkLayer(benchmarkLayerRequest);
}

function selectBenchmarkColumn() {
	invalidateFeaturePopup();
	selectedBenchmarkColumn = benchmarkColumnSelect.value;
	hideBenchmarkLegend();
	benchmarkColorExpressions.clear();
	benchmarkLayerRequest += 1;
	saveBenchmarkOptions();
	void syncSelectedBenchmarkLayer(benchmarkLayerRequest);
}

function selectBenchmarkTransform() {
	selectedBenchmarkTransform = benchmarkTransformSelect.value;
	saveBenchmarkOptions();
	if (!selectedBenchmarkColumn) return;
	hideBenchmarkLegend();
	benchmarkColorExpressions.clear();
	benchmarkLayerRequest += 1;
	void syncSelectedBenchmarkLayer(benchmarkLayerRequest);
}

function selectBenchmarkRamp() {
	selectedBenchmarkRamp = benchmarkRampSelect.value;
	saveBenchmarkOptions();
	if (!selectedBenchmarkColumn) return;
	hideBenchmarkLegend();
	benchmarkColorExpressions.clear();
	benchmarkLayerRequest += 1;
	void syncSelectedBenchmarkLayer(benchmarkLayerRequest);
}

benchmarkColumnSelect.addEventListener('change', selectBenchmarkColumn);
benchmarkTransformSelect.addEventListener('change', selectBenchmarkTransform);
benchmarkRampSelect.addEventListener('change', selectBenchmarkRamp);
benchmarkHideNullValuesControl.addEventListener('change', () => {
	saveBenchmarkOptions();
	const layer = benchmarkingLayers.find(candidate => candidate.id === activeBenchmarkLayerId);
	if (layer) updateBenchmarkNullValueFilter(layer);
});
document.querySelector('#benchmarking-none').addEventListener('change', event => {
	if (event.currentTarget.checked) selectBenchmarkLayer(null);
});
benchmarkColourInput.addEventListener('input', () => {
	benchmarkSharedStyle.color = benchmarkColourInput.value;
	const layer = benchmarkingLayers.find(candidate => candidate.id === activeBenchmarkLayerId);
	if (layer) updateMapLayerStyle(layer);
});
benchmarkColourInput.addEventListener('change', saveBenchmarkSharedStyle);
benchmarkOpacityInput.addEventListener('input', () => {
	const fillOpacity = Number(benchmarkOpacityInput.value);
	benchmarkSharedStyle.fillOpacity = fillOpacity;
	benchmarkOpacityValue.value = `${fillOpacity}%`;
	benchmarkOpacityValue.textContent = `${fillOpacity}%`;
	const layer = benchmarkingLayers.find(candidate => candidate.id === activeBenchmarkLayerId);
	if (layer) updateMapLayerStyle(layer);
});
benchmarkOpacityInput.addEventListener('change', saveBenchmarkSharedStyle);
benchmarkBorderWidthInput.addEventListener('input', () => {
	const borderWidth = Number(benchmarkBorderWidthInput.value);
	benchmarkSharedStyle.borderWidth = borderWidth;
	benchmarkBorderWidthValue.value = `${borderWidth.toFixed(1)} px`;
	benchmarkBorderWidthValue.textContent = `${borderWidth.toFixed(1)} px`;
	const layer = benchmarkingLayers.find(candidate => candidate.id === activeBenchmarkLayerId);
	if (layer) updateMapLayerStyle(layer);
});
benchmarkBorderWidthInput.addEventListener('change', saveBenchmarkSharedStyle);
void populateBenchmarkColumns();

function createLayerControl(layer, layerList) {
	const entry = document.createElement('div');
	entry.className = 'layer-entry';
	entry.dataset.layerId = layer.id;

	const row = document.createElement('div');
	row.className = 'layer-row';
	if (benchmarkingLayerIds.has(layer.id)) {
		row.classList.add('benchmark-layer-row');
		row.innerHTML = `<input id="layer-${layer.id}" type="radio" name="benchmarking-layer" value="${layer.id}">`
			+ `<label class="layer-label" for="layer-${layer.id}">${layer.name}</label>`;
		entry.append(row);
		row.querySelector('input').addEventListener('change', event => {
			if (event.currentTarget.checked) selectBenchmarkLayer(layer.id);
		});
		layerList.append(entry);
		return;
	}

	const style = layerStyles[layer.id];
	row.draggable = true;
	row.title = 'Drag to change layer order';
	row.innerHTML = `<input id="layer-${layer.id}" type="checkbox">`
		+ `<button class="layer-swatch-button" type="button" aria-label="Style ${layer.name}" `
		+ `aria-controls="layer-settings-${layer.id}" aria-expanded="false">`
		+ `<span class="layer-swatch" style="--swatch-color:${style.color};--swatch-background:${style.color}20"></span>`
		+ '</button>'
		+ `<label class="layer-label" for="layer-${layer.id}">${layer.name}</label>`;

	const settingsPanel = document.createElement('div');
	settingsPanel.id = `layer-settings-${layer.id}`;
	settingsPanel.className = 'layer-settings';
	settingsPanel.hidden = true;
	settingsPanel.innerHTML = '<label class="layer-style-control">'
		+ '<span>Colour</span>'
		+ `<input class="layer-colour-input" type="color" value="${style.color}">`
		+ '</label>'
		+ '<label class="layer-style-control">'
		+ `<span>Fill opacity <output class="layer-opacity-value">${style.fillOpacity}%</output></span>`
		+ `<input class="layer-opacity-input" type="range" min="0" max="100" step="1" value="${style.fillOpacity}">`
		+ '</label>';

	entry.append(row, settingsPanel);

	let rowDragAllowed = true;
	row.addEventListener('pointerdown', event => {
		rowDragAllowed = !(event.target instanceof Element && event.target.closest('button, input'));
	});
	row.addEventListener('dragstart', event => {
		if (!rowDragAllowed) {
			event.preventDefault();
			return;
		}
		draggedLayerEntry = entry;
		draggedLayerList = layerList;
		row.classList.add('is-dragging');
		dropTargetEntry = null;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', layer.id);
		}
	});
	row.addEventListener('dragover', event => {
		if (
			!draggedLayerEntry
			|| draggedLayerEntry === entry
			|| draggedLayerList !== layerList
		) return;
		event.preventDefault();
		dropTargetEntry?.querySelector('.layer-row')?.classList.remove('drop-before', 'drop-after');
		dropTargetEntry = entry;
		const bounds = row.getBoundingClientRect();
		dropBeforeTarget = event.clientY < bounds.top + bounds.height / 2;
		row.classList.add(dropBeforeTarget ? 'drop-before' : 'drop-after');
	});
	row.addEventListener('drop', event => {
		if (
			!draggedLayerEntry
			|| draggedLayerEntry === entry
			|| draggedLayerList !== layerList
		) return;
		event.preventDefault();
		layerList.insertBefore(
			draggedLayerEntry,
			dropBeforeTarget ? entry : entry.nextSibling,
		);
	});
	row.addEventListener('dragend', () => {
		row.classList.remove('is-dragging');
		dropTargetEntry?.querySelector('.layer-row')?.classList.remove('drop-before', 'drop-after');
		draggedLayerEntry = null;
		draggedLayerList = null;
		dropTargetEntry = null;
		void reorderMapLayers();
	});

	const styleButton = row.querySelector('.layer-swatch-button');
	styleButton.addEventListener('click', () => {
		const shouldOpen = settingsPanel.hidden;
		for (const list of layerLists) {
			for (const otherEntry of list.querySelectorAll('.layer-entry')) {
				const otherSettingsPanel = otherEntry.querySelector('.layer-settings');
				const otherStyleButton = otherEntry.querySelector('.layer-swatch-button');
				if (!otherSettingsPanel || !otherStyleButton) continue;
				otherSettingsPanel.hidden = true;
				otherStyleButton.setAttribute('aria-expanded', 'false');
			}
		}
		if (shouldOpen) {
			settingsPanel.hidden = false;
			styleButton.setAttribute('aria-expanded', 'true');
		}
	});

	const swatch = styleButton.querySelector('.layer-swatch');
	const colorInput = settingsPanel.querySelector('.layer-colour-input');
	colorInput.addEventListener('input', () => {
		layerStyles[layer.id].color = colorInput.value;
		swatch.style.setProperty('--swatch-color', colorInput.value);
		swatch.style.setProperty('--swatch-background', `${colorInput.value}20`);
		updateMapLayerStyle(layer);
	});
	colorInput.addEventListener('change', saveLayerStyles);

	const opacityInput = settingsPanel.querySelector('.layer-opacity-input');
	const opacityValue = settingsPanel.querySelector('.layer-opacity-value');
	opacityInput.addEventListener('input', () => {
		const fillOpacity = Number(opacityInput.value);
		layerStyles[layer.id].fillOpacity = fillOpacity;
		opacityValue.value = `${fillOpacity}%`;
		opacityValue.textContent = `${fillOpacity}%`;
		updateMapLayerStyle(layer);
	});
	opacityInput.addEventListener('change', saveLayerStyles);

	const checkbox = row.querySelector('input[type="checkbox"]');
	checkbox.addEventListener('change', () => {
		if (checkbox.checked) {
			selectedLayers.add(layer.id);
		} else {
			selectedLayers.delete(layer.id);
		}

		void syncMapLayer(layer, checkbox);
		updateSelectedCounts();
	});

	layerList.append(entry);
}

for (const layer of benchmarkingLayers) {
	createLayerControl(layer, benchmarkingLayerOptions);
}
for (const layer of otherLayers) {
	createLayerControl(layer, otherLayerOptions);
}
for (const layer of bapLayers) {
	createLayerControl(layer, bapLayerOptions);
}
for (const layer of lnrsLayers) {
	createLayerControl(layer, lnrsLayerOptions);
}

const coordinates = document.querySelector('#coordinates');
map.on('mousemove', event => {
	const latitude = Math.abs(event.latlng.lat).toFixed(2);
	const longitude = Math.abs(event.latlng.lng).toFixed(2);
	const northSouth = event.latlng.lat >= 0 ? 'N' : 'S';
	const eastWest = event.latlng.lng >= 0 ? 'E' : 'W';
	coordinates.textContent = `${latitude}° ${northSouth} · ${longitude}° ${eastWest}`;
});

for (const basemap of Object.values(basemaps)) {
	basemap.on('tileerror', () => {
		mapStatus.textContent = 'Basemap tiles could not be reached. Check your internet connection.';
	});
}

downloadMapButton.addEventListener('click', () => void downloadMapImage());
