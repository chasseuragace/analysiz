const express = require('express');
const { Pool } = require('pg');
const geohashTest = require('./geohash_approach_service');
const euclideanTest = require('./euclidean_approach_service');

require('dotenv').config();

const app = express();
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT,
});

// Middleware
app.use(express.json());

// Route to insert n records
app.post('/insert', async (req, res) => {
  const { n } = req.body;
  try {
    for (let i = 0; i < n; i++) {
      await pool.query(
        'INSERT INTO entities (latitude, longitude) VALUES ($1, $2)',
        [Math.random() * 180 - 90, Math.random() * 360 - 180]
      );
    }
    res.send(`${n} records inserted.`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error inserting records');
  }
});

// Route to delete all records
app.delete('/delete', async (req, res) => {
  try {
    await pool.query('DELETE FROM entities');
    res.send('All records deleted.');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting records');
  }
});

// Route to run performance tests
app.get('/test', async (req, res) => {
  const geohashResults = await geohashTest(pool);
  const euclideanResults = await euclideanTest(pool);
  
  res.json({
    geohash: geohashResults,
    euclidean: euclideanResults,
    // Add more tests here (e.g., haversineTest, knnTest)
  });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
