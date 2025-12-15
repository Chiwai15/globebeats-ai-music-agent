import React, { useEffect, useState, useRef, useImperativeHandle, forwardRef } from 'react'
import Globe from 'react-globe.gl'
import TrackList from './TrackList'

const GlobeMap = forwardRef(({ countries, playlists, selectedPlaylist, trackFilter, currentTrack, onPlaySong, onSelectPlaylist, onRemovePlaylist }, ref) => {
  const globeEl = useRef()
  const [selectedCountry, setSelectedCountry] = useState(null)
  const [isInteracting, setIsInteracting] = useState(false)
  const [showCountryList, setShowCountryList] = useState(true)
  const [showPlaylistsSection, setShowPlaylistsSection] = useState(true)
  const [countrySearchTerm, setCountrySearchTerm] = useState('')
  const [playlistSearchTerm, setPlaylistSearchTerm] = useState('')
  const [trackSearchTerm, setTrackSearchTerm] = useState('')
  const [isMobile, setIsMobile] = useState(window.innerWidth < 900)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showMobileTrackList, setShowMobileTrackList] = useState(false)
  const [mobileMenuTab, setMobileMenuTab] = useState('countries') // 'countries' or 'playlists'
  const interactionTimeout = useRef(null)
  const selectedCountryRef = useRef(null)
  const selectedPlaylistRef = useRef(null)

  // Handle window resize for mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 900)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (globeEl.current) {
      // Auto-rotate when not interacting
      const controls = globeEl.current.controls()
      controls.autoRotate = !isInteracting
      controls.autoRotateSpeed = 0.5
      controls.enableZoom = true
      controls.minDistance = 180
      controls.maxDistance = 600

      // Initial smooth camera
      if (!selectedCountry) {
        globeEl.current.pointOfView({ altitude: 2.5 }, 0)
      }
    }
  }, [isInteracting])

  // Expose selectCountry method to parent via ref
  useImperativeHandle(ref, () => ({
    selectCountry: (countryCode) => {
      const country = countries.find(c => c.country_code === countryCode)
      if (country && globeEl.current) {
        setSelectedCountry(country)
        setIsInteracting(true)
        globeEl.current.pointOfView({
          lat: country.latitude,
          lng: country.longitude,
          altitude: 1.5
        }, 1200)
      }
    }
  }), [countries])

  // Select random country by default when countries load
  useEffect(() => {
    if (countries.length > 0 && !selectedCountry) {
      // Get countries with tracks
      const countriesWithTracks = countries.filter(c => c.tracks.length > 0)

      if (countriesWithTracks.length > 0) {
        // Pick random country
        const randomCountry = countriesWithTracks[Math.floor(Math.random() * countriesWithTracks.length)]

        if (randomCountry && globeEl.current) {
          setSelectedCountry(randomCountry)
          setIsInteracting(true)
          globeEl.current.pointOfView({
            lat: randomCountry.latitude,
            lng: randomCountry.longitude,
            altitude: 1.5
          }, 1200)
        }
      }
    }
  }, [countries])

  // Pause rotation when user interacts
  useEffect(() => {
    const handleUserInteraction = () => {
      setIsInteracting(true)

      // Clear previous timeout
      if (interactionTimeout.current) {
        clearTimeout(interactionTimeout.current)
      }

      // Resume after 3 seconds of no interaction
      interactionTimeout.current = setTimeout(() => {
        setIsInteracting(false)
      }, 3000)
    }

    window.addEventListener('mousemove', handleUserInteraction)
    window.addEventListener('mousedown', handleUserInteraction)
    window.addEventListener('wheel', handleUserInteraction)

    return () => {
      window.removeEventListener('mousemove', handleUserInteraction)
      window.removeEventListener('mousedown', handleUserInteraction)
      window.removeEventListener('wheel', handleUserInteraction)
      if (interactionTimeout.current) {
        clearTimeout(interactionTimeout.current)
      }
    }
  }, [])

  // Get color from vibrant rainbow spectrum
  const getRainbowColor = (index) => {
    // Evenly distributed rainbow spectrum - 8 colors
    const rainbowColors = [
      '#FF3B30', // Vibrant Red
      '#FF9500', // Vibrant Orange
      '#FFCC00', // Vibrant Yellow
      '#34C759', // Vibrant Green
      '#5AC8FA', // Vibrant Teal/Cyan
      '#007AFF', // Vibrant Blue
      '#5856D6', // Vibrant Indigo
      '#AF52DE', // Vibrant Purple/Magenta
    ]

    return rainbowColors[index % rainbowColors.length]
  }

  // Transform countries to fancy pin points
  const points = countries.map((country, index) => ({
    lat: country.latitude,
    lng: country.longitude,
    size: country.tracks.length > 0 ? 1.2 : 0.6,
    color: country.tracks.length > 0 ? getRainbowColor(index) : '#64748b',
    altitude: 0,
    country: country
  }))

  const handlePointClick = (point) => {
    setSelectedCountry(point.country)
    setIsInteracting(true)

    // Zoom to country
    if (globeEl.current) {
      globeEl.current.pointOfView({
        lat: point.lat,
        lng: point.lng,
        altitude: 1.5
      }, 1200)
    }
  }

  const handleGlobeClick = () => {
    // Click on globe (not a point) - close panel
    if (selectedCountry) {
      setSelectedCountry(null)
      if (globeEl.current) {
        globeEl.current.pointOfView({ altitude: 2.5 }, 1200)
      }
    }
  }

  const handleZoomIn = () => {
    if (globeEl.current) {
      const pov = globeEl.current.pointOfView()
      globeEl.current.pointOfView({ altitude: Math.max(pov.altitude - 0.5, 1.0) }, 500)
    }
  }

  const handleZoomOut = () => {
    if (globeEl.current) {
      const pov = globeEl.current.pointOfView()
      globeEl.current.pointOfView({ altitude: Math.min(pov.altitude + 0.5, 3.5) }, 500)
    }
  }

  const handleResetView = () => {
    if (globeEl.current) {
      globeEl.current.pointOfView({ altitude: 2.5 }, 1200)
      setSelectedCountry(null)
    }
  }

  const handleCountrySelect = (country) => {
    setSelectedCountry(country)
    setIsInteracting(true)
    // Clear playlist selection when selecting a country
    if (onSelectPlaylist) {
      onSelectPlaylist(null)
    }

    if (globeEl.current) {
      globeEl.current.pointOfView({
        lat: country.latitude,
        lng: country.longitude,
        altitude: 1.5
      }, 1200)
    }
  }

  const handlePlaylistSelect = (playlist) => {
    // Clear country selection when selecting a playlist
    setSelectedCountry(null)
    if (onSelectPlaylist) {
      onSelectPlaylist(playlist)
    }
    // Reset globe view
    if (globeEl.current) {
      globeEl.current.pointOfView({ altitude: 2.5 }, 1200)
    }
  }

  // Scroll to selected country in the list
  useEffect(() => {
    if (selectedCountry && selectedCountryRef.current) {
      selectedCountryRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
    }
  }, [selectedCountry])

  // Filter and sort countries by name
  const filteredCountries = countries.filter(country =>
    country.country_name.toLowerCase().includes(countrySearchTerm.toLowerCase())
  )
  const sortedCountries = [...filteredCountries].sort((a, b) =>
    a.country_name.localeCompare(b.country_name)
  )

  // Filter playlists by search term
  const filteredPlaylists = playlists?.filter(playlist =>
    playlist.name.toLowerCase().includes(playlistSearchTerm.toLowerCase())
  ) || []

  return (
    <div className="relative w-full h-full bg-black">
      <Globe
        ref={globeEl}
        globeImageUrl="https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg"
        bumpImageUrl="https://unpkg.com/three-globe@2.31.1/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"

        pointsData={points}
        pointAltitude="altitude"
        pointRadius="size"
        pointColor="color"
        pointResolution={12}
        pointsMerge={false}
        onPointClick={handlePointClick}

        htmlElementsData={points}
        htmlElement={d => {
          const el = document.createElement('div')
          const markerClass = d.country.country_code === 'CH' ? 'flag-marker flag-marker-ch' : 'flag-marker'
          el.innerHTML = `<div class="${markerClass}">${d.country.flag}</div>`
          el.style.pointerEvents = 'auto'
          el.style.cursor = 'pointer'
          el.addEventListener('mouseenter', () => {
            el.style.transform = 'scale(1.3)'
          })
          el.addEventListener('mouseleave', () => {
            el.style.transform = 'scale(1)'
          })
          el.addEventListener('click', () => handlePointClick(d))
          return el
        }}
        htmlTransitionDuration={0}

        onGlobeClick={handleGlobeClick}

        ringsData={points.filter(p => p.country.tracks.length > 0)}
        ringColor={d => d.color}
        ringMaxRadius={1.5}
        ringPropagationSpeed={0.35}
        ringRepeatPeriod={2000}

        atmosphereColor="#38bdf8"
        atmosphereAltitude={0.20}

        width={window.innerWidth}
        height={window.innerHeight}

        enablePointerInteraction={true}
      />

      {/* Mobile Hamburger Menu Button */}
      {isMobile && (
        <button
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          className="absolute top-3 left-3 z-50 p-3 bg-slate-900/90 backdrop-blur-md rounded-lg border border-slate-700/50 shadow-xl hover:bg-slate-800/90 transition-all"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {showMobileMenu ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      )}

      {/* Mobile Slide-out Menu */}
      {isMobile && showMobileMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
            onClick={() => setShowMobileMenu(false)}
          />

          {/* Drawer */}
          <div className="fixed top-0 left-0 bottom-0 w-[85vw] max-w-sm bg-white/95 backdrop-blur-xl z-50 shadow-2xl flex flex-col animate-slide-in">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white/80">
              <h2 className="text-lg font-bold text-gray-900">GlobeBeats</h2>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 bg-white/60">
              <button
                onClick={() => setMobileMenuTab('countries')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-all ${
                  mobileMenuTab === 'countries'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Trending ({filteredCountries.length})
              </button>
              <button
                onClick={() => setMobileMenuTab('playlists')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-all ${
                  mobileMenuTab === 'playlists'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Playlists ({filteredPlaylists.length})
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {mobileMenuTab === 'countries' ? (
                <>
                  {/* Country Search */}
                  <div className="px-4 py-3 bg-white/40 border-b border-gray-200">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search countries..."
                        value={countrySearchTerm}
                        onChange={(e) => setCountrySearchTerm(e.target.value)}
                        className="w-full px-3 py-2 pl-9 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                      />
                      <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      {countrySearchTerm && (
                        <button
                          onClick={() => setCountrySearchTerm('')}
                          className="absolute right-2 top-2 p-1 text-gray-400 hover:text-gray-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Country List */}
                  <div className="flex-1 overflow-y-auto">
                    {sortedCountries.map((country, index) => {
                      const isSelected = selectedCountry?.country_code === country.country_code
                      return (
                        <button
                          key={index}
                          onClick={() => {
                            handleCountrySelect(country)
                            setShowMobileMenu(false)
                            setShowMobileTrackList(true)
                          }}
                          className={`w-full px-4 py-3 text-left hover:bg-blue-50 transition-all border-b border-gray-100 ${
                            isSelected ? 'bg-blue-100' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className={`text-2xl flex-shrink-0 ${country.country_code === 'CH' ? 'flag-ch' : ''}`}>{country.flag}</span>
                              <span className="text-sm text-gray-900 font-medium truncate">{country.country_name}</span>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded flex-shrink-0 ${
                              country.tracks.length > 0
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-300 text-gray-700'
                            }`}>
                              {country.tracks.length}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : (
                <>
                  {/* Playlist Search */}
                  <div className="px-4 py-3 bg-white/40 border-b border-gray-200">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search playlists..."
                        value={playlistSearchTerm}
                        onChange={(e) => setPlaylistSearchTerm(e.target.value)}
                        className="w-full px-3 py-2 pl-9 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                      />
                      <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      {playlistSearchTerm && (
                        <button
                          onClick={() => setPlaylistSearchTerm('')}
                          className="absolute right-2 top-2 p-1 text-gray-400 hover:text-gray-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Playlist List */}
                  <div className="flex-1 overflow-y-auto">
                    {filteredPlaylists.length > 0 ? (
                      filteredPlaylists.map((playlist) => {
                        const isSelected = selectedPlaylist?.id === playlist.id
                        return (
                          <div key={playlist.id} className="group relative">
                            <button
                              onClick={() => {
                                handlePlaylistSelect(playlist)
                                setShowMobileMenu(false)
                                setShowMobileTrackList(true)
                              }}
                              className={`w-full px-4 py-3 text-left hover:bg-blue-50 transition-all border-b border-gray-100 ${
                                isSelected ? 'bg-blue-200 ring-2 ring-blue-400' : ''
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="text-2xl flex-shrink-0">🎵</span>
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm text-gray-900 font-medium truncate">{playlist.name}</div>
                                  <div className="text-xs text-blue-600">{playlist.tracks.length} tracks</div>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onRemovePlaylist && onRemovePlaylist(playlist.id)
                                  }}
                                  className="p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-100 rounded flex-shrink-0"
                                  title="Remove playlist"
                                >
                                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </button>
                          </div>
                        )
                      })
                    ) : (
                      <div className="px-4 py-8 text-center text-gray-500">
                        <p className="text-sm">No playlists yet</p>
                        <p className="text-xs mt-1">Use the chat to create playlists</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Mobile Track List - Bottom Sheet */}
      {isMobile && showMobileTrackList && (selectedCountry || selectedPlaylist) && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
            onClick={() => setShowMobileTrackList(false)}
          />

          {/* Bottom Sheet */}
          <div className="fixed bottom-0 left-0 right-0 max-h-[85vh] bg-white/95 backdrop-blur-xl z-50 rounded-t-2xl shadow-2xl flex flex-col animate-slide-up">
            {/* Handle Bar */}
            <div className="flex justify-center py-2 border-b border-gray-200">
              <div className="w-12 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-3 border-b ${
              selectedPlaylist ? 'border-blue-200 bg-blue-50/80' : 'border-gray-200 bg-white/80'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`text-2xl ${selectedCountry?.country_code === 'CH' ? 'flag-ch' : ''}`}>
                  {selectedCountry ? selectedCountry.flag : '🎵'}
                </span>
                <div className="flex flex-col">
                  <h3 className={`text-base font-semibold ${selectedPlaylist ? 'text-blue-900' : 'text-gray-900'}`}>
                    {selectedCountry ? selectedCountry.country_name : selectedPlaylist?.name}
                  </h3>
                  {selectedPlaylist && (
                    <span className="text-[10px] text-blue-600/70 font-medium">AI Curated Playlist</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setShowMobileTrackList(false)
                  if (selectedCountry) {
                    setSelectedCountry(null)
                  } else if (selectedPlaylist && onSelectPlaylist) {
                    onSelectPlaylist(null)
                  }
                  if (globeEl.current) {
                    globeEl.current.pointOfView({ altitude: 2.5 }, 1200)
                  }
                }}
                className={`p-2 rounded-lg transition-colors ${
                  selectedPlaylist ? 'hover:bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Track List */}
            <div className="flex-1 overflow-hidden">
              <TrackList
                country={selectedCountry}
                playlist={selectedPlaylist}
                trackFilter={trackFilter}
                currentTrack={currentTrack}
                onPlaySong={onPlaySong}
              />
            </div>
          </div>
        </>
      )}

      {/* Bottom Control Panel */}
      <div className={`absolute bottom-3 ${isMobile ? 'left-1/2 -translate-x-1/2' : 'left-3'} flex space-x-2 z-20`}>
        <div className="bg-slate-900/80 backdrop-blur-md rounded-md border border-slate-700/50 shadow-xl overflow-hidden flex">
          <button
            onClick={handleZoomIn}
            className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800/50 transition-all border-r border-slate-700/50"
            title="Zoom In"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={handleZoomOut}
            className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800/50 transition-all border-r border-slate-700/50"
            title="Zoom Out"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            onClick={handleResetView}
            className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800/50 transition-all"
            title="Reset View"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        <div className="bg-slate-900/80 backdrop-blur-md rounded-md border border-slate-700/50 shadow-xl overflow-hidden">
          <button
            onClick={() => setShowCountryList(!showCountryList)}
            className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800/50 transition-all"
            title="Toggle Country List"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Country List Panel - Desktop Only */}
      {!isMobile && showCountryList && (
        <div className="absolute top-[8%] left-3 w-72 max-h-[42vh] bg-white/70 backdrop-blur-2xl backdrop-saturate-150 rounded-xl border border-white/30 shadow-2xl overflow-hidden flex flex-col z-20">
          <div className="px-3 py-2 border-b border-white/40 bg-white/40">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-semibold text-gray-900">🔥 Trending by Country ({filteredCountries.length})</h3>
              <button
                onClick={() => setShowCountryList(false)}
                className="text-gray-500 hover:text-gray-900 transition-colors p-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search countries..."
                value={countrySearchTerm}
                onChange={(e) => setCountrySearchTerm(e.target.value)}
                className="w-full px-3 py-1.5 pl-8 text-sm bg-white/60 border border-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white/80 transition-all"
              />
              <svg className="absolute left-2.5 top-2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {countrySearchTerm && (
                <button
                  onClick={() => setCountrySearchTerm('')}
                  className="absolute right-2 top-1.5 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="overflow-y-auto max-h-[calc(42vh-48px)]">
            {sortedCountries.map((country, index) => {
              const isSelected = selectedCountry?.country_code === country.country_code
              return (
                <button
                  key={index}
                  ref={isSelected ? selectedCountryRef : null}
                  onClick={() => handleCountrySelect(country)}
                  className={`w-full px-3 py-2 text-left hover:bg-white/70 transition-all border-b border-white/30 ${
                    isSelected ? 'bg-white/80' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-xl flex-shrink-0 ${country.country_code === 'CH' ? 'flag-ch' : ''}`}>{country.flag}</span>
                      <span className="text-sm text-gray-900 font-medium truncate">{country.country_name}</span>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                      country.tracks.length > 0
                        ? 'bg-blue-500/90 text-white'
                        : 'bg-gray-300/70 text-gray-700'
                    }`}>
                      {country.tracks.length}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Playlists Section - Desktop Only */}
      {!isMobile && showPlaylistsSection && playlists && playlists.length > 0 && (
        <div className="absolute top-[calc(8%+42vh+0.75rem)] left-3 w-72 max-h-[calc(92vh-8%-42vh-0.75rem-4rem)] bg-blue-50/80 backdrop-blur-2xl backdrop-saturate-150 rounded-xl border border-blue-200/40 shadow-2xl overflow-hidden flex flex-col z-20">
          <div className="px-3 py-2 border-b border-blue-200/50 bg-blue-100/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                  </svg>
                  <h3 className="text-base font-semibold text-blue-900">Playlists ({filteredPlaylists.length})</h3>
                </div>
                <span className="text-[10px] text-blue-600/70 font-medium ml-6">AI Curated Collections</span>
              </div>
              <button
                onClick={() => setShowPlaylistsSection(false)}
                className="text-blue-500 hover:text-blue-900 transition-colors p-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search playlists..."
                value={playlistSearchTerm}
                onChange={(e) => setPlaylistSearchTerm(e.target.value)}
                className="w-full px-3 py-1.5 pl-8 text-sm bg-white/60 border border-blue-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white/80 transition-all"
              />
              <svg className="absolute left-2.5 top-2 w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {playlistSearchTerm && (
                <button
                  onClick={() => setPlaylistSearchTerm('')}
                  className="absolute right-2 top-1.5 text-blue-400 hover:text-blue-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="overflow-y-auto max-h-[calc(42vh-48px)]">
            {filteredPlaylists.map((playlist, index) => {
              const isSelected = selectedPlaylist?.id === playlist.id
              return (
                <div
                  key={playlist.id}
                  ref={isSelected ? selectedPlaylistRef : null}
                  className="group relative"
                >
                  <button
                    onClick={() => handlePlaylistSelect(playlist)}
                    className={`w-full px-3 py-2 text-left hover:bg-blue-100/80 transition-all border-b border-blue-200/30 ${
                      isSelected ? 'bg-blue-300/70 ring-2 ring-blue-500/50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg flex-shrink-0">🎵</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-blue-900 font-medium truncate">{playlist.name}</div>
                        <div className="text-xs text-blue-600">{playlist.tracks.length} tracks</div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onRemovePlaylist && onRemovePlaylist(playlist.id)
                        }}
                        className="p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-100 rounded flex-shrink-0"
                        title="Remove playlist"
                      >
                        <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}


      {/* Track List Panel for Country - Desktop Only */}
      {!isMobile && selectedCountry && !selectedPlaylist && (
        <div className="absolute top-[8%] right-3 w-80 max-h-[calc(84vh-100px)] bg-white/70 backdrop-blur-2xl backdrop-saturate-150 rounded-xl border border-white/30 shadow-2xl overflow-hidden flex flex-col z-20">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/40 bg-white/40">
            <div className="flex items-center gap-2">
              <span className={`text-xl ${selectedCountry.country_code === 'CH' ? 'flag-ch' : ''}`}>{selectedCountry.flag}</span>
              <h3 className="text-base font-semibold text-gray-900">
                {selectedCountry.country_name}
              </h3>
            </div>
            <button
              onClick={() => {
                setSelectedCountry(null)
                if (globeEl.current) {
                  globeEl.current.pointOfView({ altitude: 2.5 }, 1200)
                }
              }}
              className="text-gray-500 hover:text-gray-900 transition-colors p-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <TrackList
              country={selectedCountry}
              trackFilter={trackFilter}
              currentTrack={currentTrack}
              onPlaySong={onPlaySong}
            />
          </div>
        </div>
      )}

      {/* Track List Panel for Playlist - Desktop Only */}
      {!isMobile && selectedPlaylist && (
        <div className="absolute top-[8%] right-3 w-80 max-h-[calc(84vh-100px)] bg-blue-50/80 backdrop-blur-2xl backdrop-saturate-150 rounded-xl border border-blue-200/40 shadow-2xl overflow-hidden flex flex-col z-20">
          <div className="flex items-center justify-between px-3 py-2 border-b border-blue-200/50 bg-blue-100/50">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎵</span>
                <h3 className="text-base font-semibold text-blue-900">
                  {selectedPlaylist.name}
                </h3>
              </div>
              <span className="text-[10px] text-blue-600/70 font-medium ml-7">AI Curated Playlist</span>
            </div>
            <button
              onClick={() => {
                onSelectPlaylist && onSelectPlaylist(null)
              }}
              className="text-blue-500 hover:text-blue-900 transition-colors p-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <TrackList
              playlist={selectedPlaylist}
              trackFilter={trackFilter}
              currentTrack={currentTrack}
              onPlaySong={onPlaySong}
            />
          </div>
        </div>
      )}
    </div>
  )
})

GlobeMap.displayName = 'GlobeMap'

export default GlobeMap
