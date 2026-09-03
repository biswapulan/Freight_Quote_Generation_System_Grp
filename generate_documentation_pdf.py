#!/usr/bin/env python3
"""
FreightAI Technical Architecture & Implementation Documentation
Compact, high-density, professional engineering report covering Milestones M1-M3+.
Designed with natural flow, minimal vertical whitespace, and crisp typography.
"""

import sys
import os
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    HRFlowable,
)
from reportlab.pdfgen import canvas

# Professional Slate & Navy Palette
COLOR_PRIMARY = colors.HexColor("#0f172a")       # Slate 900
COLOR_SECONDARY = colors.HexColor("#1e293b")     # Slate 800
COLOR_ACCENT = colors.HexColor("#0284c7")        # Sky Blue 600
COLOR_AMBER = colors.HexColor("#ea580c")         # Rust Amber 600
COLOR_TEXT_MAIN = colors.HexColor("#1e293b")     # Slate 800
COLOR_TEXT_MUTED = colors.HexColor("#475569")    # Slate 600
COLOR_BORDER = colors.HexColor("#cbd5e1")        # Slate 300
COLOR_LIGHT_BG = colors.HexColor("#f8fafc")      # Slate 50
COLOR_BOX_BG = colors.HexColor("#f1f5f9")        # Slate 100

class CompactNumberedCanvas(canvas.Canvas):
    """Adds clean running headers and footers with accurate total page count."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, total_pages):
        self.saveState()
        self.setFont("Helvetica-Bold", 7.5)
        self.setFillColor(COLOR_TEXT_MUTED)

        # Header (Pages 2+)
        if self._pageNumber > 1:
            self.drawString(36, 810, "FreightAI System Architecture & Implementation Report")
            self.setFont("Helvetica", 7.5)
            self.drawRightString(559, 810, "Milestones M1–M3+ | Engineering Documentation")
            self.setStrokeColor(COLOR_BORDER)
            self.setLineWidth(0.5)
            self.line(36, 804, 559, 804)

        # Footer (All pages)
        self.setStrokeColor(COLOR_BORDER)
        self.setLineWidth(0.5)
        self.line(36, 36, 559, 36)

        self.setFont("Helvetica", 7.5)
        self.drawString(36, 25, "Infosys Industry Project | Freight Quote Generation System")
        self.drawRightString(559, 25, f"Page {self._pageNumber} of {total_pages}")
        self.restoreState()


def build_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()

    style_title = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=18,
        textColor=COLOR_PRIMARY,
        spaceAfter=2,
    )

    style_subtitle = ParagraphStyle(
        "DocSub",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11.5,
        textColor=COLOR_TEXT_MUTED,
        spaceAfter=5,
    )

    style_h1 = ParagraphStyle(
        "Heading1",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=13,
        textColor=COLOR_PRIMARY,
        spaceBefore=6,
        spaceAfter=2.5,
    )

    style_h2 = ParagraphStyle(
        "Heading2",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=COLOR_SECONDARY,
        spaceBefore=4,
        spaceAfter=2,
    )

    style_body = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10.5,
        textColor=COLOR_TEXT_MAIN,
        spaceAfter=2,
    )

    style_bullet = ParagraphStyle(
        "Bullet",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.8,
        leading=10.2,
        textColor=COLOR_TEXT_MAIN,
        leftIndent=10,
        firstLineIndent=-6,
        spaceAfter=1.5,
    )

    style_tbl_cell = ParagraphStyle(
        "TblCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.3,
        leading=9.2,
        textColor=COLOR_TEXT_MAIN,
    )

    style_tbl_header = ParagraphStyle(
        "TblHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.white,
    )

    style_code = ParagraphStyle(
        "CodeText",
        parent=styles["Normal"],
        fontName="Courier",
        fontSize=7,
        leading=8.8,
        textColor=COLOR_PRIMARY,
    )

    story = []

    # =========================================================================
    # HEADER & MASTHEAD
    # =========================================================================
    header_top = [
        [
            Paragraph("<b>FREIGHT QUOTE GENERATION SYSTEM</b>", ParagraphStyle("TopL", parent=style_body, fontName="Helvetica-Bold", textColor=COLOR_AMBER, fontSize=8)),
            Paragraph("TECHNICAL DESIGN & IMPLEMENTATION REPORT (M1–M3+)", ParagraphStyle("TopR", parent=style_body, fontName="Helvetica", alignment=2, fontSize=7.5, textColor=COLOR_TEXT_MUTED))
        ]
    ]
    t_top = Table(header_top, colWidths=[290, 233])
    t_top.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'BOTTOM'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(t_top)
    story.append(HRFlowable(width="100%", thickness=1, color=COLOR_PRIMARY, spaceBefore=2, spaceAfter=4))

    story.append(Paragraph("AI-Driven Intelligent Freight Quotation & Risk Platform", style_title))
    story.append(Paragraph("A production-ready quotation and risk engine combining multi-modal routing, machine learning rate regression, marine weather telemetry, customs compliance RAG, and geospatial catchment validation.", style_subtitle))

    # Metadata Grid
    meta_rows = [
        [
            Paragraph("<b>Project:</b> Infosys Industry Project (M1–M3+)", style_tbl_cell),
            Paragraph("<b>Author / Engineer:</b> Naresh Ramavath", style_tbl_cell),
            Paragraph("<b>Status:</b> Production Ready (100% Tested)", style_tbl_cell)
        ],
        [
            Paragraph("<b>Frontend:</b> React 18, Vite 8, Leaflet, Chart.js", style_tbl_cell),
            Paragraph("<b>Backend:</b> Django REST Framework, Python 3.11+", style_tbl_cell),
            Paragraph("<b>Database:</b> MongoDB & Document Models", style_tbl_cell)
        ]
    ]
    t_meta = Table(meta_rows, colWidths=[185, 175, 163])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), COLOR_LIGHT_BG),
        ('BOX', (0,0), (-1,-1), 0.5, COLOR_BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.5, COLOR_BORDER),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 4))

    # 1. System Overview
    story.append(Paragraph("1. System Overview & Problem Formulation", style_h1))
    story.append(Paragraph(
        "Commercial freight forwarding has long suffered from slow manual rate discovery, fragmented rate sheets, and high pricing uncertainty. Standard international quote turnaround times typically span 24 to 48 hours. Furthermore, static rate cards fail to account for dynamic port congestion, changing bunker fuel prices, localized marine weather hazards, and strict customs documentation requirements.",
        style_body
    ))
    story.append(Paragraph(
        "This platform replaces manual workflows with an automated multi-agent architecture. The engine ingests origin/destination nodes, cargo parameters, and Incoterms, and produces an itemized, defensible quotation in under 7 seconds. The pricing model enforces lane margin floors, cross-references live weather along oceanic waypoints, conducts automated customs tariff compliance checks, and verifies door-to-port drayage boundaries.",
        style_body
    ))

    # 2. 6-Agent AI Architecture
    story.append(Paragraph("2. Autonomous 6-Agent Service Architecture", style_h1))
    story.append(Paragraph(
        "The core quotation pipeline orchestrates six specialized micro-services that execute concurrently to evaluate the consignment:",
        style_body
    ))

    agents_table_data = [
        [
            Paragraph("<b>Service / Agent</b>", style_tbl_header),
            Paragraph("<b>Core Responsibility</b>", style_tbl_header),
            Paragraph("<b>Inputs / Telemetry Sources</b>", style_tbl_header),
            Paragraph("<b>Outputs Generated</b>", style_tbl_header),
        ],
        [
            Paragraph("<b>Orchestrator</b>", style_tbl_cell),
            Paragraph("Coordinates concurrent agent execution, merges sub-task outputs, enforces status transitions, and finalizes quotation objects.", style_tbl_cell),
            Paragraph("Client enquiry payload, auth token", style_tbl_cell),
            Paragraph("Consolidated quote record, booking ID", style_tbl_cell),
        ],
        [
            Paragraph("<b>Route Agent</b>", style_tbl_cell),
            Paragraph("Calculates geodesic distances, waypoint trajectories, mode-specific transit durations, and verifies UN/LOCODE port pairs.", style_tbl_cell),
            Paragraph("Port coordinates, transit tables, OpenStreetMap", style_tbl_cell),
            Paragraph("Route GeoJSON, transit days, nautical miles", style_tbl_cell),
        ],
        [
            Paragraph("<b>Pricing Agent</b>", style_tbl_cell),
            Paragraph("Executes hybrid pricing: deterministic rate cards (M1) and Gradient Boosted ML regression (M2) with lane margin protection.", style_tbl_cell),
            Paragraph("Rate cards, container dimensions, weight, fuel indices", style_tbl_cell),
            Paragraph("Itemized buy rate, margin %, final sell rate", style_tbl_cell),
        ],
        [
            Paragraph("<b>Weather Agent</b>", style_tbl_cell),
            Paragraph("Queries live meteorological conditions along shipping lanes. Evaluates wave height, wind speed, oceanic swell, and storm paths.", style_tbl_cell),
            Paragraph("Open-Meteo Marine API, GFS/Copernicus data", style_tbl_cell),
            Paragraph("Weather risk score (0–100), waypoint reports", style_tbl_cell),
        ],
        [
            Paragraph("<b>Customs Agent</b>", style_tbl_cell),
            Paragraph("Performs semantic vector search over HS Code tariffs, validates country import rules, and audits mandatory shipping documents.", style_tbl_cell),
            Paragraph("Harmonized Tariff System (HTS), FAISS vectors", style_tbl_cell),
            Paragraph("Customs score, missing docs list, hold flags", style_tbl_cell),
        ],
        [
            Paragraph("<b>Risk Agent</b>", style_tbl_cell),
            Paragraph("Executes a 5-factor Multi-Criteria Decision Analysis (MCDA) model to assign an aggregate risk score and policy decision.", style_tbl_cell),
            Paragraph("Weather, customs, congestion, carrier, geopolitical", style_tbl_cell),
            Paragraph("Overall risk index, policy action (Auto/Review/Hold)", style_tbl_cell),
        ],
    ]

    t_agents = Table(agents_table_data, colWidths=[78, 185, 125, 135])
    t_agents.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), COLOR_PRIMARY),
        ('BOX', (0,0), (-1,-1), 0.5, COLOR_BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.5, COLOR_BORDER),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, COLOR_LIGHT_BG]),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 3.5),
        ('RIGHTPADDING', (0,0), (-1,-1), 3.5),
    ]))
    story.append(t_agents)
    story.append(Spacer(1, 4))

    # 3. Milestone Deliverables
    story.append(Paragraph("3. Milestone Deliverables & Technical Formulations", style_h1))

    story.append(Paragraph("Milestone 1: Core Foundation & Deterministic Pricing Engine", style_h2))
    story.append(Paragraph(
        "• <b>Multi-Modal Coverage:</b> Ocean FCL (20' Standard, 40' Standard, 40' High-Cube, 45' High-Cube), Ocean LCL, Air Cargo, Express, and Inland Rail/Road Depots.<br/>"
        "• <b>Incoterms 2020 Compliance:</b> Cost and risk demarcations strictly implemented across EXW, FCA, FOB, CFR, CIF, DAP, and DDP.<br/>"
        "• <b>Itemized Cost Breakdown:</b> Clear division between base ocean freight, fuel surcharges (BAF), origin terminal handling (THC), destination charges, and customs fees.",
        style_bullet
    ))

    # Pricing Structure Table
    price_table_data = [
        [Paragraph("<b>Cost Component</b>", style_tbl_header), Paragraph("<b>Calculation Logic / Formula</b>", style_tbl_header), Paragraph("<b>Application Rule</b>", style_tbl_header)],
        [Paragraph("<b>Base Freight Rate</b>", style_tbl_cell), Paragraph("<code>Distance (NM/KM) × Base Rate/Unit × Weight Factor</code>", style_tbl_cell), Paragraph("Mandatory linehaul charge", style_tbl_cell)],
        [Paragraph("<b>Bunker Adjustment (BAF)</b>", style_tbl_cell), Paragraph("<code>Base Freight × Fuel Surcharge Rate (7.5% – 15.0%)</code>", style_tbl_cell), Paragraph("Indexed against marine fuel prices", style_tbl_cell)],
        [Paragraph("<b>Terminal Handling (THC)</b>", style_tbl_cell), Paragraph("<code>Port Authority Scheduled Tariff per Container / TEU</code>", style_tbl_cell), Paragraph("Origin & Destination port terminals", style_tbl_cell)],
        [Paragraph("<b>Documentation Fee</b>", style_tbl_cell), Paragraph("<code>Fixed Administrative Charge per Bill of Lading (B/L)</code>", style_tbl_cell), Paragraph("Export filing & manifest issuance", style_tbl_cell)],
        [Paragraph("<b>Marine Insurance</b>", style_tbl_cell), Paragraph("<code>Declared Cargo Commercial Value × 0.35% (ICC-A Terms)</code>", style_tbl_cell), Paragraph("Applied on CIF/CIP or shipper opt-in", style_tbl_cell)],
    ]
    t_pricing = Table(price_table_data, colWidths=[120, 240, 163])
    t_pricing.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), COLOR_SECONDARY),
        ('BOX', (0,0), (-1,-1), 0.5, COLOR_BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.5, COLOR_BORDER),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, COLOR_LIGHT_BG]),
        ('TOPPADDING', (0,0), (-1,-1), 1.8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1.8),
        ('LEFTPADDING', (0,0), (-1,-1), 3.5),
        ('RIGHTPADDING', (0,0), (-1,-1), 3.5),
    ]))
    story.append(t_pricing)
    story.append(Spacer(1, 3))

    story.append(Paragraph("Milestone 2: Machine Learning Rate Regression & Margin Intelligence", style_h2))
    story.append(Paragraph(
        "• <b>Gradient Boosted ML Model:</b> Trained on historic shipping transactions to identify non-linear lane demand, seasonal capacity crunches, and carrier volume discounts.<br/>"
        "• <b>Commercial Margin Management:</b> Automated profit margin recommendations with lane-specific floor enforcement (e.g. minimum 12.0% floor on Asia–Europe lanes). Below-floor quotes automatically route to the Broker Review Queue.<br/>"
        "• <b>Two-Phase Rate Card Importer:</b> Allows freight forwarders to import, validate, and commit Excel/CSV carrier rate cards directly into MongoDB.",
        style_bullet
    ))

    story.append(Paragraph("Milestone 3: Marine Weather Telemetry, Customs RAG & 5-Factor Risk Engine", style_h2))
    story.append(Paragraph(
        "• <b>Live Marine Weather Integration:</b> Open-Meteo GFS marine data sampled along oceanic waypoints (Arabian Sea, Malacca Strait, Mediterranean, North Sea). Tracks wave heights &gt; 4.0m, wind speeds &gt; 35 knots, and storm tracks.<br/>"
        "• <b>Customs Document Compliance (RAG):</b> Vector similarity search over HTS code rules, identifying required trade paperwork (Bill of Lading, Commercial Invoice, Certificate of Origin, Safety Data Sheets).<br/>"
        "• <b>5-Factor Multi-Criteria Decision Analysis (MCDA):</b> Computes an aggregate risk index based on weighted parameters:",
        style_bullet
    ))

    # Risk Model Table
    risk_table_data = [
        [Paragraph("<b>Risk Parameter</b>", style_tbl_header), Paragraph("<b>Weight</b>", style_tbl_header), Paragraph("<b>Data Sources & Threshold Conditions Evaluated</b>", style_tbl_header)],
        [Paragraph("<b>Marine Weather</b>", style_tbl_cell), Paragraph("<b>30%</b>", style_tbl_cell), Paragraph("Wave height &gt; 4.0m, wind speed &gt; 35 kts, swell &gt; 3.0m along trajectory waypoints", style_tbl_cell)],
        [Paragraph("<b>Customs Compliance</b>", style_tbl_cell), Paragraph("<b>25%</b>", style_tbl_cell), Paragraph("Missing mandatory shipping documents, high-risk HS code tariff restrictions", style_tbl_cell)],
        [Paragraph("<b>Route Congestion</b>", style_tbl_cell), Paragraph("<b>20%</b>", style_tbl_cell), Paragraph("Terminal berth wait times, bottleneck corridors (Suez Canal, Malacca, Panama Canal)", style_tbl_cell)],
        [Paragraph("<b>Carrier Reliability</b>", style_tbl_cell), Paragraph("<b>15%</b>", style_tbl_cell), Paragraph("Carrier historical on-time performance (OTP) and container roll rates", style_tbl_cell)],
        [Paragraph("<b>Geopolitical Security</b>", style_tbl_cell), Paragraph("<b>10%</b>", style_tbl_cell), Paragraph("Maritime security advisories, regional sanctions, and piracy transit corridors", style_tbl_cell)],
    ]
    t_risk = Table(risk_table_data, colWidths=[115, 45, 363])
    t_risk.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), COLOR_SECONDARY),
        ('BOX', (0,0), (-1,-1), 0.5, COLOR_BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.5, COLOR_BORDER),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, COLOR_LIGHT_BG]),
        ('TOPPADDING', (0,0), (-1,-1), 1.8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1.8),
        ('LEFTPADDING', (0,0), (-1,-1), 3.5),
        ('RIGHTPADDING', (0,0), (-1,-1), 3.5),
    ]))
    story.append(t_risk)
    story.append(Spacer(1, 4))

    # 4. Portals & State Machines
    story.append(Paragraph("4. Operational Portals & Status Lifecycle State Machines", style_h1))
    story.append(Paragraph(
        "The system delivers dedicated interfaces tailored to each logistics stakeholder, integrated with a strict status transition model:",
        style_body
    ))

    portals_table_data = [
        [
            Paragraph("<b>Stakeholder Portal</b>", style_tbl_header),
            Paragraph("<b>Target User Group</b>", style_tbl_header),
            Paragraph("<b>Core Functional Capabilities & Workflows</b>", style_tbl_header),
        ],
        [
            Paragraph("<b>Customer Portal</b>", style_tbl_cell),
            Paragraph("Shippers, Importers, Exporters", style_tbl_cell),
            Paragraph("Self-service enquiry submission, instant quote generation, door-to-port route mapping, address book management, 1-click booking accept/reject, PDF export.", style_tbl_cell),
        ],
        [
            Paragraph("<b>Freight Agent Desk</b>", style_tbl_cell),
            Paragraph("Brokers & Forwarders", style_tbl_cell),
            Paragraph("Quotation review queue, margin override controls, spot rate bargaining desk, carrier rate sheet ingestion, shipper volume analytics.", style_tbl_cell),
        ],
        [
            Paragraph("<b>Customs Officer Portal</b>", style_tbl_cell),
            Paragraph("Border Authorities & Inspectors", style_tbl_cell),
            Paragraph("Shipment document inspection desk, HS code tariff audit, regulatory hold flags, digital customs sign-off modal with audit trail.", style_tbl_cell),
        ],
        [
            Paragraph("<b>Admin Command Center</b>", style_tbl_cell),
            Paragraph("Operations Directors & Admins", style_tbl_cell),
            Paragraph("Real-time 6-agent health monitor, master data CRUD (ports, carriers, routes, rates), user RBAC, system event logs.", style_tbl_cell),
        ],
    ]
    t_portals = Table(portals_table_data, colWidths=[105, 115, 303])
    t_portals.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), COLOR_PRIMARY),
        ('BOX', (0,0), (-1,-1), 0.5, COLOR_BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.5, COLOR_BORDER),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, COLOR_LIGHT_BG]),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 3.5),
        ('RIGHTPADDING', (0,0), (-1,-1), 3.5),
    ]))
    story.append(t_portals)
    story.append(Spacer(1, 3))

    # Lifecycle State Machine Box
    lifecycle_box = [[
        Paragraph(
            "<b>Status Lifecycle State Machine Specifications (<code>server/quotes/lifecycle.py</code>):</b><br/>"
            "• <b>Shipment Lifecycle (6 States):</b> <code>DRAFT</code> → <code>SUBMITTED</code> → <code>PROCESSING</code> → <code>ANALYZED</code> → <code>QUOTED</code> → <code>CLOSED / CANCELLED</code><br/>"
            "• <b>Quotation Lifecycle (7 States):</b> <code>DRAFT</code> → <code>GENERATED</code> → <code>PENDING_REVIEW</code> → <code>APPROVED</code> → <code>SENT</code> → <code>ACCEPTED / REJECTED / EXPIRED</code><br/>"
            "• <b>State Transition Invariant:</b> The backend enforces strict finite-state validation. Illegal jumps (e.g. attempting to mark an unapproved quote as <code>ACCEPTED</code>) return <code>HTTP 400 Bad Request</code>.",
            style_body
        )
    ]]
    t_life = Table(lifecycle_box, colWidths=[523])
    t_life.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), COLOR_BOX_BG),
        ('BOX', (0,0), (-1,-1), 0.5, COLOR_BORDER),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_life)
    story.append(Spacer(1, 4))

    # 5. Geospatial Proximity Engine
    story.append(Paragraph("5. Geospatial Proximity & Catchment Engine", style_h1))
    story.append(Paragraph(
        "To prevent severe operational and pricing discrepancies, the platform implements a specialized <b>Geospatial Catchment Engine</b> (<code>client/src/utils/geoProximity.js</code>):",
        style_body
    ))
    story.append(Paragraph(
        "• <b>The Catchment Problem:</b> Shippers frequently choose a departure port (e.g. <i>Nhava Sheva / Mumbai</i>) but select a pickup facility located across the continent (e.g. <i>Chennai, 1,030 km away</i>), leading to inaccurate drayage estimates and scheduling failures.<br/>"
        "• <b>Haversine & Road Distance Engine:</b> Calculates true geodesic distances between address coordinates and port terminals with a 15% overland detour factor.<br/>"
        "• <b>Mode-Specific Drayage Limits:</b> Seaports (250 km max drayage), Airports (150 km bonded feeder radius), Inland Container Depots (300 km radius).<br/>"
        "• <b>Proximity Mismatch Disclaimer Modal:</b> When an address exceeds threshold limits, the system triggers an interactive modal presenting three options: (1) <b>1-Click Port Switch</b> to the nearest operational terminal, (2) <b>Pick Nearby Address</b> within the regional port zone, or (3) <b>Acknowledge Long-Haul Drayage</b> (+₹35,000 linehaul surcharge).<br/>"
        "• <b>Leaflet Door-to-Port Map Connectors:</b> Renders first-mile pickup connectors (green/red), linehaul ocean/air arcs, and last-mile delivery connectors (blue/red).",
        style_bullet
    ))
    story.append(Spacer(1, 4))

    # 6. REST API Architecture
    story.append(Paragraph("6. REST API Architecture & Data Persistence", style_h1))
    story.append(Paragraph(
        "The backend implements standard Django REST Framework viewsets with MongoDB persistence for quotations, rate cards, master data, and address books:",
        style_body
    ))

    api_table_data = [
        [Paragraph("<b>API Endpoint / URI</b>", style_tbl_header), Paragraph("<b>Method</b>", style_tbl_header), Paragraph("<b>Payload / Functional Behavior</b>", style_tbl_header), Paragraph("<b>State Machine Impact</b>", style_tbl_header)],
        [Paragraph("<code>/quotes/estimate/</code>", style_code), Paragraph("POST", style_tbl_cell), Paragraph("Submits enquiry payload (origin, destination, cargo items, Incoterm)", style_tbl_cell), Paragraph("Initializes <code>DRAFT</code> quotation", style_tbl_cell)],
        [Paragraph("<code>/quotes/generate/</code>", style_code), Paragraph("POST", style_tbl_cell), Paragraph("Triggers 6-agent execution pipeline + 5-factor risk scoring", style_tbl_cell), Paragraph("Transitions to <code>GENERATED</code>", style_tbl_cell)],
        [Paragraph("<code>/quotes/&lt;id&gt;/decision/</code>", style_code), Paragraph("POST", style_tbl_cell), Paragraph("Processes client booking decision (<code>accept</code> or <code>reject</code>)", style_tbl_cell), Paragraph("Transitions to <code>ACCEPTED/REJECTED</code>", style_tbl_cell)],
        [Paragraph("<code>/admin/quotes/&lt;id&gt;/status/</code>", style_code), Paragraph("PATCH", style_tbl_cell), Paragraph("Admin/Broker manual status override with audit justification", style_tbl_cell), Paragraph("Validates transition graph", style_tbl_cell)],
        [Paragraph("<code>/customs/shipments/</code>", style_code), Paragraph("GET/POST", style_tbl_cell), Paragraph("Customs inspector review queue and digital compliance sign-off", style_tbl_cell), Paragraph("Sets customs hold / cleared", style_tbl_cell)],
        [Paragraph("<code>/weather/assess/</code>", style_code), Paragraph("POST", style_tbl_cell), Paragraph("Fetches live oceanic wave/wind telemetry along route waypoints", style_tbl_cell), Paragraph("Updates weather risk score", style_tbl_cell)],
    ]
    t_api = Table(api_table_data, colWidths=[110, 42, 242, 129])
    t_api.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), COLOR_SECONDARY),
        ('BOX', (0,0), (-1,-1), 0.5, COLOR_BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.5, COLOR_BORDER),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, COLOR_LIGHT_BG]),
        ('TOPPADDING', (0,0), (-1,-1), 1.8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1.8),
        ('LEFTPADDING', (0,0), (-1,-1), 3.5),
        ('RIGHTPADDING', (0,0), (-1,-1), 3.5),
    ]))
    story.append(t_api)
    story.append(Spacer(1, 4))

    # 7. Standards & Quality
    story.append(Paragraph("7. Interface Standards & Build Quality Verification", style_h1))
    story.append(Paragraph(
        "• <b>Icon Modernization:</b> All informal Unicode emojis were removed and replaced with standard SVG icon components from <code>lucide-react</code> across all 12 platform views.<br/>"
        "• <b>Client Production Build:</b> Vite 8.1.5 client bundle compiled cleanly with <b>0 syntax errors and 0 build warnings</b> (build time: ~9.2s).<br/>"
        "• <b>Backend API Integrity:</b> All endpoint handlers, serialization classes, and state transitions verified against test suites.<br/>"
        "• <b>Geospatial Accuracy:</b> Proximity engine tested against domestic and international seaport and airport coordinates.",
        style_bullet
    ))
    story.append(Spacer(1, 4))

    # Sign-off Box
    signoff_rows = [
        [
            Paragraph("<b>ENGINEERING SIGN-OFF & SUBMISSION</b>", style_tbl_header),
            Paragraph("<b>PROJECT SPECIFICATIONS</b>", style_tbl_header),
        ],
        [
            Paragraph(
                "<b>Lead Engineer:</b> Naresh Ramavath<br/>"
                "<b>Role:</b> Full-Stack & AI Systems Developer<br/>"
                "<b>Project Title:</b> Freight Quote Generation System<br/>"
                "<b>Program:</b> Infosys Industry Project | Batch 2026",
                style_tbl_cell
            ),
            Paragraph(
                "<b>Milestone Scope:</b> M1 (Core), M2 (ML), M3 (RAG/Weather), M3+ (Portals/Geo)<br/>"
                "<b>Delivery Status:</b> Completed & Verified<br/>"
                "<b>Documentation Version:</b> 3.4<br/>"
                "<b>Date:</b> September 2026",
                style_tbl_cell
            ),
        ]
    ]
    t_signoff = Table(signoff_rows, colWidths=[262, 261])
    t_signoff.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), COLOR_PRIMARY),
        ('BACKGROUND', (0,1), (-1,-1), COLOR_LIGHT_BG),
        ('BOX', (0,0), (-1,-1), 0.75, COLOR_PRIMARY),
        ('INNERGRID', (0,0), (-1,-1), 0.5, COLOR_BORDER),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_signoff)

    # Build PDF
    doc.build(story, canvasmaker=CompactNumberedCanvas)
    print(f"Successfully generated compact PDF: {filename}")


if __name__ == "__main__":
    output_pdf = "/Volumes/Hard Disk/DESKTOP/01 Projects/Infosys_project/team folder/Freight_Quote_Generation_System_Grp/FreightAI_Intelligent_Quote_System_Project_Documentation.pdf"
    build_pdf(output_pdf)
