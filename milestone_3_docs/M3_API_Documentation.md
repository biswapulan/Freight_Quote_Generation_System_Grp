# Milestone 3: REST API Documentation Catalog

---

## Base URL: `http://localhost:8000/api/v1/`

---

## 1. Weather Intelligence Endpoints

### 1.1 `POST /api/v1/weather/assess/`
Calculates oceanographic/atmospheric risk, forecasts transit delay hours, and emits alerts.

**Request Body**:
```json
{
  "shipment_id": "SHP-1001",
  "origin": "Chennai",
  "destination": "Rotterdam",
  "transit_days": 22
}
```

**Response (200 OK)**:
```json
{
  "id": "c1f7a83d-9e12-4f32-824b-63a9254dfb11",
  "shipment_id": "SHP-1001",
  "overall_score": 38.5,
  "risk_level": "MEDIUM",
  "delay_probability": 0.32,
  "estimated_delay_hours": 24.6,
  "has_storm": false,
  "observations": [
    {
      "waypoint_name": "Chennai Port Hub",
      "wave_height": 1.4,
      "wind_speed": 16.2,
      "storm_detected": false
    }
  ],
  "advisories": ["Weather conditions are favorable along corridor."]
}
```

---

## 2. Customs Intelligence & Hybrid RAG Endpoints

### 2.1 `POST /api/v1/customs/validate/`
Validates HS code tariff compliance, performs RAG retrieval, and generates cited document checklists.

**Request Body**:
```json
{
  "shipment_id": "SHP-1001",
  "origin_country": "India",
  "destination_country": "Netherlands",
  "hs_code": "850440",
  "commodity": "Solar Power Inverters",
  "incoterm": "CIF"
}
```

**Response (200 OK)**:
```json
{
  "shipment_id": "SHP-1001",
  "hs_code": "850440",
  "commodity": "Solar Power Inverters",
  "readiness_score": 88.0,
  "status": "APPROVED",
  "is_prohibited": false,
  "checklist_items": [
    {
      "item_name": "Certificate of Origin (COO)",
      "mandatory": true,
      "status": "PENDING",
      "citation": "Netherlands Customs Tariff Schedule - Origin Verification"
    }
  ]
}
```

### 2.2 `POST /api/v1/customs/officer-action/`
Customs Compliance Officer sign-off (`APPROVE` / `REJECT`).

**Request Body**:
```json
{
  "shipment_id": "SHP-1001",
  "action": "APPROVE",
  "officer_name": "Customs Officer Smith",
  "notes": "All regulatory certificates verified."
}
```

---

## 3. Multi-Factor Risk & Policy Gating Endpoints

### 3.1 `POST /api/v1/risk/assess/`
Computes 5-factor composite risk and enforces policy state gating.

**Request Body**:
```json
{
  "shipment_id": "SHP-1001",
  "weather_score": 38.5,
  "customs_score": 12.0,
  "customs_status": "APPROVED",
  "origin": "Chennai",
  "destination": "Rotterdam",
  "cargo_type": "Solar Power Inverters",
  "hs_code": "850440"
}
```

**Response (201 Created)**:
```json
{
  "shipment_id": "SHP-1001",
  "overall_score": 26.8,
  "risk_level": "LOW",
  "can_issue_quote": true,
  "policy_action": "AUTO_APPROVED",
  "explanation": {
    "summary": "Overall shipment risk is LOW (26.8/100). Dominant risk driver is Route.",
    "dominant_factor": "route",
    "contributions": {
      "weather": 11.55,
      "customs": 3.0,
      "route": 9.6,
      "port": 4.5,
      "cargo": 2.5
    }
  }
}
```

---

## 4. Machine Learning Freight Pricing Endpoints

### 4.1 `POST /api/v1/pricing/ml-predict/`
Predicts spot market rate from historical model, computes variance vs. rule baseline, and outputs confidence intervals.

**Request Body**:
```json
{
  "Origin": "Chennai",
  "Destination": "Rotterdam",
  "Transport_Mode": "Sea",
  "Cargo_Type": "Electronics",
  "Container_Type": "40FT",
  "Weight_KG": 3500,
  "Volume_CBM": 8.5,
  "Distance_KM": 8500,
  "Fuel_Price": 95.0,
  "Season": "Peak",
  "Carrier": "Carrier_A",
  "Transit_Days": 15
}
```

**Response (200 OK)**:
```json
{
  "ml_predicted_price_inr": 78500.0,
  "ml_predicted_price_usd": 940.12,
  "rule_based_price_inr": 74200.0,
  "rule_based_price_usd": 888.62,
  "variance_percent": 5.8,
  "confidence_interval_95": {
    "lower_inr": 68098.34,
    "upper_inr": 88901.66,
    "lower_usd": 815.55,
    "upper_usd": 1064.69
  },
  "strategy": "OPTIMAL_MARKET_PARITY",
  "pricing_recommendation": "Rule baseline is tightly aligned with ML spot prediction (+5.8%). Issue quote at standard rate card pricing."
}
```
