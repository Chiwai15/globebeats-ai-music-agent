# GlobeBeats - Complete Project Understanding

> **Document Status**: Living document - Updated as understanding evolves
> **Last Updated**: 2026-01-31
> **Purpose**: Single source of truth for project architecture, current state, and known issues

---

## Executive Summary

**GlobeBeats** is a RAG-powered (Retrieval-Augmented Generation) global music discovery platform that:
- Displays trending music from 40+ countries on an interactive 3D globe
- Provides AI chat for natural language music queries
- Creates custom playlists via conversational AI
- Streams 30-second audio previews via iTunes

**Core Tech Stack**:
- **Backend**: FastAPI + ChromaDB (vector store) + OpenAI/Anthropic LLM
- **Frontend**: React 19 + react-globe.gl + Tailwind CSS
- **Data Source**: iTunes RSS Feed API (primary), iTunes Search API (playlists)
- **Deployment**: Docker Compose (local), Railway (production-ready)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER BROWSER                                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     React Frontend (port 5174)                    │   │
│  │  ┌────────────┐  ┌───────────────┐  ┌─────────────────────────┐ │   │
│  │  │  GlobeMap  │  │  ChatPanel    │  │  MusicPlayer            │ │   │
│  │  │  (3D Globe)│  │  (AI Chat)    │  │  (Audio Playback)       │ │   │
│  │  └────────────┘  └───────────────┘  └─────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ HTTP/SSE
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      FastAPI Backend (port 8001)                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │  ITunesService   │  │   RAGService     │  │    LLMService        │  │
│  │  (Music Data)    │  │   (ChromaDB)     │  │  (OpenAI/Anthropic)  │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────┬───────────┘  │
│           │                     │                        │              │
│           ▼                     ▼                        ▼              │
│     iTunes API           Vector Store             LLM APIs              │
│    (RSS + Search)       (In-Memory)          (Streaming SSE)           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Current Implementation Status

### Backend Services

| Service | File | Status | Notes |
|---------|------|--------|-------|
| ITunesService | `backend/services/itunes_service.py` | **Active** | Primary data source for trending + search |
| RAGService | `backend/services/rag_service.py` | **Active** | ChromaDB with all-MiniLM-L6-v2 embeddings |
| LLMService | `backend/services/llm_service.py` | **Active** | Dual-provider (OpenAI/Anthropic) with fallback |
| SpotifyService | `backend/services/spotify_service.py` | **Legacy** | Optional, rarely used |
| LastFMService | `backend/services/lastfm_service.py` | **Legacy** | Not used in current flow |

### Frontend Components

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| App.jsx | `frontend/src/App.jsx` | **Active** | Main orchestrator, ~490 lines |
| GlobeMap.jsx | `frontend/src/components/GlobeMap.jsx` | **Active** | 3D globe, ~854 lines |
| ChatPanel.jsx | `frontend/src/components/ChatPanel.jsx` | **Active** | AI chat, ~859 lines |
| MusicPlayer.jsx | `frontend/src/components/MusicPlayer.jsx` | **Active** | Audio controls, ~268 lines |
| TrackList.jsx | `frontend/src/components/TrackList.jsx` | **Active** | Track display, ~202 lines |
| FrequencyVisualizer.jsx | `frontend/src/components/FrequencyVisualizer.jsx` | **Disabled** | CORS blocks iTunes audio analysis |

---

## Key Data Flows

### 1. Initial Page Load

```
App.jsx startup
    │
    ├─► fetchCountries() → GET /countries
    │                           │
    │                           └─► Returns 40 countries with tracks
    │
    ├─► Connect SSE → GET /stream
    │                     │
    │                     └─► Real-time updates every 30s
    │
    └─► Audio unlock listener (waits for user click)
            │
            └─► playRandomSong() auto-plays trending
```

### 2. AI Chat Flow (Action Tag System)

```
User types: "play taylor swift"
    │
    ▼
ChatPanel.handleSubmit()
    │
    ├─► POST /chat with message + history + playlists
    │
    ▼
Backend:
    ├─► RAGService.search_relevant_context() → Top 10 countries
    ├─► LLMService.chat() with context + playlists
    │
    ▼
LLM Response (streamed):
    "Coming right up! 🎵 [ACTION:SHOW_SONG_LIST|Taylor Swift]"
    │
    ▼
ChatPanel parses action tag:
    │
    ├─► executeAction("[ACTION:SHOW_SONG_LIST|Taylor Swift]")
    │       │
    │       └─► showSongList("Taylor Swift")
    │               │
    │               └─► POST /search {query: "Taylor Swift", limit: 20}
    │                       │
    │                       └─► iTunes Search API returns 20 tracks
    │
    ▼
ChatPanel creates playlist:
    │
    └─► onAddPlaylist("Taylor Swift", tracks)
            │
            └─► App.jsx adds to playlists state
                    │
                    └─► Auto-plays first track with preview URL
```

### 3. Sequential Playlist Playback

```
Track ends → audio 'ended' event
    │
    ▼
Check: currentPlayingPlaylistRef.current?
    │
    ├─► YES: Play next track in playlist
    │           │
    │           └─► handlePlaySong(..., playlistContext: {playlist, index+1})
    │
    └─► NO: Check isAutoPlayModeRef.current?
                │
                ├─► YES: playRandomSong() (trending)
                │
                └─► NO: Stop playback
```

---

## Action Tag System

The LLM communicates with the frontend using action tags embedded in responses:

| Action | Format | Behavior |
|--------|--------|----------|
| SELECT_COUNTRY | `[ACTION:SELECT_COUNTRY\|JP]` | Zooms globe, shows country's trending tracks |
| SHOW_SONG_LIST | `[ACTION:SHOW_SONG_LIST\|Taylor Swift]` | Searches iTunes, creates playlist, auto-plays |
| SEARCH_AND_PLAY | `[ACTION:SEARCH_AND_PLAY\|christmas]` | Searches trending charts for query |
| SEARCH_SPOTIFY | `[ACTION:SEARCH_SPOTIFY\|query]` | Legacy - uses iTunes now |
| PLAY_SONG | `[ACTION:PLAY_SONG\|US\|track\|artist]` | Direct play (rarely used) |

**Duplicate Prevention**: `executedActionsRef` tracks executed actions to prevent re-execution during streaming.

---

## Stale/Outdated Items

### 1. MCP Migration Plans (Not Implemented)

Files in `llm-history/`:
- `MCP_MIGRATION_DESIGN.md` - Detailed design for tool-use pattern
- `MCP_MIGRATION_PLAN.json` - Migration steps
- `MCP_IMPLEMENTATION_PLAN.json` - Implementation details
- `MCP_TECHNICAL_DOCUMENTATION.md` - Technical specs
- `MCP_IMPLEMENTATION_PROGRESS.json` - Progress tracker

**Status**: These were planning documents for converting from action tags to MCP tool-use. **Never implemented**. The current system uses action tags.

### 2. Legacy Service Files

- `SpotifyService` - Configured but iTunes is preferred for preview availability
- `LastFMService` - Not used in any current flow

### 3. FrequencyVisualizer

- Disabled due to CORS restrictions on iTunes audio URLs
- `createMediaElementSource()` requires same-origin audio

---

## Configuration

### Environment Variables (.env)

```bash
# Required for AI chat
LLM_PROVIDER=anthropic              # or "openai"
ANTHROPIC_API_KEY=sk-ant-...        # Primary LLM
OPENAI_API_KEY=sk-...               # Fallback LLM

# Models
ANTHROPIC_MODEL=claude-sonnet-4-20250514
OPENAI_MODEL=gpt-4-turbo-preview

# Optional (not used by default)
SPOTIFY_CLIENT_ID=                   # Only for Spotify search
SPOTIFY_CLIENT_SECRET=
LASTFM_API_KEY=                      # Not used

# System
CORS_ORIGINS=http://localhost:5174
UPDATE_INTERVAL=300                  # Music refresh (seconds)
```

### Ports

| Service | Internal | External |
|---------|----------|----------|
| Backend | 8000 | 8001 |
| Frontend | 80 (nginx) / 5173 (dev) | 5174 |

---

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Health check + service status |
| GET | `/countries` | All 40 countries with tracks |
| GET | `/countries/{code}` | Single country data |
| GET | `/stream` | SSE real-time updates |
| POST | `/chat` | AI chat with streaming |
| POST | `/search` | iTunes search for playlists |
| GET | `/rag/stats` | Vector DB statistics |
| GET | `/rag/summary` | Countries list |

---

## Known Limitations

1. **ChromaDB HNSW Limit**: Max 10 results per query (index parameter constraint)
2. **iTunes Audio CORS**: FrequencyVisualizer disabled, no audio analysis
3. **30-Second Previews**: iTunes only provides preview clips
4. **In-Memory Storage**: Data lost on restart (no persistence)
5. **Single Instance**: No horizontal scaling for SSE connections
6. **No Authentication**: Demo-only, no user sessions

---

## Development Commands

```bash
# Start all services
docker-compose up -d --build

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Rebuild after changes
docker-compose down && docker-compose up -d --build

# Quick start script
./START.sh

# Stop
./STOP.sh

# Health check
curl http://localhost:8001/
```

---

## File Structure (Key Files)

```
GlobeBeats/
├── backend/
│   ├── main.py                 # FastAPI app, endpoints
│   ├── config.py               # Pydantic settings
│   ├── models.py               # Track, CountryMusic
│   ├── services/
│   │   ├── itunes_service.py   # Primary music source
│   │   ├── rag_service.py      # ChromaDB vector ops
│   │   └── llm_service.py      # OpenAI/Anthropic chat
│   └── data/
│       └── countries.py        # 40 country definitions
│
├── frontend/
│   └── src/
│       ├── App.jsx             # Root component
│       ├── config.js           # API_BASE_URL
│       ├── components/
│       │   ├── GlobeMap.jsx    # 3D globe + sidebars
│       │   ├── ChatPanel.jsx   # AI chat + demos
│       │   ├── MusicPlayer.jsx # Audio controls
│       │   └── TrackList.jsx   # Track display
│       └── data/
│           └── demoScenarios.json
│
├── docs/
│   ├── BACKEND.md              # Backend documentation
│   ├── FRONTEND.md             # Frontend documentation
│   ├── INFRASTRUCTURE.md       # Docker/deployment
│   └── PROJECT_UNDERSTANDING.md # This document
│
├── llm-history/                # Development logs
│   ├── INDEX.md                # Session log index
│   ├── 2025-12-13*.md          # Build sessions
│   ├── 2025-12-14*.md          # Feature sessions
│   └── MCP_*.md/json           # Stale MCP plans
│
├── docker-compose.yml
├── .env                        # API keys (not in git)
├── ARCHITECTURE.md             # High-level architecture
├── FEATURES.json               # Feature inventory
└── README.md                   # User documentation
```

---

## Relationship to Other Docs

| Document | Purpose | Status |
|----------|---------|--------|
| `README.md` | User-facing quick start | Current |
| `ARCHITECTURE.md` | High-level system design | Current |
| `docs/BACKEND.md` | Detailed backend docs | Current |
| `docs/FRONTEND.md` | Detailed frontend docs | Current |
| `docs/INFRASTRUCTURE.md` | Docker/deployment | Current |
| `llm-history/INDEX.md` | Development session logs | Current |
| `llm-history/MCP_*.md` | MCP migration plans | **Stale** |
| `FEATURES.json` | Feature inventory | Current |

---

## Architecture Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Vector DB | ChromaDB (in-memory) | Fast, easy Python integration, good for prototyping |
| Embeddings | all-MiniLM-L6-v2 | Lightweight (80MB), good for short text |
| Real-time | SSE (not WebSocket) | Simpler, one-way sufficient, auto-reconnect |
| LLM Communication | Action tags (not tool-use) | Simpler, frontend controls execution |
| Music Source | iTunes RSS/Search | 90%+ preview availability, no auth required |
| Frontend | React + Vite | Fast HMR, modern tooling |
| Styling | Tailwind CSS v3 | Utility-first, v4 has breaking changes |
| 3D Globe | react-globe.gl | Feature-rich, handles textures/animations |

---

## Interview/Demo Notes

**Key talking points**:
1. RAG architecture - semantic search over music data
2. Real-time SSE streaming for both data updates and chat
3. Multi-provider LLM with automatic fallback
4. Action tag pattern for LLM → UI communication
5. Playlist context tracking for sequential playback
6. Audio unlock pattern for browser autoplay policy

**Demo scenarios** (in `demoScenarios.json`):
- Country exploration
- Artist playlist creation
- Multi-step conversations

---

## Future Considerations (From llm-history)

Not implemented but discussed:
- MCP tool-use migration (multi-step reasoning, error recovery)
- Persistent playlists (localStorage or backend)
- Playlist editing (reorder, delete tracks)
- Export to Spotify
- Rate limiting for production
- User authentication
