# Railway Deployment Guide

This guide explains how to deploy GlobeBeats to Railway with separate frontend and backend services.

## Prerequisites

- Railway account (https://railway.app)
- GitHub repository with GlobeBeats code
- API keys for OpenAI or Anthropic

## Deployment Steps

### 1. Create New Railway Project

1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your GlobeBeats repository

### 2. Deploy Backend Service

1. **Create Backend Service:**
   - In your Railway project, click "New Service"
   - Select "GitHub Repo" → Choose your repository
   - Railway will detect `backend/railway.json`

2. **Configure Backend Environment Variables:**
   Go to backend service → Variables tab and add:
   ```
   LLM_PROVIDER=openai
   OPENAI_API_KEY=your_openai_api_key
   # OR
   ANTHROPIC_API_KEY=your_anthropic_key

   LLM_MODEL=gpt-4-turbo-preview
   UPDATE_INTERVAL=300

   # Optional (for custom playlist search)
   SPOTIFY_CLIENT_ID=your_spotify_id
   SPOTIFY_CLIENT_SECRET=your_spotify_secret
   ```

3. **Configure Build Settings:**
   - Root Directory: `backend`
   - Dockerfile Path: `backend/Dockerfile` (should auto-detect from railway.json)

4. **Note Backend URL:**
   After deployment, copy the backend URL (e.g., `https://your-backend.up.railway.app`)

### 3. Deploy Frontend Service

1. **Create Frontend Service:**
   - In your Railway project, click "New Service"
   - Select "GitHub Repo" → Choose your repository again
   - Railway will detect `frontend/railway.json`

2. **Configure Frontend Environment Variables:**
   Go to frontend service → Variables tab and add:
   ```
   VITE_API_URL=https://your-backend.up.railway.app
   ```
   Replace with your actual backend URL from step 2.4

3. **Configure Build Settings:**
   - Root Directory: `frontend`
   - Dockerfile Path: `frontend/Dockerfile` (should auto-detect from railway.json)

### 4. Enable CORS on Backend

The backend CORS configuration needs to allow your frontend URL:

1. Go to backend service → Variables
2. Add/Update:
   ```
   CORS_ORIGINS=https://your-frontend.up.railway.app,http://localhost:5173
   ```
   Replace with your actual frontend URL

### 5. Verify Deployment

1. **Check Backend Health:**
   Visit `https://your-backend.up.railway.app/`
   You should see:
   ```json
   {
     "status": "healthy",
     "countries_loaded": 40,
     "ai_enabled": true
   }
   ```

2. **Check Frontend:**
   Visit `https://your-frontend.up.railway.app`
   - Globe should load with country markers
   - Chat should show LLM provider status
   - SSE connection should show "Connected"

## Railway Configuration Files

### Backend (`backend/railway.json`)
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "backend/Dockerfile"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Frontend (`frontend/railway.json`)
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "frontend/Dockerfile"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

## Architecture

```
GitHub Repo (GlobeBeats)
    ↓
Railway Project
    ├── Backend Service
    │   ├── Dockerfile: backend/Dockerfile
    │   ├── Port: Auto-assigned (Railway sets PORT env var)
    │   ├── URL: https://backend-xyz.up.railway.app
    │   └── Environment Variables (API keys, LLM config)
    │
    └── Frontend Service
        ├── Dockerfile: frontend/Dockerfile
        ├── Port: 80 (nginx)
        ├── URL: https://frontend-abc.up.railway.app
        └── Environment Variables (VITE_API_URL)
```

## Environment Variables Summary

### Backend Required:
- `LLM_PROVIDER` - "openai" or "anthropic"
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`
- `CORS_ORIGINS` - Frontend URL for CORS

### Backend Optional:
- `LLM_MODEL` - Default: "gpt-4-turbo-preview"
- `UPDATE_INTERVAL` - Default: 300 seconds
- `SPOTIFY_CLIENT_ID` - For custom playlist search
- `SPOTIFY_CLIENT_SECRET` - For custom playlist search

### Frontend Required:
- `VITE_API_URL` - Backend Railway URL

## Troubleshooting

### Backend won't start
- Check Railway logs: Backend service → Deployments → View Logs
- Verify all required environment variables are set
- Ensure API keys are valid

### Frontend can't connect to backend
- Verify `VITE_API_URL` is set correctly in frontend environment variables
- Check CORS_ORIGINS includes frontend URL in backend environment variables
- Open browser console to see API request errors

### SSE Connection Issues
- Railway has 60-second timeout for HTTP connections
- SSE connections may disconnect after idle time
- Frontend auto-reconnects on SSE errors

### Build Failures
- Check Dockerfile syntax
- Verify `railway.json` paths match actual Dockerfile locations
- Ensure all dependencies are in package.json/requirements.txt

## Cost Optimization

Railway free tier includes:
- 500 hours of compute per month
- $5 credit

To optimize costs:
- Set `UPDATE_INTERVAL` to higher value (e.g., 600 = 10 minutes)
- Use Anthropic Claude (cheaper than OpenAI GPT-4)
- Monitor usage in Railway dashboard

## Updating Deployment

To update after code changes:

1. Push to GitHub
2. Railway auto-deploys from connected branch
3. Monitor deployment in Railway dashboard
4. If environment variables changed, redeploy services

## Alternative: Single Dockerfile

For simpler deployment, you can use docker-compose locally but Railway requires separate services. The current setup with `railway.json` in both directories allows Railway to build both services from the same repository.
