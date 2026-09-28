# FloodShield 🌊

FloodShield is an AI-Powered Flood Decision Intelligence System. It features an automated data pipeline, an ANUGA hydraulic flood simulation engine, and a premium interactive Next.js web dashboard.

This repository is split into two components:
1. `backend/`: Python-based hydrodynamic simulation engine (ANUGA 4.0.1 2D SWE, Delft3D & PySPH benchmarks, Sentinel-1 SAR pipeline, and FastAPI server).
2. `frontend/`: Next.js (React) premium UI for the Dam Break Inundation Modeling Studio.

---

## 🚀 One-Command Quick Start

To launch both the FastAPI hydrodynamic backend and the Next.js mission control dashboard simultaneously:

```bash
./start.sh
```

- **Mission Control Dashboard:** [http://localhost:3000](http://localhost:3000)
- **Interactive API Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **System Health Status:** [http://localhost:8000/api/health](http://localhost:8000/api/health)

### 🧪 Run the SIH26161 Automated Test Suite

To validate all 5 NTRO technical deliverables in a single command:

```bash
backend/.venv/bin/python backend/tests/test_sih26161.py
```

## 🏗️ Backend Setup

The backend handles the heavy lifting, including data fetching (OpenStreetMap, Weather) and running the flood propagation simulations.

### Prerequisites
- Python 3.9+
- PostgreSQL 16+ (installed natively)
- PostGIS Extension (installed via PostgreSQL Stack Builder -> Spatial Extensions)
- QGIS & ANUGA Viewer Plugin (to view simulation results)

### Installation

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   ```
   *Note for Windows users: If you run into a `WinError 2` file not found error, run `python -m venv venv` (without the dot).*

3. Activate the virtual environment:
   * **Windows (PowerShell):**
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   * **Windows (Command Prompt):**
     ```cmd
     venv\Scripts\activate.bat
     ```
   * **Linux / macOS:**
     ```bash
     source venv/bin/activate
     ```

4. Install the standard dependencies:
   ```bash
   pip install -r requirements.txt
   ```

5. Install ANUGA (Hydraulic Simulation Engine):
   ANUGA is a heavy scientific module written in Python and C that requires C-compilation. Choose the method for your operating system:

   * **Windows (Highly Recommended to use Conda)**
     Natively compiling C-extensions on Windows via pip requires the heavy Microsoft C++ Build Tools. It is highly recommended to use Conda to get the pre-compiled binaries instead:
     ```bash
     conda install -c conda-forge anuga
     ```

   * **Linux / Ubuntu (via Pip)**
     To install ANUGA natively on Linux, you must first install the system-level C compilers and Python development headers so `pip` can compile the physics engine from source:
     ```bash
     sudo apt-get update
     sudo apt-get install build-essential python3-dev
     pip install anuga
     ```

   * **macOS (via Pip)**
     Ensure you have the Xcode Command Line Tools installed (`xcode-select --install`), then run:
     ```bash
     pip install anuga
     ```

6. Hydrological Routing Engine (Wflow & SCS-CN):
   The Wflow integration is handled entirely natively in Python via the `wflow_runner.py` script. It uses the mathematical **SCS Curve Number (SCS-CN)** equation to translate rainfall CSV data into surface runoff (discharge). 
   Because this is a pure Python implementation, you do **not** need to install Julia or complex C++ Wflow dependencies! The FastAPI server automatically routes rainfall data from the frontend directly into this calculation engine.

### Automated Pipeline Execution (Recommended)
Instead of running scripts individually, use the master automation script. This script automatically:
1. Initializes the PostGIS database.
2. Fetches OpenStreetMap road networks, shelters, and Open-Meteo weather data.
3. Executes the ANUGA hydraulic simulation.

* **Windows (PowerShell):**
  ```powershell
  .\run_pipeline.ps1
  ```
* **Linux / macOS:**
  ```bash
  chmod +x run_pipeline.sh
  ./run_pipeline.sh
  ```

*Note: Raw data is saved to `backend/data/raw/` and simulation `.sww` files are saved to `backend/data/processed/`.*

### Running the FastAPI Server
To serve the API for the frontend dashboard:
```bash
uvicorn src.main:app --reload
```
The backend API will run on `http://localhost:8000`.

---

## 💻 Frontend Setup

The frontend provides a premium, interactive web interface built with Next.js, TailwindCSS, and Leaflet.

### Prerequisites
- Node.js & npm

### Installation
```bash
cd frontend
npm install
```

### Running the Dashboard
Start the development server:
```bash
npm run dev
```
Open **http://localhost:3000** in your browser.







> **Note:** The frontend automatically proxies API calls to the Python backend on port 8000. Make sure the backend server (`uvicorn`) is running simultaneously!

## Local LLM Setup (Ollama)

This project uses a 100% local LLM for drafting emergency SMS messages in the SMS Dispatch Dashboard. We recommend using **Qwen** via Ollama.

### Windows Installation:
1. Download Ollama for Windows from [ollama.com](https://ollama.com/download/windows).
2. Run the installer (OllamaSetup.exe).
3. Once installed, open your command prompt (or PowerShell).
4. Run the following command to download and start the **Qwen** model:
   `powershell
   ollama run qwen2.5:0.5b
   `
   *(Note: You can use qwen2.5:1.5b or qwen2.5:7b if your computer has more RAM/VRAM for better responses).*
5. Ollama will automatically expose a local API at http://localhost:11434. The Next.js frontend and FastAPI backend are pre-configured to communicate with this endpoint automatically.
