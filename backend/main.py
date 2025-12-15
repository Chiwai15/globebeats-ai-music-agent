from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
import asyncio
import json
from datetime import datetime
from typing import Dict, List
from config import settings
from models import CountryMusic
from services import ITunesService, RAGService, LLMService, SpotifyService
from data import COUNTRIES, get_country_name
from pydantic import BaseModel

app = FastAPI(title="GlobeBeats API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
itunes_service = ITunesService()

# Initialize Spotify service
spotify_service = SpotifyService(
    client_id=settings.spotify_client_id,
    client_secret=settings.spotify_client_secret
) if settings.spotify_client_id and settings.spotify_client_secret else None

# Initialize RAG service
rag_service = RAGService()

# Initialize LLM services (primary and fallback)
primary_llm_service = None
fallback_llm_service = None

if settings.llm_provider == "anthropic" and settings.anthropic_api_key:
    primary_llm_service = LLMService("anthropic", settings.anthropic_api_key, settings.anthropic_model)
    if settings.llm_fallback_enabled and settings.openai_api_key:
        fallback_llm_service = LLMService("openai", settings.openai_api_key, settings.openai_model)
elif settings.llm_provider == "openai" and settings.openai_api_key:
    primary_llm_service = LLMService("openai", settings.openai_api_key, settings.openai_model)
    if settings.llm_fallback_enabled and settings.anthropic_api_key:
        fallback_llm_service = LLMService("anthropic", settings.anthropic_api_key, settings.anthropic_model)

# Legacy support
llm_service = primary_llm_service

# Cache for country music data
music_cache: Dict[str, CountryMusic] = {}


# Pydantic models for chat
class ChatRequest(BaseModel):
    message: str
    conversation_history: List[Dict[str, str]] = []
    preferred_llm: str = "auto"  # "auto", "primary", "fallback"
    playlists: List[Dict] = []  # User's created playlists


class ChatResponse(BaseModel):
    response: str
    contexts: List[Dict] = []


class SearchRequest(BaseModel):
    query: str
    limit: int = 10


async def fetch_country_music(country: dict) -> CountryMusic:
    """Fetch music data for a country using iTunes RSS Feed API"""
    country_code = country["code"]
    country_name = country["name"]

    tracks = []
    source = "none"

    # Use iTunes RSS Feed API
    try:
        tracks = await itunes_service.get_country_top_tracks(country_code)
        if tracks:
            source = "itunes"
    except Exception as e:
        print(f"iTunes error for {country_code}: {e}")

    return CountryMusic(
        country_code=country_code,
        country_name=country_name,
        latitude=country["lat"],
        longitude=country["lon"],
        flag=country.get("flag"),
        tracks=tracks,
        source=source,
        updated_at=datetime.utcnow().isoformat()
    )


async def update_music_data():
    """Update music data for all countries"""
    print(f"Updating music data for {len(COUNTRIES)} countries...")

    # Fetch data for all countries concurrently (in batches to avoid rate limits)
    batch_size = 5
    for i in range(0, len(COUNTRIES), batch_size):
        batch = COUNTRIES[i:i + batch_size]
        tasks = [fetch_country_music(country) for country in batch]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for country, result in zip(batch, results):
            if isinstance(result, Exception):
                print(f"Error fetching data for {country['code']}: {result}")
            else:
                music_cache[country["code"]] = result

        # Small delay between batches to respect rate limits
        if i + batch_size < len(COUNTRIES):
            await asyncio.sleep(1)

    print(f"Updated {len(music_cache)} countries")

    # Update RAG database with new music data
    countries_data = [country.dict() for country in music_cache.values()]
    rag_service.update_music_data(countries_data)
    print("Updated RAG database")


@app.on_event("startup")
async def startup_event():
    """Initialize data on startup"""
    await update_music_data()

    # Start background task for periodic updates
    asyncio.create_task(periodic_update())


async def periodic_update():
    """Periodically update music data"""
    while True:
        await asyncio.sleep(settings.update_interval)
        await update_music_data()


@app.get("/")
async def root():
    """Health check endpoint"""
    rag_stats = rag_service.get_stats()

    # Determine available LLMs
    available_llms = []
    if primary_llm_service:
        primary_name = "Anthropic (Claude)" if settings.llm_provider == "anthropic" else "OpenAI (GPT-4)"
        available_llms.append({"id": "primary", "name": primary_name, "provider": settings.llm_provider})
    if fallback_llm_service:
        fallback_name = "OpenAI (GPT-4)" if settings.llm_provider == "anthropic" else "Anthropic (Claude)"
        fallback_provider = "openai" if settings.llm_provider == "anthropic" else "anthropic"
        available_llms.append({"id": "fallback", "name": fallback_name, "provider": fallback_provider})

    return {
        "status": "ok",
        "service": "GlobeBeats API",
        "countries": len(music_cache),
        "music_source": "itunes",
        "search_enabled": spotify_service is not None,
        "ai_enabled": llm_service is not None,
        "rag_stats": rag_stats,
        "available_llms": available_llms
    }


@app.get("/countries", response_model=List[CountryMusic])
async def get_all_countries():
    """Get music data for all countries"""
    return list(music_cache.values())


@app.get("/countries/{country_code}", response_model=CountryMusic)
async def get_country(country_code: str):
    """Get music data for a specific country"""
    country_code = country_code.upper()
    if country_code in music_cache:
        return music_cache[country_code]
    return {"error": "Country not found"}


@app.post("/search")
async def search_tracks(request: SearchRequest):
    """Search for tracks on iTunes by song name, artist, or both

    This endpoint uses iTunes Search API which has 90%+ preview availability.
    Examples: "Love Story Taylor Swift", "Shake It Off", "Bohemian Rhapsody Queen", "Shakira"
    """
    # Use iTunes service instead of Spotify for better preview availability
    tracks = await itunes_service.search_tracks(request.query, request.limit)

    return {
        "query": request.query,
        "tracks": [track.dict() for track in tracks],
        "count": len(tracks),
        "source": "iTunes"
    }


@app.get("/stream")
async def stream():
    """SSE endpoint for real-time updates"""
    async def event_generator():
        while True:
            # Send current data
            if music_cache:
                yield {
                    "event": "update",
                    "data": json.dumps([country.dict() for country in music_cache.values()])
                }

            # Wait before next update
            await asyncio.sleep(30)

    return EventSourceResponse(event_generator())


@app.post("/chat")
async def chat(request: ChatRequest):
    """Chat endpoint with RAG - returns streaming response with fallback support"""
    if not primary_llm_service:
        return {
            "error": "AI service not configured. Please add OpenAI or Anthropic API key to .env file."
        }

    # Search for relevant context (limited to 10 for HNSW compatibility)
    # Note: HNSW index has parameter limits, requesting all 40 countries causes:
    # "RuntimeError: Cannot return the results in a contigious 2D array"
    contexts = rag_service.search_relevant_context(request.message, n_results=10)

    async def stream_response():
        full_response = ""

        # Determine which LLM to use based on preference
        selected_service = None
        if request.preferred_llm == "fallback" and fallback_llm_service:
            selected_service = fallback_llm_service
        else:
            selected_service = primary_llm_service

        # Try the selected LLM
        try:
            async for chunk in selected_service.chat(
                request.message,
                contexts,
                request.conversation_history,
                request.playlists
            ):
                full_response += chunk
                yield {
                    "event": "message",
                    "data": json.dumps({"chunk": chunk, "done": False})
                }
        except Exception as e:
            error_str = str(e)
            print(f"[DEBUG] LLM Error: {error_str}")
            print(f"[DEBUG] Error Type: {type(e).__name__}")

            # Try fallback only if auto mode and error is retriable
            if request.preferred_llm == "auto" and fallback_llm_service and selected_service == primary_llm_service:
                if "overloaded" in error_str.lower() or "rate_limit" in error_str.lower():
                    # Send switching notification as separate message
                    primary_name = "Anthropic (Claude)" if settings.llm_provider == "anthropic" else "OpenAI"
                    fallback_name = "OpenAI (GPT-4)" if settings.llm_provider == "anthropic" else "Anthropic (Claude)"

                    # Send done for switching message
                    yield {
                        "event": "message",
                        "data": json.dumps({
                            "chunk": f"⚠️ {primary_name} is overloaded. Switching to {fallback_name}...",
                            "done": True
                        })
                    }

                    # Try fallback
                    try:
                        full_response = ""
                        async for chunk in fallback_llm_service.chat(
                            request.message,
                            contexts,
                            request.conversation_history,
                            request.playlists
                        ):
                            full_response += chunk
                            yield {
                                "event": "message",
                                "data": json.dumps({"chunk": chunk, "done": False})
                            }
                    except Exception as fallback_error:
                        fallback_error_str = str(fallback_error)
                        print(f"[DEBUG] Fallback Error: {fallback_error_str}")
                        error_msg = f"⚠️ Both AI providers are unavailable. Please try again in a moment."
                        yield {
                            "event": "message",
                            "data": json.dumps({"chunk": error_msg, "done": False})
                        }
                else:
                    # Different error - show to user
                    provider_name = "Anthropic (Claude)" if settings.llm_provider == "anthropic" else "OpenAI"
                    error_msg = f"⚠️ {provider_name} error: {error_str[:150]}"
                    yield {
                        "event": "message",
                        "data": json.dumps({"chunk": error_msg, "done": False})
                    }
            else:
                # Show error
                provider_name = "Anthropic (Claude)" if selected_service == primary_llm_service else "OpenAI (GPT-4)"
                error_msg = f"⚠️ {provider_name} error: {error_str[:150]}"
                yield {
                    "event": "message",
                    "data": json.dumps({"chunk": error_msg, "done": False})
                }

        # Send final message with contexts
        yield {
            "event": "message",
            "data": json.dumps({
                "chunk": "",
                "done": True,
                "full_response": full_response,
                "contexts": contexts
            })
        }

    return EventSourceResponse(stream_response())


@app.get("/rag/stats")
async def rag_stats():
    """Get RAG database statistics"""
    return rag_service.get_stats()


@app.get("/rag/summary")
async def rag_summary():
    """Get summary of available countries"""
    return {"summary": rag_service.get_all_countries_summary()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
