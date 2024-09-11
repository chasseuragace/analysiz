const fs = require('fs');
const path = require('path');
const { runComparison } = require('./geospatialQueries');

async function main() {
  const lat = 25.0;
  const lon = 85.0;
  const radius = 10000; // 10km in meters
  const k = 10; // for KNN
  const minPoints = 3; // for DBSCAN
  const volumes = [
    10_000,    // Small scale
    50_000,    // Medium scale
    100_000,   // Large scale
    200_000,   // Larger scale
    500_000,   // Big data
    1_000_000, // Very large scale
    2_000_000, // Larger than typical use cases
    5_000_000  // Extremely large scale
  ];
  

// Generate 200 random coordinates
const coordinates = generateRandomCoordinates(5500);
 


  try {
    const results = await runComparison(coordinates, radius, k, minPoints, volumes);
    const outputPath = path.join('/usr/src/app/out', 'output.txt');
    
    let output = 'Comparison Results:\n\n';
    for (const [volume, approaches] of Object.entries(results)) {
      output += `Volume: ${volume} records\n`;
      for (const [approach, data] of Object.entries(approaches)) {
        output += `  ${approach.padEnd(10)}: ${data.timeTaken}ms, ${data.recordsFound} records found\n`;
      }
      output += '\n';
    }

    fs.writeFileSync(outputPath, output);
    console.log(`Results written to ${outputPath}`);
  } catch (error) {
    console.error('Error running comparison:', error);
  }
}

main();


// Function to generate random coordinates within Nepal's boundary
function generateRandomCoordinates(numPoints) {
  const nepalBounds = {
    north: 30.42271698660863,
    south: 26.347,
    east: 88.20152567091282,
    west: 80.05858693736828
  };

  const coordinates = [];
  for (let i = 0; i < numPoints; i++) {
    const lat = Math.random() * (nepalBounds.north - nepalBounds.south) + nepalBounds.south;
    const lon = Math.random() * (nepalBounds.east - nepalBounds.west) + nepalBounds.west;
    coordinates.push([lat, lon]);
  }
  return coordinates;
}


