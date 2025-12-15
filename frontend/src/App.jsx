import { useState, useEffect, useRef } from 'react'
import GlobeMap from './components/GlobeMap'
import Header from './components/Header'
import ChatPanel from './components/ChatPanel'
import MusicPlayer from './components/MusicPlayer'
import './App.css'

function App() {
  const [countries, setCountries] = useState([])
  const [playlists, setPlaylists] = useState([]) // Custom playlists from AI requests
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState(null)
  const [currentAudio, setCurrentAudio] = useState(null)
  const [currentTrack, setCurrentTrack] = useState(null)
  const [trackFilter, setTrackFilter] = useState(null)
  const [isAutoPlayMode, setIsAutoPlayMode] = useState(true) // Track if we're in auto-play mode
  const [selectedPlaylist, setSelectedPlaylist] = useState(null) // Currently selected playlist
  const [currentPlayingPlaylist, setCurrentPlayingPlaylist] = useState(null) // Playlist currently being played
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(0) // Current song index in playlist
  const globeMapRef = useRef(null)
  const isAutoPlayModeRef = useRef(true) // Ref for checking auto-play in event listeners
  const currentPlayingPlaylistRef = useRef(null) // Ref for playlist in event listeners
  const currentPlaylistIndexRef = useRef(0) // Ref for playlist index in event listeners
  const audioUnlockedRef = useRef(false) // Track if audio has been unlocked

  // Unlock audio on first user interaction
  useEffect(() => {
    const unlockAudio = async () => {
      if (audioUnlockedRef.current) return

      try {
        const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA')
        await silentAudio.play()
        audioUnlockedRef.current = true
        console.log('✅ Audio context unlocked on user interaction')

        // Remove listener after unlock
        document.removeEventListener('click', unlockAudio)
        document.removeEventListener('keydown', unlockAudio)
      } catch (err) {
        console.log('⚠️ Audio unlock attempt (will retry on next interaction)')
      }
    }

    document.addEventListener('click', unlockAudio)
    document.addEventListener('keydown', unlockAudio)

    return () => {
      document.removeEventListener('click', unlockAudio)
      document.removeEventListener('keydown', unlockAudio)
    }
  }, [])

  useEffect(() => {
    // Fetch initial data
    fetchCountries()

    // Connect to SSE for real-time updates
    const eventSource = new EventSource('http://localhost:8001/stream')

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

    eventSource.onerror = (err) => {
      console.error('SSE error:', err)
      // Don't disconnect if we already have data
      if (countries.length === 0) {
        setIsConnected(false)
      }
    }

    return () => {
      eventSource.close()
    }
  }, [])

  // Auto-play random song on page load (after audio is unlocked)
  useEffect(() => {
    if (countries.length > 0 && !currentTrack && audioUnlockedRef.current) {
      // Wait a bit for everything to load
      const timer = setTimeout(() => {
        console.log('Auto-playing random song...')
        playRandomSong()
      }, 500)

      return () => clearTimeout(timer)
    }
  }, [countries, currentTrack])

  const fetchCountries = async () => {
    try {
      const response = await fetch('http://localhost:8001/countries')
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

  const handlePlaySong = (countryCode, trackName, artistName, isAutoPlay = false, previewUrl = null, playlistContext = null, imageUrl = null) => {
    console.log('handlePlaySong called:', countryCode, trackName, artistName, 'isAutoPlay:', isAutoPlay, 'previewUrl:', previewUrl, 'playlistContext:', playlistContext, 'imageUrl:', imageUrl)

    // SAFETY: If user manually plays any song, KILL auto-play forever
    if (!isAutoPlay) {
      console.log('🛑 MANUAL PLAY DETECTED - Disabling auto-play permanently for this session')
      setIsAutoPlayMode(false)
      isAutoPlayModeRef.current = false
    }

    // Track playlist playback context
    if (playlistContext) {
      console.log('📀 Playing from playlist:', playlistContext.playlist.name, 'Track index:', playlistContext.index)
      setCurrentPlayingPlaylist(playlistContext.playlist)
      setCurrentPlaylistIndex(playlistContext.index)
      currentPlayingPlaylistRef.current = playlistContext.playlist
      currentPlaylistIndexRef.current = playlistContext.index
    } else {
      // Not playing from playlist - clear playlist context
      setCurrentPlayingPlaylist(null)
      setCurrentPlaylistIndex(0)
      currentPlayingPlaylistRef.current = null
      currentPlaylistIndexRef.current = 0
    }

    let track = null
    let country = null

    // If previewUrl is provided (iTunes/Spotify search), use it directly
    if (previewUrl) {
      console.log('Using provided preview URL (iTunes/Spotify):', previewUrl)
      track = {
        name: trackName,
        artist: artistName,
        preview_url: previewUrl,
        image_url: imageUrl // Include album art if provided
      }
      // Create a virtual country for playlist tracks
      country = {
        country_name: 'AI Playlist',
        country_code: 'PLAYLIST',
        flag: '🎵'
      }
    } else {
      // Original logic: find track in country's trending charts
      country = countries.find(c => c.country_code === countryCode)
      if (!country) {
        console.log('Country not found:', countryCode)
        return
      }

      track = country.tracks.find(t =>
        t.name.toLowerCase().includes(trackName.toLowerCase()) &&
        t.artist.toLowerCase().includes(artistName.toLowerCase())
      )

      if (!track || !track.preview_url) {
        console.log('Track not found or no preview available:', trackName, artistName)
        return
      }
    }

    console.log('Playing track:', track.name, 'Preview URL:', track.preview_url)

    // Stop current audio if playing and remove its event listeners
    if (currentAudio) {
      currentAudio.pause()
      currentAudio.src = '' // Clear source to stop loading
      // Event listeners will be garbage collected
    }

    // Create and play new audio
    const audio = new Audio(track.preview_url)

    // Set state first
    setCurrentAudio(audio)
    setCurrentTrack({
      ...track,
      country_code: country.country_code,
      country_name: country.country_name,
      flag: country.flag
    })

    console.log('Attempting to play audio... Auto-play mode:', isAutoPlay)

    // Then play - this ensures state is set before playback starts
    audio.play()
      .then(() => {
        console.log('✅ Audio playback started successfully')
      })
      .catch(err => {
        console.error('❌ Error playing audio:', err)
        console.error('⚠️ Browser autoplay policy blocked audio. Click the play button to start.')
      })

    // Audio ended handler - check for playlist continuation or random auto-play
    audio.addEventListener('ended', () => {
      console.log('Audio ended.')
      setCurrentAudio(null)
      setCurrentTrack(null)

      // Priority 1: Check if we're playing from a playlist
      if (currentPlayingPlaylistRef.current) {
        const playlist = currentPlayingPlaylistRef.current
        const currentIndex = currentPlaylistIndexRef.current
        const nextIndex = currentIndex + 1

        console.log('📀 Playlist mode - Current index:', currentIndex, 'Total tracks:', playlist.tracks.length)

        if (nextIndex < playlist.tracks.length) {
          const nextTrack = playlist.tracks[nextIndex]
          if (nextTrack.preview_url) {
            console.log('📀 Playing next track from playlist:', nextTrack.name)
            setTimeout(() => {
              // Play next track with playlist context
              handlePlaySong(
                'PLAYLIST',
                nextTrack.name,
                nextTrack.artist,
                false, // Not random auto-play
                nextTrack.preview_url,
                { playlist, index: nextIndex }, // Continue playlist context
                nextTrack.image_url // Pass album art for music player display
              )
            }, 1000)
          } else {
            console.log('📀 Next track has no preview, skipping to next...')
            // Skip to next track
            currentPlaylistIndexRef.current = nextIndex
            setTimeout(() => {
              const skipEvent = new Event('ended')
              audio.dispatchEvent(skipEvent)
            }, 100)
          }
        } else {
          console.log('📀 Playlist finished - stopping playback')
          // Playlist complete - clear context
          setCurrentPlayingPlaylist(null)
          setCurrentPlaylistIndex(0)
          currentPlayingPlaylistRef.current = null
          currentPlaylistIndexRef.current = 0
        }
      }
      // Priority 2: Check if random auto-play is enabled (trending songs)
      else if (isAutoPlayModeRef.current) {
        console.log('🔀 Auto-playing next random trending song...')
        setTimeout(() => {
          playRandomSong()
        }, 1000)
      } else {
        console.log('⏹️ Playback stopped - no auto-play')
      }
    })

    // Also select the country on the globe (skip for Spotify)
    if (countryCode !== 'SPOTIFY') {
      handleSelectCountry(countryCode)
    }
  }

  const handlePlayPause = () => {
    if (!currentAudio) return

    if (currentAudio.paused) {
      currentAudio.play()
        .then(() => {
          console.log('✅ Playback resumed successfully')
        })
        .catch(err => {
          console.error('❌ Error resuming playback:', err)
        })
    } else {
      currentAudio.pause()
    }
  }

  const handleSeek = (time) => {
    if (!currentAudio) return
    currentAudio.currentTime = time
  }

  const handleSkip = (direction) => {
    if (!currentAudio) return
    const newTime = direction === 'forward'
      ? Math.min(currentAudio.currentTime + 10, currentAudio.duration)
      : Math.max(currentAudio.currentTime - 10, 0)
    currentAudio.currentTime = newTime
  }

  const handleSearchAndPlay = (searchQuery) => {
    const query = searchQuery.toLowerCase()

    // Find all countries with matching tracks
    for (const country of countries) {
      const matchingTracks = country.tracks.filter(track =>
        track.name.toLowerCase().includes(query) ||
        track.artist.toLowerCase().includes(query)
      )

      if (matchingTracks.length > 0) {
        // Found first country with matching songs
        // Set the filter
        setTrackFilter(query)

        // Select the country
        handleSelectCountry(country.country_code)

        // Play the first matching song with preview URL
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

  const playRandomSong = () => {
    console.log('playRandomSong called, countries:', countries.length)

    // Get countries with tracks that have preview URLs
    const countriesWithPreviews = countries.filter(country =>
      country.tracks.some(track => track.preview_url)
    )

    console.log('Countries with previews:', countriesWithPreviews.length)

    if (countriesWithPreviews.length === 0) {
      console.log('No countries with preview URLs found')
      return
    }

    // Pick random country
    const randomCountry = countriesWithPreviews[Math.floor(Math.random() * countriesWithPreviews.length)]

    // Get tracks with preview URLs from that country
    const tracksWithPreviews = randomCountry.tracks.filter(track => track.preview_url)

    console.log('Tracks with previews:', tracksWithPreviews.length)

    if (tracksWithPreviews.length === 0) {
      console.log('No tracks with preview URLs in selected country')
      return
    }

    // Pick random track
    const randomTrack = tracksWithPreviews[Math.floor(Math.random() * tracksWithPreviews.length)]

    console.log('Playing random track:', randomTrack.name, 'from', randomCountry.country_name)

    // Play it in auto-play mode
    handlePlaySong(randomCountry.country_code, randomTrack.name, randomTrack.artist, true)
  }

  const handleAddPlaylist = (playlistName, tracks) => {
    console.log('Adding playlist:', playlistName, 'with', tracks.length, 'tracks')

    const newPlaylist = {
      id: `playlist_${Date.now()}`,
      name: playlistName,
      tracks: tracks,
      created_at: new Date().toISOString()
    }

    setPlaylists(prev => [...prev, newPlaylist])
    setSelectedPlaylist(newPlaylist)

    // Don't auto-play here - ChatPanel.jsx handles auto-play to avoid duplicate playback

    return newPlaylist
  }

  const handleSelectPlaylist = (playlist) => {
    console.log('Selecting playlist:', playlist.name)
    setSelectedPlaylist(playlist)
    // Clear any selected country when viewing a playlist
    if (globeMapRef.current) {
      // Don't call selectCountry, just let the playlist panel show
    }
  }

  const handleRemovePlaylist = (playlistId) => {
    console.log('Removing playlist:', playlistId)
    setPlaylists(prev => prev.filter(p => p.id !== playlistId))
    if (selectedPlaylist && selectedPlaylist.id === playlistId) {
      setSelectedPlaylist(null)
    }
  }

  const handleClearAll = () => {
    console.log('Clearing all playlists for demo')
    setPlaylists([])
    setSelectedPlaylist(null)
    setCurrentPlayingPlaylist(null)
    setCurrentPlaylistIndex(0)
    currentPlayingPlaylistRef.current = null
    currentPlaylistIndexRef.current = 0
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
        currentAudio={currentAudio}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        onSkip={handleSkip}
      />
    </div>
  )
}

export default App
