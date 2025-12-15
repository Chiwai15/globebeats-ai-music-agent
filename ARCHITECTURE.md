# GlobeBeats Architecture

## System Overview

GlobeBeats is a production-ready, AI-powered music discovery platform featuring real-time data synchronization, RAG-based natural language querying, and interactive visualization.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Layer                          │
│  React + Vite │ Leaflet Maps │ SSE Client │ TailwindCSS     │
└────────────────────────┬────────────────────────────────────┘
                         │
                    HTTP/SSE
                         │
┌────────────────────────┴────────────────────────────────────┐
│                   API Gateway Layer                         │
│           FastAPI │ CORS │ SSE Streaming                    │
└──────┬─────────┬──────────────┬──────────────┬──────────────┘
       │         │              │              │
   ┌───┴───┐ ┌──┴────┐  ┌──────┴────┐  ┌─────┴──────┐
   │ Music │ │  RAG  │  │    LLM    │  │   Cache    │
   │Service│ │Service│  │ Service   │  │  Manager   │
   └───┬───┘ └───┬───┘  └─────┬─────┘  └────────────┘
       │         │            │
   ┌───┴────┐ ┌──┴──────┐ ┌──┴────────┐
   │Spotify │ │ChromaDB │ │OpenAI/    │
   │Last.fm │ │Vector DB│ │Anthropic  │
   └────────┘ └─────────┘ └───────────┘
```

## Core Components

### 1. Frontend Architecture

**Technology Stack:**
- **React 18**: Component-based UI with hooks
- **Vite**: Fast development server with HMR
- **Leaflet**: Interactive map rendering
- **TailwindCSS**: Utility-first styling

**Key Components:**
```
App.jsx                    # Root component, state orchestration
├── Header.jsx             # Status indicators, branding
├── GlobeMap.jsx           # Interactive world map
│   └── TrackList.jsx      # Music track rendering
├── ChatPanel.jsx          # AI chat interface
│   └── SSE streaming      # Real-time AI responses
└── MusicPlayer.jsx        # Audio playback controls
```

**State Management:**
- React hooks for local state
- useRef for audio context and playback
- Props drilling for component communication
- SSE for server-pushed state updates

### 2. Backend Architecture

**Technology Stack:**
- **FastAPI**: Async Python web framework
- **ChromaDB**: Vector database for semantic search
- **Sentence Transformers**: Embedding generation
- **SSE-Starlette**: Server-Sent Events
- **Pydantic**: Type validation and settings

**Service Layer:**

```python
MusicFetchService
├── iTunes RSS Feed API (trending charts)
├── Spotify Web API (optional, playlist search)
├── Data normalization
├── Caching (5-minute TTL)
└── Batched requests (5 countries/batch)

RAGService
├── Document embedding (all-MiniLM-L6-v2)
├── ChromaDB collection management
├── Semantic search (cosine similarity)
└── Context retrieval (top-k)

LLMService
├── Provider abstraction (OpenAI/Anthropic)
├── Streaming response handling
├── Prompt engineering
└── Conversation history management
```

### 3. Data Flow

#### Music Data Pipeline

```
iTunes RSS Feed API → MusicFetchService → In-Memory Cache
                                                ↓
                                          RAGService
                                                ↓
                                   Vector Embedding (384-dim)
                                                ↓
                                           ChromaDB
                                                ↓
                                         SSE Broadcast → Clients
```

**Update Cycle:**
1. Background task runs every 5 minutes
2. Fetches data from iTunes RSS Feed API (batched, 5 per request)
3. Updates in-memory cache
4. Re-embeds documents
5. Updates ChromaDB collection
6. Broadcasts to connected clients via SSE

#### AI Chat Pipeline

```
User Query → ChatPanel → POST /chat
                              ↓
                        RAGService.search_relevant_context()
                              ↓
                    Vector similarity search (top-10)
                              ↓
                        LLM Prompt Construction
                              ↓
                    OpenAI/Anthropic Streaming API
                              ↓
                        SSE Response Stream → Client
```

### 4. Vector Database Design

**Collection Schema:**
```python
{
    "name": "music_data",
    "metadata": {"description": "Global music trends by country"},
    "embedding_function": SentenceTransformer('all-MiniLM-L6-v2')
}
```

**Document Structure:**
```python
{
    "id": "country_code",
    "document": """
        Country: {country_name} ({country_code})
        Data Source: {source}
        Top Tracks:
        - {track} by {artist}
        ...
        Updated: {timestamp}
    """,
    "metadata": {
        "country_code": str,
        "country_name": str,
        "source": str,
        "track_count": int
    }
}
```

**Search Strategy:**
- Embedding dimension: 384
- Similarity metric: Cosine similarity
- Top-k results: 10 (HNSW index limitation)
- No distance threshold (return all k results)

### 5. API Design

#### RESTful Endpoints

```
GET  /                    # Health check + service status
GET  /countries           # All country music data
GET  /countries/{code}    # Single country data
POST /search              # iTunes search for playlists
POST /chat                # AI chat (SSE response)
GET  /stream              # Music data updates (SSE)
GET  /rag/stats           # RAG database stats
GET  /rag/summary         # Country summary
```

#### SSE Streams

**Music Data Stream (`/stream`):**
```javascript
event: update
data: {
  "countries": [...],  // Full dataset
  "timestamp": "2024-..."
}
```

**Chat Stream (`/chat`):**
```javascript
event: thinking
data: {"thought": "Analyzing query..."}

event: chunk
data: {"content": "Based on the data, "}

event: done
data: {"message": "Stream complete"}

event: error
data: {"error": "Error message"}
```

### 6. Deployment Architecture

**Docker Compose Stack:**
```yaml
services:
  backend:
    - FastAPI app (uvicorn)
    - Port 8000 → 8001
    - Hot reload enabled
    - Volume mounts for development

  frontend:
    - Vite dev server
    - Port 5173 → 5174
    - Hot reload enabled
    - Proxy to backend
```

**Environment Configuration:**
```
Production:  .env (Docker secrets)
Development: .env (local file)
Testing:     In-memory overrides
```

## Design Decisions

### 1. Why ChromaDB?
- **In-memory mode**: Fast startup, no persistence needed
- **Simple API**: Easy integration, minimal boilerplate
- **Good embedding support**: Built-in sentence transformers
- **Trade-off**: Limited to 10 results due to HNSW params
- **Alternative considered**: Pinecone (too expensive), Weaviate (over-engineered)

### 2. Why SSE over WebSockets?
- **Unidirectional**: Server → Client (our use case)
- **HTTP/2 compatible**: Better for proxies/CDNs
- **Simpler client**: Native EventSource API
- **Automatic reconnection**: Built-in browser support
- **Trade-off**: No client → server push (not needed)

### 3. Why React + Vite?
- **Fast HMR**: Sub-second updates
- **Modern tooling**: ESM, tree-shaking
- **Simple setup**: No webpack complexity
- **Trade-off**: Not suitable for SSR (not needed)

### 4. Why FastAPI?
- **Async native**: Non-blocking I/O for APIs
- **Type safety**: Pydantic validation
- **Auto docs**: OpenAPI/Swagger built-in
- **SSE support**: Via sse-starlette
- **Trade-off**: Python GIL (mitigated by async)

## Performance Characteristics

### Latency
- **Music data fetch**: 2-5s (API dependent)
- **RAG search**: <100ms (in-memory ChromaDB)
- **LLM first token**: 300-800ms (API dependent)
- **SSE chunk delivery**: <50ms

### Scalability
- **Concurrent users**: Limited by SSE connections (~1000/instance)
- **Database size**: 40 countries × 5 tracks = 200 documents
- **Embedding time**: ~50ms for 40 documents
- **Memory usage**: ~500MB (ChromaDB + models)

### Caching Strategy
```
Music data:  5-minute TTL (balance freshness vs API quota)
Embeddings:  Regenerated on data update
LLM calls:   No caching (conversational context)
```

## Security Considerations

### API Keys
- Stored in `.env` (never committed)
- Docker secrets in production
- Validation on startup

### CORS
- Whitelist specific origins
- Credentials allowed for same-origin
- No wildcard in production

### Rate Limiting
- External APIs: Handled by providers
- Internal APIs: Not implemented (single-user demo)
- **Production TODO**: Add rate limiting middleware

## Monitoring & Observability

### Logging
```python
INFO:  API requests, data updates
ERROR: API failures, LLM errors
DEBUG: RAG search results, embedding dims
```

### Health Checks
```python
GET / → {
  "status": "healthy",
  "countries_loaded": 40,
  "rag_documents": 40,
  "llm_configured": true
}
```

## Known Limitations

1. **HNSW Index Constraints**: Maximum 10 results per query
2. **Audio CORS**: iTunes preview has CORS restrictions, visualizer disabled
3. **Single-Instance**: No horizontal scaling (SSE in-memory)
4. **No Persistence**: Data cleared on restart
5. **Demo Mode**: No user authentication, rate limiting
