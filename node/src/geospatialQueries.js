const { Pool } = require('pg');
const geohash = require('ngeohash');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function geohashApproach(coordinates, radius) {
  // Adjust geohash precision based on the radius
  let precision;
  if (radius <= 1000) {
    precision = 6; // ~1.2 km x 0.6 km
  } else if (radius <= 5000) {
    precision = 5; // ~5 km x 5 km
  } else {
    precision = 4; // ~20 km x 20 km
  }
  
  // Start measuring time for performance analysis
  const start = Date.now();
  
  // Encode geohashes for the given coordinates at the calculated precision
  const givenHashes = coordinates.map(([lat, lon]) => geohash.encode(lat, lon, precision));
  
  // SQL query to select entities within the given geohash areas
  const query = `
    SELECT DISTINCT e.*
    FROM entities e
    WHERE LEFT(e.geohash, $2) = ANY($1::text[]);
  `;
  
  try {
    // Execute query with the list of geohashes and the precision length
    const result = await pool.query(query, [
      givenHashes,
      precision
    ]);
    
    // End time measurement
    const end = Date.now();
    
    return {
      approach: 'geohash',
      timeTaken: end - start,
      recordsFound: result.rows.length,
      data: result.rows
    };
  } catch (error) {
    console.error('Error executing geohash approach query:', error);
    throw error;
  }
}

async function euclideanApproach(coordinates, radius) {
  const start = Date.now();
  
  // Convert radius from meters to degrees
  const radiusInDegrees = radius / 111320;

  const result = await pool.query(`
    SELECT DISTINCT e.*
    FROM entities e
    WHERE EXISTS (
      SELECT 1
      FROM unnest($1::float[], $2::float[]) WITH ORDINALITY AS t(lat, lon, idx)
      WHERE (
        ((e.latitude - t.lat)::numeric)^2 + ((e.longitude - t.lon)::numeric)^2
      ) <= ($3::numeric)^2
    );
  `, [coordinates.map(c => c[0]), coordinates.map(c => c[1]), radiusInDegrees]);

  const end = Date.now();
  return {
    approach: 'euclidean',
    timeTaken: end - start,
    recordsFound: result.rows.length,
  };
  
  
}
async function postgisApproach(coordinates, radius) {
  const start = Date.now();

  // Convert coordinates array into GeoJSON format for a MultiPoint
  const geoJSON = {
    type: 'MultiPoint',
    coordinates: coordinates.map(c => [c[1], c[0]]) // Convert [lat, lon] to [lon, lat]
  };

  // Serialize GeoJSON to string
  const geoJSONString = JSON.stringify(geoJSON);
  const result = await pool.query(`
    WITH params AS (
      SELECT
        ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), 6207), 32645) AS input_multipoint,
        $2::float AS max_distance
    )
    SELECT DISTINCT e.*
    FROM entities e, params p
    WHERE 
      ST_DWithin(ST_Transform(e.geom, 32645), p.input_multipoint, p.max_distance);
  `, [geoJSONString, radius]);
  
  const end = Date.now();
  return {
    approach: 'postgis',
    timeTaken: end - start,
    recordsFound: result.rows.length,
  };
}


async function haversineApproach(coordinates, radius) {
  const start = Date.now();

  // Execute the query to find entities within the radius using the haversine method
  const result = await pool.query(`
    SELECT DISTINCT e.*
    FROM entities e
    WHERE EXISTS (
      SELECT 1
      FROM unnest($1::float[], $2::float[]) WITH ORDINALITY AS t(lat, lon, idx)
      WHERE ST_DWithin(
        e.geom, 
        ST_SetSRID(ST_MakePoint(t.lon, t.lat), 6207), 
        $3  -- Radius in meters
      )
    );
  `, [coordinates.map(c => c[0]), coordinates.map(c => c[1]), radius]);

  const end = Date.now();
  return {
    approach: 'haversine',
    timeTaken: end - start,
    recordsFound: result.rows.length,
  };
}
  
  async function rTreeApproach(coordinates, radius) {
    const start = Date.now();
    const result = await pool.query(`
      SELECT DISTINCT e.*
      FROM entities e
      WHERE EXISTS (
        SELECT 1
        FROM unnest($1::float[], $2::float[]) WITH ORDINALITY AS t(lat, lon, idx)
        WHERE e.geom && ST_Expand(ST_SetSRID(ST_MakePoint(t.lon, t.lat), 6207), $3)
        AND ST_DWithin(
          e.geom,
          ST_SetSRID(ST_MakePoint(t.lon, t.lat), 6207),
          $3
        )
      );
    `, [coordinates.map(c => c[0]), coordinates.map(c => c[1]), radius]);
  
    const end = Date.now();
    return {
      approach: 'r-tree',
      timeTaken: end - start,
      recordsFound: result.rows.length,
    };
  }
  
  async function kdTreeApproach(coordinates, radius) {
    const start = Date.now();
    const result = await pool.query(`
      SELECT DISTINCT e.*
      FROM entities e
      WHERE EXISTS (
        SELECT 1
        FROM unnest($1::float[], $2::float[]) WITH ORDINALITY AS t(lat, lon, idx)
        WHERE ST_DWithin(
          e.geom,
          ST_SetSRID(ST_MakePoint(t.lon, t.lat), 6207),
          $3
        )
      );
    `, [coordinates.map(c => c[0]), coordinates.map(c => c[1]), radius]);
  
    const end = Date.now();
    return {
      approach: 'kd-tree',
      timeTaken: end - start,
      recordsFound: result.rows.length,
    };
  }
  

async function runComparison(coordinates, distanceRangeInMeteres, k, minPoints, volumes) {
  const results = {};
  
  for (const volume of volumes) {
    console.log(`\n=== Running comparison for volume: ${volume} ===`);
    results[volume] = {};

    await pool.query('TRUNCATE TABLE entities;');
    await pool.query(`
      INSERT INTO entities (latitude, longitude)
      SELECT (random_bihar_coordinate()).lat, (random_bihar_coordinate()).lon
      FROM generate_series(1, $1);
    `, [volume]);

     // Log the first 5 rows
     const first5Rows = await pool.query('SELECT * FROM entities LIMIT 5;');
     console.log('First 5 rows:', first5Rows.rows);

    const approaches = [
      { name: 'geohash', fn: geohashApproach, args: [coordinates, distanceRangeInMeteres] },
      // { name: 'euclidean', fn: euclideanApproach, args: [coordinates, distanceRangeInMeteres] },
      { name: 'postgres', fn: postgisApproach, args: [coordinates, distanceRangeInMeteres] },
      // { name: 'haversine', fn: haversineApproach, args: [coordinates, distanceRangeInMeteres] },
      // { name: 'r-tree', fn: rTreeApproach, args: [coordinates, distanceRangeInMeteres] },
      // { name: 'kd-tree', fn: kdTreeApproach, args: [coordinates, distanceRangeInMeteres] }
    ];

    for (const approach of approaches) {
      console.log(`Running ${approach.name} approach...`);
      try {
        results[volume][approach.name] = await approach.fn(...approach.args);
        console.log(`${approach.name} - Time Taken: ${results[volume][approach.name].timeTaken} ms, Records Found: ${results[volume][approach.name].recordsFound}`);
      } catch (error) {
        console.error(`Error in ${approach.name} approach:`, error);
        results[volume][approach.name] = { error: error.message };
      }
    }
  }

  return results;
}

module.exports = {
  runComparison,
};
