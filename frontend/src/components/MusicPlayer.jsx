import React, { useState, useEffect, useRef } from 'react'
import FrequencyVisualizer from './FrequencyVisualizer'

const MusicPlayer = ({ currentTrack, currentAudio, onPlayPause, onSeek, onSkip }) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [shouldScrollTitle, setShouldScrollTitle] = useState(false)
  const [shouldScrollArtist, setShouldScrollArtist] = useState(false)
  const containerRef = useRef(null)

  // Check if text needs scrolling
  useEffect(() => {
    const checkOverflow = () => {
      if (currentTrack && containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth - 20 // Account for padding

        // Create temporary elements to measure text width
        const titleMeasure = document.createElement('span')
        titleMeasure.style.visibility = 'hidden'
        titleMeasure.style.position = 'absolute'
        titleMeasure.style.fontSize = '12px'
        titleMeasure.style.fontWeight = '500'
        titleMeasure.textContent = currentTrack.name
        document.body.appendChild(titleMeasure)
        const titleWidth = titleMeasure.offsetWidth
        document.body.removeChild(titleMeasure)

        const artistMeasure = document.createElement('span')
        artistMeasure.style.visibility = 'hidden'
        artistMeasure.style.position = 'absolute'
        artistMeasure.style.fontSize = '10px'
        artistMeasure.textContent = currentTrack.artist
        document.body.appendChild(artistMeasure)
        const artistWidth = artistMeasure.offsetWidth
        document.body.removeChild(artistMeasure)

        setShouldScrollTitle(titleWidth > containerWidth)
        setShouldScrollArtist(artistWidth > containerWidth)
      }
    }

    checkOverflow()
    // Recheck on window resize
    window.addEventListener('resize', checkOverflow)
    return () => window.removeEventListener('resize', checkOverflow)
  }, [currentTrack])

  useEffect(() => {
    if (!currentAudio) {
      setIsPlaying(false)
      setCurrentTime(0)
      setDuration(0)
      return
    }

    const audio = currentAudio

    // Set initial playing state based on audio's current state
    setIsPlaying(!audio.paused)

    const updateTime = () => {
      if (!isDragging) {
        setCurrentTime(audio.currentTime)
      }
    }

    const updateDuration = () => {
      setDuration(audio.duration)
    }

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => setIsPlaying(false)
    const handlePlaying = () => setIsPlaying(true)

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('playing', handlePlaying)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('playing', handlePlaying)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [currentAudio, isDragging])

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handlePlayPauseClick = () => {
    if (onPlayPause) {
      onPlayPause()
    }
  }

  const handleProgressClick = (e) => {
    if (!currentAudio || !duration) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    const newTime = percentage * duration

    if (onSeek) {
      onSeek(newTime)
    }
    setCurrentTime(newTime)
  }

  const handleSkipForward = () => {
    if (!currentAudio) return
    const newTime = Math.min(currentTime + 10, duration)
    if (onSeek) {
      onSeek(newTime)
    }
  }

  const handleSkipBackward = () => {
    if (!currentAudio) return
    const newTime = Math.max(currentTime - 10, 0)
    if (onSeek) {
      onSeek(newTime)
    }
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[1500] w-full max-w-[525px] px-3">
      <div className="bg-white/70 backdrop-blur-2xl backdrop-saturate-150 rounded-full shadow-2xl border border-white/30 px-4 py-2 flex items-center gap-3 w-full relative">
        {/* Frequency Visualizer */}
        <FrequencyVisualizer currentAudio={currentAudio} isPlaying={isPlaying} />
        {/* Album Art */}
        {currentTrack && currentTrack.image_url ? (
          <img
            src={currentTrack.image_url}
            alt={currentTrack?.name || 'No track'}
            className="w-12 h-12 rounded-lg shadow-md flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-white/60 flex items-center justify-center flex-shrink-0 border border-gray-200/50">
            <svg className="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
            </svg>
          </div>
        )}

        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          {/* Skip Backward */}
          <button
            onClick={handleSkipBackward}
            disabled={!currentAudio}
            className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Skip backward 10s"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/>
            </svg>
          </button>

          {/* Play/Pause */}
          <button
            onClick={handlePlayPauseClick}
            disabled={!currentAudio}
            className="w-9 h-9 flex items-center justify-center bg-blue-500 rounded-full text-white hover:bg-blue-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>

          {/* Skip Forward */}
          <button
            onClick={handleSkipForward}
            disabled={!currentAudio}
            className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Skip forward 10s"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/>
            </svg>
          </button>
        </div>

        {/* Progress & Info */}
        <div ref={containerRef} className="flex-1 flex flex-col gap-1 min-w-0 max-w-[280px]">
          {/* Track Info */}
          {currentTrack ? (
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="overflow-hidden whitespace-nowrap relative">
                  {shouldScrollTitle ? (
                    <span className="text-gray-900 font-medium text-xs inline-block animate-marquee">
                      {currentTrack.name}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{currentTrack.name}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{currentTrack.name}
                    </span>
                  ) : (
                    <p className="text-gray-900 font-medium text-xs truncate">
                      {currentTrack.name}
                    </p>
                  )}
                </div>
                <div className="overflow-hidden whitespace-nowrap relative">
                  {shouldScrollArtist ? (
                    <span className="text-gray-600 text-[10px] inline-block animate-marquee-slow">
                      {currentTrack.artist}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{currentTrack.artist}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{currentTrack.artist}
                    </span>
                  ) : (
                    <p className="text-gray-600 text-[10px] truncate">
                      {currentTrack.artist}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="min-w-0 flex-1">
              <p className="text-gray-600 text-xs">No track playing</p>
            </div>
          )}

          {/* Progress Bar & Time */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-600 font-mono tabular-nums">
              {formatTime(currentTime)}
            </span>
            <div
              className="flex-1 h-1 bg-gray-300 rounded-full cursor-pointer group relative"
              onClick={handleProgressClick}
            >
              <div
                className="h-full bg-blue-500 rounded-full relative transition-all"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" />
              </div>
            </div>
            <span className="text-[10px] text-gray-600 font-mono tabular-nums">
              {formatTime(duration)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MusicPlayer
