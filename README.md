# League Analyzer (Nexus)

![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Python](https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54)
![MongoDB](https://img.shields.io/badge/MongoDB-%234ea94b.svg?style=for-the-badge&logo=mongodb&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)

**Nexus** is a full-stack advanced analytics platform for League of Legends that bridges the gap between raw match data and actionable player insights.

---

## 📖 About The Project

### The Problem
League of Legends matches generate thousands of data points, but existing tools often present this information in a vacuum. Players are told *what* their stats were (e.g., "Drafting 7cs/min"), but rarely *why* it mattered in the context of that specific game state or team composition.

### The Solution
Nexus aggregates data from the Riot Games API, applying role-specific algorithms to contextualize performance. Instead of static tables, it offers:
*   **Relative Benchmarking:** Comparing performance not just to averages, but to dynamic baselines based on game duration and role.
*   **Algorithmic "Blame" Detection:** A proprietary model that analyzes win conditions to determine if a loss was due to individual performance or team macro play.
*   **AI-Powered Coaching:** An integrated LLM ("Neural Link") that synthesizes match events into qualitative, tactical advice.

---

## ✨ Key Features

### 🧠 Contextual Intelligence
*   **Role-Aware Baselines:** Benchmarks metrics (CS, Damage Share, KP) against Diamond/Master tier standards specific to the played role (e.g., comparing a Top Laner's KP to other Top Laners, not Supports).
*   **Win Factor Analysis:** Categorizes losses by identifying specific failure points—whether it was objective control (Dragon/Baron), lane phase deficits, or late-game scaling.

### 🤖 Nexus Neural Link (AI Coach)
A custom RAG (Retrieval-Augmented Generation) pipeline that feeds structured match JSON into an LLM to generate:
*   **Tactical Feedback:** Specific advice on positioning and decision-making.
*   **Itemization Analysis:** evaluating build efficiency against the enemy team composition.

### 📊 Dynamic Visualizations
*   **Bento Grid Dashboard:** A modern, high-density UI built with React & Tailwind CSS.
*   **Teammate Synergy Tracker:** Aggregates win rates with specific duo partners over time.
*   **Deep Dive Timeline:** A scrollable, event-based view of the match flow.

---

## 🛠️ Technical Architecture

This project demonstrates a modern full-stack application structure:

*   **Data Layer:**
    *   **Ingestion:** Python scripts utilizing the Riot Games v5 API.
    *   **Storage:** MongoDB for persistent querying of complex nested match JSONs and caching analysis results.
*   **Backend:**
    *   FastAPI / Python scripts for data processing and business logic.
    *   Custom algorithms for "Win Probability" and "Player Responsibility" scoring.
*   **Frontend:**
    *   **Framework:** React (Vite).
    *   **Styling:** Tailwind CSS for a responsive, "glassmorphism" aesthetic.
    *   **State Management:** Complex hook-based state for filtering match history and asynchronous data fetching.

---

## 🚀 Getting Started

### Prerequisites
*   Python 3.9+
*   Node.js & npm
*   MongoDB Instance (Local or Atlas)
*   Riot Games API Key

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/league-analyzer.git
    cd league-analyzer
    ```

2.  **Backend Setup**
    ```bash
    # Create virtual environment
    python -m venv .venv
    source .venv/bin/activate  # or .venv\Scripts\activate on Windows

    # Install dependencies
    pip install -r requirements.txt
    
    # Configure Environment
    # Create a .env file and add:
    # RIOT_API_KEY=your_key_here
    # MONGO_URI=mongodb://localhost:27017/
    ```

3.  **Frontend Setup**
    ```bash
    cd web_dashboard/frontend
    npm install
    npm run dev
    ```

---

## 🔮 Roadmap

*   [ ] **Live Game Nexus Assistant:** A real-time lobby/in-game tool providing immediate strategic context:
    *   **AI Skill Scores:** Dynamic scoring of all participants based on overall proficiency and specific champion mastery.
    *   **Strategic Game Plan:** A generated "path to victory" guide outlining key win conditions and macro plays specific to the draft.
    *   **ML Win Prediction:** Integrating the win probability model to forecast outcomes based on live match variables.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
