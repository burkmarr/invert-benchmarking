# LERN BHS

This desktop-oriented Leaflet app displays the PMTiles archives in `data/` as
selectable vector overlays; multiple overlays can be enabled at once. It uses
MapLibre GL through
`@maplibre/maplibre-gl-leaflet`; OpenStreetMap and OpenTopoMap are available as
basemaps.
The **Greyscale** checkbox applies to whichever basemap is selected.
The selected basemap, greyscale setting, and opacity are saved in browser
storage and restored on the next visit.
Drag the polygon layer rows to change their stacking order; higher rows appear
above lower rows on the map.
Click a layer's colour swatch to change its colour and fill opacity. These
settings are saved in the browser's local storage.
The **Benchmarking layers**, **Other layers**, and **BAP habitats** sections list
PMTiles from `data/bm-layers/`, `data/other/`, and `data/bap/`, respectively.
Only one Benchmarking layer can be displayed at a time; choose **None** to hide
all of them. The Benchmarking section has shared opacity, border thickness
(0-5 px, default 1 px), statistic-column, and default fill-colour controls.
These settings carry over when switching layers. Benchmarking borders are
always black.
Its statistic selector uses the columns from `sat-sites-tetrads.csv` (except
`site`). Choose **None**, **Sqrt**, **Cbrt**, **Log**, or **Log10** to transform
the selected metric before applying the selected **Viridis** or **Cividis**
colour ramp, or a ColorBrewer **Blues**, **Purples**, **BuPu**, **PuBuGn**,
**YlGn**, or **YlOrRd** ramp, to matching polygons. The ColorBrewer ramps use
their nine-class colours as continuous interpolation stops.
**Log** (`ln(value + 1)`) is the default, preserving the previous styling;
**Log10** uses `log10(value + 1)` so zero values remain valid. Polygons without
a numeric match are transparent while their outlines remain visible by
default. A map legend shows the active layer, metric, ramp, and integer
value ticks. Tick positions follow the selected transform, with tick intervals
adapting to the metric range. Check **Hide areas with null values** to hide
unmatched features, including their outlines. Choosing **None selected**
restores the shared solid colour. Other and BAP layers retain their individual
styles and can still be reordered within their sections; each section renders
below the preceding one.
Click a polygon to view its layer and site name. Benchmarking popups also show
the selected metric column and its original, untransformed value.
The selected Benchmarking layer, metric, transform, colour ramp, and
null-value visibility setting are restored from browser storage on the next
visit.
Click a section heading to collapse or expand it.
Use **Recentre** to centre on the LERN boundary, zoomed one level closer than
its fitted extent. **Download** saves the visible map area as a PNG, including
the active basemap styling, vector layers, legend, and map controls.

The app loads overlay tiles on demand. PMTiles needs HTTP byte-range requests,
so do not open `index.html` directly as a `file://` URL. Start the included
development server from the repository root:

```powershell
node map\server.mjs
```

Then open <http://localhost:8080>. The server only binds to localhost and
supports byte-range requests for `.pmtiles` files. The app loads its mapping
libraries from unpkg and its basemap tiles from their respective providers,
so an internet connection is required.

To add another benchmarking layer, put its `.pmtiles` file in `data/bm-layers/`
and add its file, layer name, display name, and default colour to
`benchmarkingLayers` in `app.js`. Add LERN or other boundary layers to
`otherLayers` with files in `data/other/`. To add a BAP habitat, put its archive
in `data/bap/` and add its habitat value to `bapHabitats` and a default colour
to `bapColors`.
