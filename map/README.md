# LERN BHS

This desktop-oriented Leaflet app displays the PMTiles archives in `data/` as
selectable vector overlays; multiple overlays can be enabled at once. It uses
MapLibre GL through
`@maplibre/maplibre-gl-leaflet`; OpenStreetMap and OpenTopoMap are available as
basemaps.
The **Greyscale** checkbox applies to whichever basemap is selected.
Drag the polygon layer rows to change their stacking order; higher rows appear
above lower rows on the map.
Click a layer's colour swatch to change its colour and fill opacity. These
settings are saved in the browser's local storage.
Use the **Recentre** button beside the basemap heading to centre on the LERN
boundary, zoomed one level closer than its fitted extent.

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

To add another overlay, put its `.pmtiles` file in `data/` and add its file,
layer name, display name, and colour to the `siteLayers` list in `app.js`.
