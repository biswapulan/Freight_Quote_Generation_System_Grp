/**
 * Geospatial Proximity & Catchment Validation Engine for FreightAI
 * Calculates real distances between pickup/delivery addresses and seaports/airports/ICDs.
 */

// City Coordinate Database for instant, offline-first resolution
export const LOGISTICS_CITY_COORDINATES = {
  // India - West & Central
  mumbai: { lat: 18.95, lng: 72.95, state: "Maharashtra", country: "India" },
  "navi mumbai": { lat: 18.99, lng: 73.02, state: "Maharashtra", country: "India" },
  thane: { lat: 19.21, lng: 72.97, state: "Maharashtra", country: "India" },
  bhiwandi: { lat: 19.29, lng: 73.06, state: "Maharashtra", country: "India" },
  pune: { lat: 18.52, lng: 73.85, state: "Maharashtra", country: "India" },
  nashik: { lat: 19.99, lng: 73.78, state: "Maharashtra", country: "India" },
  aurangabad: { lat: 19.87, lng: 75.34, state: "Maharashtra", country: "India" },
  nagpur: { lat: 21.14, lng: 79.08, state: "Maharashtra", country: "India" },
  ahmedabad: { lat: 23.02, lng: 72.57, state: "Gujarat", country: "India" },
  surat: { lat: 21.17, lng: 72.83, state: "Gujarat", country: "India" },
  mundra: { lat: 22.84, lng: 69.72, state: "Gujarat", country: "India" },
  kandla: { lat: 23.01, lng: 70.22, state: "Gujarat", country: "India" },
  vadodara: { lat: 22.30, lng: 73.18, state: "Gujarat", country: "India" },
  rajkot: { lat: 22.30, lng: 70.80, state: "Gujarat", country: "India" },
  indore: { lat: 22.71, lng: 75.85, state: "Madhya Pradesh", country: "India" },
  bhopal: { lat: 23.25, lng: 77.41, state: "Madhya Pradesh", country: "India" },
  goa: { lat: 15.29, lng: 73.98, state: "Goa", country: "India" },

  // India - South
  chennai: { lat: 13.08, lng: 80.27, state: "Tamil Nadu", country: "India" },
  coimbatore: { lat: 11.01, lng: 76.95, state: "Tamil Nadu", country: "India" },
  tirupur: { lat: 11.10, lng: 77.34, state: "Tamil Nadu", country: "India" },
  madurai: { lat: 9.92, lng: 78.11, state: "Tamil Nadu", country: "India" },
  tuticorin: { lat: 8.76, lng: 78.13, state: "Tamil Nadu", country: "India" },
  bengaluru: { lat: 12.97, lng: 77.59, state: "Karnataka", country: "India" },
  bangalore: { lat: 12.97, lng: 77.59, state: "Karnataka", country: "India" },
  mangalore: { lat: 12.91, lng: 74.85, state: "Karnataka", country: "India" },
  mysuru: { lat: 12.29, lng: 76.63, state: "Karnataka", country: "India" },
  hyderabad: { lat: 17.38, lng: 78.48, state: "Telangana", country: "India" },
  visakhapatnam: { lat: 17.68, lng: 83.21, state: "Andhra Pradesh", country: "India" },
  vizag: { lat: 17.68, lng: 83.21, state: "Andhra Pradesh", country: "India" },
  vijayawada: { lat: 16.50, lng: 80.64, state: "Andhra Pradesh", country: "India" },
  kochi: { lat: 9.93, lng: 76.26, state: "Kerala", country: "India" },
  cochin: { lat: 9.93, lng: 76.26, state: "Kerala", country: "India" },
  trivandrum: { lat: 8.52, lng: 76.93, state: "Kerala", country: "India" },

  // India - North & East
  delhi: { lat: 28.61, lng: 77.20, state: "Delhi", country: "India" },
  "new delhi": { lat: 28.61, lng: 77.20, state: "Delhi", country: "India" },
  noida: { lat: 28.53, lng: 77.39, state: "Uttar Pradesh", country: "India" },
  gurgaon: { lat: 28.45, lng: 77.02, state: "Haryana", country: "India" },
  gurugram: { lat: 28.45, lng: 77.02, state: "Haryana", country: "India" },
  faridabad: { lat: 28.40, lng: 77.31, state: "Haryana", country: "India" },
  ludhiana: { lat: 30.90, lng: 75.85, state: "Punjab", country: "India" },
  chandigarh: { lat: 30.73, lng: 76.77, state: "Punjab", country: "India" },
  jaipur: { lat: 26.91, lng: 75.78, state: "Rajasthan", country: "India" },
  kolkata: { lat: 22.57, lng: 88.36, state: "West Bengal", country: "India" },
  haldia: { lat: 22.06, lng: 88.06, state: "West Bengal", country: "India" },

  // International Gateways
  singapore: { lat: 1.35, lng: 103.81, state: "Singapore", country: "Singapore" },
  "pasir panjang": { lat: 1.28, lng: 103.78, state: "Singapore", country: "Singapore" },
  jurong: { lat: 1.33, lng: 103.74, state: "Singapore", country: "Singapore" },
  dubai: { lat: 25.20, lng: 55.27, state: "Dubai", country: "UAE" },
  "jebel ali": { lat: 24.98, lng: 55.02, state: "Dubai", country: "UAE" },
  "abu dhabi": { lat: 24.45, lng: 54.37, state: "Abu Dhabi", country: "UAE" },
  sharjah: { lat: 25.34, lng: 55.42, state: "Sharjah", country: "UAE" },
  rotterdam: { lat: 51.92, lng: 4.47, state: "South Holland", country: "Netherlands" },
  amsterdam: { lat: 52.36, lng: 4.90, state: "North Holland", country: "Netherlands" },
  antwerp: { lat: 51.21, lng: 4.40, state: "Flanders", country: "Belgium" },
  hamburg: { lat: 53.55, lng: 9.99, state: "Hamburg", country: "Germany" },
  frankfurt: { lat: 50.11, lng: 8.68, state: "Hesse", country: "Germany" },
  london: { lat: 51.50, lng: -0.12, state: "England", country: "UK" },
  shanghai: { lat: 31.23, lng: 121.47, state: "Shanghai", country: "China" },
  ningbo: { lat: 29.86, lng: 121.54, state: "Zhejiang", country: "China" },
  shenzhen: { lat: 22.54, lng: 114.05, state: "Guangdong", country: "China" },
  "los angeles": { lat: 34.05, lng: -118.24, state: "California", country: "USA" },
  "long beach": { lat: 33.77, lng: -118.19, state: "California", country: "USA" },
  "new york": { lat: 40.71, lng: -74.00, state: "New York", country: "USA" },
  newark: { lat: 40.73, lng: -74.17, state: "New Jersey", country: "USA" },
};

// Catchment radii in kilometers based on cargo transport mode
export const CATCHMENT_RADIUS_KM = {
  ocean: 250, // Standard Maritime Container Drayage radius
  air: 150, // Air Cargo Terminal bonded trucking radius
  express: 120, // Express Airport Drop catchment
  ground: 300, // Inland Multi-modal Depot Feeder radius
};

/**
 * Calculates geodesic distance using Haversine formula in kilometers
 */
export function calculateGeoDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
    return 0;
  }
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const rawDistance = R * c;
  // Road routing approximation (adding 15% winding road factor)
  return Math.max(Math.round(rawDistance * 1.15), 5);
}

/**
 * Resolves address coordinates from object or city text
 */
export function resolveAddressCoordinates(addr) {
  if (!addr) return null;

  // 1. Direct coordinates if already attached
  if (addr.lat && addr.lng) {
    return { lat: Number(addr.lat), lng: Number(addr.lng) };
  }

  // 2. City name matching
  const cityName = (addr.city || addr.state || addr.label || "").trim().toLowerCase();
  for (const [key, coords] of Object.entries(LOGISTICS_CITY_COORDINATES)) {
    if (cityName.includes(key) || key.includes(cityName)) {
      return { lat: coords.lat, lng: coords.lng, city: key, country: coords.country };
    }
  }

  // 3. Street/label matching
  const fullText = `${addr.label || ""} ${addr.street || ""} ${addr.city || ""} ${addr.state || ""} ${addr.country || ""}`.toLowerCase();
  for (const [key, coords] of Object.entries(LOGISTICS_CITY_COORDINATES)) {
    if (fullText.includes(key)) {
      return { lat: coords.lat, lng: coords.lng, city: key, country: coords.country };
    }
  }

  // 4. Default country centroids
  const country = (addr.country || "India").toLowerCase();
  if (country.includes("singapore")) return { lat: 1.35, lng: 103.81, country: "Singapore" };
  if (country.includes("uae") || country.includes("emirates") || country.includes("dubai")) return { lat: 25.20, lng: 55.27, country: "UAE" };
  if (country.includes("netherlands") || country.includes("rotterdam")) return { lat: 51.92, lng: 4.47, country: "Netherlands" };
  if (country.includes("germany") || country.includes("hamburg")) return { lat: 53.55, lng: 9.99, country: "Germany" };
  if (country.includes("china") || country.includes("shanghai")) return { lat: 31.23, lng: 121.47, country: "China" };
  if (country.includes("usa") || country.includes("united states")) return { lat: 34.05, lng: -118.24, country: "USA" };

  return { lat: 18.95, lng: 72.95, country: "India" }; // Default Mumbai coordinates
}

/**
 * Finds the closest available port to a given address
 */
export function findNearestPort(addr, availablePorts = []) {
  if (!addr || !availablePorts || availablePorts.length === 0) return null;

  const addrCoords = resolveAddressCoordinates(addr);
  if (!addrCoords) return null;

  let closestPort = null;
  let minDistance = Infinity;

  availablePorts.forEach((port) => {
    if (port.lat !== undefined && port.lng !== undefined) {
      const dist = calculateGeoDistanceKm(addrCoords.lat, addrCoords.lng, port.lat, port.lng);
      if (dist < minDistance) {
        minDistance = dist;
        closestPort = { ...port, distanceKm: dist };
      }
    }
  });

  return closestPort;
}

/**
 * Validates whether an address is within the commercial catchment of the selected port/hub
 */
export function validateAddressProximity(address, port, mode = "ocean") {
  if (!address || !port) {
    return {
      isValid: true,
      distanceKm: 0,
      thresholdKm: CATCHMENT_RADIUS_KM[mode] || 250,
      excessKm: 0,
      status: "NO_DATA",
    };
  }

  const addrCoords = resolveAddressCoordinates(address);
  if (!addrCoords || port.lat === undefined || port.lng === undefined) {
    return {
      isValid: true,
      distanceKm: 0,
      thresholdKm: CATCHMENT_RADIUS_KM[mode] || 250,
      excessKm: 0,
      status: "ESTIMATED",
    };
  }

  const distanceKm = calculateGeoDistanceKm(addrCoords.lat, addrCoords.lng, port.lat, port.lng);
  const thresholdKm = CATCHMENT_RADIUS_KM[mode] || 250;

  // Cross-country check
  const addrCountry = (address.country || addrCoords.country || "").trim().toLowerCase();
  const portCountry = (port.country || "").trim().toLowerCase();
  const isDifferentCountry = Boolean(addrCountry && portCountry && !addrCountry.includes(portCountry) && !portCountry.includes(addrCountry));

  const isNearby = distanceKm <= thresholdKm && !isDifferentCountry;

  return {
    isValid: isNearby,
    distanceKm,
    thresholdKm,
    excessKm: Math.max(0, distanceKm - thresholdKm),
    isDifferentCountry,
    addrCoords,
    portCoords: { lat: port.lat, lng: port.lng },
    status: isNearby ? "VALID" : isDifferentCountry ? "COUNTRY_MISMATCH" : "EXCEEDS_RADIUS",
  };
}
