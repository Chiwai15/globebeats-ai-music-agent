# 🌍 GlobeBeats

Real-time global music discovery platform with RAG-powered natural language querying. Explore what's trending across 40+ countries and interact with music data through conversational AI.

## Features

- **Interactive World Map** - Click any country to see trending tracks
- **AI-Powered Search** - Natural language queries over global music data
- **Real-Time Updates** - Server-Sent Events for live data synchronization
- **iTunes RSS Feed API** - Trending music charts from 40+ countries
- **Audio Previews** - Stream 30-second track previews
- **Playlist Generation** - Create custom playlists via Spotify search and conversational AI

## Quick Start

### Prerequisites

- Docker & Docker Compose
- API Keys:
  - **Required**: OpenAI or Anthropic API key (for AI chat)
  - **Optional**: Spotify API (https://developer.spotify.com/dashboard) - for custom playlist search
  - **Note**: iTunes RSS Feed API requires no key (public API)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd GlobeBeats

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Start services
docker-compose up --build

# Access application
# Frontend: http://localhost:5174
# Backend:  http://localhost:8001
# API Docs: http://localhost:8001/docs
```

### Development Setup

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Backend Architecture

### Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Web Framework | **FastAPI** | Async API with automatic OpenAPI docs |
| Vector Database | **ChromaDB** | Semantic search over music data |
| Embeddings | **Sentence Transformers** | Text-to-vector conversion (all-MiniLM-L6-v2) |
| LLM Integration | **OpenAI / Anthropic** | Conversational AI with streaming |
| HTTP Client | **httpx** | Async requests to external APIs |
| Streaming | **SSE-Starlette** | Server-Sent Events for real-time updates |
| Validation | **Pydantic** | Type-safe configuration and request validation |
| Runtime | **Uvicorn** | ASGI server with hot reload |

### Core Services

#### MusicFetchService
Fetches trending music data:
- **iTunes RSS Feed API**: Top charts for 40+ countries (primary source)
- **Spotify Web API**: Search for custom playlist creation (optional)
- **Caching**: 5-minute TTL to minimize API calls
- **Batched Requests**: 5 countries per batch to avoid rate limits

#### RAGService
Vector database operations for semantic search:
- **Document Embedding**: Converts country music data to 384-dim vectors
- **ChromaDB Management**: In-memory collection with automatic updates
- **Similarity Search**: Cosine similarity with top-k retrieval
- **Context Retrieval**: Fetches relevant music data for LLM queries

#### LLMService
Streaming AI chat implementation:
- **Provider Abstraction**: Supports OpenAI (GPT-4) and Anthropic (Claude)
- **Streaming Responses**: Token-by-token delivery via SSE
- **Conversation History**: Maintains context across messages
- **Fallback Logic**: Automatic provider switching on failure

### API Endpoints

```
GET  /                     Health check + service status
GET  /countries            All country music data
GET  /countries/{code}     Single country details
POST /search               iTunes search for playlist creation
POST /chat                 AI chat with streaming response (SSE)
GET  /stream               Real-time music data updates (SSE)
GET  /rag/stats            Vector database statistics
GET  /rag/summary          Available countries summary
```

### Data Pipeline

```
iTunes RSS Feed API (public, no auth required)
        ↓
  MusicFetchService (batched, 5-min cache)
        ↓
  Document Embedding (SentenceTransformer)
        ↓
  ChromaDB (Vector Storage)
        ↓
  SSE Broadcast → Connected Clients
```

### RAG Implementation

**Vector Database:**
- **Collection**: `music_data` (40 documents, 1 per country)
- **Embedding Model**: `all-MiniLM-L6-v2` (384 dimensions)
- **Search**: Cosine similarity, top-10 results
- **Update Strategy**: Full re-embedding on data refresh

**Document Structure:**
```python
{
    "id": "US",
    "document": "Country: United States (US)\nTop Tracks:\n- Song by Artist\n...",
    "metadata": {
        "country_code": "US",
        "country_name": "United States",
        "source": "spotify",
        "track_count": 50
    }
}
```

**Query Flow:**
1. User sends natural language query
2. Query embedded to 384-dim vector
3. ChromaDB retrieves top-10 similar country documents
4. Context injected into LLM prompt
5. Streaming response returned via SSE

### Server-Sent Events

**Music Data Stream:**
```javascript
// /stream endpoint
event: update
data: {"countries": [...], "timestamp": "2024-12-15T..."}
```

**Chat Stream:**
```javascript
// /chat endpoint
event: thinking
data: {"thought": "Analyzing global music trends..."}

event: chunk
data: {"content": "Based on the data, "}

event: done
data: {"message": "Stream complete"}
```

### Configuration

Environment variables (`.env`):
```env
# AI/LLM (Required)
LLM_PROVIDER=openai                    # or "anthropic"
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4-turbo-preview
ANTHROPIC_API_KEY=your_key             # optional fallback
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
LLM_FALLBACK_ENABLED=true

# Music APIs (Optional - Spotify only for custom playlist search)
SPOTIFY_CLIENT_ID=your_client_id      # optional
SPOTIFY_CLIENT_SECRET=your_client_secret  # optional
# Note: iTunes RSS Feed API requires no authentication

# System
UPDATE_INTERVAL=300                    # seconds
CORS_ORIGINS=http://localhost:5173,http://localhost:5174
```

### Dependencies

**Core:**
```
fastapi==0.115.6
uvicorn[standard]==0.34.0
sse-starlette==2.2.1
pydantic-settings==2.7.1
```

**AI/RAG:**
```
chromadb==0.5.23
sentence-transformers==3.3.1
openai==1.59.3
anthropic==0.42.0
```

**HTTP:**
```
httpx==0.28.1
```

### Performance

- **Latency**:
  - Music API fetch: 2-5s (external dependency)
  - RAG search: <100ms (in-memory ChromaDB)
  - LLM first token: 300-800ms
- **Throughput**: ~1000 concurrent SSE connections
- **Memory**: ~500MB (ChromaDB + embedding models)

### Scalability Considerations

**Current Setup (Single Instance):**
- In-memory ChromaDB (no persistence)
- Single uvicorn worker
- Local caching (no distributed cache)

**Production Enhancements:**
- Replace in-memory ChromaDB with persistent storage
- Add Redis for distributed caching
- Horizontal scaling with load balancer
- Rate limiting middleware
- Request/response logging

## Frontend Stack

- **React 18** - Component-based UI
- **Vite** - Fast development with HMR
- **Leaflet** - Interactive maps
- **TailwindCSS** - Utility-first styling
- **EventSource API** - SSE client

## Supported Regions

40+ countries including US, UK, Canada, Japan, South Korea, Brazil, Australia, Germany, France, Spain, Italy, Mexico, and more.

## API Examples

### Get all countries:
```bash
curl http://localhost:8001/countries
```

### Chat with AI:
```bash
curl -X POST http://localhost:8001/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are the top tracks in Japan?",
    "conversation_history": []
  }'
```

### Search music (for playlists):
```bash
curl -X POST http://localhost:8001/search \
  -H "Content-Type: application/json" \
  -d '{"query": "taylor swift", "limit": 20}'
```

## Project Structure

```
GlobeBeats/
├── backend/
│   ├── main.py              # FastAPI application & routes
│   ├── config.py            # Environment configuration
│   ├── services/
│   │   ├── music_fetch.py   # External API integration
│   │   ├── rag_service.py   # ChromaDB vector operations
│   │   └── llm_service.py   # OpenAI/Anthropic streaming
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Root component
│   │   ├── components/      # React components
│   │   └── data/            # Demo scenarios
│   └── package.json
├── docker-compose.yml       # Multi-container setup
├── .env.example             # Environment template
└── README.md
```

## License

MIT

## Acknowledgments

- Apple iTunes RSS Feed API - Music chart data
- Spotify Web API - Custom playlist search
- OpenAI / Anthropic - LLM providers
- ChromaDB - Vector database
- OpenStreetMap & CARTO - Map tiles
