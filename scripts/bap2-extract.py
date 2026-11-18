import json
import os
import sys

from osgeo import gdal, ogr


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def main():
    if len(sys.argv) != 4:
        raise RuntimeError(
            "Usage: bap2-extract.py <geojson> <output-directory> <habitats-json>"
        )

    gdal.UseExceptions()
    ogr.UseExceptions()
    input_path, output_directory, habitats_json = sys.argv[1:]
    habitats = json.loads(habitats_json)

    source_ds = gdal.OpenEx(input_path, gdal.OF_VECTOR | gdal.OF_READONLY)
    require(source_ds is not None, f"Could not open GeoJSON: {input_path}")
    source_layer = source_ds.GetLayerByName("bap")
    require(source_layer is not None, 'GeoJSON does not contain a "bap" layer.')

    source_definition = source_layer.GetLayerDefn()
    mainhabs_index = source_definition.GetFieldIndex("mainhabs")
    require(mainhabs_index >= 0, 'GeoJSON layer does not contain a "mainhabs" field.')
    driver = ogr.GetDriverByName("GeoJSON")
    require(driver is not None, "GDAL GeoJSON driver is unavailable.")

    output_layers = []
    output_datasets = []
    for index, habitat in enumerate(habitats):
        output_path = os.path.join(
            output_directory, f"habitat-{index:03d}.geojson"
        )
        output_ds = driver.CreateDataSource(output_path)
        require(output_ds is not None, f"Could not create {output_path}")
        output_layer = output_ds.CreateLayer(
            habitat,
            srs=source_layer.GetSpatialRef(),
            geom_type=source_layer.GetGeomType(),
            options=["RFC7946=YES"],
        )
        require(output_layer is not None, f"Could not create layer for {habitat}")
        for field_index in range(source_definition.GetFieldCount()):
            output_layer.CreateField(source_definition.GetFieldDefn(field_index))
        output_datasets.append(output_ds)
        output_layers.append(output_layer)

    habitat_indexes = {habitat: index for index, habitat in enumerate(habitats)}
    feature_count = source_layer.GetFeatureCount()
    matched_count = 0
    next_report = 5

    for feature in source_layer:
        value = feature.GetFieldAsString(mainhabs_index)
        feature_habitats = {
            part.strip() for part in value.split(",") if part.strip()
        }
        geometry = feature.GetGeometryRef()
        if geometry is None:
            continue

        for habitat in feature_habitats:
            index = habitat_indexes.get(habitat)
            if index is None:
                continue
            output_feature = ogr.Feature(output_layers[index].GetLayerDefn())
            output_feature.SetFrom(feature, 1)
            output_layers[index].CreateFeature(output_feature)
            output_feature = None

        matched_count += 1
        percent = int(matched_count * 100 / feature_count) if feature_count else 100
        if percent >= next_report:
            print(
                f"Extracted habitat assignments: {percent}% "
                f"({matched_count:,}/{feature_count:,} features)",
                flush=True,
            )
            next_report = min(100, (percent // 5 + 1) * 5)

    output_datasets.clear()
    source_ds = None
    print(f"Extracted habitat-specific GeoJSON files for {len(habitats)} values.")


if __name__ == "__main__":
    main()
