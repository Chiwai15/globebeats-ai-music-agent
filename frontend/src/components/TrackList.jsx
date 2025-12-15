import React, { useState } from 'react'

const TrackList = ({ country, playlist, trackFilter, currentTrack, onPlaySong }) => {
  const [searchTerm, setSearchTerm] = useState('')

  // Determine source: country or playlist
  const source = playlist || country
  const tracks = playlist ? playlist.tracks : (country ? country.tracks : [])
  const sourceType = playlist ? 'playlist' : 'country'

  // Filter tracks - first by trackFilter (from parent), then by local search
  let displayTracks = trackFilter
    ? tracks.filter(track =>
        track.name.toLowerCase().includes(trackFilter.toLowerCase()) ||
        track.artist.toLowerCase().includes(trackFilter.toLowerCase())
      )
    : tracks

  // Apply local search filter
  if (searchTerm) {
    displayTracks = displayTracks.filter(track =>
      track.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      track.artist.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }

  const handlePlayPreview = (track) => {
    // Call parent's onPlaySong to handle playback
    // ALWAYS pass false for autoPlay - user clicked manually!
    if (onPlaySong) {
      if (sourceType === 'playlist') {
        // For playlists, pass playlist context to enable sequential playback
        const trackIndex = playlist.tracks.findIndex(t => t.name === track.name && t.artist === track.artist)
        onPlaySong(
          'PLAYLIST',
          track.name,
          track.artist,
          false, // User clicked manually
          track.preview_url,
          { playlist, index: trackIndex }, // Pass playlist context for sequential playback
          track.image_url // Pass image URL for album art display
        )
      } else if (country) {
        // For country tracks, DISABLE auto-play (user clicked manually)
        onPlaySong(country.country_code, track.name, track.artist, false)
      }
    }
  }

  return (
    <div>
      {country && (
        <div className="px-3 py-1.5 bg-white/30">
          <div className="flex items-center justify-between text-xs text-gray-700">
            <span className="capitalize font-medium">Source: {country.source}</span>
            <span>{new Date(country.updated_at).toLocaleTimeString()}</span>
          </div>
        </div>
      )}
      {playlist && (
        <div className="px-3 py-1.5 bg-blue-100/40">
          <div className="flex items-center justify-between text-xs text-blue-700">
            <span className="capitalize font-medium">Source: iTunes Search</span>
            <span>{displayTracks.length} tracks</span>
          </div>
        </div>
      )}

      {/* Search Input for Tracks */}
      <div className="px-3 py-2 bg-white/20">
        <div className="relative">
          <input
            type="text"
            placeholder="Search songs or artists..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-1.5 pl-8 text-sm bg-white/60 border border-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white/80 transition-all"
          />
          <svg className="absolute left-2.5 top-2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1.5 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {displayTracks.length === 0 ? (
        <div className="text-center py-12 px-4">
          <div className="text-gray-400 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <p className="text-sm text-gray-700">{trackFilter ? 'No matching tracks' : 'No tracks available'}</p>
          <p className="text-xs text-gray-500 mt-1">{trackFilter ? `No tracks match "${trackFilter}"` : 'Try another country'}</p>
        </div>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto">
          <div className="px-2 pb-2">
            {trackFilter && (
              <div className="px-2 py-1.5 mb-1 bg-blue-500/20 rounded-lg">
                <p className="text-xs text-blue-700 font-medium">
                  Filtered: "{trackFilter}" ({displayTracks.length} {displayTracks.length === 1 ? 'track' : 'tracks'})
                </p>
              </div>
            )}
            {displayTracks.map((track, index) => {
              // Check if this track is currently playing
              const isPlaying = currentTrack &&
                currentTrack.name === track.name &&
                currentTrack.artist === track.artist
              const isSelected = isPlaying

              return (
                <div
                  key={index}
                  className="group relative"
                >
                  <button
                    onClick={() => track.preview_url && handlePlayPreview(track)}
                    className={`w-full flex items-center gap-3 p-2 rounded hover:bg-white/70 transition-colors text-left ${
                      isSelected ? 'bg-white/70' : ''
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      {track.image_url ? (
                        <img
                          src={track.image_url}
                          alt={track.name}
                          className="w-12 h-12 rounded object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded bg-white/30 flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                          </svg>
                        </div>
                      )}
                      {track.preview_url && (
                        <div className={`absolute inset-0 flex items-center justify-center bg-black/50 rounded transition-opacity ${
                          isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}>
                          {isPlaying ? (
                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 pr-8">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {track.name}
                      </p>
                      <p className="text-xs text-gray-600 truncate">
                        {track.artist}
                      </p>
                    </div>
                  </button>

                  {track.external_url && (
                    <a
                      href={track.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`absolute top-2 right-2 p-2 hover:bg-white/80 rounded-full transition-all z-10 ${
                        isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                      title="Open in iTunes"
                    >
                      <svg className="w-4 h-4 text-gray-700 hover:text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                        <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                      </svg>
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default TrackList
