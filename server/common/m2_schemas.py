"""MongoDB Collection Schemas & Validators for Milestone 2 (FQ-AMB-001/M2-DATA).

Defines $jsonSchema validators for the 8 new M2 collections:
  1. rate_cards
  2. rate_card_lines (with oneOf ocean/air validator)
  3. surcharges
  4. rate_card_imports (two-phase import tracking)
  5. margin_policies
  6. approval_rules
  7. quote_approvals
  8. fx_rates
"""

M2_COLLECTION_SCHEMAS = {
    "rate_card_lines": {
        "validator": {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["rate_card_id", "lane_key", "base_rate", "is_active"],
                "properties": {
                    "lane_key": {
                        "bsonType": "string",
                        "pattern": "^[A-Z0-9]{3,8}-[A-Z0-9]{3,8}$"
                    },
                    "base_rate": {
                        "bsonType": "object",
                        "required": ["amount", "currency"],
                        "properties": {
                            "amount": {"bsonType": ["decimal", "double", "int"]},
                            "currency": {"bsonType": "string"}
                        }
                    },
                    "minimum_charge": {
                        "bsonType": "object",
                        "properties": {
                            "amount": {"bsonType": ["decimal", "double", "int"]},
                            "currency": {"bsonType": "string"}
                        }
                    }
                },
                "oneOf": [
                    {
                        "required": ["container_type"],
                        "properties": {"weight_break_min": {"bsonType": "null"}}
                    },
                    {
                        "required": ["weight_break_min"],
                        "properties": {"container_type": {"bsonType": "null"}}
                    }
                ]
            }
        },
        "validationLevel": "strict",
        "validationAction": "error"
    },
    "rate_cards": {
        "validator": {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["name", "mode", "type", "status"],
                "properties": {
                    "name": {"bsonType": "string"},
                    "mode": {"enum": ["OCEAN", "AIR", "GROUND", "GROUND_RAIL"]},
                    "type": {"enum": ["CONTRACT", "SPOT", "TARIFF"]},
                    "status": {"enum": ["DRAFT", "ACTIVE", "EXPIRED", "SUPERSEDED"]}
                }
            }
        }
    },
    "margin_policies": {
        "validator": {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["scope", "floor_pct", "target_pct", "resolution_priority", "is_active"],
                "properties": {
                    "scope": {"enum": ["GLOBAL", "CARGO_TYPE", "LANE", "CUSTOMER_TIER", "CUSTOMER_LANE"]},
                    "resolution_priority": {"bsonType": "int"},
                    "floor_pct": {"bsonType": ["decimal", "double", "int"]},
                    "target_pct": {"bsonType": ["decimal", "double", "int"]},
                    "stretch_pct": {"bsonType": ["decimal", "double", "int"]}
                }
            }
        }
    },
    "approval_rules": {
        "validator": {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["order_index", "name", "condition", "approver_role", "is_active"],
                "properties": {
                    "order_index": {"bsonType": "int"},
                    "name": {"bsonType": "string"},
                    "approver_role": {"enum": ["PRICING_MANAGER", "SENIOR_BROKER", "FINANCE_ADMIN"]},
                    "is_blocking": {"bsonType": "bool"}
                }
            }
        }
    },
    "quote_approvals": {
        "validator": {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["quote_number", "rule_name", "breach_reason", "approver_role", "decision"],
                "properties": {
                    "quote_number": {"bsonType": "string"},
                    "rule_name": {"bsonType": "string"},
                    "breach_reason": {"bsonType": "string"},
                    "approver_role": {"enum": ["PRICING_MANAGER", "SENIOR_BROKER", "FINANCE_ADMIN"]},
                    "decision": {"enum": ["PENDING", "APPROVED", "REJECTED"]}
                }
            }
        }
    }
}
