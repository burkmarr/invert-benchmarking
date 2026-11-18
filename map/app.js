import * as L from 'leaflet';
import * as maplibregl from 'maplibre-gl';
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import { Protocol } from 'pmtiles';

const protocol = new Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);

const analyticalLayers = [
	{ id: 'bhs', name: 'BHS', file: 'bhs.pmtiles', color: '#18836a' },
	{ id: 'lern', name: 'LERN', file: 'lern.pmtiles', color: '#d07a34' },
	{ id: 'sssi-in-lern', name: 'SSSI in LERN', file: 'sssi-in-lern.pmtiles', color: '#7856a5' },
	{ id: 'sssi', name: 'SSSI', file: 'sssi.pmtiles', color: '#9b4f7c' },
	{ id: 'tetrads', name: 'Tetrads', file: 'tetrads.pmtiles', color: '#3978b8' },
	{ id: 'monads', name: 'Monads', file: 'monads.pmtiles', color: '#bd5260' },
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
const allLayers = [...analyticalLayers, ...bapLayers];

const basemaps = {
	'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		maxZoom: 19,
		className: 'basemap-tile-layer',
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
	}),
	'OpenTopoMap': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
		maxZoom: 17,
		className: 'basemap-tile-layer',
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
let activeBasemap = basemaps['OpenStreetMap'];
activeBasemap.addTo(map);

function updateBasemapGreyscale() {
	const container = activeBasemap.getContainer();
	if (container) {
		container.classList.toggle('basemap-greyscale', basemapGreyscaleControl.checked);
	}
}

updateBasemapGreyscale();
basemapGreyscaleControl.addEventListener('change', updateBasemapGreyscale);

const basemapOptions = document.querySelector('#basemap-options');
for (const [name, layer] of Object.entries(basemaps)) {
	const id = `basemap-${name.toLowerCase().replaceAll(' ', '-')}`;
	const label = document.createElement('label');
	label.className = 'choice-row';
	label.htmlFor = id;
	label.innerHTML = `<input id="${id}" type="radio" name="basemap" ${layer === activeBasemap ? 'checked' : ''}>`
		+ `<span>${name}</span>`;
	label.querySelector('input').addEventListener('change', () => {
		map.removeLayer(activeBasemap);
		activeBasemap = layer;
		activeBasemap.addTo(map);
		updateBasemapGreyscale();
	});
	basemapOptions.append(label);
}

const selectedLayers = new Set();
let vectorLayer;
let vectorMap;
let vectorMapReady;
const layerOptions = document.querySelector('#layer-options');
const bapLayerOptions = document.querySelector('#bap-layer-options');
const layerLists = [layerOptions, bapLayerOptions];
const selectedCount = document.querySelector('#selected-count');
const bapSelectedCount = document.querySelector('#bap-selected-count');
const mapStatus = document.querySelector('#map-status');
const layerStyleStorageKey = 'site-explorer.layer-styles.v1';
const defaultFillOpacity = 60;
const layerStyles = loadLayerStyles();
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

setupLayerAccordion('#layers-toggle', '#layer-options');
setupLayerAccordion('#bap-layers-toggle', '#bap-layer-options');

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

function saveLayerStyles() {
	try {
		localStorage.setItem(layerStyleStorageKey, JSON.stringify(layerStyles));
	} catch (error) {
		console.error('Unable to save layer styles:', error);
		mapStatus.textContent = 'Unable to save layer styles in this browser.';
	}
}

function ensureVectorMap() {
	if (!vectorLayer) {
		vectorLayer = maplibreGL({
			pane: 'overlayPane',
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
		});
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
	for (const suffix of ['fill', 'outline']) {
		const layerId = `${layer.id}-${suffix}`;
		if (vectorMap.getLayer(layerId)) vectorMap.removeLayer(layerId);
	}

	const sourceId = `${layer.id}-source`;
	if (vectorMap.getSource(sourceId)) vectorMap.removeSource(sourceId);
}

function updateMapLayerStyle(layer) {
	if (!vectorMap) return;

	const style = layerStyles[layer.id];
	const fillId = `${layer.id}-fill`;
	const outlineId = `${layer.id}-outline`;
	if (vectorMap.getLayer(fillId)) {
		vectorMap.setPaintProperty(fillId, 'fill-color', style.color);
		vectorMap.setPaintProperty(fillId, 'fill-opacity', style.fillOpacity / 100);
	}
	if (vectorMap.getLayer(outlineId)) {
		vectorMap.setPaintProperty(outlineId, 'line-color', style.color);
	}
}

async function reorderMapLayers() {
	if (!vectorLayer) return;
	await vectorMapReady;

	const orderedIds = [
		...layerOptions.querySelectorAll('.layer-entry'),
		...bapLayerOptions.querySelectorAll('.layer-entry'),
	]
		.map(entry => entry.dataset.layerId);
	for (const layerId of orderedIds.reverse()) {
		for (const suffix of ['fill', 'outline']) {
			const mapLayerId = `${layerId}-${suffix}`;
			if (vectorMap.getLayer(mapLayerId)) vectorMap.moveLayer(mapLayerId);
		}
	}
}

async function syncMapLayer(layer, checkbox) {
	try {
		if (checkbox.checked) {
			await ensureVectorMap();
			if (checkbox.checked) {
				addMapLayer(layer);
				await reorderMapLayers();
			}
		} else if (vectorLayer) {
			await vectorMapReady;
			if (!checkbox.checked) removeMapLayer(layer);
		}
	} catch (error) {
		console.error(`Unable to update map layer "${layer.name}":`, error);
		mapStatus.textContent = `Unable to load ${layer.name}. Check the local server and PMTiles file.`;
	}
}

function makeLayerStyle(layer) {
	const sourceId = `${layer.id}-source`;
	const sourceUrl = new URL(`./data/${layer.file}`, window.location.href).href;
	const style = layerStyles[layer.id];
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
				paint: {
					'fill-color': style.color,
					'fill-opacity': style.fillOpacity / 100,
				},
			},
			{
				id: `${layer.id}-outline`,
				type: 'line',
				source: sourceId,
				'source-layer': layer.id,
				paint: {
					'line-color': style.color,
					'line-width': 1.4,
					'line-opacity': 0.92,
				},
			},
		],
	};
}

function updateSelectedCounts() {
	selectedCount.textContent = String(
		analyticalLayers.filter(layer => selectedLayers.has(layer.id)).length,
	);
	bapSelectedCount.textContent = String(
		bapLayers.filter(layer => selectedLayers.has(layer.id)).length,
	);
}

function createLayerControl(layer, layerList) {
	const style = layerStyles[layer.id];
	const entry = document.createElement('div');
	entry.className = 'layer-entry';
	entry.dataset.layerId = layer.id;

	const row = document.createElement('div');
	row.className = 'layer-row';
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
				otherEntry.querySelector('.layer-settings').hidden = true;
				otherEntry.querySelector('.layer-swatch-button').setAttribute('aria-expanded', 'false');
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

for (const layer of analyticalLayers) {
	createLayerControl(layer, layerOptions);
}
for (const layer of bapLayers) {
	createLayerControl(layer, bapLayerOptions);
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
