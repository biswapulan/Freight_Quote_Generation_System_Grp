# Weather Agent Design & Marine Telemetry Engine Specification

---

## 1. Agent Mission & Responsibilities
The Weather Intelligence Agent ingests real-time oceanographic and meteorological telemetry along international marine routes, translates raw physical observations (wave swell, wind knots, barometric pressure) into standardized 0–100 risk metrics, and predicts voyage delay probabilities.

---

## 2. Telemetry Ingestion Architecture

### 2.1 Route Waypoint Sampling (`sampler.py`)
Shipping corridors are sampled into $N$ discrete evaluation waypoints ($N \in [2, 10]$):
- **Predefined Corridors**: e.g., Chennai $\rightarrow$ Colombo $\rightarrow$ Bab-el-Mandeb $\rightarrow$ Suez Canal $\rightarrow$ Rotterdam.
- **Great-Circle Interpolation**: Generates geodetic coordinates:
  $$\text{lat}_i = \text{lat}_0 + \frac{i}{N}(\text{lat}_1 - \text{lat}_0), \quad \text{lon}_i = \text{lon}_0 + \frac{i}{N}(\text{lon}_1 - \text{lon}_0)$$

### 2.2 Open-Meteo Integration (`provider.py`)
- **Marine API Endpoint**: `https://marine-api.open-meteo.com/v1/marine` (Wave height, wave direction, wave period, swell height).
- **Forecast API Endpoint**: `https://api.open-meteo.com/v1/forecast` (10m wind speed, gusts, precipitation, surface pressure, visibility).
- **Resilient Fallback**: If Open-Meteo is unreachable, deterministic seasonal marine simulation ensures $100\%$ pipeline continuity.

---

## 3. Mathematical Risk Formulation (`engine.py`)

$$\text{WeatherRiskScore} = (0.35 \cdot W_{\text{wave}}) + (0.30 \cdot W_{\text{wind}}) + (0.20 \cdot W_{\text{storm}}) + (0.10 \cdot W_{\text{precip}}) + (0.05 \cdot W_{\text{temp}})$$

### Parameter Thresholds:
- **Wave Height ($m$)**:
  - $< 1.5\text{m}$: Low ($0 - 18$)
  - $1.5 - 3.0\text{m}$: Moderate ($20 - 50$)
  - $3.0 - 5.0\text{m}$: Rough ($50 - 86$)
  - $> 5.0\text{m}$: Severe / Dangerous ($86 - 100$)
- **Wind Speed ($\text{knots}$)**:
  - $< 15\text{kt}$: Low ($0 - 20$)
  - $15 - 28\text{kt}$: Moderate ($20 - 50$)
  - $28 - 40\text{kt}$: Gale ($50 - 80$)
  - $> 40\text{kt}$: Storm ($80 - 100$)

### Delay Probability & Hours:
$$\text{DelayProb} = \min\left(0.95, \max\left(0.05, \frac{\text{Score}}{120.0}\right)\right)$$
$$\text{EstimatedDelayHours} = \text{DelayProb} \times (\text{TransitDays} \times 24 \times 0.35)$$
