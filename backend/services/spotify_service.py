import httpx
import base64
from typing import List, Optional
from datetime import datetime
from models import Track, CountryMusic


class SpotifyService:
    def __init__(self, client_id: str, client_secret: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.access_token: Optional[str] = None
        self.token_url = "https://accounts.spotify.com/api/token"
        self.api_base = "https://api.spotify.com/v1"

    async def get_access_token(self) -> str:
        """Get Spotify access token using client credentials flow"""
        if self.access_token:
            return self.access_token

        auth_str = f"{self.client_id}:{self.client_secret}"
        auth_b64 = base64.b64encode(auth_str.encode()).decode()

        headers = {
            "Authorization": f"Basic {auth_b64}",
            "Content-Type": "application/x-www-form-urlencoded"
        }

        data = {"grant_type": "client_credentials"}

        async with httpx.AsyncClient() as client:
            response = await client.post(self.token_url, headers=headers, data=data)
            response.raise_for_status()
            token_data = response.json()
            self.access_token = token_data["access_token"]
            return self.access_token

    async def get_country_top_tracks(self, country_code: str, playlist_id: str = None) -> List[Track]:
        """Get popular tracks for a specific country using Spotify's search with market parameter"""
        try:
            token = await self.get_access_token()
            headers = {"Authorization": f"Bearer {token}"}

            async with httpx.AsyncClient() as client:
                # Search for popular tracks in the market
                # Use generic search terms that will return popular local content
                search_terms = ["pop", "top", "hits", "chart"]
                tracks = []

                for term in search_terms[:2]:  # Use first 2 terms to get variety
                    params = {
                        "q": term,
                        "type": "track",
                        "market": country_code,
                        "limit": 5
                    }

                    response = await client.get(
                        f"{self.api_base}/search",
                        headers=headers,
                        params=params,
                        timeout=10.0
                    )

                    if response.status_code == 200:
                        data = response.json()
                        items = data.get("tracks", {}).get("items", [])

                        for track in items:
                            if track and len(tracks) < 10:
                                # Avoid duplicates
                                if not any(t.external_url == track.get("external_urls", {}).get("spotify") for t in tracks):
                                    tracks.append(Track(
                                        name=track.get("name", "Unknown"),
                                        artist=", ".join([artist["name"] for artist in track.get("artists", [])]),
                                        preview_url=track.get("preview_url"),
                                        image_url=track.get("album", {}).get("images", [{}])[0].get("url") if track.get("album", {}).get("images") else None,
                                        external_url=track.get("external_urls", {}).get("spotify")
                                    ))
                    else:
                        print(f"Spotify API error for {country_code}: {response.status_code} - {response.text[:200]}")

                    if len(tracks) >= 10:
                        break

                return tracks[:10]

        except Exception as e:
            print(f"Spotify service error for {country_code}: {type(e).__name__}: {str(e)}")
            return []

    async def search_track(self, query: str, limit: int = 10) -> List[Track]:
        """Search for tracks on Spotify by song name, artist, or both

        Args:
            query: Search query (e.g., "Love Story Taylor Swift", "Shake It Off", "Ed Sheeran")
            limit: Maximum number of results to return

        Returns:
            List of Track objects with preview URLs when available
        """
        try:
            token = await self.get_access_token()
            headers = {"Authorization": f"Bearer {token}"}

            async with httpx.AsyncClient() as client:
                params = {
                    "q": query,
                    "type": "track",
                    "market": "US",  # Required for preview URLs
                    "limit": limit
                }

                response = await client.get(
                    f"{self.api_base}/search",
                    headers=headers,
                    params=params,
                    timeout=10.0
                )

                if response.status_code == 200:
                    data = response.json()
                    items = data.get("tracks", {}).get("items", [])

                    tracks = []
                    for track in items:
                        if track:
                            tracks.append(Track(
                                name=track.get("name", "Unknown"),
                                artist=", ".join([artist["name"] for artist in track.get("artists", [])]),
                                preview_url=track.get("preview_url"),
                                image_url=track.get("album", {}).get("images", [{}])[0].get("url") if track.get("album", {}).get("images") else None,
                                external_url=track.get("external_urls", {}).get("spotify")
                            ))

                    return tracks
                else:
                    print(f"Spotify search error: {response.status_code} - {response.text[:200]}")
                    return []

        except Exception as e:
            print(f"Spotify search error: {type(e).__name__}: {str(e)}")
            return []
