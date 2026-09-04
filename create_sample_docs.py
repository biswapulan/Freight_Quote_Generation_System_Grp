import os
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

OUT_DIRS = [
    os.path.abspath("sample_trade_documents"),
    os.path.abspath("client/public/sample_trade_documents")
]

for d in OUT_DIRS:
    os.makedirs(d, exist_ok=True)

styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    "DocTitle",
    parent=styles["Heading1"],
    fontSize=18,
    leading=22,
    textColor=colors.HexColor("#0f172a"),
    alignment=1, # Center
    fontName="Helvetica-Bold"
)

sub_style = ParagraphStyle(
    "DocSub",
    parent=styles["Normal"],
    fontSize=10,
    leading=14,
    textColor=colors.HexColor("#64748b"),
    alignment=1,
    fontName="Helvetica"
)

h2_style = ParagraphStyle(
    "SectionHeading",
    parent=styles["Heading2"],
    fontSize=12,
    leading=16,
    textColor=colors.HexColor("#0284c7"),
    fontName="Helvetica-Bold",
    spaceBefore=10,
    spaceAfter=6
)

body_style = ParagraphStyle(
    "Body",
    parent=styles["Normal"],
    fontSize=9,
    leading=13,
    textColor=colors.HexColor("#334155"),
    fontName="Helvetica"
)

bold_style = ParagraphStyle(
    "BodyBold",
    parent=styles["Normal"],
    fontSize=9,
    leading=13,
    textColor=colors.HexColor("#0f172a"),
    fontName="Helvetica-Bold"
)

badge_style = ParagraphStyle(
    "Badge",
    parent=styles["Normal"],
    fontSize=9,
    leading=12,
    textColor=colors.HexColor("#059669"),
    fontName="Helvetica-Bold",
    alignment=1
)

def build_pdf(filename, title, subtitle, content_elements):
    for d in OUT_DIRS:
        filepath = os.path.join(d, filename)
        doc = SimpleDocTemplate(filepath, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
        story = [
            Paragraph(title, title_style),
            Spacer(1, 4),
            Paragraph(subtitle, sub_style),
            Spacer(1, 8),
            HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0284c7"), spaceAfter=12),
        ] + content_elements + [
            Spacer(1, 20),
            HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1"), spaceAfter=8),
            Paragraph("Official Maritime Document &bull; Verified under IMO FAL Convention &amp; FreightAI Automated Clearance Gateway", sub_style)
        ]
        doc.build(story)
        print(f"Generated: {filepath}")

# 1. Commercial Invoice
inv_elements = [
    Table([
        [
            Paragraph("<b>EXPORTER / SHIPPER:</b><br/>ABC Electronics Private Limited<br/>Plot 44, Guindy Industrial Estate<br/>Chennai, Tamil Nadu 600032, India<br/>GSTIN: 33AAACA1234F1Z5 &bull; IEC: 0409012345", body_style),
            Paragraph("<b>INVOICE NO:</b> INV-2026-8849<br/><b>DATE:</b> 04-Sep-2026<br/><b>SHIPMENT REF:</b> SHP-1001 / QT-4YAD7U1V<br/><b>INCOTERM:</b> CIF Rotterdam Port<br/><b>CURRENCY:</b> USD ($)", body_style)
        ],
        [
            Paragraph("<b>CONSIGNEE / IMPORTER:</b><br/>Global Tech Logistics B.V.<br/>Weena 505, 3013 AL Rotterdam<br/>Kingdom of the Netherlands<br/>EU VAT ID: NL882910492B01", body_style),
            Paragraph("<b>PORT OF LOADING:</b> Chennai Sea Port (INMAA)<br/><b>PORT OF DISCHARGE:</b> Port of Rotterdam (NLRTM)<br/><b>OCEAN CARRIER:</b> MSC Mediterranean Shipping<br/><b>VESSEL / VOYAGE:</b> MSC Paloma / V.24E", body_style)
        ]
    ], colWidths=[270, 270], style=[
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#e2e8f0")),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 8),
    ]),
    Spacer(1, 14),
    Paragraph("Itemized Merchandise Breakdown", h2_style),
    Table([
        [Paragraph("<b>Item / Description</b>", bold_style), Paragraph("<b>HS Code</b>", bold_style), Paragraph("<b>Qty</b>", bold_style), Paragraph("<b>Unit Price</b>", bold_style), Paragraph("<b>Total (USD)</b>", bold_style)],
        [Paragraph("Industrial IoT Telemetry Gateways &amp; Transceivers", body_style), Paragraph("8517.12.00", body_style), Paragraph("1,200 pcs", body_style), Paragraph("$65.00", body_style), Paragraph("$78,000.00", body_style)],
        [Paragraph("Enterprise Edge Compute Micro-Servers (Model ES-40)", body_style), Paragraph("8471.41.00", body_style), Paragraph("300 pcs", body_style), Paragraph("$180.00", body_style), Paragraph("$54,000.00", body_style)],
        [Paragraph("High-Density Lithium-Safe Sensor Modules", body_style), Paragraph("9031.80.80", body_style), Paragraph("800 pcs", body_style), Paragraph("$20.625", body_style), Paragraph("$16,500.00", body_style)],
        [Paragraph("<b>TOTAL COMMERCIAL VALUE (CIF)</b>", bold_style), Paragraph("<b>3 Lines</b>", bold_style), Paragraph("<b>2,300 pcs</b>", bold_style), Paragraph("<b>—</b>", bold_style), Paragraph("<b>$148,500.00</b>", bold_style)],
    ], colWidths=[200, 75, 75, 80, 110], style=[
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#e0f2fe")),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor("#f1f5f9")),
        ('PADDING', (0,0), (-1,-1), 6),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]),
    Spacer(1, 14),
    Table([
        [
            Paragraph("<b>CUSTOMS DECLARATION &amp; CERTIFICATION:</b><br/>We hereby declare that this invoice shows the actual price of the goods described, that no other invoice has been or will be issued, and that all particulars are true and correct.", body_style),
            Paragraph("<br/><b>AUTHORIZED SIGNATURE:</b><br/><i>R. Sundaram (Director of Logistics)</i><br/>ABC Electronics Pvt Ltd &bull; Chennai", body_style)
        ]
    ], colWidths=[360, 180], style=[
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('PADDING', (0,0), (-1,-1), 8),
    ])
]
build_pdf("Commercial_Invoice_INV2026.pdf", "COMMERCIAL INVOICE", "International Maritime Export Document &bull; Customs Clearance Declaration", inv_elements)

# 2. Packing List
pl_elements = [
    Table([
        [
            Paragraph("<b>SHIPPER:</b> ABC Electronics Pvt Ltd &bull; Chennai, India", body_style),
            Paragraph("<b>PACKING LIST REF:</b> PL-2026-9921<br/><b>DATE:</b> 04-Sep-2026", body_style)
        ],
        [
            Paragraph("<b>CONSIGNEE:</b> Global Tech Logistics B.V. &bull; Rotterdam, NL", body_style),
            Paragraph("<b>VESSEL:</b> MSC Paloma V.24E &bull; Voyage: 24E<br/><b>LANE:</b> Chennai (INMAA) ➔ Rotterdam (NLRTM)", body_style)
        ]
    ], colWidths=[270, 270], style=[
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#e2e8f0")),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
        ('PADDING', (0,0), (-1,-1), 8),
    ]),
    Spacer(1, 14),
    Paragraph("Cargo Package & Weight Specifications", h2_style),
    Table([
        [Paragraph("<b>Package ID</b>", bold_style), Paragraph("<b>Container &amp; Seal No</b>", bold_style), Paragraph("<b>Pallets</b>", bold_style), Paragraph("<b>Gross Wt (kg)</b>", bold_style), Paragraph("<b>Net Wt (kg)</b>", bold_style), Paragraph("<b>Dimensions / CBM</b>", bold_style)],
        [Paragraph("PKG-01 to 12", body_style), Paragraph("MSCU-7829104<br/>Seal: IN99281A", body_style), Paragraph("12 Pallets", body_style), Paragraph("6,250 kg", body_style), Paragraph("5,900 kg", body_style), Paragraph("120x80x160 cm &bull; 29.2 CBM", body_style)],
        [Paragraph("PKG-13 to 24", body_style), Paragraph("CMAU-9182301<br/>Seal: IN99282B", body_style), Paragraph("12 Pallets", body_style), Paragraph("6,250 kg", body_style), Paragraph("5,900 kg", body_style), Paragraph("120x80x160 cm &bull; 29.2 CBM", body_style)],
        [Paragraph("<b>TOTALS</b>", bold_style), Paragraph("<b>2 &times; 40HC Containers</b>", bold_style), Paragraph("<b>24 Pallets</b>", bold_style), Paragraph("<b>12,500 kg</b>", bold_style), Paragraph("<b>11,800 kg</b>", bold_style), Paragraph("<b>58.4 CBM Total</b>", bold_style)],
    ], colWidths=[70, 110, 70, 90, 90, 110], style=[
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#fef3c7")),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor("#f1f5f9")),
        ('PADDING', (0,0), (-1,-1), 6),
    ])
]
build_pdf("Packing_List_PL9921.pdf", "EXPORT PACKING LIST", "Official Cargo Manifest & Dimension Specifications", pl_elements)

# 3. Bill of Lading Draft
bl_elements = [
    Table([
        [
            Paragraph("<b>MEDITERRANEAN SHIPPING COMPANY S.A.</b><br/>Geneva, Switzerland &bull; Chennai Port Liaison Office", bold_style),
            Paragraph("<b>OCEAN BILL OF LADING DRAFT</b><br/><b>B/L NUMBER:</b> MSCU-MAA-ROT-48109<br/><b>BOOKING REF:</b> BK-2026-88194", body_style)
        ]
    ], colWidths=[300, 240], style=[
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#0284c7")),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f0f9ff")),
        ('PADDING', (0,0), (-1,-1), 8),
    ]),
    Spacer(1, 10),
    Table([
        [Paragraph("<b>SHIPPER:</b><br/>ABC Electronics Pvt Ltd<br/>Chennai, Tamil Nadu, India", body_style), Paragraph("<b>NOTIFY PARTY:</b><br/>FreightAI Automated Customs Broker<br/>Rotterdam Port Gate Eurohub 12", body_style)],
        [Paragraph("<b>CONSIGNEE:</b><br/>To Order of Global Tech Logistics B.V.<br/>Rotterdam, The Netherlands", body_style), Paragraph("<b>FREIGHT PAYABLE AT:</b><br/>Chennai / Prepaid CIF", body_style)],
        [Paragraph("<b>PRE-CARRIAGE BY:</b><br/>Rail Feeder CFS Chennai", body_style), Paragraph("<b>OCEAN VESSEL &amp; VOY NO:</b><br/>MSC Paloma / 24E", body_style)],
        [Paragraph("<b>PORT OF LOADING:</b><br/>Chennai Sea Port, India (INMAA)", body_style), Paragraph("<b>PORT OF DISCHARGE:</b><br/>Port of Rotterdam, Netherlands (NLRTM)", body_style)]
    ], colWidths=[270, 270], style=[
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('PADDING', (0,0), (-1,-1), 6),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#ffffff")),
    ]),
    Spacer(1, 12),
    Table([
        [Paragraph("<b>Marks &amp; Numbers</b>", bold_style), Paragraph("<b>No. of Packages</b>", bold_style), Paragraph("<b>Description of Cargo</b>", bold_style), Paragraph("<b>Gross Weight</b>", bold_style), Paragraph("<b>Measurement</b>", bold_style)],
        [Paragraph("ABC-ROT-2026<br/>01 to 24", body_style), Paragraph("24 Pallets (2x40HC FCL)", body_style), Paragraph("Said to Contain: Commercial Telecommunication &amp; Electronic Hardware Modules", body_style), Paragraph("12,500.00 KGS", body_style), Paragraph("58.40 CBM", body_style)],
    ], colWidths=[80, 100, 200, 80, 80], style=[
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#f1f5f9")),
        ('PADDING', (0,0), (-1,-1), 6),
    ])
]
build_pdf("Bill_of_Lading_Draft_BL4810.pdf", "BILL OF LADING (OCEAN DRAFT)", "Multimodal Transport Negotiable Document", bl_elements)

# 4. Certificate of Origin
coo_elements = [
    Table([
        [
            Paragraph("<b>FEDERATION OF INDIAN EXPORT ORGANISATIONS (FIEO)</b><br/>Recognized by Ministry of Commerce &amp; Industry, Government of India", bold_style),
            Paragraph("<b>CERTIFICATE OF ORIGIN</b><br/><b>CERTIFICATE NO:</b> IN-COO-2026-77189<br/><b>ISSUED AT:</b> Chennai, India", body_style)
        ]
    ], colWidths=[320, 220], style=[
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#16a34a")),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f0fdf4")),
        ('PADDING', (0,0), (-1,-1), 8),
    ]),
    Spacer(1, 10),
    Table([
        [Paragraph("<b>1. Goods Consigned From (Exporter):</b><br/>ABC Electronics Pvt Ltd<br/>Guindy Industrial Estate, Chennai 600032, India", body_style),
         Paragraph("<b>2. Goods Consigned To (Consignee):</b><br/>Global Tech Logistics B.V.<br/>Weena 505, Rotterdam, Netherlands", body_style)],
        [Paragraph("<b>3. Means of Transport and Route:</b><br/>From: Chennai Port (INMAA), India<br/>To: Rotterdam (NLRTM), Netherlands<br/>Vessel: MSC Paloma V.24E", body_style),
         Paragraph("<b>4. For Official Use Only:</b><br/>India-EU Preferential Trade Agreement<br/>Customs Clearance Status: Eligible", body_style)]
    ], colWidths=[270, 270], style=[
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('PADDING', (0,0), (-1,-1), 6),
    ]),
    Spacer(1, 12),
    Table([
        [Paragraph("<b>Item No.</b>", bold_style), Paragraph("<b>Marks &amp; Numbers</b>", bold_style), Paragraph("<b>Description of Goods</b>", bold_style), Paragraph("<b>HS Tariff Code</b>", bold_style), Paragraph("<b>Origin Criterion</b>", bold_style)],
        [Paragraph("1", body_style), Paragraph("ABC-ROT-01/24", body_style), Paragraph("Commercial Electronic Telecom Transceiver Assemblies &amp; Gateways", body_style), Paragraph("8517.12 / 8471.41", body_style), Paragraph("Wholly Produced (India) &bull; 'P'", body_style)],
    ], colWidths=[40, 100, 210, 100, 90], style=[
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#dcfce7")),
        ('PADDING', (0,0), (-1,-1), 6),
    ]),
    Spacer(1, 14),
    Table([
        [
            Paragraph("<b>DECLARATION BY THE EXPORTER:</b><br/>The undersigned hereby declares that the above details and statements are correct; that all the goods were produced in India and that they comply with the rules of origin.", body_style),
            Paragraph("<b>CERTIFICATION BY AUTHORITY:</b><br/>It is hereby certified, on the basis of control carried out, that the declaration by the exporter is correct.<br/><b>SEAL &amp; SIGNATURE:</b> FIEO Regional Authority", body_style)
        ]
    ], colWidths=[270, 270], style=[
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('PADDING', (0,0), (-1,-1), 8),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
    ])
]
build_pdf("Certificate_of_Origin_COO2026.pdf", "CERTIFICATE OF ORIGIN", "Chamber of Commerce Preferential Trade Certification", coo_elements)
print("All 4 sample trade documents successfully built.")
