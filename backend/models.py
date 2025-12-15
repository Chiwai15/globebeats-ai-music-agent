from pydantic import BaseModel
from typing import List, Optional


class Track(BaseModel):
    name: str
    artist: str
    preview_url: Optional[str] = None
    image_url: Optional[str] = None
    external_url: Optional[str] = None


class CountryMusic(BaseModel):
    country_code: str
    country_name: str
    latitude: float
    longitude: float
    flag: Optional[str] = None
    tracks: List[Track]
    source: str  # "spotify" or "lastfm"
    updated_at: str
