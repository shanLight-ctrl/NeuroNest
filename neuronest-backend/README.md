# NeuroNest Backend API

FastAPI backend for NeuroNest — handles all Gemini API calls server-side so the API key is never exposed to the browser.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| POST | `/audio` | Generate podcast-style audio script |
| POST | `/cards` | Simplify, explain, or generate flashcards |
| POST | `/quiz` | Generate 3-level progressive quiz |

## Run locally

```bash
# Install dependencies
pip install -r requirements.txt

# Set your Gemini key
cp .env.example .env
# Edit .env and add your GEMINI_KEY

# Run
uvicorn main:app --reload --port 8080
```

API docs available at: `http://localhost:8080/docs`

## Deploy to Google Cloud Run

```bash
# 1. Install Google Cloud CLI: https://cloud.google.com/sdk/docs/install

# 2. Login
gcloud auth login

# 3. Set your project
gcloud config set project YOUR_PROJECT_ID

# 4. Deploy (from the neuronest-backend folder)
gcloud run deploy neuronest-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_KEY=your-actual-key-here
```

Your API will be live at a URL like:
`https://neuronest-api-xxxx-uc.a.run.app`

## Connect frontend

In your frontend `app.js`, replace the direct Gemini call with:
```js
var BACKEND_URL = "https://neuronest-api-xxxx-uc.a.run.app";
```
