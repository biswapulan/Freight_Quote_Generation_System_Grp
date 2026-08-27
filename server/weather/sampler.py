"""Route Geometry & Maritime Waypoint Sampler.

Decomposes origin-destination lanes into spatial maritime corridors and samples
equidistant intermediate waypoints along sea routes and land corridors.
"""

import math
from typing import List, Tuple, Dict, Any
from pricing.cities import resolve_city, CITY_COORDINATES


# Maritime Chokepoints and Strategic Waypoints Master
MARITIME_WAYPOINTS = {
    "malacca_strait": (2.5000, 101.5000),
    "singapore_strait": (1.2500, 103.8000),
    "bab_el_mandeb": (12.5833, 43.3333),
    "suez_canal": (29.9300, 32.5500),
    "gibraltar_strait": (35.9500, -5.6000),
    "english_channel": (50.0000, -1.0000),
    "cape_good_hope": (-34.3500, 18.4800),
    "arabian_sea_central": (15.0000, 65.0000),
    "bay_of_bengal_central": (14.0000, 86.0000),
    "south_china_sea_central": (12.0000, 114.0000),
    "red_sea_central": (20.0000, 38.5000),
    "mediterranean_central": (35.5000, 18.0000),
    "persian_gulf": (26.5000, 52.0000),
}


def haversine_distance(coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
    """Calculate the great-circle distance between two points in km."""
    lat1, lon1 = coord1
    lat2, lon2 = coord2
    r = 6371.0  # Earth radius in kilometers

    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def interpolate_points(coord1: Tuple[float, float], coord2: Tuple[float, float], num_points: int) -> List[Tuple[float, float]]:
    """Linearly interpolate intermediate coordinates between two points."""
    points = []
    lat1, lon1 = coord1
    lat2, lon2 = coord2

    for i in range(1, num_points + 1):
        fraction = i / (num_points + 1)
        interp_lat = lat1 + (lat2 - lat1) * fraction
        interp_lon = lon1 + (lon2 - lon1) * fraction
        points.append((round(interp_lat, 4), round(interp_lon, 4)))
    return points


class RouteGeometrySampler:
    """Samples geographic evaluation waypoints along trade lanes."""

    @staticmethod
    def resolve_location(name_or_code: str) -> Tuple[float, float]:
        """Resolve city name or port code to (lat, lon)."""
        if not name_or_code:
            return (13.0827, 80.2707)  # Default fallback (Chennai)

        clean = name_or_code.strip().lower()
        coords = resolve_city(clean)
        if coords:
            return coords

        # Fallback dictionary for common port codes
        port_code_map = {
            "inmaa": (13.0827, 80.2707),  # Chennai
            "innsa": (18.9500, 72.9500),  # Nhava Sheva
            "sgsin": (1.29027, 103.8519), # Singapore
            "aejea": (24.9857, 55.0272),  # Jebel Ali
            "nlrtm": (51.9244, 4.4777),   # Rotterdam
            "cnsha": (31.2304, 121.4737), # Shanghai
            "gbfxt": (51.9617, 1.3513),   # Felixstowe
            "lkcmb": (6.9271, 79.8612),   # Colombo
            "ommet": (23.5880, 58.3829),  # Muscat
        }
        if clean in port_code_map:
            return port_code_map[clean]

        return (13.0827, 80.2707)

    @classmethod
    def sample_route_waypoints(
        cls,
        origin: str,
        destination: str,
        explicit_waypoints: List[Dict[str, float]] = None,
        max_samples: int = 5,
    ) -> List[Dict[str, Any]]:
        """Extracts ordered route waypoints with intermediate maritime transit nodes."""
        if explicit_waypoints and len(explicit_waypoints) >= 2:
            sampled = []
            for i, wp in enumerate(explicit_waypoints):
                sampled.append({
                    "index": i,
                    "name": wp.get("name", f"Waypoint {i+1}"),
                    "lat": round(float(wp["lat"]), 4),
                    "lon": round(float(wp["lon"]), 4),
                    "type": "EXPLICIT_WAYPOINT",
                })
            return sampled

        origin_coords = cls.resolve_location(origin)
        dest_coords = cls.resolve_location(destination)

        total_distance = haversine_distance(origin_coords, dest_coords)
        intermediate_corridors = []

        # Intelligent corridor insertion based on global trade lanes
        orig_lon, dest_lon = origin_coords[1], dest_coords[1]
        orig_lat, dest_lat = origin_coords[0], dest_coords[0]

        # Asia to Europe (via Malacca -> Bab-el-Mandeb -> Suez -> Gibraltar)
        if (orig_lon > 60 and dest_lon < 20) or (dest_lon > 60 and orig_lon < 20):
            if orig_lon > 90:  # East Asia / SE Asia
                intermediate_corridors.append(("Malacca Strait", MARITIME_WAYPOINTS["malacca_strait"]))
            intermediate_corridors.append(("Arabian Sea Corridor", MARITIME_WAYPOINTS["arabian_sea_central"]))
            intermediate_corridors.append(("Bab-el-Mandeb Strait", MARITIME_WAYPOINTS["bab_el_mandeb"]))
            intermediate_corridors.append(("Suez Canal Transit", MARITIME_WAYPOINTS["suez_canal"]))
            intermediate_corridors.append(("Mediterranean Passage", MARITIME_WAYPOINTS["mediterranean_central"]))
        
        # India to SE Asia / Far East
        elif (65 <= orig_lon <= 85) and (dest_lon > 95):
            intermediate_corridors.append(("Bay of Bengal Corridor", MARITIME_WAYPOINTS["bay_of_bengal_central"]))
            intermediate_corridors.append(("Malacca Approach", MARITIME_WAYPOINTS["malacca_strait"]))

        # India to Middle East / Gulf
        elif (65 <= orig_lon <= 85) and (45 <= dest_lon <= 60):
            intermediate_corridors.append(("Arabian Sea Transit", MARITIME_WAYPOINTS["arabian_sea_central"]))
            intermediate_corridors.append(("Strait of Hormuz Approach", MARITIME_WAYPOINTS["persian_gulf"]))

        # Assemble full route
        route_points = [
            {"index": 0, "name": f"Origin Port ({origin.title()})", "lat": origin_coords[0], "lon": origin_coords[1], "type": "ORIGIN"}
        ]

        if intermediate_corridors:
            for i, (name, coords) in enumerate(intermediate_corridors[:max_samples-2], start=1):
                route_points.append({
                    "index": i,
                    "name": name,
                    "lat": coords[0],
                    "lon": coords[1],
                    "type": "MARITIME_CHOKEPOINT",
                })
        else:
            # Linear geographic interpolation
            num_interp = min(3, max(1, int(total_distance / 600)))
            interps = interpolate_points(origin_coords, dest_coords, num_interp)
            for i, (lat, lon) in enumerate(interps, start=1):
                route_points.append({
                    "index": i,
                    "name": f"Open Sea Segment {i}",
                    "lat": lat,
                    "lon": lon,
                    "type": "TRANSIT_SEGMENT",
                })

        route_points.append({
            "index": len(route_points),
            "name": f"Destination Port ({destination.title()})",
            "lat": dest_coords[0],
            "lon": dest_coords[1],
            "type": "DESTINATION"
        })

        return route_points
