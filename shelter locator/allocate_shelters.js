/**
 * Shelter Allocation Protocol Script
 * 
 * Calculates density and alive population in disaster areas, 
 * then optimally distributes them to the best available shelters or bunkers
 * based on distance, bunker strength, and capacity.
 */

// --- 1. MOCK DATA ---

// List of affected areas
const areas = [
  { id: 'Sector-Alpha', lat: 28.6139, lon: 77.2090, area_sq_km: 10, total_population: 50000, alive_ratio: 0.8 },
  { id: 'Sector-Bravo', lat: 28.5355, lon: 77.2910, area_sq_km: 15, total_population: 80000, alive_ratio: 0.6 },
  { id: 'Sector-Charlie', lat: 28.7041, lon: 77.1025, area_sq_km: 8,  total_population: 30000, alive_ratio: 0.9 },
  { id: 'Sector-Delta', lat: 28.6500, lon: 77.1500, area_sq_km: 20, total_population: 120000, alive_ratio: 0.7 }
];

// List of available shelters/bunkers
const shelters = [
  { id: 'Bunker-Command', lat: 28.6200, lon: 77.2100, max_capacity: 30000, strength: 95, current_occupancy: 0 },
  { id: 'Bunker-Outpost-1', lat: 28.5400, lon: 77.2800, max_capacity: 40000, strength: 80, current_occupancy: 0 },
  { id: 'Bunker-Outpost-2', lat: 28.7000, lon: 77.1000, max_capacity: 20000, strength: 90, current_occupancy: 0 },
  { id: 'Bunker-Underground', lat: 28.6000, lon: 77.2500, max_capacity: 50000, strength: 70, current_occupancy: 0 }
];

// --- 2. HELPER FUNCTIONS ---

/**
 * Haversine formula to calculate the great-circle distance between two points on a sphere
 * Returns distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

/**
 * Calculates a suitability score for a shelter relative to an area.
 * Formula balances distance (closer is better) and strength (higher is better).
 */
function calculateShelterScore(distance, strength) {
  // Avoid division by zero
  const distAdjusted = Math.max(distance, 0.1); 
  // We prefer higher strength and shorter distances. 
  // This is a custom algorithm weight:
  return strength / Math.sqrt(distAdjusted);
}

// --- 3. MAIN ALGORITHM ---

function allocateShelters() {
  console.log("=========================================");
  console.log("   SHELTER ALLOCATION PROTOCOL STARTED   ");
  console.log("=========================================\n");

  // Step A: Calculate Density and Alive Population
  const processedAreas = areas.map(area => {
    // Estimate alive population based on survivability ratio
    const alivePopulation = Math.floor(area.total_population * area.alive_ratio);
    
    // Calculate density of survivors
    const densityAlive = (alivePopulation / area.area_sq_km).toFixed(2);
    
    console.log(`[AREA SCANNED] ${area.id}:`);
    console.log(`  - Total Population: ${area.total_population}`);
    console.log(`  - Estimated Survivors: ${alivePopulation}`);
    console.log(`  - Survivor Density: ${densityAlive} people/sq_km\n`);
    
    return {
      ...area,
      alivePopulation,
      unallocated: alivePopulation
    };
  });

  console.log("=========================================");
  console.log("   COMMENCING EVACUATION DISTRIBUTION    ");
  console.log("=========================================");

  // Step B: Distribute people optimally to shelters
  processedAreas.forEach(area => {
    console.log(`\n>>> Routing ${area.unallocated} survivors from ${area.id}...`);

    // Rank all shelters for this specific area
    const rankedShelters = shelters.map(shelter => {
      const distance = calculateDistance(area.lat, area.lon, shelter.lat, shelter.lon);
      const score = calculateShelterScore(distance, shelter.strength);
      return { ...shelter, distance, score };
    }).sort((a, b) => b.score - a.score); // Highest score first

    // Allocate unallocated people to the best ranked shelters
    for (let i = 0; i < rankedShelters.length; i++) {
      if (area.unallocated <= 0) break; // All survivors placed

      const bestShelter = rankedShelters[i];
      const shelterRef = shelters.find(s => s.id === bestShelter.id); // Reference to original object
      
      const availableSpace = shelterRef.max_capacity - shelterRef.current_occupancy;
      if (availableSpace <= 0) continue; // Skip if shelter is full

      // Determine how many we can actually move into this shelter
      const peopleToMove = Math.min(area.unallocated, availableSpace);
      
      // Update capacities and unallocated counts
      shelterRef.current_occupancy += peopleToMove;
      area.unallocated -= peopleToMove;

      console.log(`    -> Moved ${peopleToMove} people to ${shelterRef.id}`);
      console.log(`       Distance: ${bestShelter.distance.toFixed(2)} km | Bunker Strength: ${shelterRef.strength}/100`);
    }

    if (area.unallocated > 0) {
      console.log(`    [CRITICAL WARNING] Insufficient capacity! ${area.unallocated} survivors in ${area.id} are stranded.`);
    }
  });

  // --- 4. FINAL REPORT ---
  console.log("\n=========================================");
  console.log("          FINAL BUNKER STATUS            ");
  console.log("=========================================");
  
  shelters.forEach(s => {
    const utilization = ((s.current_occupancy / s.max_capacity) * 100).toFixed(1);
    let statusLabel = "SAFE";
    if (utilization >= 100) statusLabel = "AT MAX CAPACITY";
    else if (utilization > 80) statusLabel = "WARNING - NEAR FULL";

    console.log(`[${s.id}] Strength: ${s.strength}/100 | Status: ${statusLabel}`);
    console.log(`  Occupancy: ${s.current_occupancy} / ${s.max_capacity} (${utilization}%)\n`);
  });
}

// Execute the algorithm
allocateShelters();
