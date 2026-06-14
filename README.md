# Halal Checker

A web app to check if food products are Halal, using Claude AI with real-time web search.

## Setup

### 1. Add your Anthropic API key

Edit `backend/.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
PORT=3001
```

### 2. Start the backend

```bash
cd backend
npm install
npm start
```

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 (or 5174 if 5173 is in use).

## Features

- **Search by Name** — type a product name, Claude searches the web for ingredients and halal status
- **Scan Product** — upload or photograph an ingredient label, Claude reads the text via vision and checks each ingredient
- Green ✅ Halal / Red ❌ Haram / Yellow ⚠️ Uncertain results with full ingredient breakdown
- Mobile-friendly, works with phone camera
