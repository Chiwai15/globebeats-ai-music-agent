/**
 * useAudioPlayer - React hook for the AudioManager singleton
 *
 * Provides reactive state and controls for audio playback.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import audioManager from '../services/AudioManager';

export function useAudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackContext, setPlaybackContext] = useState(null);
  const [playlistInfo, setPlaylistInfo] = useState(null);

  // Refs for callbacks that need latest state
  const onTrackEndedRef = useRef(null);

  // Subscribe to AudioManager events
  useEffect(() => {
    const unsubscribers = [];

    unsubscribers.push(
      audioManager.on('play', (track) => {
        setIsPlaying(true);
        setCurrentTrack(track);
      })
    );

    unsubscribers.push(
      audioManager.on('pause', () => {
        setIsPlaying(false);
      })
    );

    unsubscribers.push(
      audioManager.on('stop', () => {
        setIsPlaying(false);
        setCurrentTrack(null);
        setCurrentTime(0);
        setDuration(0);
        setPlaybackContext(null);
        setPlaylistInfo(null);
      })
    );

    unsubscribers.push(
      audioManager.on('ended', (data) => {
        setIsPlaying(false);
        // Call the registered callback if exists
        if (onTrackEndedRef.current) {
          onTrackEndedRef.current(data);
        }
      })
    );

    unsubscribers.push(
      audioManager.on('timeupdate', ({ currentTime: time, duration: dur }) => {
        setCurrentTime(time);
        if (dur && dur !== duration) {
          setDuration(dur);
        }
      })
    );

    unsubscribers.push(
      audioManager.on('loadedmetadata', ({ duration: dur }) => {
        setDuration(dur);
      })
    );

    unsubscribers.push(
      audioManager.on('unlocked', () => {
        setIsUnlocked(true);
      })
    );

    // Sync initial state
    const state = audioManager.getState();
    setIsPlaying(state.isPlaying);
    setIsUnlocked(state.isUnlocked);
    setCurrentTrack(state.currentTrack);
    setCurrentTime(state.currentTime);
    setDuration(state.duration);
    setPlaybackContext(state.playbackContext);
    setPlaylistInfo(state.playlistInfo);

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, []);

  // Play a track
  const play = useCallback(async (track, options = {}) => {
    setPlaybackContext(options.context || null);
    setPlaylistInfo(options.playlist ? { playlist: options.playlist, index: options.playlistIndex || 0 } : null);
    return await audioManager.play(track, options);
  }, []);

  // Pause
  const pause = useCallback(() => {
    audioManager.pause();
  }, []);

  // Resume
  const resume = useCallback(async () => {
    return await audioManager.resume();
  }, []);

  // Toggle play/pause
  const togglePlayPause = useCallback(async () => {
    return await audioManager.togglePlayPause();
  }, []);

  // Stop completely
  const stop = useCallback(() => {
    audioManager.stop();
  }, []);

  // Seek
  const seek = useCallback((time) => {
    audioManager.seek(time);
  }, []);

  // Skip forward/backward
  const skip = useCallback((seconds) => {
    audioManager.skip(seconds);
  }, []);

  // Unlock audio (call on user interaction)
  const unlock = useCallback(async () => {
    return await audioManager.unlock();
  }, []);

  // Register callback for track ended
  const onTrackEnded = useCallback((callback) => {
    onTrackEndedRef.current = callback;
  }, []);

  // Get audio element (for legacy components that need direct access)
  const getAudioElement = useCallback(() => {
    return audioManager.getAudioElement();
  }, []);

  return {
    // State
    isPlaying,
    isUnlocked,
    currentTrack,
    currentTime,
    duration,
    playbackContext,
    playlistInfo,

    // Controls
    play,
    pause,
    resume,
    togglePlayPause,
    stop,
    seek,
    skip,
    unlock,

    // Callbacks
    onTrackEnded,

    // Legacy support
    getAudioElement,
    currentAudio: audioManager.getAudioElement()
  };
}

export default useAudioPlayer;
