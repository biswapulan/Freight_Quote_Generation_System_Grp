# Dataset Documentation & Schema Dictionary
### Dataset: `freight_pricing_training_dataset_5000.xlsx`

---

## 1. Dataset Summary & Characteristics
- **Total Records**: 5,000 Verified Freight Transactions
- **File Format**: Microsoft Excel (.xlsx)
- **Primary Use Case**: Machine Learning regression training for real-time spot freight rate prediction.
- **Data Completeness**: $100\%$ (Zero null values across all 14 feature fields).

---

## 2. Feature Schema & Column Data Dictionary

| Column Name | Data Type | Value Range / Unique Categories | Description |
|---|:---:|---|---|
| `Shipment_ID` | String | `SHP00001` - `SHP05000` | Unique shipment record identifier. |
| `Origin` | String | Major domestic and international freight hubs (e.g. Mumbai, Chennai, Delhi, Shanghai, Singapore, Rotterdam). | Port or city of cargo origin. |
| `Destination` | String | Global destination ports & cities. | Port or city of cargo delivery. |
| `Transport_Mode`| String | `Sea`, `Air`, `Road`, `Rail` | Primary mode of freight transit. |
| `Cargo_Type` | String | `Electronics`, `Chemicals`, `Perishable`, `General Cargo`, `Heavy Machinery`, `Automotive` | Commodity category classification. |
| `Weight_KG` | Numeric | $100.0 - 45,000.0\text{ kg}$ | Total gross cargo weight. |
| `Volume_CBM` | Numeric | $0.5 - 95.0\text{ m}^3$ | Total cubic meter cargo volume. |
| `Distance_KM` | Numeric | $150.0 - 18,500.0\text{ km}$ | Calculated transit distance along route corridor. |
| `Container_Type`| String | `20FT`, `40FT`, `40FT_HC`, `Reefer_20FT`, `Reefer_40FT`, `LCL` | Container / equipment type utilized. |
| `Fuel_Price` | Numeric | $75.0 - 130.0\text{ INR/L}$ | Prevailing fuel index at time of shipment booking. |
| `Season` | String | `Normal`, `Peak`, `Off-Peak`, `Monsoon`, `Holiday` | Market seasonality during quotation window. |
| `Carrier` | String | `Carrier_A`, `Carrier_B`, `Carrier_C`, `Carrier_D`, `Carrier_E` | Maritime line or logistics carrier. |
| `Transit_Days` | Integer | $1 - 45\text{ days}$ | Total voyage duration. |
| `Actual_Freight_Price_INR` | Numeric (Target) | ₹$4,500.00$ - ₹$385,000.00$ | Final realized market freight booking price in Indian Rupees (**Target Variable**). |
