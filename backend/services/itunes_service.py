import httpx
import asyncio
from typing import List
from models import Track


class ITunesService:
    def __init__(self):
        self.api_base = "https://itunes.apple.com"
        self.search_base = "https://itunes.apple.com/search"

    async def get_preview_url(self, track_name: str, artist_name: str, country_code: str) -> str:
        """Get preview URL for a track using iTunes Search API"""
        params = {
            'term': f"{track_name} {artist_name}",
            'media': 'music',
            'entity': 'song',
            'limit': 1,
            'country': country_code
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(self.search_base, params=params, timeout=10.0)
                if response.status_code == 200:
                    data = response.json()
                    if data.get('results') and len(data['results']) > 0:
                        return data['results'][0].get('previewUrl')
                elif response.status_code in (403, 429):
                    # Rate limited - skip silently to avoid log spam
                    pass
        except:
            pass
        return None

    async def search_tracks(self, query: str, limit: int = 20) -> List[Track]:
        """Search for tracks using iTunes Search API

        Args:
            query: Search query (artist name, song name, etc.)
            limit: Maximum number of results (default 20)

        Returns:
            List of Track objects with preview URLs
        """
        try:
            params = {
                'term': query,
                'media': 'music',
                'entity': 'song',
                'limit': limit,
                'country': 'US'  # Use US store for widest catalog
            }

            async with httpx.AsyncClient() as client:
                response = await client.get(self.search_base, params=params, timeout=10.0)

                if response.status_code != 200:
                    print(f"iTunes search error: {response.status_code}")
                    return []

                data = response.json()
                results = data.get('results', [])

                tracks = []
                for result in results:
                    # Extract track information
                    track_name = result.get('trackName', 'Unknown')
                    artist_name = result.get('artistName', 'Unknown Artist')
                    preview_url = result.get('previewUrl')  # iTunes almost always has this!
                    image_url = result.get('artworkUrl100')  # 100x100 album art
                    external_url = result.get('trackViewUrl')  # iTunes store link

                    tracks.append(Track(
                        name=track_name,
                        artist=artist_name,
                        preview_url=preview_url,
                        image_url=image_url,
                        external_url=external_url
                    ))

                return tracks

        except Exception as e:
            print(f"iTunes search error: {type(e).__name__}: {str(e)}")
            return []

    async def get_country_top_tracks(self, country_code: str) -> List[Track]:
        """Get top tracks for a specific country using iTunes RSS Feed API"""
        try:
            # iTunes uses lowercase country codes
            country_code_lower = country_code.lower()

            # Construct iTunes RSS feed URL
            url = f"{self.api_base}/{country_code_lower}/rss/topsongs/limit=10/json"

            async with httpx.AsyncClient() as client:
                response = await client.get(url, timeout=10.0)

                if response.status_code != 200:
                    print(f"iTunes API error for {country_code}: {response.status_code}")
                    return []

                data = response.json()
                feed = data.get("feed", {})
                entries = feed.get("entry", [])

                tracks = []
                for idx, entry in enumerate(entries[:10]):
                    # Extract track information
                    track_name = entry.get("im:name", {}).get("label", "Unknown")
                    artist_name = entry.get("im:artist", {}).get("label", "Unknown Artist")

                    # Get album art
                    images = entry.get("im:image", [])
                    image_url = None
                    if images and len(images) > 0:
                        # Get the largest image (last one is typically largest)
                        image_url = images[-1].get("label")

                    # Get iTunes link - can be dict or first item in list
                    link_data = entry.get("link")
                    external_url = None
                    if isinstance(link_data, dict):
                        external_url = link_data.get("attributes", {}).get("href")
                    elif isinstance(link_data, list) and len(link_data) > 0:
                        external_url = link_data[0].get("attributes", {}).get("href")

                    # Get preview URL for first 5 tracks (iTunes rate limits from Docker IPs)
                    # Note: iTunes aggressively rate limits API requests from server IPs
                    preview_url = None
                    if idx < 5:
                        preview_url = await self.get_preview_url(track_name, artist_name, country_code)
                        await asyncio.sleep(0.2)  # Small delay between requests

                    tracks.append(Track(
                        name=track_name,
                        artist=artist_name,
                        preview_url=preview_url,
                        image_url=image_url,
                        external_url=external_url
                    ))

                return tracks

        except Exception as e:
            print(f"iTunes service error for {country_code}: {type(e).__name__}: {str(e)}")
            return []
