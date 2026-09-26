"""
generate_project_pdf.py — Generates a comprehensive, professional PDF document
for Third Eye / Rakshak Web3 Security & On-Chain Immunity Platform.
"""

from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas
import sys

PDF_OUTPUT_PATH = Path(__file__).resolve().parent.parent.parent / "ThirdEye_Rakshak_System_Overview.pdf"


class NumberedCanvas(canvas.Canvas):
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
            self.draw_header_footer(num_pages)
            super().showPage()
        super().save()

    def draw_header_footer(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 750, "Third Eye (Rakshak) — System Architecture & Technical Specification")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(54, 742, 558, 742)

        # Footer
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 36, page_text)
        self.drawString(54, 36, "CONFIDENTIAL & PROPRIETARY — WEB3 IMMUNITY PLATFORM")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(54, 48, 558, 48)
        
        self.restoreState()


def build_pdf():
    doc = SimpleDocTemplate(
        str(PDF_OUTPUT_PATH),
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=64,
        bottomMargin=64,
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    primary_color = colors.HexColor("#0F172A")
    accent_blue = colors.HexColor("#0284C7")
    accent_cyan = colors.HexColor("#0EA5E9")
    dark_text = colors.HexColor("#1E293B")
    muted_text = colors.HexColor("#475569")

    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=28,
        textColor=primary_color,
        spaceAfter=4,
    )
    
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=12,
        leading=16,
        textColor=accent_blue,
        spaceAfter=14,
    )

    h1_style = ParagraphStyle(
        "Heading1_Custom",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=18,
        textColor=primary_color,
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True,
    )

    h2_style = ParagraphStyle(
        "Heading2_Custom",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=15,
        textColor=accent_blue,
        spaceBefore=10,
        spaceAfter=5,
        keepWithNext=True,
    )

    body_style = ParagraphStyle(
        "Body_Custom",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=13.5,
        textColor=dark_text,
        spaceAfter=6,
    )

    bullet_style = ParagraphStyle(
        "Bullet_Custom",
        parent=body_style,
        leftIndent=14,
        firstLineIndent=-10,
        spaceAfter=3,
    )

    callout_style = ParagraphStyle(
        "Callout_Text",
        parent=body_style,
        fontName="Helvetica-Oblique",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#0369A1"),
    )

    code_style = ParagraphStyle(
        "Code_Style",
        parent=styles["Normal"],
        fontName="Courier",
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor("#0F172A"),
    )

    story = []

    # ── TITLE & HEADER ──────────────────────────────────────────────
    story.append(Paragraph("Third Eye / Rakshak", title_style))
    story.append(Paragraph("AI-Powered Web3 Security & On-Chain Immunity Platform · Base Sepolia", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=accent_blue, spaceBefore=0, spaceAfter=12))

    # Metadata Banner Box
    meta_data = [
        [
            Paragraph("<b>Target Network:</b> Base Sepolia (Chain ID 84532)", body_style),
            Paragraph("<b>Stack:</b> Python/FastAPI · React/Three.js · Solidity", body_style),
        ],
        [
            Paragraph("<b>Core Model:</b> Isolation Forest + D-P-R Decay + LLM", body_style),
            Paragraph("<b>Enforcement:</b> Reversible Smart Contract Quarantine", body_style),
        ]
    ]
    meta_table = Table(meta_data, colWidths=[240, 264])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#E2E8F0")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 10))

    # ── SECTION 1: EXECUTIVE SUMMARY & PROBLEM ──────────────────────
    story.append(Paragraph("1. Executive Summary & Problem Solved", h1_style))
    story.append(Paragraph(
        "Web3 security currently faces two massive structural challenges: (1) <b>High-Speed Exploit Drains:</b> "
        "Attacks execute in milliseconds via automated flash-loan sequences, outpacing human response time; and (2) <b>False Positives:</b> "
        "Naive binary blacklists ruin legitimate new users who perform large initial transactions or innocent counterparties with incidental graph hops.",
        body_style
    ))
    story.append(Paragraph(
        "<b>Rakshak (Third Eye)</b> is an autonomous, decentralized security platform that integrates real-time transaction ingestion, "
        "Neo4j graph relationship clustering, machine learning anomaly detection, natural language threat explainability, and a confidence-aware "
        "on-chain enforcement layer with reversible quarantine on Base Sepolia.",
        body_style
    ))
    story.append(Spacer(1, 6))

    # ── SECTION 2: FULL TECHNOLOGY STACK ────────────────────────────
    story.append(Paragraph("2. Comprehensive Technology Stack", h1_style))

    tech_table_data = [
        [Paragraph("<b>Layer</b>", body_style), Paragraph("<b>Technologies Used</b>", body_style), Paragraph("<b>Role & Purpose</b>", body_style)],
        [
            Paragraph("<b>Frontend UI & Viz</b>", body_style),
            Paragraph("React 18, TypeScript, Vite, Three.js, React-Force-Graph-3D, Ethers.js v6", body_style),
            Paragraph("Interactive 60fps 3D galaxy visualization of wallet networks, live threat alerts, and operator review panel.", body_style)
        ],
        [
            Paragraph("<b>Backend API</b>", body_style),
            Paragraph("Python 3.10+, FastAPI (ASGI), Uvicorn, Celery, Redis", body_style),
            Paragraph("High-throughput async API endpoints, distributed sweep workers, and secure HMAC request validation.", body_style)
        ],
        [
            Paragraph("<b>Graph Database</b>", body_style),
            Paragraph("Neo4j (Cypher) + InMemoryGraphStore Fallback", body_style),
            Paragraph("Maps wallet nodes and directed transaction links; supports hop-distance calculations and multi-hop tracing.", body_style)
        ],
        [
            Paragraph("<b>ML & Risk Engine</b>", body_style),
            Paragraph("scikit-learn (Isolation Forest), NumPy, Pandas", body_style),
            Paragraph("Unsupervised ML anomaly detection on transaction velocity, dispersion, gas usage, and structural patterns.", body_style)
        ],
        [
            Paragraph("<b>AI Explainability</b>", body_style),
            Paragraph("Groq API / LLaMA-3.1-8B-Instant / Gemini Pro", body_style),
            Paragraph("Generates structured natural language forensic threat narratives and recommended protocol actions.", body_style)
        ],
        [
            Paragraph("<b>Smart Contracts</b>", body_style),
            Paragraph("Solidity ^0.8.20, OpenZeppelin, Base Sepolia (84532)", body_style),
            Paragraph("On-chain enforcer contracts: ShieldWallet.sol (reversible quarantine) and ThirdEyeGuardian.sol (blacklist).", body_style)
        ],
    ]

    tech_table = Table(tech_table_data, colWidths=[100, 175, 229])
    tech_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0F172A")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('BOTTOMPADDING', (0,0), (-1,0), 5),
        ('TOPPADDING', (0,0), (-1,0), 5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor("#FFFFFF"), colors.HexColor("#F8FAFC")]),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,1), (-1,-1), 5),
        ('BOTTOMPADDING', (0,1), (-1,-1), 5),
    ]))
    story.append(tech_table)
    story.append(Spacer(1, 10))

    # ── SECTION 3: END-TO-END SYSTEM ARCHITECTURE ───────────────────
    story.append(Paragraph("3. End-to-End System Pipeline (7-Step Workflow)", h1_style))
    
    steps = [
        "<b>Step 1 — Real-Time Ingestion:</b> Transactions are ingested via Base Sepolia RPC webhooks and queued in Redis.",
        "<b>Step 2 — Graph Relationship Mapping:</b> Wallet nodes and transaction edges are indexed in Neo4j to track fund provenance.",
        "<b>Step 3 — Isolation Forest Anomaly Detection:</b> Feature vectors (velocity, amount, gas, dispersion) are evaluated by ML.",
        "<b>Step 4 — D-P-R Graph Exposure Scoring:</b> Calculates distance decay (0.4^(hops-1)), percentage exposure, and repetition weighting.",
        "<b>Step 5 — Progressive Trust Graduation:</b> Evaluates 45-day age and continuous weekly activity (0 dead weeks) to protect new users.",
        "<b>Step 6 — Multi-Signal Corroboration:</b> Requires >= 2 independent categories to trigger Critical; routes to auto_block vs human_review.",
        "<b>Step 7 — Smart Contract Execution:</b> Calls ShieldWallet.sol to quarantine or permanently block malicious wallets on Base Sepolia.",
    ]
    for s in steps:
        story.append(Paragraph(f"• {s}", bullet_style))
    story.append(Spacer(1, 10))

    story.append(PageBreak())

    # ── SECTION 4: TRUST & FAIRNESS LAYER (FEATURES A -> D) ─────────
    story.append(Paragraph("4. The Trust & Fairness Intelligence Layer", h1_style))
    
    story.append(Paragraph("Feature A: Progressive Trust / Wallet Graduation System", h2_style))
    story.append(Paragraph(
        "Eliminates false positives on new wallets by requiring 3 conditions for graduation to <b>TRUSTED</b> status: "
        "(1) 45 days elapsed since creation; (2) continuous weekly activity with at least 1 tx every 7-day interval (zero dead weeks); "
        "and (3) >= 10 total transactions. New wallets receive a 0.5x threshold multiplier and a strict severity cap at 'Watch'.",
        body_style
    ))

    story.append(Paragraph("Feature B: Graph Exposure Scoring ('D-P-R' Model)", h2_style))
    story.append(Paragraph(
        "Calculates mathematical exposure to malicious clusters using three weighted parameters: "
        "<b>Distance Decay (D):</b> Risk contribution decays exponentially (0.4^(hops-1)); "
        "<b>Percentage Exposure (P):</b> Tainted Inbound / Total Inbound ETH ratio; "
        "<b>Repetition Multiplier (R):</b> Incidental transfers (<3 in 30d) receive 0.3x weight vs sustained (1.0x).",
        body_style
    ))

    story.append(Paragraph("Feature C: Multi-Signal Corroboration Gate", h2_style))
    story.append(Paragraph(
        "Enforces that <b>no single signal independently triggers Critical</b>. Critical escalation strictly requires at least 2 independent "
        "signal categories: (1) ML Amount/Velocity Anomaly; (2) Graph Exposure > 15%; or (3) Behavioral Pattern Signature.",
        body_style
    ))

    story.append(Paragraph("Feature D: Confidence-Aware Hybrid Enforcement Routing", h2_style))
    story.append(Paragraph(
        "Routes decisions based on data confidence: "
        "<b>Critical + High Confidence</b> -> <i>auto_block</i> (Immediate reversible smart contract freeze); "
        "<b>Critical + Low Confidence</b> -> <i>human_review</i> (Dashboard review alert for thin history); "
        "<b>Elevated</b> -> <i>human_review</i>; <b>Watch/Low</b> -> <i>log_only</i> (Audit trail only).",
        body_style
    ))
    story.append(Spacer(1, 8))

    # ── SECTION 5: SMART CONTRACT ARCHITECTURE ──────────────────────
    story.append(Paragraph("5. Smart Contracts Architecture (`ShieldWallet.sol`)", h1_style))
    story.append(Paragraph(
        "<b>ShieldWallet.sol</b> is an OpenZeppelin-compatible enforcement contract featuring a 3-tier wallet status lifecycle: "
        "<b>Active (0)</b>, <b>Quarantined (1)</b>, and <b>Blocked (2)</b>.",
        body_style
    ))

    sc_table_data = [
        [Paragraph("<b>Function</b>", body_style), Paragraph("<b>Caller</b>", body_style), Paragraph("<b>Description & Lifecycle Action</b>", body_style)],
        [
            Paragraph("<code>quarantineWallet(addr, reason)</code>", code_style),
            Paragraph("AI Engine / Operator", body_style),
            Paragraph("Reversibly freezes wallet interactions on-chain pending operator review or appeal.", body_style)
        ],
        [
            Paragraph("<code>appealQuarantine(addr)</code>", code_style),
            Paragraph("Wallet Owner", body_style),
            Paragraph("Allows users to submit on-chain appeal tickets if they believe they were falsely flagged.", body_style)
        ],
        [
            Paragraph("<code>releaseFromQuarantine(addr)</code>", code_style),
            Paragraph("Operator / Admin", body_style),
            Paragraph("Restores a cleared wallet back to Active status upon successful verification.", body_style)
        ],
        [
            Paragraph("<code>confirmBlock(addr)</code>", code_style),
            Paragraph("Operator / Admin", body_style),
            Paragraph("Permanently and irreversibly blocks confirmed malicious exploit wallets.", body_style)
        ],
        [
            Paragraph("<code>shield(caller)</code>", code_style),
            Paragraph("DeFi Protocols", body_style),
            Paragraph("Gate check: Reverts transaction immediately if caller is Quarantined or Blocked.", body_style)
        ],
    ]
    sc_table = Table(sc_table_data, colWidths=[150, 110, 244])
    sc_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0F172A")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor("#FFFFFF"), colors.HexColor("#F8FAFC")]),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,1), (-1,-1), 4),
        ('BOTTOMPADDING', (0,1), (-1,-1), 4),
    ]))
    story.append(sc_table)
    story.append(Spacer(1, 10))

    # ── SECTION 6: REAL-WORLD USE CASES & INDUSTRIAL IMPACT ─────────
    story.append(Paragraph("6. Real-World Use Cases & Industrial Impact", h1_style))
    use_cases = [
        "<b>DeFi Lending & Staking Gateways:</b> Protocols integrate <code>shield()</code> to block flash-loan attacks before liquidity pools are drained.",
        "<b>DEXes & Cross-Chain Bridges:</b> Automatically isolates funds originating from Tornado Cash, mixers, or stolen bridge clusters.",
        "<b>Compliance & Forensic Incident Response:</b> Security analysts use the 3D Galaxy view and Decision Audit Trail for immutable evidentiary logging.",
        "<b>Fairness for Web3 On-Ramps:</b> Legitimate users onboarding to Base are protected from premature automated account bans.",
    ]
    for u in use_cases:
        story.append(Paragraph(f"• {u}", bullet_style))
    story.append(Spacer(1, 12))

    # ── SECTION 7: API ENDPOINTS REFERENCE ──────────────────────────
    story.append(Paragraph("7. Core API Endpoints Reference", h1_style))
    api_data = [
        [Paragraph("<b>Endpoint</b>", body_style), Paragraph("<b>Method</b>", body_style), Paragraph("<b>Description</b>", body_style)],
        [Paragraph("<code>/api/wallet/{addr}/trust-status</code>", code_style), Paragraph("GET", body_style), Paragraph("Returns 45-day age, 7-week activity checklist, and graduation status.", body_style)],
        [Paragraph("<code>/api/wallet/{addr}/exposure</code>", code_style), Paragraph("GET", body_style), Paragraph("Returns D-P-R distance decay, tainted value %, and repetition weight.", body_style)],
        [Paragraph("<code>/api/enforcement/decision/{addr}</code>", code_style), Paragraph("GET", body_style), Paragraph("Evaluates multi-signal corroboration and confidence-aware routing action.", body_style)],
        [Paragraph("<code>/api/enforcement/execute-action</code>", code_style), Paragraph("POST", body_style), Paragraph("Executes operator quarantine/block/dismiss and appends to audit log.", body_style)],
        [Paragraph("<code>/api/wallet/{addr}/summary</code>", code_style), Paragraph("GET", body_style), Paragraph("Returns instant 0ms archetype keyword badge (e.g. RAPID EXFILTRATOR) & summary.", body_style)],
        [Paragraph("<code>/api/graph/nodes</code>", code_style), Paragraph("GET", body_style), Paragraph("Returns full 3D graph nodes, relationships, keywords, and threat scores.", body_style)],
    ]
    api_table = Table(api_data, colWidths=[180, 50, 274])
    api_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0F172A")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor("#FFFFFF"), colors.HexColor("#F8FAFC")]),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,1), (-1,-1), 4),
        ('BOTTOMPADDING', (0,1), (-1,-1), 4),
    ]))
    story.append(api_table)

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF successfully generated at: {PDF_OUTPUT_PATH}")


if __name__ == "__main__":
    build_pdf()
