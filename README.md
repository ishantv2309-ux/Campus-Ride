# CampusRide (Smart Student Carpooling & Commuter Network)

> **A high-performance, data-driven carpooling platform tailored for KCC Institute students, combining graph-based pathfinding with an integrated AutoML traffic prediction engine.**

---

## 📌 Overview

**CampusRide** is an intelligent, student-exclusive carpooling and tactical dispatch system engineered specifically for daily commutes to **KCC Institute of Technology and Management (Knowledge Park II, Greater Noida)**. 

Commuters navigating the National Capital Region (NCR) face severe bottlenecks along major transit arteries such as GT Road, NH-9, and the Lal Kuan junction. CampusRide solves this by pairing **Dijkstra/A\*** deterministic shortest-path graph traversal with an **integrated AutoML gradient-boosted traffic model**. The system evaluates real-time congestion scores, predicts accurate arrival ETAs, and automatically calculates dynamic bottleneck reroutes (e.g., routing drivers via the Eastern Peripheral Expressway [EPE] to bypass Lal Kuan delays).

---

## 🏗️ Architecture & Tech Stack

CampusRide is built with a resilient, decoupled client-server architecture combining high-throughput asynchronous Python microservices with an interactive tactical dashboard.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   CampusRide Frontend (React 18 + Vite)                │
│       • Tactical Commuter Dashboard        • 450ms Synced Light/Dark   │
│       • Interactive Route Waypoints        • Seat Dispatch Controls    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ JSON / REST API + Bearer JWT
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      FastAPI Asynchronous Gateway                      │
│       • Domain Gatekeeper (@college.edu.in)                            │
│       • Pydantic v2 Schema Validation & Rate-Limiting                  │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│        Hybrid Routing Engine         │  │   Supabase Auth & Database   │
│  • Graph Network (Dijkstra / A*)     │  │  • PostgreSQL DB Engine      │
│  • AutoML Pipeline (Joblib Artifact) │  │  • JWT Auth & RLS Policies   │
│  • Dynamic Lal Kuan Rerouting        │  │  • Student Verified Profiles │
└──────────────────────────────────────┘  └──────────────────────────────┘
```

### 1. Backend Microservices
- **FastAPI (Python 3.14 / 3.11+)**: High-performance asynchronous REST API handling auth tokens, ride queries, seat reservations, and telemetry feeds.
- **Graph Pathfinding (Dijkstra / A\*)**: Computes multi-hop topological distance matrices between regional commuter hubs and the college campus.
- **Pydantic v2**: Strict request/response data contracts, input sanitization, and structured error reporting.

### 2. Machine Learning & Predictive Analytics
- **Custom AutoML Engine (`AutoML/kcc_route_bundle`)**: Pre-trained machine learning pipeline (`pipeline.joblib`) that ingests physical distance, departure hour, and segment friction indices to compute realistic ETAs.
- **Bottleneck Rerouting Engine**: Evaluates edge weight penalties in real time; whenever corridor congestion exceeds threshold limits (such as a 0.85 bottleneck score on GT Road), the router calculates alternative high-speed corridors (e.g., via EPE) to save commute time.

### 3. Database, Security & Identity
- **Supabase (PostgreSQL & Auth)**: Cloud-native PostgreSQL persistence with Row-Level Security (RLS) policies.
- **Domain Gatekeeping**: Strict regex validation restricting account creation and authentication exclusively to verified institutional emails (`*@college.edu.in`).
- **Resilient Fallback Storage**: Built-in dual-engine persistence (automatically falls back to local SQLite if Supabase credentials are not configured).

### 4. Tactical Commuter Frontend
- **React 18 & Vite**: Lightning-fast hot module replacement (HMR) and optimized build bundles.
- **Tailwind CSS v3**: Clean, high-contrast, military-inspired commuter dashboard with zero bloat or slow filters.
- **Synchronized Theme Transition**: 450ms cubic-bezier transition engine delivering seamless switching between **Deep Obsidian Dark Mode** (`#09090B`) and **Crisp Off-White Light Mode** (`#F8FAFC`).
- **Lucide React Icons**: Unified iconography with interactive rotation/scale toggle animations.

---

## 🛣️ Commuter Corridor & Routing Logic

### Destination Anchor
- **Fixed Terminal**: **KCC Institute of Technology and Management**
- **Coordinates / Location**: Knowledge Park II, Greater Noida, Uttar Pradesh (201306)

### Dynamic Pickup Corridors
CampusRide monitors four primary student commuter arteries across NCR:
1. **Noida Sector 62 Corridor**: ~28.5 km via Noida-Greater Noida Expressway (Avg. ETA: ~34 mins).
2. **NH-3 / Crossings Republik Corridor**: ~24.2 km via Bisrakh Road & Greater Noida West Link (Avg. ETA: ~31 mins).
3. **Chapraula Corridor**: ~19.8 km via Dadri Main Road & Surajpur (Avg. ETA: ~26.5 mins).
4. **Lal Kuan Corridor**: ~35.3 km via Eastern Peripheral Expressway (Avg. ETA: ~48–52 mins with dynamic GT Road bypass).

### Hybrid Routing Mathematical Model
Traditional navigation engines rely solely on physical distance or static road speeds. CampusRide employs a **hybrid penalty routing algorithm**:

$$\text{Effective Edge Cost} = D \times \left(1 + \gamma \cdot C_{\text{AutoML}}\right)$$

Where:
- $D$ is the physical segment distance in kilometers.
- $C_{\text{AutoML}} \in [0.0, 1.0]$ is the real-time congestion coefficient generated by the AutoML model.
- $\gamma$ is the corridor friction multiplier (calibrated to $1.2$ for high-density suburban corridors).

When the GT Road segment through Lal Kuan experiences heavy gridlock ($C = 0.85$), the engine shifts the path traversal to the EPE bypass ($C = 0.12$), reducing overall passenger commute time by up to 25 minutes despite a slightly longer physical distance.

---

## 📂 Project Structure

```text
CampusRide/
├── AutoML/                               # Protected Machine Learning Module
│   └── kcc_route_bundle/
│       ├── model_artifact/
│       │   ├── pipeline.joblib          # Trained gradient-boosted routing pipeline
│       │   └── metadata.json            # Model parameters, features, and metrics
│       ├── test_inference.py            # Model inference verification script
│       └── requirements.txt             # Locked AutoML runtime dependencies
│
├── backend/                              # FastAPI Application
│   ├── main.py                          # API routes, app lifecycle & middleware
│   ├── models.py                        # Pydantic v2 data models & request schemas
│   ├── hybrid_router.py                 # Graph pathfinding & AutoML integration
│   ├── supabase_client.py               # Supabase Auth, PostgreSQL client & fallback
│   └── seed_data.py                     # Initial corridors and active rides seed data
│
├── src/                                  # React 18 Frontend Application
│   ├── components/                      # UI components (Dispatch cards, Theme toggle)
│   ├── App.jsx                          # Root dashboard view & live state management
│   ├── main.jsx                         # React DOM mount point
│   └── index.css                        # Global CSS & 450ms theme transition rules
│
├── tests/                                # Automated Test Suites
│   ├── test_end_to_end.py               # End-to-end integration and API tests
│   └── test_api.py                      # Router & schema verification tests
│
├── index.html                            # HTML entry point
├── package.json                          # Node.js project manifest & scripts
├── requirements.txt                      # Python backend dependencies
├── tailwind.config.js                    # Tailwind configuration & color themes
├── vite.config.js                        # Vite bundler configuration
└── README.md                             # Repository documentation
```

---

## 🚀 Setup & Installation Instructions

### Prerequisites
- **Python**: Version `3.11` or `3.14` recommended
- **Node.js**: Version `18.x` or `20.x` LTS
- **Package Managers**: `pip` and `npm`

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/<your-username>/CampusRide.git
cd CampusRide
```

---

### Step 2: Backend Setup & Virtual Environment

1. Create and activate a Python virtual environment:
   ```bash
   # On macOS/Linux:
   python3 -m venv venv
   source venv/bin/activate

   # On Windows (Command Prompt / PowerShell):
   # python -m venv venv
   # .\venv\Scripts\activate
   ```

2. Install backend dependencies:
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

3. *(Optional)* Configure Supabase Environment Variables:
   If connecting to an external Supabase PostgreSQL cluster, create a `.env` file in the project root:
   ```env
   SUPABASE_URL="https://your-project.supabase.co"
   SUPABASE_KEY="your-anon-or-service-role-key"
   ```
   > **Note:** If no Supabase keys are provided, CampusRide will automatically run in local mode with an embedded SQLite persistence fallback.

---

### Step 3: Frontend Setup

Open a new terminal window in the project root:
```bash
npm install
```

---

### Step 4: Run the Application

#### 1. Start the FastAPI Backend
```bash
# Ensure your virtual environment is active
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
The backend API will be available at:
- **API Root**: [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Endpoint**: [http://localhost:8000/api/health](http://localhost:8000/api/health)

#### 2. Start the React Frontend Dashboard
```bash
npm run dev
```
The tactical dashboard will launch at:
- **Frontend URL**: [http://localhost:5173](http://localhost:5173)

---

### Step 5: Run Automated Tests

Execute the comprehensive test suite to verify route finding, AutoML predictions, token validation, and API contracts:
```bash
pytest tests/test_end_to_end.py -v
```

---

## 🔒 Security & College Verification Policy

CampusRide enforces strict role-based access control and identity validation:
- **Institutional Domain Requirement**: Only users with verified institutional email addresses ending in `@college.edu.in` can authenticate or post rides.
- **Seat Allocation Lock**: Atomic seat reservation ensures vehicles cannot be over-booked beyond verified safety capacities.
- **Safe Commute Protocol**: Driver identities and vehicle numbers are validated and displayed across all confirmed corridors.

---

## 📄 License & Attribution

Developed for **KCC Institute of Technology and Management, Knowledge Park II, Greater Noida**.  
Distributed under the **MIT License**. See `LICENSE` for details.
