const fs = require('fs');
const path = require('path');
const { runComparison } = require('./geospatialQueries');

async function main() {
  // Base settings
  const lat = 25.0; // Base latitude for random coordinate generation
  const lon = 85.0; // Base longitude for random coordinate generation
  const k = 10; // For KNN
  const minPoints = 3; // For DBSCAN
  
  // Define volumes and radii for testing
  const volumes = [
    // 10_000,    // Small scale
    // 50_000,    // Medium scale
    100_000,   // Large scale
    // 200_000,   // Larger scale
    // 500_000,   // Big data
    // 1_000_000, // Very large scale
    // 2_000_000, // Larger than typical use cases
    // 5_000_000  // Extremely large scale
  ];

  const radii = [
  //  1_000,     // Small radius in meters
    5_000,     // Medium radius
    // 10_000,    // Large radius
    // Add more radii as needed
  ];

  const pointSizes = [
    1,
    5,
    20,
    50,   // Small number of points

    100,  // Medium number of points
    // 200,  // Large number of points
    // 500,  // Very large number of points
    // Add more sizes if needed
  ];

  console.log("Waiting 5 seconds to let the database initialize...");

  // Wait 5 seconds for the database to initialize
  setTimeout(async () => {
    try {
      const outputPath = path.join('/usr/src/app/out', 'output.txt');
      let output = 'Comparison Results:\n\n';

      // Iterate over volumes
      for (const volume of volumes) {
        console.log(`\n=== Running comparison for volume: ${volume} ===`);
        
        // Iterate over point sizes
        for (const pointSize of pointSizes) {
          const coordinates = generateRandomCoordinates(pointSize);
          console.log(`\n=== Running comparison for ${pointSize} points ===`);
          
          // Iterate over radii
          for (const radius of radii) {
            console.log(`Running comparison for radius: ${radius} meters`);
            try {
              const results = await runComparison(coordinates, radius, k, minPoints, [volume]);

              // Format results
              output += `Point Size: ${pointSize}, Volume: ${volume} records, Radius: ${radius} meters\n`;
              for (const [volume, approaches] of Object.entries(results)) {
                for (const [approach, data] of Object.entries(approaches)) {
                  output += `  ${approach.padEnd(10)}: ${data.timeTaken}ms, ${data.recordsFound} records found\n`;
                }
                output += '\n';
              }
            } catch (error) {
              console.error(`Error running comparison for radius ${radius}:`, error);
              output += `Error running comparison for radius ${radius}: ${error.message}\n`;
            }
          }
        }
      }

      // Write results to file
      fs.writeFileSync(outputPath, output);
      console.log(`Results written to ${outputPath}`);
    } catch (error) {
      console.error('Error running comparisons:', error);
    }
  }, 5000); // Wait for 5000 milliseconds (5 seconds)
}

// Function to generate random coordinates within specified bounds
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

main();
