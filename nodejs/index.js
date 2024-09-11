const geo = require('./geospatial-queries');

async function main() {
  const lat = 0;
  const lon = 0;
  const radius = 1000; // in meters
  const k = 10; // for KNN
  const minPoints = 3; // for DBSCAN
  const volumes = [1000, 2000, 3000, 5000];

  const results = await geo.runComparison(lat, lon, radius, k, minPoints, volumes);
  console.table(results);
}

main().catch(console.error);