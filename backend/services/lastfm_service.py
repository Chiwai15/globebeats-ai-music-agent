import httpx
from typing import List
from models import Track


class LastFmService:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.api_base = "https://ws.audioscrobbler.com/2.0/"

    async def get_country_top_tracks(self, country_name: str, limit: int = 10) -> List[Track]:
        """Get top tracks for a specific country from Last.fm"""
        params = {
            "method": "geo.gettoptracks",
            "country": country_name,
            "api_key": self.api_key,
            "format": "json",
            "limit": limit
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(self.api_base, params=params)

            if response.status_code == 200:
                data = response.json()
                tracks_data = data.get("tracks", {}).get("track", [])

                tracks = []
                for track_data in tracks_data:
                    tracks.append(Track(
                        name=track_data.get("name", "Unknown"),
                        artist=track_data.get("artist", {}).get("name", "Unknown Artist"),
                        preview_url=None,
                        image_url=track_data.get("image", [{}])[-1].get("#text") if track_data.get("image") else None,
                        external_url=track_data.get("url")
                    ))

                return tracks

            return []
