import sys
import time

from osgeo import gdal, ogr, osr


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def main():
    if len(sys.argv) != 5:
        raise RuntimeError(
            "Usage: bap-extract.py <geodatabase> <boundary-geojson> <output> <layer>"
        )

    gdal.UseExceptions()
    ogr.UseExceptions()
    gdb_path, boundary_path, output_path, layer_name = sys.argv[1:]

    source_ds = gdal.OpenEx(gdb_path, gdal.OF_VECTOR | gdal.OF_READONLY)
    require(source_ds is not None, f"Could not open geodatabase: {gdb_path}")
    source_layer = source_ds.GetLayerByName(layer_name)
    require(source_layer is not None, f"Layer not found: {layer_name}")
    source_srs = source_layer.GetSpatialRef()
    require(source_srs is not None, f"Layer has no CRS: {layer_name}")
    source_srs = source_srs.Clone()
    source_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)

    boundary_ds = gdal.OpenEx(boundary_path, gdal.OF_VECTOR | gdal.OF_READONLY)
    require(boundary_ds is not None, f"Could not open boundary: {boundary_path}")
    boundary_layer = boundary_ds.GetLayer(0)
    require(boundary_layer is not None, "Boundary has no layers.")
    boundary_feature = boundary_layer.GetNextFeature()
    require(boundary_feature is not None, "Boundary has no features.")
    boundary_geometry = boundary_feature.GetGeometryRef()
    require(boundary_geometry is not None, "Boundary feature has no geometry.")
    boundary_srs = boundary_layer.GetSpatialRef()
    require(boundary_srs is not None, "Boundary has no CRS.")
    boundary_srs = boundary_srs.Clone()
    boundary_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)

    to_source = osr.CoordinateTransformation(boundary_srs, source_srs)
    boundary_geometry = boundary_geometry.Clone()
    boundary_geometry.Transform(to_source)
    boundary_geometry.FlattenTo2D()
    source_layer.SetSpatialFilter(boundary_geometry)

    print("Finding candidate features with the geodatabase spatial filter...", flush=True)
    candidate_count = source_layer.GetFeatureCount(1)
    require(candidate_count >= 0, "Could not determine the spatial candidate count.")
    print(f"Checking {candidate_count:,} spatial candidates.", flush=True)

    target_srs = osr.SpatialReference()
    target_srs.ImportFromEPSG(4326)
    target_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    to_target = osr.CoordinateTransformation(source_srs, target_srs)

    driver = ogr.GetDriverByName("GeoJSON")
    require(driver is not None, "GDAL GeoJSON driver is unavailable.")
    output_ds = driver.CreateDataSource(output_path)
    require(output_ds is not None, f"Could not create output: {output_path}")
    output_layer = output_ds.CreateLayer(
        "bap",
        srs=target_srs,
        geom_type=ogr.wkbMultiPolygon,
        options=["RFC7946=YES"],
    )
    require(output_layer is not None, "Could not create the output layer.")

    source_definition = source_layer.GetLayerDefn()
    for field_index in range(source_definition.GetFieldCount()):
        output_layer.CreateField(source_definition.GetFieldDefn(field_index))
    output_definition = output_layer.GetLayerDefn()

    checked = 0
    written = 0
    last_reported_percent = 0
    next_report = 5
    last_report_time = time.monotonic()
    source_layer.ResetReading()

    for feature in source_layer:
        checked += 1
        geometry = feature.GetGeometryRef()
        if geometry is not None:
            test_geometry = geometry
            if not geometry.IsValid():
                test_geometry = geometry.MakeValid()
                require(
                    test_geometry is not None,
                    f"Could not repair geometry for source feature {feature.GetFID()}.",
                )

            if test_geometry.Intersects(boundary_geometry):
                output_feature = ogr.Feature(output_definition)
                output_feature.SetFrom(feature, 1)
                output_geometry = geometry.Clone()
                output_geometry.Transform(to_target)
                output_feature.SetGeometry(output_geometry)
                output_layer.CreateFeature(output_feature)
                output_feature = None
                written += 1

        percent = int(checked * 100 / candidate_count) if candidate_count else 100
        now = time.monotonic()
        if percent >= next_report or now - last_report_time >= 5:
            print(
                f"Progress: {percent}% "
                f"({checked:,}/{candidate_count:,} candidates checked; "
                f"{written:,} intersecting features)",
                flush=True,
            )
            last_reported_percent = percent
            next_report = min(100, (percent // 5 + 1) * 5)
            last_report_time = now

    if last_reported_percent < 100:
        print(
            f"Progress: 100% ({checked:,}/{candidate_count:,} candidates checked; "
            f"{written:,} intersecting features)",
            flush=True,
        )

    output_ds = None
    boundary_ds = None
    source_ds = None
    print(f"Features written: {written:,}", flush=True)


if __name__ == "__main__":
    main()
