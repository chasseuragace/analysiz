
const { Pool } = require('pg');


require('dotenv').config();

const app = express();
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT,
});


// Geohash approach
module.exports.geohashApproach = async function(lat, lon, radius) {
  const start = Date.now();
  const result = await pool.query(`
    SELECT * FROM entities
    WHERE geohash LIKE (SELECT LEFT(generate_geohash($1, $2, 8), 5) || '%')
    AND ST_DWithin(
      geom,
      ST_SetSRID(ST_MakePoint($2, $1), 4326),
      $3
    );
  `, [lat, lon, radius]);
  const end = Date.now();
  return {
    approach: 'geohash',
    timeTaken: end - start,
    recordsFound: result.rows.length,
  };
};

// Euclidean approach
module.exports.euclideanApproach = async function(lat, lon, radius) {
  const start = Date.now();
  const result = await pool.query(`
    SELECT * FROM entities
    WHERE (latitude - $1)^2 + (longitude - $2)^2 <= ($3 / 111.32)^2;
  `, [lat, lon, radius]);
  const end = Date.now();
  return {
    approach: 'euclidean',
    timeTaken: end - start,
    recordsFound: result.rows.length,
  };
};

// Haversine approach
module.exports.haversineApproach = async function(lat, lon, radius) {
  const start = Date.now();
  const result = await pool.query(`
    SELECT * FROM entities
    WHERE ST_DWithin(
      geom,
      ST_SetSRID(ST_MakePoint($2, $1), 4326),
      $3
    );
  `, [lat, lon, radius]);
  const end = Date.now();
  return {
    approach: 'haversine',
    timeTaken: end - start,
    recordsFound: result.rows.length,
  };
};

// DBSCAN approach
module.exports.dbscanApproach = async function(lat, lon, radius, minPoints) {
  const start = Date.now();
  const result = await pool.query(`
    WITH clusters AS (
      SELECT ST_ClusterDBSCAN(geom, eps := $3, minpoints := $4) over () AS cid,
             id, latitude, longitude
      FROM entities
      WHERE ST_DWithin(
        geom,
        ST_SetSRID(ST_MakePoint($2, $1), 4326),
        $3
      )
    )
    SELECT * FROM clusters WHERE cid IS NOT NULL;
  `, [lat, lon, radius, minPoints]);
  const end = Date.now();
  return {
    approach: 'dbscan',
    timeTaken: end - start,
    recordsFound: result.rows.length,
  };
};

// KNN approach
module.exports.knnApproach = async function(lat, lon, k) {
  const start = Date.now();
  const result = await pool.query(`
    SELECT id, latitude, longitude,
           ST_Distance(geom, ST_SetSRID(ST_MakePoint($2, $1), 4326)) AS distance
    FROM entities
    ORDER BY geom <-> ST_SetSRID(ST_MakePoint($2, $1), 4326)
    LIMIT $3;
  `, [lat, lon, k]);
  const end = Date.now();
  return {
    approach: 'knn',
    timeTaken: end - start,
    recordsFound: result.rows.length,
  };
};

// Function to run all approaches and compare results
module.exports.runComparison = async function(lat, lon, radius, k, minPoints, volumes) {
  const results = {};
  
  for (const volume of volumes) {
    results[volume] = {};
    
    // Populate the database with the specified volume of random data
    await pool.query(`
      INSERT INTO entities (latitude, longitude, geom, geohash)
      SELECT 
        random() * 180 - 90 AS latitude,
        random() * 360 - 180 AS longitude,
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326),
        generate_geohash(latitude, longitude, 8)
      FROM generate_series(1, $1);
    `, [volume]);
    
    results[volume]['geohash'] = await this.geohashApproach(lat, lon, radius);
    results[volume]['euclidean'] = await this.euclideanApproach(lat, lon, radius);
    results[volume]['haversine'] = await this.haversineApproach(lat, lon, radius);
    results[volume]['dbscan'] = await this.dbscanApproach(lat, lon, radius, minPoints);
    results[volume]['knn'] = await this.knnApproach(lat, lon, k);
    
    // Clear the database for the next volume test
    await pool.query('TRUNCATE TABLE entities;');
  }
  
  return results;
};