import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

def create_deck():
    prs = Presentation()
    # 16:9 widescreen dimensions
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    # Color Palette (Dark Tactical / Modern Obsidian & Electric Emerald)
    BG_COLOR = RGBColor(11, 15, 25)       # #0B0F19 (Deep Obsidian Slate)
    CARD_BG = RGBColor(19, 27, 46)        # #131B2E (Surface Card)
    CARD_BORDER = RGBColor(35, 48, 78)    # #23304E (Crisp border)
    TEXT_WHITE = RGBColor(255, 255, 255)  # #FFFFFF
    TEXT_MUTED = RGBColor(148, 163, 184)  # #94A3B8 (Slate 400)
    ACCENT_EMERALD = RGBColor(16, 185, 129) # #10B981 (Electric Emerald)
    ACCENT_AMBER = RGBColor(245, 158, 11)   # #F59E0B (Safety Amber)
    ACCENT_SKY = RGBColor(56, 189, 248)    # #38BDF8 (Sky Blue)
    BLANK_LAYOUT = prs.slide_layouts[6]   # completely blank layout

    def apply_background(slide):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
        bg.fill.solid()
        bg.fill.fore_color.rgb = BG_COLOR
        bg.line.fill.background()
        return bg

    def add_card(slide, left, top, width, height, bg_color=CARD_BG, border_color=CARD_BORDER):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        card.fill.solid()
        card.fill.fore_color.rgb = bg_color
        card.line.color.rgb = border_color
        card.line.width = Pt(1.2)
        return card

    def add_header(slide, tag_text, title_text, subtitle_text=""):
        # Tag badge
        tag_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11.7), Inches(0.4))
        tf_tag = tag_box.text_frame
        tf_tag.word_wrap = True
        p_tag = tf_tag.paragraphs[0]
        p_tag.text = tag_text.upper()
        p_tag.font.name = "Arial"
        p_tag.font.size = Pt(11)
        p_tag.font.bold = True
        p_tag.font.color.rgb = ACCENT_EMERALD

        # Title
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.75), Inches(11.7), Inches(0.65))
        tf_title = title_box.text_frame
        tf_title.word_wrap = True
        p_title = tf_title.paragraphs[0]
        p_title.text = title_text
        p_title.font.name = "Arial"
        p_title.font.size = Pt(26)
        p_title.font.bold = True
        p_title.font.color.rgb = TEXT_WHITE

        # Subtitle
        if subtitle_text:
            sub_box = slide.shapes.add_textbox(Inches(0.8), Inches(1.35), Inches(11.7), Inches(0.4))
            tf_sub = sub_box.text_frame
            tf_sub.word_wrap = True
            p_sub = tf_sub.paragraphs[0]
            p_sub.text = subtitle_text
            p_sub.font.name = "Arial"
            p_sub.font.size = Pt(13)
            p_sub.font.color.rgb = TEXT_MUTED

    # -------------------------------------------------------------
    # SLIDE 1: TITLE / HERO SLIDE
    # -------------------------------------------------------------
    s1 = prs.slides.add_slide(BLANK_LAYOUT)
    apply_background(s1)

    # Hero Banner Card
    add_card(s1, Inches(0.8), Inches(0.8), Inches(11.733), Inches(5.9), bg_color=CARD_BG, border_color=CARD_BORDER)

    # Brand Pill
    pill = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.4), Inches(1.4), Inches(3.2), Inches(0.45))
    pill.fill.solid()
    pill.fill.fore_color.rgb = RGBColor(6, 78, 59)
    pill.line.color.rgb = ACCENT_EMERALD
    pill.line.width = Pt(1)
    tf = pill.text_frame
    p = tf.paragraphs[0]
    p.text = "SMART CAMPUS MOBILITY • AI INITIATIVE"
    p.font.name = "Arial"
    p.font.size = Pt(10)
    p.font.bold = True
    p.font.color.rgb = ACCENT_EMERALD
    p.alignment = PP_ALIGN.CENTER

    # Big Title
    title_box = s1.shapes.add_textbox(Inches(1.4), Inches(2.1), Inches(10.5), Inches(1.5))
    tf = title_box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "CampusRide"
    p.font.name = "Arial"
    p.font.size = Pt(46)
    p.font.bold = True
    p.font.color.rgb = TEXT_WHITE

    p2 = tf.add_paragraph()
    p2.text = "AI-Driven Peer Carpooling & Hybrid Route Engine"
    p2.font.name = "Arial"
    p2.font.size = Pt(22)
    p2.font.bold = True
    p2.font.color.rgb = ACCENT_EMERALD

    # Subtitle / Description
    desc_box = s1.shapes.add_textbox(Inches(1.4), Inches(3.6), Inches(10.2), Inches(1.1))
    tf = desc_box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "A domain-verified campus carpooling ecosystem for KCC Institute of Technology & Management, featuring graph-based shortest-path routing, real-time bottleneck avoidance, and scikit-learn AutoML door-to-gate ETA predictions."
    p.font.name = "Arial"
    p.font.size = Pt(14)
    p.font.color.rgb = TEXT_MUTED

    # Highlights Row
    highlights = [
        ("Institutional Trust", "Strict @college.edu.in Auth"),
        ("Hybrid Routing", "Dijkstra + AutoML Congestion"),
        ("Corridor Telemetry", "Lal Kuan Bottleneck Bypass"),
        ("Eco & Wallet Friendly", "Zero Surge Pricing & Shared Fuel")
    ]
    for i, (h_title, h_sub) in enumerate(highlights):
        left_pos = Inches(1.4 + i * 2.6)
        h_card = add_card(s1, left_pos, Inches(4.9), Inches(2.45), Inches(1.3), bg_color=RGBColor(15, 23, 42), border_color=CARD_BORDER)
        tb = s1.shapes.add_textbox(left_pos + Inches(0.15), Inches(5.05), Inches(2.15), Inches(1.0))
        tf = tb.text_frame
        tf.word_wrap = True
        p1 = tf.paragraphs[0]
        p1.text = h_title
        p1.font.name = "Arial"
        p1.font.size = Pt(12)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_WHITE

        p2 = tf.add_paragraph()
        p2.text = h_sub
        p2.font.name = "Arial"
        p2.font.size = Pt(10)
        p2.font.color.rgb = ACCENT_EMERALD

    s1.notes_slide.notes_text_frame.text = (
        "Good morning everyone! Today I am presenting CampusRide, our end-to-end intelligent campus carpooling "
        "and hybrid route dispatch system specifically engineered for KCC Institute of Technology and Management in Knowledge Park II, Greater Noida. "
        "CampusRide addresses daily student commuter bottlenecks using a blend of modern full-stack web engineering, "
        "graph pathfinding, and machine learning."
    )

    # -------------------------------------------------------------
    # SLIDE 2: THE PROBLEM STATEMENT
    # -------------------------------------------------------------
    s2 = prs.slides.add_slide(BLANK_LAYOUT)
    apply_background(s2)
    add_header(s2, "Challenge Identification", "The Broken Student Commute: 4 Critical Pain Points", "Why traditional transit options fail daily college commuters travelling across NCR corridors")

    problems = [
        ("1. High Commute Costs", "Students spend ₹3,000–₹6,000 monthly on private autos or app cabs suffering from erratic surge pricing. Meanwhile, peer student vehicles travel with 3–4 empty seats.", ACCENT_AMBER),
        ("2. Transit Inefficiency", "Public buses and shared tempos are overcrowded, have unpredictable intervals, and make frequent stops, resulting in chronic fatigue before morning 9:00 AM classes.", ACCENT_SKY),
        ("3. Chronic Traffic Bottlenecks", "Severe commuter bottlenecks like GT Road / Lal Kuan cause 45–60 min delays daily. Without dynamic bottleneck bypass routing, students miss morning lectures.", ACCENT_EMERALD),
        ("4. Safety & Verification Deficit", "Commercial ride apps and stranger hitchhiking present trust risks. Students lack a secure, university-verified peer-to-peer commuting network.", RGBColor(244, 63, 94))
    ]

    for i, (title, desc, accent) in enumerate(problems):
        left_pos = Inches(0.8 + i * 2.95)
        card = add_card(s2, left_pos, Inches(1.9), Inches(2.8), Inches(4.8), bg_color=CARD_BG, border_color=CARD_BORDER)
        
        # Color top bar
        bar = s2.shapes.add_shape(MSO_SHAPE.RECTANGLE, left_pos, Inches(1.9), Inches(2.8), Inches(0.08))
        bar.fill.solid()
        bar.fill.fore_color.rgb = accent
        bar.line.fill.background()

        tb = s2.shapes.add_textbox(left_pos + Inches(0.2), Inches(2.2), Inches(2.4), Inches(4.3))
        tf = tb.text_frame
        tf.word_wrap = True
        p1 = tf.paragraphs[0]
        p1.text = title
        p1.font.name = "Arial"
        p1.font.size = Pt(16)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_WHITE

        p2 = tf.add_paragraph()
        p2.text = "\n" + desc
        p2.font.name = "Arial"
        p2.font.size = Pt(12)
        p2.font.color.rgb = TEXT_MUTED

    s2.notes_slide.notes_text_frame.text = (
        "Here are the four core problems students face every day traveling to KCC ITM: "
        "First, high travel expense and surge pricing. Second, public transit unreliability and exhaustion. "
        "Third, chronic bottleneck traps like Lal Kuan that lead to late attendance. "
        "And fourth, safety concerns when riding with unverified strangers. CampusRide is built directly to fix these four issues."
    )

    # -------------------------------------------------------------
    # SLIDE 3: THE SOLUTION & VALUE PROPOSITION
    # -------------------------------------------------------------
    s3 = prs.slides.add_slide(BLANK_LAYOUT)
    apply_background(s3)
    add_header(s3, "System Solution", "CampusRide: Tactical Mobility & Intelligent Dispatch", "A high-trust, AI-optimized carpooling network built exclusively for our college community")

    sol_cards = [
        ("Closed-Loop Verified Community", [
            "Strict institutional email domain validation (@college.edu.in).",
            "Zero unverified outsiders: every driver and rider is a confirmed college peer.",
            "Accountability via college roll numbers and registered student profiles."
        ]),
        ("Hybrid Pathfinding + AI Prediction", [
            "Dijkstra graph shortest-path engine calculates exact physical road distances.",
            "AutoML VotingRegressor predicts door-to-gate arrival time within ±1.5 mins.",
            "Dynamic traffic penalty weights automatically detour around Lal Kuan congestion."
        ]),
        ("Tactical Dispatch Dashboard", [
            "Interactive corridor visualizer displaying waypoints, distance, and ETAs.",
            "Atomic seat booking system preventing race conditions or double reservations.",
            "Direct driver contact synchronization and 1-click saved daily routes."
        ]),
        ("Triple Impact: Cost, Time & Planet", [
            "Cuts daily travel expenses by up to 60–75% through shared fuel splitting.",
            "Saves ~45–59 minutes on peak-hour routes via EPE Expressway bypass.",
            "Reduces campus congestion and individual carbon emissions."
        ])
    ]

    for i, (title, bullets) in enumerate(sol_cards):
        row = i // 2
        col = i % 2
        left_pos = Inches(0.8 + col * 5.95)
        top_pos = Inches(1.9 + row * 2.55)
        add_card(s3, left_pos, top_pos, Inches(5.75), Inches(2.35), bg_color=CARD_BG, border_color=CARD_BORDER)

        tb = s3.shapes.add_textbox(left_pos + Inches(0.25), top_pos + Inches(0.18), Inches(5.25), Inches(2.0))
        tf = tb.text_frame
        tf.word_wrap = True
        p_title = tf.paragraphs[0]
        p_title.text = title
        p_title.font.name = "Arial"
        p_title.font.size = Pt(16)
        p_title.font.bold = True
        p_title.font.color.rgb = ACCENT_EMERALD

        for b in bullets:
            p_b = tf.add_paragraph()
            p_b.text = "• " + b
            p_b.font.name = "Arial"
            p_b.font.size = Pt(11.5)
            p_b.font.color.rgb = TEXT_WHITE

    s3.notes_slide.notes_text_frame.text = (
        "Our solution has four pillars: "
        "1. Institutional Trust: Only @college.edu.in emails can sign in. "
        "2. Hybrid Engine: Combines graph theory (Dijkstra) with Machine Learning. "
        "3. Real-time Dispatch UX: Instant seat booking and driver communication. "
        "4. Triple Benefit: Saving money, saving time, and lowering carbon footprint."
    )

    # -------------------------------------------------------------
    # SLIDE 4: FULL TECHNOLOGY STACK
    # -------------------------------------------------------------
    s4 = prs.slides.add_slide(BLANK_LAYOUT)
    apply_background(s4)
    add_header(s4, "Engineering Architecture", "Production Technology Stack: Modern & Robust", "Full-stack decoupled architecture designed for low latency (<6ms) and high concurrency")

    stacks = [
        ("Frontend UI / UX", ACCENT_SKY, [
            ("React 18 & Vite", "Ultra-fast bundling, component architecture, HMR"),
            ("Tailwind CSS v3", "Custom Obsidian & Electric Emerald theme design system"),
            ("Lucide React", "Tactile iconography for waypoints, vehicles, and status"),
            ("JetBrains Mono & Sans", "Tabular monospace for ETAs and telemetry metrics"),
            ("Adaptive Themes", "Instant Light / Dark toggle persisted in localStorage")
        ]),
        ("Backend Services", ACCENT_EMERALD, [
            ("FastAPI (Python 3.14)", "Asynchronous, high-throughput REST API"),
            ("Pydantic v2", "Strict type validation for ride requests and booking payloads"),
            ("Uvicorn ASGI", "Lightning-fast asynchronous server deployment"),
            ("Graph Search Engine", "Custom Dijkstra & A* corridor pathfinding implementation"),
            ("CORS & Middleware", "Secure cross-origin student request handling")
        ]),
        ("Identity & Database", ACCENT_AMBER, [
            ("Supabase Auth", "Secure token-based auth with email domain verification"),
            ("PostgreSQL / SQLite", "Relational persistence with ACID atomic transactions"),
            ("Relational Schema", "Normalized tables for profiles, rides, and seat bookings"),
            ("Continuous Learning", "Automated export pipeline for ML model retraining"),
            ("Zero Data Loss", "State persists across server reboots and browser refreshes")
        ]),
        ("Machine Learning / AI", RGBColor(168, 85, 247), [
            ("AutoML Pipeline", "Protected serialized model artifacts in automl/"),
            ("VotingRegressor Ensemble", "GradientBoostingRegressor + RandomForestRegressor"),
            ("Scikit-Learn Pipeline", "OneHotEncoder + StandardScaler for route feature vectors"),
            ("Bottleneck Heuristics", "Dynamic congestion penalty computation (0.15 to 0.85)"),
            ("Zero Hardcoded Dummies", "100% actual real-time inference on every request")
        ])
    ]

    for i, (layer_title, accent, items) in enumerate(stacks):
        left_pos = Inches(0.8 + i * 2.95)
        add_card(s4, left_pos, Inches(1.9), Inches(2.8), Inches(4.8), bg_color=CARD_BG, border_color=CARD_BORDER)

        bar = s4.shapes.add_shape(MSO_SHAPE.RECTANGLE, left_pos, Inches(1.9), Inches(2.8), Inches(0.08))
        bar.fill.solid()
        bar.fill.fore_color.rgb = accent
        bar.line.fill.background()

        tb = s4.shapes.add_textbox(left_pos + Inches(0.18), Inches(2.1), Inches(2.44), Inches(4.5))
        tf = tb.text_frame
        tf.word_wrap = True
        p_head = tf.paragraphs[0]
        p_head.text = layer_title
        p_head.font.name = "Arial"
        p_head.font.size = Pt(15)
        p_head.font.bold = True
        p_head.font.color.rgb = TEXT_WHITE

        for tool_name, desc in items:
            p1 = tf.add_paragraph()
            p1.text = "• " + tool_name
            p1.font.name = "Arial"
            p1.font.size = Pt(11)
            p1.font.bold = True
            p1.font.color.rgb = accent

            p2 = tf.add_paragraph()
            p2.text = "  " + desc
            p2.font.name = "Arial"
            p2.font.size = Pt(9.5)
            p2.font.color.rgb = TEXT_MUTED

    s4.notes_slide.notes_text_frame.text = (
        "Let's look at the tech stack: "
        "On the frontend, we use React with Vite and Tailwind CSS for a modern, tactile dispatch UI with instant dark/light mode. "
        "The backend is powered by FastAPI in Python, which gives us sub-10 millisecond latency. "
        "Identity is secured using Supabase Auth with strict institutional email domain filtering. "
        "And the ML core runs a Scikit-Learn VotingRegressor ensemble combining Gradient Boosting and Random Forest models."
    )

    # -------------------------------------------------------------
    # SLIDE 5: SYSTEM WORKFLOW & ARCHITECTURE
    # -------------------------------------------------------------
    s5 = prs.slides.add_slide(BLANK_LAYOUT)
    apply_background(s5)
    add_header(s5, "System Architecture", "End-to-End System Flow: From Request to Confirmation", "How data flows seamlessly between student clients, backend APIs, and AI models")

    steps = [
        ("Step 1: Auth & Domain Gate", "Student signs up with rollnumber@college.edu.in. Personal Gmail/Yahoo accounts are rejected at the API boundary.", ACCENT_SKY),
        ("Step 2: Profile & Vehicle Setup", "Users declare their commuting role: Rider-only or Driver (Car, Motorcycle, Scooty) with vehicle brand details.", ACCENT_EMERALD),
        ("Step 3: Ride Posting / Discovery", "Drivers post empty seats with departure time and corridor origin (Noida 62, NH-3, Chapraula, Lal Kuan).", ACCENT_AMBER),
        ("Step 4: AI & Graph Processing", "FastAPI builds corridor graph, queries AutoML model for congestion weights, and executes Dijkstra pathfinding.", RGBColor(168, 85, 247)),
        ("Step 5: Atomic Booking & Sync", "Rider books seat; backend decrements available count atomically, persists booking, and displays driver contact.", ACCENT_EMERALD)
    ]

    for i, (title, desc, accent) in enumerate(steps):
        left_pos = Inches(0.8 + i * 2.36)
        card = add_card(s5, left_pos, Inches(2.0), Inches(2.25), Inches(4.6), bg_color=CARD_BG, border_color=CARD_BORDER)

        # Step badge
        badge = s5.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left_pos + Inches(0.2), Inches(2.2), Inches(1.85), Inches(0.35))
        badge.fill.solid()
        badge.fill.fore_color.rgb = RGBColor(15, 23, 42)
        badge.line.color.rgb = accent
        badge.line.width = Pt(1)
        tf_b = badge.text_frame
        p_b = tf_b.paragraphs[0]
        p_b.text = f"PHASE 0{i+1}"
        p_b.font.name = "Arial"
        p_b.font.size = Pt(10)
        p_b.font.bold = True
        p_b.font.color.rgb = accent
        p_b.alignment = PP_ALIGN.CENTER

        tb = s5.shapes.add_textbox(left_pos + Inches(0.15), Inches(2.7), Inches(1.95), Inches(3.7))
        tf = tb.text_frame
        tf.word_wrap = True
        p1 = tf.paragraphs[0]
        p1.text = title
        p1.font.name = "Arial"
        p1.font.size = Pt(13)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_WHITE

        p2 = tf.add_paragraph()
        p2.text = "\n" + desc
        p2.font.name = "Arial"
        p2.font.size = Pt(11)
        p2.font.color.rgb = TEXT_MUTED

    s5.notes_slide.notes_text_frame.text = (
        "This flow diagram illustrates the 5-phase student experience: "
        "Phase 1 authenticates institutional identity. Phase 2 configures the vehicle profile. "
        "Phase 3 lists and filters active rides along key corridors. "
        "Phase 4 runs Dijkstra's algorithm augmented with AutoML congestion weights to recommend the best route. "
        "Phase 5 confirms the seat atomically with zero risk of overbooking."
    )

    # -------------------------------------------------------------
    # SLIDE 6: HOW THE HYBRID ROUTING ENGINE WORKS (DEEP DIVE)
    # -------------------------------------------------------------
    s6 = prs.slides.add_slide(BLANK_LAYOUT)
    apply_background(s6)
    add_header(s6, "Algorithmic Innovation", "Hybrid Routing: Graph Theory + AutoML Inference", "Combining physical road topology (Dijkstra) with empirical traffic models (AutoML)")

    add_card(s6, Inches(0.8), Inches(1.9), Inches(5.75), Inches(4.7), bg_color=CARD_BG, border_color=CARD_BORDER)
    tb_left = s6.shapes.add_textbox(Inches(1.05), Inches(2.05), Inches(5.25), Inches(4.3))
    tf_l = tb_left.text_frame
    tf_l.word_wrap = True
    p = tf_l.paragraphs[0]
    p.text = "Graph Pathfinding (Dijkstra / A*)"
    p.font.name = "Arial"
    p.font.size = Pt(18)
    p.font.bold = True
    p.font.color.rgb = ACCENT_SKY

    dijkstra_points = [
        "Network Graph Representation: Key commuter hubs (Noida 62, NH-3, Chapraula, Lal Kuan, Pari Chowk) mapped as weighted vertices & edges.",
        "Fixed Target Destination: Fixed destination node: KCC Institute of Technology & Management (Knowledge Park II).",
        "Dynamic Cost Function: Edge cost is physical distance modified by real-time traffic congestion weights:",
        "    Cost(u, v) = Distance(u, v) × (1 + CongestionPenalty(u, v))",
        "Prevents Naive Routing: Direct physical shortest path through GT Road is 26.5 km but experiences 0.85 bottleneck weight (taking ~75 mins)."
    ]
    for pt in dijkstra_points:
        p = tf_l.add_paragraph()
        p.text = "• " + pt
        p.font.name = "Arial"
        p.font.size = Pt(11)
        p.font.color.rgb = TEXT_MUTED

    add_card(s6, Inches(6.75), Inches(1.9), Inches(5.75), Inches(4.7), bg_color=CARD_BG, border_color=CARD_BORDER)
    tb_right = s6.shapes.add_textbox(Inches(7.0), Inches(2.05), Inches(5.25), Inches(4.3))
    tf_r = tb_right.text_frame
    tf_r.word_wrap = True
    p = tf_r.paragraphs[0]
    p.text = "AutoML Congestion Engine (VotingRegressor)"
    p.font.name = "Arial"
    p.font.size = Pt(18)
    p.font.bold = True
    p.font.color.rgb = ACCENT_EMERALD

    automl_points = [
        "Protected Model Artifacts: Serialized GradientBoosting + RandomForest pipeline stored under automl/ directory.",
        "Input Feature Vector: Origin Hub, Target Gate, Time-of-Day (Rush vs Non-rush), Day of Week, Vehicle Class.",
        "Continuous Penalization: Calculates bottleneck severity (e.g. 0.85 for Lal Kuan during 8:00–10:00 AM rush hour).",
        "Intelligent Detour Execution: Reroutes vehicle via Eastern Peripheral Expressway (EPE) bypass (35.3 km) saving ~25 mins net transit time.",
        "Confidence Scoring: Outputs Door-to-Gate ETA (49.5m) with 92% model confidence score."
    ]
    for pt in automl_points:
        p = tf_r.add_paragraph()
        p.text = "• " + pt
        p.font.name = "Arial"
        p.font.size = Pt(11)
        p.font.color.rgb = TEXT_MUTED

    s6.notes_slide.notes_text_frame.text = (
        "Here is the core technical innovation of CampusRide: "
        "Standard GPS navigation often makes the mistake of sending students through the physically shortest distance—like GT Road through Lal Kuan—which is completely gridlocked during morning peak hours. "
        "Our Hybrid Router combines Dijkstra's shortest-path graph algorithm with our AutoML VotingRegressor model. "
        "The AutoML model calculates dynamic traffic penalties and multiplies the edge weights. "
        "This allows the graph search to automatically discover that taking the slightly longer EPE bypass saves over 25 minutes of travel time."
    )

    # -------------------------------------------------------------
    # SLIDE 7: KEY COMMUTER CORRIDORS & REAL TELEMETRY
    # -------------------------------------------------------------
    s7 = prs.slides.add_slide(BLANK_LAYOUT)
    apply_background(s7)
    add_header(s7, "Corridor Telemetry", "Real Commuter Corridors to KCC ITM", "Real corridor metrics evaluated by the hybrid pathfinding engine")

    corridors = [
        ("Noida 62 ➔ KCC ITM", "Expressway Route", "28.5 km", "34.0 mins", "Aarav Sharma (Car)", "Route: Noida 62 -> FNG -> Noida Expressway -> Pari Chowk -> KCC Gate. Clear morning flow.", ACCENT_EMERALD),
        ("Lal Kuan ➔ KCC ITM", "Bottleneck Detour", "35.3 km", "49.5 mins", "Rohan Verma (Bike)", "GT Road severely congested (0.85 penalty). Rerouted via EPE Expressway bypass to avoid 75m gridlock.", ACCENT_AMBER),
        ("NH-3 ➔ KCC ITM", "130m Expressway", "24.2 km", "31.2 mins", "Kabir Mehta (Car)", "Pickup near Crossings Republik roundabout. Direct transit via Greater Noida 130m link corridor.", ACCENT_SKY),
        ("Chapraula ➔ KCC ITM", "Bypass Transit", "19.8 km", "26.5 mins", "Priya Patel (Car)", "Direct bypass run to Knowledge Park II campus gate. Lowest latency morning commuter corridor.", ACCENT_EMERALD)
    ]

    for i, (route_name, route_type, dist, eta, driver, notes, accent) in enumerate(corridors):
        col = i % 2
        row = i // 2
        left_pos = Inches(0.8 + col * 5.95)
        top_pos = Inches(1.9 + row * 2.55)
        add_card(s7, left_pos, top_pos, Inches(5.75), Inches(2.35), bg_color=CARD_BG, border_color=CARD_BORDER)

        tb = s7.shapes.add_textbox(left_pos + Inches(0.2), top_pos + Inches(0.15), Inches(5.35), Inches(2.05))
        tf = tb.text_frame
        tf.word_wrap = True

        p1 = tf.paragraphs[0]
        p1.text = route_name
        p1.font.name = "Arial"
        p1.font.size = Pt(16)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_WHITE

        p2 = tf.add_paragraph()
        p2.text = f"Strategy: {route_type}  |  Distance: {dist}  |  AutoML ETA: {eta}"
        p2.font.name = "Arial"
        p2.font.size = Pt(11)
        p2.font.bold = True
        p2.font.color.rgb = accent

        p3 = tf.add_paragraph()
        p3.text = f"Student Driver: {driver}\nTelemetry: {notes}"
        p3.font.name = "Arial"
        p3.font.size = Pt(10)
        p3.font.color.rgb = TEXT_MUTED

    s7.notes_slide.notes_text_frame.text = (
        "Here are the four key corridors implemented in our system: "
        "Notice route number 2: Lal Kuan to KCC ITM. The direct GT road route is heavily congested. "
        "Our engine routes student driver Rohan Verma through the EPE bypass. Even though the distance is 35.3 km, the ETA is reduced to 49.5 mins, preventing students from arriving late."
    )

    # -------------------------------------------------------------
    # SLIDE 8: STUDENT ADVANTAGES & IMPACT
    # -------------------------------------------------------------
    s8 = prs.slides.add_slide(BLANK_LAYOUT)
    apply_background(s8)
    add_header(s8, "Value Creation", "Measurable Advantages for KCC ITM Students", "Quantifiable benefits across student finances, campus safety, and academic punctuality")

    benefits = [
        ("Up to 70% Cost Savings", "Students save ₹2,000–₹4,500 every month on transit expenses. Car drivers offset their high fuel costs while riders pay a fraction of commercial cab fares.", ACCENT_EMERALD),
        ("100% Verified Peer Trust", "Eliminates security risks associated with commercial strangers. Every driver and passenger is a verified classmate or senior with an authentic student profile.", ACCENT_SKY),
        ("Punctuality & Exam Security", "Dynamic detour recommendations around Lal Kuan traffic traps prevent attendance penalties and ensure students reach morning examinations stress-free.", ACCENT_AMBER),
        ("Reduced Campus Congestion", "By moving from single-occupancy vehicles to shared carpools, CampusRide frees parking space at KCC ITM and significantly lowers campus carbon emissions.", RGBColor(16, 185, 129))
    ]

    for i, (title, desc, accent) in enumerate(benefits):
        col = i % 2
        row = i // 2
        left_pos = Inches(0.8 + col * 5.95)
        top_pos = Inches(1.9 + row * 2.55)
        add_card(s8, left_pos, top_pos, Inches(5.75), Inches(2.35), bg_color=CARD_BG, border_color=CARD_BORDER)

        bar = s8.shapes.add_shape(MSO_SHAPE.RECTANGLE, left_pos, top_pos, Inches(0.1), Inches(2.35))
        bar.fill.solid()
        bar.fill.fore_color.rgb = accent
        bar.line.fill.background()

        tb = s8.shapes.add_textbox(left_pos + Inches(0.25), top_pos + Inches(0.2), Inches(5.3), Inches(1.95))
        tf = tb.text_frame
        tf.word_wrap = True

        p1 = tf.paragraphs[0]
        p1.text = title
        p1.font.name = "Arial"
        p1.font.size = Pt(17)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_WHITE

        p2 = tf.add_paragraph()
        p2.text = "\n" + desc
        p2.font.name = "Arial"
        p2.font.size = Pt(12)
        p2.font.color.rgb = TEXT_MUTED

    s8.notes_slide.notes_text_frame.text = (
        "When explaining this to the class, emphasize the direct student advantages: "
        "1. Financial relief: Saving thousands of rupees every semester. "
        "2. Safety: Riding only with verified students from your own college. "
        "3. Academic attendance: No more missing attendance because of traffic bottlenecks. "
        "4. Sustainability: Contributing to a greener campus."
    )

    # -------------------------------------------------------------
    # SLIDE 9: VERIFICATION & CODEBASE ROBUSTNESS
    # -------------------------------------------------------------
    s9 = prs.slides.add_slide(BLANK_LAYOUT)
    apply_background(s9)
    add_header(s9, "Engineering Rigor", "Tested, Validated & Production-Ready", "Comprehensive end-to-end testing, zero dummy predictions, and bulletproof data persistence")

    tests = [
        ("10/10 E2E Test Suite", "Full test suite in pytest covering auth rejection, domain enforcement, AutoML inference, ride posting, and seat decrements."),
        ("Protected AutoML Blackbox", "Zero hardcoded prediction numbers. All ETAs are computed via real scikit-learn VotingRegressor pipeline inference."),
        ("ACID Seat Reservations", "Concurrent seat bookings handled atomically without race conditions; drivers cannot book their own seats."),
        ("Local Persistence & Sync", "Saved commuter corridors, profiles, and active rides persist cleanly across server restarts and page refreshes.")
    ]

    for i, (title, desc) in enumerate(tests):
        col = i % 2
        row = i // 2
        left_pos = Inches(0.8 + col * 5.95)
        top_pos = Inches(1.9 + row * 2.55)
        add_card(s9, left_pos, top_pos, Inches(5.75), Inches(2.35), bg_color=CARD_BG, border_color=CARD_BORDER)

        tb = s9.shapes.add_textbox(left_pos + Inches(0.25), top_pos + Inches(0.25), Inches(5.25), Inches(1.85))
        tf = tb.text_frame
        tf.word_wrap = True

        p1 = tf.paragraphs[0]
        p1.text = "✓ " + title
        p1.font.name = "Arial"
        p1.font.size = Pt(16)
        p1.font.bold = True
        p1.font.color.rgb = ACCENT_EMERALD

        p2 = tf.add_paragraph()
        p2.text = "\n" + desc
        p2.font.name = "Arial"
        p2.font.size = Pt(12)
        p2.font.color.rgb = TEXT_MUTED

    s9.notes_slide.notes_text_frame.text = (
        "We have backed our project with strict engineering verification: "
        "We have a 100% passing test suite across all 10 end-to-end integration tests. "
        "All predictions are generated by real ML inference, not hardcoded strings. "
        "And all database transactions are atomic, preventing double bookings."
    )

    # -------------------------------------------------------------
    # SLIDE 10: FUTURE ROADMAP & CONCLUSION
    # -------------------------------------------------------------
    s10 = prs.slides.add_slide(BLANK_LAYOUT)
    apply_background(s10)
    add_header(s10, "Future Scope", "Roadmap & Vision for Scalable Campus Mobility", "Expanding CampusRide beyond single campuses into a city-wide student transit grid")

    roadmap_items = [
        ("Live GPS Telemetry", "Integrating WebSocket-powered live vehicle tracking and geofenced campus gate arrival alerts.", ACCENT_SKY),
        ("Automated UPI Split", "Instant peer-to-peer micro-payments for fuel sharing via NPCI UPI QR integration.", ACCENT_EMERALD),
        ("Inter-College Network", "Expanding to adjacent institutions across Knowledge Park (Galgotias, Sharda, GL Bajaj).", ACCENT_AMBER),
        ("Continuous AutoML Learning", "Continuous model retraining pipeline feeding real-world trip telemetry into the AutoML ensemble.", RGBColor(168, 85, 247))
    ]

    for i, (title, desc, accent) in enumerate(roadmap_items):
        left_pos = Inches(0.8 + i * 2.95)
        add_card(s10, left_pos, Inches(1.9), Inches(2.8), Inches(4.8), bg_color=CARD_BG, border_color=CARD_BORDER)

        bar = s10.shapes.add_shape(MSO_SHAPE.RECTANGLE, left_pos, Inches(1.9), Inches(2.8), Inches(0.08))
        bar.fill.solid()
        bar.fill.fore_color.rgb = accent
        bar.line.fill.background()

        tb = s10.shapes.add_textbox(left_pos + Inches(0.2), Inches(2.2), Inches(2.4), Inches(4.3))
        tf = tb.text_frame
        tf.word_wrap = True

        p1 = tf.paragraphs[0]
        p1.text = title
        p1.font.name = "Arial"
        p1.font.size = Pt(16)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_WHITE

        p2 = tf.add_paragraph()
        p2.text = "\n" + desc
        p2.font.name = "Arial"
        p2.font.size = Pt(12)
        p2.font.color.rgb = TEXT_MUTED

    s10.notes_slide.notes_text_frame.text = (
        "In conclusion, CampusRide represents a modern, AI-powered solution to an urgent everyday student problem. "
        "Our roadmap includes real-time GPS telemetry, automated UPI micropayments, and scaling across Greater Noida's Knowledge Park education hub. "
        "Thank you! We are now open to questions from the class and professor."
    )

    output_path = "/Users/ishantverma/Desktop/CampusRide/CampusRide_Presentation.pptx"
    prs.save(output_path)
    print(f"Presentation saved successfully to: {output_path}")

if __name__ == "__main__":
    create_deck()
