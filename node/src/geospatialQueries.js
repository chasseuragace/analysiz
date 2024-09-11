const { Pool } = require('pg');
// Geohash approach with detailed logging for testing
const geohash = require('ngeohash'); // Ensure the geohash package is installed

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});// Geohash approach

// Geohash approach with precision 4, using ILIKE with ANY
async function geohashApproach(coordinates) {
  // console.log('Geohash Approach Start:');
  // console.log('Coordinates:', coordinates);

  const start = Date.now();

  // Step 1: Convert coordinates to geohashes with precision 4
  const givenHashes = coordinates.map(([lat, lon]) => geohash.encode(lat, lon, 4));
  // console.log('Generated Geohashes (Precision 4):', givenHashes);

  // Step 2: Construct the SQL query using a lateral join
  const query = `
    SELECT e.*
    FROM entities e
    JOIN LATERAL (
      SELECT pattern
      FROM unnest($1::text[]) AS pattern
      WHERE e.geohash ILIKE pattern || '%'
    ) AS matched
    ON true;
  `;

  try {
    // Execute the query with the geohash prefixes
    const result = await pool.query(query, [givenHashes]);

    // Debug: Print number of records found and sample of results
    // console.log('Query completed successfully.');
    // console.log('Records found:', result.rows.length);
    // console.log('Result rows (first 5):', result.rows.slice(0, 5));

    const end = Date.now();

    return {
      approach: 'geohash',
      timeTaken: end - start,
      recordsFound: result.rows.length,
    };
  } catch (error) {
    // Log the error if the query fails
    console.error('Error executing geohash approach query:', error);
    throw error;
  }
}





// Euclidean approach
async function euclideanApproach(coordinates, radius) {
  const start = Date.now();
  const placeholders = coordinates.map((_, index) => `($${index * 2 + 1}, $${index * 2 + 2})`).join(',');
  const flatCoordinates = coordinates.flat();
  
  const result = await pool.query(`
    WITH input_points AS (
      SELECT unnest($1::float[]) as lat, unnest($2::float[]) as lon
    )
    SELECT e.* FROM entities e
    JOIN input_points ip ON (
      (e.latitude - ip.lat)^2 + (e.longitude - ip.lon)^2 <= ($3 / 111320)^2
    );
  `, [coordinates.map(c => c[0]), coordinates.map(c => c[1]), radius]);
  
  const end = Date.now();
  return {
    approach: 'euclidean',
    timeTaken: end - start,
    recordsFound: result.rows.length,
  };
}

// Haversine approach
async function haversineApproach(coordinates, radius) {
  const start = Date.now();
  const placeholders = coordinates.map((_, index) => `($${index * 2 + 1}, $${index * 2 + 2})`).join(',');
  const flatCoordinates = coordinates.flat();
  
  const result = await pool.query(`
    WITH input_points AS (
      SELECT unnest($1::float[]) as lat, unnest($2::float[]) as lon
    )
    SELECT e.* FROM entities e
    JOIN input_points ip ON (
      ST_DWithin(
        e.geom,
        ST_SetSRID(ST_MakePoint(ip.lon, ip.lat), 4326),
        $3
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

// DBSCAN approach
async function dbscanApproach(coordinates, radius, minPoints) {
  const start = Date.now();
  const placeholders = coordinates.map((_, index) => `($${index * 2 + 1}, $${index * 2 + 2})`).join(',');
  const flatCoordinates = coordinates.flat();
  
  const result = await pool.query(`
    WITH input_points AS (
      SELECT unnest($1::float[]) as lat, unnest($2::float[]) as lon
    ),
    nearby_points AS (
      SELECT e.* FROM entities e
      JOIN input_points ip ON (
        ST_DWithin(
          e.geom,
          ST_SetSRID(ST_MakePoint(ip.lon, ip.lat), 4326),
          $3
        )
      )
    ),
    clusters AS (
      SELECT ST_ClusterDBSCAN(geom, eps := $3, minpoints := $4) over () AS cid,
             id, latitude, longitude
      FROM nearby_points
    )
    SELECT * FROM clusters WHERE cid IS NOT NULL;
  `, [coordinates.map(c => c[0]), coordinates.map(c => c[1]), radius, minPoints]);
  
  const end = Date.now();
  return {
    approach: 'dbscan',
    timeTaken: end - start,
    recordsFound: result.rows.length,
  };
}

// KNN approach
async function knnApproach(coordinates, k) {
  const start = Date.now();
  const placeholders = coordinates.map((_, index) => `($${index * 2 + 1}, $${index * 2 + 2})`).join(',');
  const flatCoordinates = coordinates.flat();
  
  const result = await pool.query(`
    WITH input_points AS (
      SELECT unnest($1::float[]) as lat, unnest($2::float[]) as lon
    ),
    knn_results AS (
      SELECT e.id, e.latitude, e.longitude,
             ST_Distance(e.geom, ST_SetSRID(ST_MakePoint(ip.lon, ip.lat), 4326)) AS distance,
             ROW_NUMBER() OVER (PARTITION BY ip.lat, ip.lon ORDER BY e.geom <-> ST_SetSRID(ST_MakePoint(ip.lon, ip.lat), 4326)) as rn
      FROM entities e
      CROSS JOIN input_points ip
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

// Updated function to run all approaches and compare results
async function runComparison(coordinates, radius, k, minPoints, volumes) {
  const results = {};
  if (!Array.isArray(volumes)) {
    throw new TypeError("volumes must be an array");
  }  console.log('Volumes:', volumes);  // Logging to ensure it's correct
  for (const volume of volumes) {
    results[volume] = {};
    
    // Truncate the table and repopulate with the specified volume of random data
    await pool.query('TRUNCATE TABLE entities;');
    await pool.query(`
      INSERT INTO entities (latitude, longitude)
      SELECT * FROM random_bihar_coordinate()
      LIMIT $1;
    `, [volume]);
    
    // Fetch the first 10 data points after insertion
    // Fetch and print the total count of data points in the entities table
    const { rows: dataCount } = await pool.query(`
      SELECT COUNT(*) as total
      FROM entities;
    `);
    
    
    results[volume]['geohash'] = await geohashApproach(coordinates, radius);
    results[volume]['euclidean'] = await euclideanApproach(coordinates, radius);
    results[volume]['haversine'] = await haversineApproach(coordinates, radius);
    results[volume]['dbscan'] = await dbscanApproach(coordinates, radius, minPoints);
    results[volume]['knn'] = await knnApproach(coordinates, k);
  }
  
  return results;
}

module.exports = {
  runComparison,
};


