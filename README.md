# `a1.mjs`

`scripts/a1.mjs` creates two per-site CSV reports for the Sites of Biological
Importance (BHS) polygons in `data/bhs.geojson`. It combines occurrence records
with Pantheon habitat traits and conservation-status data.

## Inputs

The script reads these files from `data/`:

- `bhs.geojson` — BHS boundaries and site properties.
- `irecord-data.csv` — occurrence records, including latitude, longitude, and
  taxon version key.
- `PantheonHabitatTraits_v3.7.4.csv` — SQS scores and specific assemblage
  types (SATs), matched by `SpeciesTVK`.
- `PantheonConservationStatus_v3.7.4-modified.csv` — conservation categories,
  matched by `PreferredTVK`.

Paths are resolved relative to the script, so it can be run from any working
directory.

## Processing

The script loads trait and status values into maps keyed by taxon version key.
It then builds an R-tree spatial index from the bounding boxes of the BHS
polygons. Occurrence records are read as a stream: records with missing or
invalid latitude/longitude values are skipped, and the index narrows down the
candidate polygons before Turf checks whether each point is inside a polygon.

For each BHS, it calculates:

- **Total records** — records with valid coordinates that fall inside the
  boundary.
- **Species richness** — distinct taxon version keys among those records.
- **SQI** — the sum of SQS scores for distinct species in the site; missing
  scores contribute zero.
- **SAT counts** — distinct species in the site for each specific assemblage
  type.
- **Conservation-status counts** — distinct species in the site for each
  reporting-category/designation combination.

SAT and conservation-status columns are generated from the values represented
in the BHS sites and sorted alphabetically. Records inside overlapping BHS
boundaries contribute to each matching site.

## Outputs

The script creates `output/` if needed and writes two CSV files with a shared
timestamp:

- `sats-and-sqi-YYYY-MM-DD-HH-MM-SS.csv` — site details, record totals, species
  richness, SQI, and SAT counts.
- `cons-status-YYYY-MM-DD-HH-MM-SS.csv` — site details, record totals, species
  richness, and conservation-status counts.

Each row represents one BHS feature. Site ID and name use the feature's
`SiteID` and `SiteName` properties when available; hectares are written to one
decimal place.

## Run

Install the project dependencies, then run:

```powershell
npm install
node scripts\a1.mjs
```
