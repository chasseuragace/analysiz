-- Enable PostGIS extension for geospatial functionality
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create the entities table with all necessary columns
CREATE TABLE IF NOT EXISTS entities (
    id SERIAL PRIMARY KEY,
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    geom geometry(Point, 6207),
    geohash text
);

-- Create a function to generate geohash
CREATE OR REPLACE FUNCTION generate_geohash(lat float, lon float, hash_length int)
RETURNS text AS $$
BEGIN
    RETURN ST_GeoHash(ST_SetSRID(ST_MakePoint(lon, lat), 6207), hash_length);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a trigger function to update geom and geohash on insert or update
CREATE OR REPLACE FUNCTION update_geom_and_geohash()
RETURNS TRIGGER AS $$
BEGIN
    NEW.geom = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 6207);
    NEW.geohash = generate_geohash(NEW.latitude, NEW.longitude, 8);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER update_entity_geom_and_geohash
BEFORE INSERT OR UPDATE ON entities
FOR EACH ROW EXECUTE FUNCTION update_geom_and_geohash();

-- Create indexes
CREATE INDEX idx_entities_geom ON entities USING GIST (geom);
CREATE INDEX idx_entities_lat ON entities (latitude);
CREATE INDEX idx_entities_lon ON entities (longitude);
CREATE INDEX idx_entities_lat_lon ON entities (latitude, longitude);
CREATE INDEX idx_entities_geohash ON entities (geohash);

-- Function to generate random coordinates within Bihar
CREATE OR REPLACE FUNCTION random_bihar_coordinate()
RETURNS TABLE(lat DECIMAL(9,6), lon DECIMAL(9,6)) AS $$
BEGIN
    RETURN QUERY SELECT
        (random() * (30.45 - 26.3667) + 26.3667)::DECIMAL(9,6) AS latitude,
        (random() * (88.2 - 80.0667) + 80.0667)::DECIMAL(9,6) AS longitude;
END;
$$ LANGUAGE plpgsql;

-- Insert 5000 random records within Bihar
INSERT INTO entities (latitude, longitude)
SELECT lat, lon
FROM (
    SELECT (random_bihar_coordinate()).* 
    FROM generate_series(1, 5000)
) AS coords;

-- Verify the data
SELECT COUNT(*) FROM entities;
SELECT MIN(latitude), MAX(latitude), MIN(longitude), MAX(longitude) FROM entities;
SELECT id, latitude, longitude, geohash FROM entities LIMIT 5;