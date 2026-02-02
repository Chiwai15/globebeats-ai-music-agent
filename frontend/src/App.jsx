import { useState, useEffect, useRef, useCallback } from 'react'
import GlobeMap from './components/GlobeMap'
import Header from './components/Header'
import ChatPanel from './components/ChatPanel'
import MusicPlayer from './components/MusicPlayer'
import { useAudioPlayer } from './hooks/useAudioPlayer'
import { API_BASE_URL } from './config'
import './App.css'

function App() {
  const [countries, setCountries] = useState([])
  const [playlists, setPlaylists] = useState([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState(null)
  const [trackFilter, setTrackFilter] = useState(null)
  const [selectedPlaylist, setSelectedPlaylist] = useState(null)

  // Use the singleton audio player
  const {
    isPlaying,
    isUnlocked,
    currentTrack,
    play,
    togglePlayPause,
    stop,
    seek,
    skip,
    unlock,
    onTrackEnded,
    getAudioElement
  } = useAudioPlayer()

  const globeMapRef = useRef(null)
  const countriesRef = useRef([])
  const isAutoPlayModeRef = useRef(true)

  // Refs to store latest function references (avoids stale closures)
  const handlePlaySongRef = useRef(null)
  const playRandomSongRef = useRef(null)

  // Keep countriesRef in sync
  useEffect(() => {
    countriesRef.current = countries
  }, [countries])

  // Unlock audio on first user interaction
  useEffect(() => {
    const handleInteraction = () => {
      unlock()
    }

    document.addEventListener('click', handleInteraction, { once: true })
    document.addEventListener('keydown', handleInteraction, { once: true })

    return () => {
      document.removeEventListener('click', handleInteraction)
      document.removeEventListener('keydown', handleInteraction)
    }
  }, [unlock])

  // Define handlePlaySong
  const handlePlaySong = useCallback(async (countryCode, trackName, artistName, isAutoPlay = false, previewUrl = null, playlistContext = null, imageUrl = null) => {
    console.log('[App] handlePlaySong:', countryCode, trackName, artistName, 'isAutoPlay:', isAutoPlay)

    // If user manually plays, disable auto-play
    if (!isAutoPlay) {
      console.log('[App] Manual play - disabling auto-play')
      isAutoPlayModeRef.current = false
    }

    let track = null
    let country = null
    let context = 'trending'

    // Build track from provided URL or find in countries
    if (previewUrl) {
      track = {
        name: trackName,
        artist: artistName,
        preview_url: previewUrl,
        image_url: imageUrl
      }
      country = {
        country_name: playlistContext ? 'AI Playlist' : 'Search',
        country_code: countryCode,
        flag: playlistContext ? '🎵' : '🔍'
      }
      context = playlistContext ? 'playlist' : 'search'
    } else {
      country = countriesRef.current.find(c => c.country_code === countryCode)
      if (!country) {
        console.log('[App] Country not found:', countryCode)
        return
      }

      track = country.tracks.find(t =>
        t.name.toLowerCase().includes(trackName.toLowerCase()) &&
        t.artist.toLowerCase().includes(artistName.toLowerCase())
      )

      if (!track || !track.preview_url) {
        console.log('[App] Track not found or no preview:', trackName)
        return
      }
    }

    // Build full track object with country info
    const fullTrack = {
      ...track,
      country_code: country.country_code,
      country_name: country.country_name,
      flag: country.flag
    }

    console.log('[App] Calling play() with track:', fullTrack.name)

    // Play using singleton
    const success = await play(fullTrack, {
      context,
      playlist: playlistContext?.playlist || null,
      playlistIndex: playlistContext?.index || 0
    })

    console.log('[App] play() returned:', success)

    // Select country on globe (skip for playlists/search)
    if (countryCode !== 'SPOTIFY' && countryCode !== 'PLAYLIST') {
      handleSelectCountry(countryCode)
    }
  }, [play])

  // Define playRandomSong
  const playRandomSong = useCallback(() => {
    const currentCountries = countriesRef.current
    console.log('[App] playRandomSong, countries:', currentCountries.length)

    const countriesWithPreviews = currentCountries.filter(country =>
      country.tracks.some(track => track.preview_url)
    )

    if (countriesWithPreviews.length === 0) {
      console.log('[App] No countries with previews')
      return
    }

    const randomCountry = countriesWithPreviews[Math.floor(Math.random() * countriesWithPreviews.length)]
    const tracksWithPreviews = randomCountry.tracks.filter(track => track.preview_url)

    if (tracksWithPreviews.length === 0) return

    const randomTrack = tracksWithPreviews[Math.floor(Math.random() * tracksWithPreviews.length)]
    console.log('[App] Playing random:', randomTrack.name, 'from', randomCountry.country_name)

    // Use ref to get latest function
    if (handlePlaySongRef.current) {
      handlePlaySongRef.current(randomCountry.country_code, randomTrack.name, randomTrack.artist, true)
    }
  }, [])

  // Keep refs updated with latest functions
  useEffect(() => {
    handlePlaySongRef.current = handlePlaySong
  }, [handlePlaySong])

  useEffect(() => {
    playRandomSongRef.current = playRandomSong
  }, [playRandomSong])

  // Handle track ended - uses refs to avoid stale closures
  useEffect(() => {
    const handleEnded = ({ track, context, playlistInfo: pInfo }) => {
      console.log('[App] Track ended:', track?.name, 'Context:', context)

      // Priority 1: Continue playlist
      if (pInfo && pInfo.playlist) {
        const { playlist, index } = pInfo
        const nextIndex = index + 1

        console.log('[App] Playlist mode - index:', index, 'total:', playlist.tracks.length)

        if (nextIndex < playlist.tracks.length) {
          const nextTrack = playlist.tracks[nextIndex]
          if (nextTrack.preview_url) {
            console.log('[App] Playing next playlist track:', nextTrack.name)
            setTimeout(() => {
              if (handlePlaySongRef.current) {
                handlePlaySongRef.current(
                  'PLAYLIST',
                  nextTrack.name,
                  nextTrack.artist,
                  false,
                  nextTrack.preview_url,
                  { playlist, index: nextIndex },
                  nextTrack.image_url
                )
              }
            }, 1000)
            return
          }
        }
        console.log('[App] Playlist finished')
      }

      // Priority 2: Auto-play random trending song
      if (isAutoPlayModeRef.current && context !== 'playlist') {
        console.log('[App] Auto-playing next random song...')
        setTimeout(() => {
          if (playRandomSongRef.current) {
            playRandomSongRef.current()
          }
        }, 1000)
      }
    }

    onTrackEnded(handleEnded)
  }, [onTrackEnded])

  // Fetch countries on mount
  useEffect(() => {
    fetchCountries()

    const eventSource = new EventSource(`${API_BASE_URL}/stream`)

    eventSource.onopen = () => {
      setIsConnected(true)
      console.log('SSE connected')
    }

    eventSource.addEventListener('update', (event) => {
      try {
        const data = JSON.parse(event.data)
        setCountries(data)
        setIsConnected(true)
      } catch (err) {
        console.error('Error parsing SSE data:', err)
      }
    })

    eventSource.onerror = () => {
      if (countriesRef.current.length === 0) {
        setIsConnected(false)
      }
    }

    return () => eventSource.close()
  }, [])

  // Auto-play on load (when unlocked and no track playing)
  useEffect(() => {
    if (countries.length > 0 && !currentTrack && isUnlocked && isAutoPlayModeRef.current) {
      const timer = setTimeout(() => {
        if (!currentTrack && isAutoPlayModeRef.current && playRandomSongRef.current) {
          console.log('[App] Auto-playing random song on load...')
          playRandomSongRef.current()
        }
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [countries.length, currentTrack, isUnlocked])

  const fetchCountries = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/countries`)
      if (response.ok) {
        const data = await response.json()
        setCountries(data)
        setIsConnected(true)
      } else {
        setError('Failed to fetch countries')
      }
    } catch (err) {
      setError('Failed to connect to backend')
      console.error('Fetch error:', err)
    }
  }

  const handleSelectCountry = (countryCode) => {
    if (globeMapRef.current) {
      globeMapRef.current.selectCountry(countryCode)
    }
  }

  const handlePlayPause = useCallback(() => {
    togglePlayPause()
  }, [togglePlayPause])

  const handleSeek = useCallback((time) => {
    seek(time)
  }, [seek])

  const handleSkip = useCallback((direction) => {
    skip(direction === 'forward' ? 10 : -10)
  }, [skip])

  const handleSearchAndPlay = (searchQuery) => {
    const query = searchQuery.toLowerCase()

    for (const country of countries) {
      const matchingTracks = country.tracks.filter(track =>
        track.name.toLowerCase().includes(query) ||
        track.artist.toLowerCase().includes(query)
      )

      if (matchingTracks.length > 0) {
        setTrackFilter(query)
        handleSelectCountry(country.country_code)

        const firstTrackWithPreview = matchingTracks.find(t => t.preview_url)
        if (firstTrackWithPreview) {
          setTimeout(() => {
            handlePlaySong(country.country_code, firstTrackWithPreview.name, firstTrackWithPreview.artist)
          }, 500)
        }
        break
      }
    }
  }

  const handleAddPlaylist = (playlistName, tracks) => {
    console.log('[App] Adding playlist:', playlistName, 'with', tracks.length, 'tracks')

    const newPlaylist = {
      id: `playlist_${Date.now()}`,
      name: playlistName,
      tracks: tracks,
      created_at: new Date().toISOString()
    }

    setPlaylists(prev => [...prev, newPlaylist])
    setSelectedPlaylist(newPlaylist)

    return newPlaylist
  }

  const handleSelectPlaylist = (playlist) => {
    console.log('[App] Selecting playlist:', playlist?.name || 'null')
    setSelectedPlaylist(playlist)

    // Stop current audio when switching playlists
    stop()
  }

  const handleRemovePlaylist = (playlistId) => {
    console.log('[App] Removing playlist:', playlistId)
    setPlaylists(prev => prev.filter(p => p.id !== playlistId))
    if (selectedPlaylist?.id === playlistId) {
      setSelectedPlaylist(null)
    }
  }

  const handleClearAll = () => {
    console.log('[App] Clearing all playlists')
    setPlaylists([])
    setSelectedPlaylist(null)
    stop()
  }

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <Header
        isConnected={isConnected}
        countriesCount={countries.length}
        error={error}
      />
      <GlobeMap
        ref={globeMapRef}
        countries={countries}
        playlists={playlists}
        selectedPlaylist={selectedPlaylist}
        trackFilter={trackFilter}
        currentTrack={currentTrack}
        onPlaySong={handlePlaySong}
        onSelectPlaylist={handleSelectPlaylist}
        onRemovePlaylist={handleRemovePlaylist}
      />
      <ChatPanel
        countries={countries}
        currentTrack={currentTrack}
        playlists={playlists}
        onSelectCountry={handleSelectCountry}
        onPlaySong={handlePlaySong}
        onSearchAndPlay={handleSearchAndPlay}
        onAddPlaylist={handleAddPlaylist}
        onClearAll={handleClearAll}
      />
      <MusicPlayer
        currentTrack={currentTrack}
        currentAudio={getAudioElement()}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        onSkip={handleSkip}
      />
    </div>
  )
}

export default App
