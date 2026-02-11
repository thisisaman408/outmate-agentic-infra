# Outmate.Ai - B2B Data Intelligence Platform

Outmate.Ai is a comprehensive B2B data intelligence and outreach automation platform. It aggregates data from multiple providers (Crustdata, Explorium, ContactOut), provides advanced filtering for lead discovery, and automates research and outreach via AI agents.

---

## 🚀 Key Features

### 🔍 Database Finder
- **Multi-Provider Search**: Discover prospects and companies using data from Crustdata, Explorium, and ContactOut.
- **Advanced Filtering**: Filter by industry, revenue, employee count, technology stack, funding, and more.
- **Intelligent Caching**: High-performance query results with Redis-backed caching.

### 🤖 AI Agents
- **Automated Research**: AI-driven agents that research leads and gather deep insights.
- **Personalized Outreach**: Generate and send personalized messages based on lead data.

### 📈 Lead Management
- **Contact & Company Enrichment**: Enhance lead data with firmographic, technographic, and social insights.
- **Scoring & Signals**: Prioritize leads based on intent data and custom scoring models.
- **Lists & Exports**: Organize leads into lists and export them to CSV or XLSX.

### 💳 Credit & Usage System
- **Usage-Based Tracking**: Transparent credit management for data enrichment and searches.
- **Transaction History**: Detailed logs for all credit-related activities.

### 📣 Campaigns & Workflows
- **Multi-Channel Outreach**: Automate campaigns across email, LinkedIn, and more.
- **Visual Workflows**: Build complex automation sequences with an intuitive UI.

---

## 🛠️ Technology Stack

### Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python)
- **Database**: [PostgreSQL](https://www.postgresql.org/) (via SQLAlchemy & Supabase)
- **Task Queue / Cache**: [Redis](https://redis.io/)
- **Validation**: [Pydantic v2](https://docs.pydantic.dev/)
- **API Client**: [HTTPX](https://www.python-httpx.org/)

### Frontend
- **Framework**: [Next.js](https://nextjs.org/) (React 19)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/), [Framer Motion](https://www.framer.com/motion/)
- **UI Components**: [Radix UI](https://www.radix-ui.com/), [Lucide React](https://lucide.dev/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Forms**: [React Hook Form](https://react-hook-form.com/) & [Zod](https://zod.dev/)

---

## 📂 Project Structure

```text
Outmate/
├── Backend/          # FastAPI application
│   ├── app/          # Main application logic
│   │   ├── api/      # API routes and controllers
│   │   ├── db/       # SQLAlchemy models and database logic
│   │   ├── services/ # Business logic layer
│   │   └── schemas/  # Pydantic models
│   ├── alembic/      # Database migrations
│   └── .env.example  # Backend environment variables
├── Frontend/         # Next.js application
│   ├── app/          # App router pages and API routes
│   ├── components/   # Reusable UI components
│   ├── lib/          # Utilities and shared logic
│   ├── hooks/        # Custom React hooks
│   └── public/       # Static assets
└── README.md         # Comprehensive project documentation
```

---

## ⚙️ Setup & Installation

### Backend Setup

1. **Navigate to the Backend directory**:
   ```bash
   cd Backend
   ```

2. **Create and activate a virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure Environment Variables**:
   Create a `.env` file in the `Backend` directory and add your PostgreSQL and API credentials (see `.env.example`).

5. **Run Database Migrations**:
   ```bash
   alembic upgrade head
   ```

6. **Start the server**:
   ```bash
   uvicorn app.main:app --reload
   ```

### Frontend Setup

1. **Navigate to the Frontend directory**:
   ```bash
   cd Frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install  # or pnpm install / yarn install
   ```

3. **Configure Environment Variables**:
   Create a `.env.local` file in the `Frontend` directory with the necessary API URLs and keys.

4. **Start the development server**:
   ```bash
   npm run dev
   ```

---

## 📄 License

This project is proprietary and confidential. All rights reserved by Outmate.Ai.
