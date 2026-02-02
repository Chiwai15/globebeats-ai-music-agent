/**
 * AudioManager - Singleton audio player to prevent multiple simultaneous playback
 *
 * This ensures only ONE audio instance exists at any time, preventing the
 * "10 songs playing together" bug caused by race conditions.
 */

class AudioManager {
  constructor() {
    if (AudioManager.instance) {
      return AudioManager.instance;
    }

    this.audio = null;
    this.isUnlocked = false;
    this.isPlaying = false;
    this.currentTrack = null;
    this.listeners = new Map();
    this.playbackContext = null; // 'trending', 'playlist', 'search', etc.
    this.playlistInfo = null;
    this.isLoading = false;

    // Bind methods
    this.play = this.play.bind(this);
    this.pause = this.pause.bind(this);
    this.stop = this.stop.bind(this);
    this.unlock = this.unlock.bind(this);

    AudioManager.instance = this;

    console.log('[AudioManager] Singleton initialized');
  }

  /**
   * Unlock audio playback (required for browser autoplay policy)
   */
  async unlock() {
    if (this.isUnlocked) {
      return true;
    }

    try {
      const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
      await silentAudio.play();
      silentAudio.pause();
      silentAudio.src = '';
      this.isUnlocked = true;
      console.log('[AudioManager] Audio unlocked');
      this.emit('unlocked');
      return true;
    } catch (err) {
      console.log('[AudioManager] Unlock failed (normal on first load):', err.message);
      return false;
    }
  }

  /**
   * Play a track - stops any current playback first
   * @param {Object} track - Track object with preview_url
   * @param {Object} options - Playback options
   */
  async play(track, options = {}) {
    const {
      context = 'unknown',
      playlist = null,
      playlistIndex = 0,
      onEnded = null
    } = options;

    // Validate track
    if (!track || !track.preview_url) {
      console.warn('[AudioManager] Cannot play - no preview URL');
      return false;
    }

    // Prevent double-play of same track
    if (this.currentTrack &&
        this.currentTrack.preview_url === track.preview_url &&
        this.isPlaying) {
      console.log('[AudioManager] Same track already playing, ignoring');
      return true;
    }

    // Prevent rapid fire requests
    if (this.isLoading) {
      console.log('[AudioManager] Already loading a track, ignoring');
      return false;
    }

    this.isLoading = true;

    console.log(`[AudioManager] Playing: "${track.name}" by ${track.artist} (${context})`);

    // Stop current audio COMPLETELY before creating new one
    this.stopInternal();

    try {
      // Create new audio instance
      this.audio = new Audio(track.preview_url);
      this.audio.preload = 'auto';

      // Store track info
      this.currentTrack = { ...track };
      this.playbackContext = context;
      this.playlistInfo = playlist ? { playlist, index: playlistIndex } : null;

      // Set up event listeners
      this.audio.addEventListener('play', () => {
        this.isPlaying = true;
        this.emit('play', this.currentTrack);
      });

      this.audio.addEventListener('pause', () => {
        this.isPlaying = false;
        this.emit('pause', this.currentTrack);
      });

      this.audio.addEventListener('ended', () => {
        console.log('[AudioManager] Track ended');
        this.isPlaying = false;
        const endedTrack = this.currentTrack;
        const endedContext = this.playbackContext;
        const endedPlaylistInfo = this.playlistInfo;

        this.emit('ended', {
          track: endedTrack,
          context: endedContext,
          playlistInfo: endedPlaylistInfo
        });

        // Call custom onEnded callback if provided
        if (onEnded) {
          onEnded({ track: endedTrack, context: endedContext, playlistInfo: endedPlaylistInfo });
        }
      });

      this.audio.addEventListener('timeupdate', () => {
        this.emit('timeupdate', {
          currentTime: this.audio?.currentTime || 0,
          duration: this.audio?.duration || 0
        });
      });

      this.audio.addEventListener('loadedmetadata', () => {
        this.emit('loadedmetadata', {
          duration: this.audio?.duration || 0
        });
      });

      this.audio.addEventListener('error', (e) => {
        console.error('[AudioManager] Audio error:', e);
        this.isPlaying = false;
        this.isLoading = false;
        this.emit('error', e);
      });

      // Attempt to play
      await this.audio.play();
      this.isLoading = false;
      console.log('[AudioManager] Playback started successfully');
      return true;

    } catch (err) {
      console.error('[AudioManager] Play failed:', err);
      this.isLoading = false;
      this.stopInternal();
      return false;
    }
  }

  /**
   * Pause current playback
   */
  pause() {
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
      console.log('[AudioManager] Paused');
    }
  }

  /**
   * Resume playback
   */
  async resume() {
    if (this.audio && this.audio.paused && this.audio.src) {
      try {
        await this.audio.play();
        console.log('[AudioManager] Resumed');
        return true;
      } catch (err) {
        console.error('[AudioManager] Resume failed:', err);
        return false;
      }
    }
    return false;
  }

  /**
   * Toggle play/pause
   */
  async togglePlayPause() {
    if (!this.audio) return false;

    if (this.audio.paused) {
      return await this.resume();
    } else {
      this.pause();
      return true;
    }
  }

  /**
   * Stop playback and clear track
   */
  stop() {
    this.stopInternal();
    this.currentTrack = null;
    this.playbackContext = null;
    this.playlistInfo = null;
    this.emit('stop');
    console.log('[AudioManager] Stopped and cleared');
  }

  /**
   * Internal stop - doesn't clear track info (used when switching tracks)
   */
  stopInternal() {
    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.src = '';
        this.audio.load(); // Force release of resources
      } catch (e) {
        // Ignore errors during cleanup
      }
      this.audio = null;
    }
    this.isPlaying = false;
  }

  /**
   * Seek to a specific time
   */
  seek(time) {
    if (this.audio && !isNaN(time)) {
      this.audio.currentTime = Math.max(0, Math.min(time, this.audio.duration || 0));
    }
  }

  /**
   * Skip forward/backward
   */
  skip(seconds) {
    if (this.audio) {
      this.seek(this.audio.currentTime + seconds);
    }
  }

  /**
   * Get current state
   */
  getState() {
    return {
      isPlaying: this.isPlaying,
      isUnlocked: this.isUnlocked,
      isLoading: this.isLoading,
      currentTrack: this.currentTrack,
      playbackContext: this.playbackContext,
      playlistInfo: this.playlistInfo,
      currentTime: this.audio?.currentTime || 0,
      duration: this.audio?.duration || 0,
      paused: this.audio?.paused ?? true
    };
  }

  /**
   * Get the audio element (for MusicPlayer component)
   */
  getAudioElement() {
    return this.audio;
  }

  /**
   * Event subscription
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    this.listeners.get(event)?.delete(callback);
  }

  /**
   * Emit event to all listeners
   */
  emit(event, data) {
    this.listeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (e) {
        console.error(`[AudioManager] Error in ${event} listener:`, e);
      }
    });
  }
}

// Create and export singleton instance
const audioManager = new AudioManager();

export default audioManager;
