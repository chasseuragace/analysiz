const { Pool } = require('pg');
const geohash = require('ngeohash');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function geohashApproach(coordinates) {
  const start = Date.now();
  const givenHashes = coordinates.map(([lat, lon]) => geohash.encode(lat, lon, 4));
  const query = `
    SELECT e.*
    FROM entities e
    WHERE LEFT(e.geohash, 4) = ANY($1::text[]);
  `;

  try {
    const result = await pool.query(query, [givenHashes]);
    const end = Date.now();
    return {
      approach: 'geohash',
      timeTaken: end - start,
      recordsFound: result.rows.length,
    };
  } catch (error) {
    console.error('Error executing geohash approach query:', error);
    throw error;
  }
}

async function euclideanApproach(coordinates, radius) {
  const start = Date.now();
  const result = await pool.query(`
    SELECT e.*
    FROM entities e
    WHERE EXISTS (
      SELECT 1
      FROM unnest($1::float[], $2::float[]) AS coord(lat, lon)
      WHERE (e.latitude - coord.lat)^2 + (e.longitude - coord.lon)^2 <= ($3 / 111.32)^2
    );
  `, [coordinates.map(c => c[0]), coordinates.map(c => c[1]), radius]);

  const end = Date.now();
  return {
    approach: 'euclidean',
    timeTaken: end - start,
    recordsFound: result.rows.length,
  };
}

async function haversineApproach(coordinates, radius) {
  const start = Date.now();
  const result = await pool.query(`
    SELECT e.*
    FROM entities e
    WHERE EXISTS (
      SELECT 1
      FROM unnest($1::float[], $2::float[]) AS coord(lat, lon)
      WHERE ST_DWithin(
        e.geom,
        ST_SetSRID(ST_MakePoint(coord.lon, coord.lat), 4326),
        $3 / 111.32
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

async function dbscanApproach(coordinates, radius, minPoints) {
  const start = Date.now();
  const result = await pool.query(`
    WITH clustered_points AS (
      SELECT id, latitude, longitude, 
             ST_ClusterDBSCAN(geom, eps := $3 / 111.32, minpoints := $4) OVER () AS cid
      FROM entities
      WHERE EXISTS (
        SELECT 1
        FROM unnest($1::float[], $2::float[]) AS coord(lat, lon)
        WHERE ST_DWithin(
          geom,
          ST_SetSRID(ST_MakePoint(coord.lon, coord.lat), 4326),
          $3 / 111.32
        )
      )
    )
    SELECT * 
    FROM clustered_points
    WHERE cid IS NOT NULL;
  `, [coordinates.map(c => c[0]), coordinates.map(c => c[1]), radius, minPoints]);

  const end = Date.now();
  return {
    approach: 'dbscan',
    timeTaken: end - start,
    recordsFound: result.rows.length,
  };
}

async function knnApproach(coordinates, k) {
  const start = Date.now();
  const result = await pool.query(`
    WITH knn_results AS (
      SELECT e.id, e.latitude, e.longitude,
             ST_Distance(e.geom, ST_SetSRID(ST_MakePoint(coord.lon, coord.lat), 4326)) AS distance,
             ROW_NUMBER() OVER (PARTITION BY coord.lat, coord.lon ORDER BY e.geom <-> ST_SetSRID(ST_MakePoint(coord.lon, coord.lat), 4326)) as rn
      FROM entities e
      CROSS JOIN unnest($1::float[], $2::float[]) AS coord(lat, lon)
    )
    SELECT * FROM knn_results WHERE rn <= $3;
  `, [coordinates.map(c => c[0]), coordinates.map(c => c[1]), k]);

  const end = Date.now();
  return {
    approach: 'knn',
    timeTaken: end - start,
    recordsFound: result.rows.length,
  };
}

async function rTreeApproach(coordinates, radius) {
  const start = Date.now();
  const result = await pool.query(`
    SELECT e.*
    FROM entities e
    WHERE EXISTS (
      SELECT 1
      FROM unnest($1::float[], $2::float[]) AS coord(lat, lon)
      WHERE e.geom && ST_Expand(ST_SetSRID(ST_MakePoint(coord.lon, coord.lat), 4326), $3 / 111.32)
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
    SELECT e.*
    FROM entities e
    WHERE EXISTS (
      SELECT 1
      FROM unnest($1::float[], $2::float[]) AS coord(lat, lon)
      WHERE ST_DWithin(e.geom, ST_SetSRID(ST_MakePoint(coord.lon, coord.lat), 4326), $3 / 111.32)
    );
  `, [coordinates.map(c => c[0]), coordinates.map(c => c[1]), radius]);

  const end = Date.now();
  return {
    approach: 'kd-tree',
    timeTaken: end - start,
    recordsFound: result.rows.length,
  };
}

async function runComparison(coordinates, radius, k, minPoints, volumes) {
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

    const approaches = [
      { name: 'geohash', fn: geohashApproach, args: [coordinates] },
      { name: 'euclidean', fn: euclideanApproach, args: [coordinates, radius] },
      { name: 'haversine', fn: haversineApproach, args: [coordinates, radius] },
      // { name: 'dbscan', fn: dbscanApproach, args: [coordinates, radius, minPoints] },
      // { name: 'knn', fn: knnApproach, args: [coordinates, k] },
      { name: 'r-tree', fn: rTreeApproach, args: [coordinates, radius] },
      { name: 'kd-tree', fn: kdTreeApproach, args: [coordinates, radius] }
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