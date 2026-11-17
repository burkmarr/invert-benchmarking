
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { parse } from 'csv-parse';
import { createReadStream } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import proj4 from 'proj4';
import RBush from 'rbush';

const dataDefs = {
    tanhub: {
        recs: "E:\\Tanyptera\\benchmarking\\data\\TanHub records\\occurrences-lern-2026-11-17.csv",
        taxa: "E:\\Tanyptera\\benchmarking\\data\\TanHub taxa\\taxa-2026-11-17.csv",
        recsDateFld: "From date",
        recsGrFld: "Grid ref",
        recsLinkFld: "Exact taxon ID",
        taxaLinkFld: "Taxon ID",
        taxaSatsFld: "Pantheon SAT",
        csvColPrefix: "tanhub"
    },
    moth: {
        recs: "E:\\Tanyptera\\benchmarking\\data\\Moth records\\Mapmate_records_final_except_stage-2026-11-05.csv",
        taxa: "E:\\Tanyptera\\benchmarking\\data\\Pantheon\\pantheon-traits-processed.csv",
        recsDateFld: "RecordDate",
        recsGrFld: "OSGridRef",
        recsLinkFld: "Taxon_version_key",
        taxaLinkFld: "tvk",
        taxaSatsFld: "sats",
        csvColPrefix: "moth"
    }
}

const lastNYears = 50;
const currentYear = new Date().getFullYear();
const sites = "E:\\Tanyptera\\benchmarking\\data\\sites\\bhs.geojson";
const siteNameFld = "SiteName";
const reportTxt = "E:\\Tanyptera\\benchmarking\\data\\sat-totals.txt";
const sitesReportCsv = "E:\\Tanyptera\\benchmarking\\data\\sat-sites.csv";
const osgb36Crs = '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs';

function createCsvParser(filePath, requiredColumns) {
    return createReadStream(filePath).pipe(parse({
        bom: true,
        columns: (headers) => {
            for (const column of requiredColumns) {
                if (!headers.includes(column)) {
                    throw new Error(`Column "${column}" not found in ${filePath}`);
                }
            }
            return headers;
        },
        skip_empty_lines: true,
    }));
}

function parseSats(value, filePath, taxonKey) {
    const text = value?.trim();
    if (!text) return [];

    const sats = JSON.parse(text);
    if (!Array.isArray(sats) || !sats.every(sat => typeof sat === 'string')) {
        throw new Error(`Expected a JSON array of SAT names for taxon "${taxonKey}" in ${filePath}`);
    }

    return [...new Set(sats.map(sat => sat.trim()).filter(Boolean))];
}

function parseYear(value) {
    const match = value?.match(/(?:^|[^\d])(\d{4})(?=$|[^\d])/);
    if (!match) return null;

    const year = Number(match[1]);
    return year > 0 ? year : null;
}

function gridRefToWgs84(value) {
    const gridRef = value?.trim().toUpperCase().replace(/\s+/g, '');
    const match = gridRef && /^([A-HJ-Z]{2})(\d{0,10})$/.exec(gridRef);
    if (!match || match[2].length % 2 !== 0) return null;

    const firstLetter = match[1].charCodeAt(0) - 65;
    const secondLetter = match[1].charCodeAt(1) - 65;
    const firstIndex = firstLetter > 7 ? firstLetter - 1 : firstLetter;
    const secondIndex = secondLetter > 7 ? secondLetter - 1 : secondLetter;
    const easting100km = ((firstIndex - 2) % 5) * 5 + (secondIndex % 5);
    const northing100km = 19 - Math.floor(firstIndex / 5) * 5 - Math.floor(secondIndex / 5);
    const digitsPerAxis = match[2].length / 2;
    const scale = 10 ** (5 - digitsPerAxis);
    const easting = easting100km * 100000
        + (Number(match[2].slice(0, digitsPerAxis)) || 0) * scale
        + scale / 2;
    const northing = northing100km * 100000
        + (Number(match[2].slice(digitsPerAxis)) || 0) * scale
        + scale / 2;

    if (easting < 0 || northing < 0) return null;

    const [longitude, latitude] = proj4(osgb36Crs, 'EPSG:4326', [easting, northing]);
    if (
        !Number.isFinite(longitude)
        || !Number.isFinite(latitude)
        || longitude < -180
        || longitude > 180
        || latitude < -90
        || latitude > 90
    ) {
        return null;
    }

    return [longitude, latitude];
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

console.log(`Loading site boundaries from ${sites}`);
const sitesGeoJson = JSON.parse(await readFile(sites, 'utf8'));
if (!Array.isArray(sitesGeoJson.features)) {
    throw new Error(`No feature collection found in ${sites}`);
}

const siteIndex = new RBush();
siteIndex.load(sitesGeoJson.features.map((feature) => {
    if (!['Polygon', 'MultiPolygon'].includes(feature.geometry?.type)) {
        throw new Error(`Unsupported site geometry type: ${feature.geometry?.type}`);
    }
    const siteName = feature.properties?.[siteNameFld]?.trim();
    if (!siteName) {
        throw new Error(`Missing site name field "${siteNameFld}" in ${sites}`);
    }
    return {
        ...getBounds(feature.geometry.coordinates),
        feature,
        siteName,
    };
}));
console.log(`Loaded ${sitesGeoJson.features.length.toLocaleString()} site boundaries`);

const siteCountsByName = new Map();
const siteReportSats = new Set();
function countRecordAtSites(gridRef, sats, taxonKey) {
    for (const sat of sats) siteReportSats.add(sat);

    const point = gridRefToWgs84(gridRef);
    if (!point) return;

    const [longitude, latitude] = point;
    const candidates = siteIndex.search({
        minX: longitude,
        minY: latitude,
        maxX: longitude,
        maxY: latitude,
    });
    const overlappingSiteNames = new Set();
    for (const candidate of candidates) {
        if (booleanPointInPolygon(point, candidate.feature)) {
            overlappingSiteNames.add(candidate.siteName);
        }
    }

    for (const siteName of overlappingSiteNames) {
        const countsBySat = siteCountsByName.get(siteName) ?? new Map();
        for (const sat of sats) {
            const taxa = countsBySat.get(sat) ?? new Set();
            taxa.add(taxonKey);
            countsBySat.set(sat, taxa);
        }
        siteCountsByName.set(siteName, countsBySat);
    }
}

async function countUniqueTaxaBySat(dataDef, group) {
    const startedAt = Date.now();
    const satsByTaxon = new Map();
    console.log(`${group}: loading taxa with SAT values`);
    for await (const record of createCsvParser(dataDef.taxa, [
        dataDef.taxaLinkFld,
        dataDef.taxaSatsFld,
    ])) {
        const taxonKey = record[dataDef.taxaLinkFld]?.trim();
        if (!taxonKey) continue;

        const sats = parseSats(record[dataDef.taxaSatsFld], dataDef.taxa, taxonKey);
        if (sats.length === 0) continue;

        const taxonSats = satsByTaxon.get(taxonKey) ?? new Set();
        for (const sat of sats) taxonSats.add(sat);
        satsByTaxon.set(taxonKey, taxonSats);
    }

    const taxaBySat = new Map();
    const recordCounts = {
        total: 0,
        yearUnparsed: 0,
        tooOld: 0,
        includedWithSat: 0,
        includedWithoutSat: 0,
    };
    console.log(`${group}: processing occurrence records`);
    for await (const record of createCsvParser(dataDef.recs, [
        dataDef.recsDateFld,
        dataDef.recsGrFld,
        dataDef.recsLinkFld,
    ])) {
        recordCounts.total += 1;
        if (recordCounts.total % 100000 === 0) {
            console.log(`${group}: ${recordCounts.total.toLocaleString()} records processed`);
        }
        const year = parseYear(record[dataDef.recsDateFld]);
        if (year === null) {
            recordCounts.yearUnparsed += 1;
            continue;
        }
        if (year < currentYear - lastNYears) {
            recordCounts.tooOld += 1;
            continue;
        }

        const taxonKey = record[dataDef.recsLinkFld]?.trim();
        const sats = taxonKey ? satsByTaxon.get(taxonKey) : undefined;
        if (sats?.size) {
            recordCounts.includedWithSat += 1;
            countRecordAtSites(record[dataDef.recsGrFld], sats, taxonKey);
        } else {
            recordCounts.includedWithoutSat += 1;
        }

        for (const sat of sats ?? []) {
            const taxa = taxaBySat.get(sat) ?? new Set();
            taxa.add(taxonKey);
            taxaBySat.set(sat, taxa);
        }
    }

    console.log(
        `${group}: finished ${recordCounts.total.toLocaleString()} records `
        + `in ${((Date.now() - startedAt) / 1000).toFixed(1)} seconds`,
    );
    return { taxaBySat, recordCounts };
}

function formatReportSection(group, taxaBySat, recordCounts) {
    const lines = [`${group}:`];
    if (recordCounts) {
        lines.push(
            `  Records: ${recordCounts.total}`,
            `  Records ignored (year could not be parsed): ${recordCounts.yearUnparsed}`,
            `  Records ignored (more than ${lastNYears} years before ${currentYear}): ${recordCounts.tooOld}`,
            `  Included records for taxa with a SAT value: ${recordCounts.includedWithSat}`,
            `  Included records for taxa with no SAT value: ${recordCounts.includedWithoutSat}`,
        );
    }

    lines.push('  Unique taxa per SAT:');
    if (taxaBySat.size === 0) {
        lines.push('    No matching taxa with SAT values');
    } else {
        for (const [sat, taxa] of [...taxaBySat].sort(([first], [second]) => first.localeCompare(second))) {
            lines.push(`    ${sat}: ${taxa.size}`);
        }
    }
    return lines.join('\n');
}

const reportSections = [];
const combinedTaxaBySat = new Map();
const combinedRecordCounts = {
    total: 0,
    yearUnparsed: 0,
    tooOld: 0,
    includedWithSat: 0,
    includedWithoutSat: 0,
};
for (const [group, dataDef] of Object.entries(dataDefs)) {
    const { taxaBySat, recordCounts } = await countUniqueTaxaBySat(dataDef, group);
    reportSections.push(formatReportSection(group, taxaBySat, recordCounts));

    for (const countName of Object.keys(combinedRecordCounts)) {
        combinedRecordCounts[countName] += recordCounts[countName];
    }

    for (const [sat, taxa] of taxaBySat) {
        const combinedTaxa = combinedTaxaBySat.get(sat) ?? new Set();
        for (const taxonKey of taxa) combinedTaxa.add(taxonKey);
        combinedTaxaBySat.set(sat, combinedTaxa);
    }
}

reportSections.push(formatReportSection('combined', combinedTaxaBySat, combinedRecordCounts));
const report = `${reportSections.join('\n\n')}\n`;
await writeFile(reportTxt, report, 'utf8');
console.log(report);

function escapeCsv(value) {
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const siteSatNames = [...siteReportSats].sort((first, second) => first.localeCompare(second));
const siteRows = [
    ['site', ...siteSatNames, 'satN', 'satTaxaN'],
    ...[...siteCountsByName]
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([siteName, countsBySat]) => {
            const satCounts = [...countsBySat.values()];
            return [
                siteName,
                ...siteSatNames.map(sat => countsBySat.get(sat)?.size ?? ''),
                satCounts.length,
                satCounts.reduce((total, taxa) => total + taxa.size, 0),
            ];
        }),
];
await writeFile(
    sitesReportCsv,
    `${siteRows.map(row => row.map(escapeCsv).join(',')).join('\n')}\n`,
    'utf8',
);