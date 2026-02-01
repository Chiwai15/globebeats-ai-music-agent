import React, { useState, useRef, useEffect } from 'react'
import { API_BASE_URL } from '../config'
import demoScenariosData from '../data/demoScenarios.json'

const ChatPanel = ({ countries, onSelectCountry, onPlaySong, onSearchAndPlay, onAddPlaylist, currentTrack, playlists, onClearAll }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hi! Ask me anything about music trends around the world.\n\nExamples:\n• What\'s trending in Japan?\n• Compare US and UK music\n• Similar music across countries'
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [aiEnabled, setAiEnabled] = useState(false)
  const [selectedLLM, setSelectedLLM] = useState('auto') // auto, anthropic, openai
  const [availableLLMs, setAvailableLLMs] = useState([])
  const [selectedDemo, setSelectedDemo] = useState('')
  const [isPlayingDemo, setIsPlayingDemo] = useState(false)
  const [demoProgress, setDemoProgress] = useState({ current: 0, total: 0 })
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const executedActionsRef = useRef(new Set()) // Track executed actions to prevent duplicates
  const stopDemoRef = useRef(false)
  const disableAutoPlayRef = useRef(false) // Disable auto-play during demos

  const getActionLabel = (actionString) => {
    const match = actionString.match(/\[ACTION:(\w+)\|([^\]]+)\]/)
    if (!match) return null

    const [, actionType, params] = match
    const paramList = params.split('|')

    switch (actionType) {
      case 'PLAY_SONG': {
        const [countryCode, trackName] = paramList
        return { icon: '🎵', text: `Playing: ${trackName}` }
      }
      case 'SELECT_COUNTRY': {
        const [countryCode] = paramList
        const country = countries.find(c => c.country_code === countryCode)
        return { icon: '🌍', text: `Zooming to ${country?.country_name || countryCode}` }
      }
      case 'SEARCH_AND_PLAY': {
        const [searchQuery] = paramList
        return { icon: '🔍', text: `Searching for "${searchQuery}"` }
      }
      case 'SEARCH_SPOTIFY': {
        const [searchQuery] = paramList
        return { icon: '🎸', text: `Searching Spotify for "${searchQuery}"` }
      }
      case 'SHOW_SONG_LIST': {
        const [searchQuery] = paramList
        return { icon: '🎵', text: `Creating playlist for "${searchQuery}"` }
      }
      default:
        return null
    }
  }

  const executeAction = (actionString) => {
    // Parse action format: [ACTION:TYPE|param1|param2|...]
    const match = actionString.match(/\[ACTION:(\w+)\|([^\]]+)\]/)
    if (!match) {
      console.log('[ChatPanel] No match for action:', actionString)
      return
    }

    const [, actionType, params] = match
    const paramList = params.split('|')
    console.log('[ChatPanel] Parsed action type:', actionType, 'params:', paramList)

    // Keep chat open for demonstration - show all AI workflow steps
    // Auto-close disabled for interview/demo purposes

    switch (actionType) {
      case 'PLAY_SONG': {
        const [countryCode, trackName, artistName] = paramList
        console.log('[ChatPanel] PLAY_SONG action - Country:', countryCode, 'Track:', trackName, 'Artist:', artistName)
        playSong(countryCode, trackName, artistName)
        // autoCloseChat() - DISABLED for demo
        break
      }
      case 'SELECT_COUNTRY': {
        const [countryCode] = paramList
        console.log('[ChatPanel] SELECT_COUNTRY action - Country:', countryCode)
        if (onSelectCountry) {
          onSelectCountry(countryCode)
        }
        // autoCloseChat() - DISABLED for demo
        break
      }
      case 'SEARCH_AND_PLAY': {
        const [searchQuery] = paramList
        console.log('[ChatPanel] SEARCH_AND_PLAY action - Query:', searchQuery)
        if (onSearchAndPlay) {
          onSearchAndPlay(searchQuery)
        }
        // autoCloseChat() - DISABLED for demo
        break
      }
      case 'SEARCH_SPOTIFY': {
        const [searchQuery] = paramList
        console.log('[ChatPanel] SEARCH_SPOTIFY action - Query:', searchQuery)
        searchAndPlaySpotify(searchQuery)
        // autoCloseChat() - DISABLED for demo
        break
      }
      case 'SHOW_SONG_LIST': {
        const [searchQuery] = paramList
        console.log('[ChatPanel] SHOW_SONG_LIST action - Query:', searchQuery)
        showSongList(searchQuery)
        // autoCloseChat() - DISABLED for demo
        break
      }
    }
  }

  const searchAndPlaySpotify = async (query) => {
    console.log('[ChatPanel] Searching Spotify for:', query)
    try {
      const response = await fetch(`${API_BASE_URL}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      })

      if (!response.ok) {
        console.error('[ChatPanel] Spotify search failed:', response.status)
        return
      }

      const data = await response.json()
      console.log('[ChatPanel] Spotify search results:', data)

      if (data.tracks && data.tracks.length > 0) {
        // Find first track with preview URL
        const trackWithPreview = data.tracks.find(t => t.preview_url)

        if (trackWithPreview) {
          console.log('[ChatPanel] Playing Spotify track:', trackWithPreview.name, 'by', trackWithPreview.artist)
          // Play directly using the preview URL
          if (onPlaySong) {
            // Create a temporary "Spotify" country code for this track
            onPlaySong('SPOTIFY', trackWithPreview.name, trackWithPreview.artist, false, trackWithPreview.preview_url)
          }
        } else {
          console.log('[ChatPanel] No tracks with preview URL found')
          // Add a system message to chat
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `Sorry, I found "${data.tracks[0].name}" by ${data.tracks[0].artist} on Spotify, but it doesn't have a 30-second preview available. This is a Spotify licensing limitation for some songs.

Try asking for a different song, or check out what's trending in the countries on the globe!`
          }])
        }
      } else {
        console.log('[ChatPanel] No tracks found for query:', query)
        // Add a system message to chat
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Sorry, I couldn't find any tracks for "${query}" on Spotify. Try rephrasing your search or check out what's trending!`
        }])
      }
    } catch (error) {
      console.error('[ChatPanel] Error searching Spotify:', error)
    }
  }

  const showSongList = async (query) => {
    console.log('[ChatPanel] Showing song list for:', query)

    // Add status message: Calling API
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: `🔄 Calling iTunes Search API for "${query}"...`
    }])

    try {
      const response = await fetch(`${API_BASE_URL}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, limit: 20 })
      })

      if (!response.ok) {
        console.error('[ChatPanel] Song list search failed:', response.status)
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `❌ API call failed with status ${response.status}`
        }])
        return
      }

      const data = await response.json()
      console.log('[ChatPanel] Song list results:', data)

      // Add status message: Processing results
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `🔄 Processing ${data.tracks?.length || 0} tracks from API response...`
      }])

      if (data.tracks && data.tracks.length > 0) {
        // Format tracks and add to playlist state
        const formattedTracks = data.tracks.map(track => ({
          name: track.name,
          artist: track.artist,
          preview_url: track.preview_url,
          image_url: track.image_url,
          external_url: track.external_url
        }))

        // Add playlist to state via parent callback and get the created playlist object
        let createdPlaylist = null
        if (onAddPlaylist) {
          createdPlaylist = onAddPlaylist(query, formattedTracks)
          console.log('[ChatPanel] ✅ Playlist created:', createdPlaylist.name, 'ID:', createdPlaylist.id)
        } else {
          console.error('[ChatPanel] ❌ onAddPlaylist is not available!')
        }

        // Add a confirmation message to chat
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `✅ Created playlist "${query}" with ${formattedTracks.length} tracks! Check the Playlists section on the left.`
        }])

        // IMMEDIATELY play the first track with preview URL for better UX
        // BUT: Skip auto-play during demo mode to prevent multiple songs playing simultaneously
        const firstTrackWithPreview = formattedTracks.find(track => track.preview_url)
        if (firstTrackWithPreview && onPlaySong && createdPlaylist && !disableAutoPlayRef.current) {
          console.log('[ChatPanel] Auto-playing first track from playlist:', firstTrackWithPreview.name)

          // Add status message: Starting playback
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `🔄 Auto-playing "${firstTrackWithPreview.name}" by ${firstTrackWithPreview.artist}...`
          }])

          // Pass false for autoPlay to KILL the "devil" auto-play mode
          // Pass playlist context to enable sequential playback
          setTimeout(() => {
            onPlaySong(
              'PLAYLIST',
              firstTrackWithPreview.name,
              firstTrackWithPreview.artist,
              false, // Not random auto-play
              firstTrackWithPreview.preview_url,
              { playlist: createdPlaylist, index: 0 }, // Start playlist from beginning
              firstTrackWithPreview.image_url // Pass album art for music player display
            )
          }, 500) // Small delay to let playlist UI update first
        } else if (disableAutoPlayRef.current) {
          console.log('[ChatPanel] ⏸️ Auto-play DISABLED during demo mode - preventing multiple audio overlap')
        }
      } else {
        console.log('[ChatPanel] No tracks found for playlist query:', query)
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Sorry, I couldn't find any tracks for "${query}". Try a different search!`
        }])
      }
    } catch (error) {
      console.error('[ChatPanel] Error fetching song list:', error)
    }
  }

  const playSong = (countryCode, trackName, artistName) => {
    console.log('[ChatPanel] playSong called with:', { countryCode, trackName, artistName })
    if (onPlaySong) {
      console.log('[ChatPanel] Calling onPlaySong from App.jsx')
      onPlaySong(countryCode, trackName, artistName)
    } else {
      console.log('[ChatPanel] WARNING: onPlaySong is not available!')
    }
  }

  useEffect(() => {
    fetch(`${API_BASE_URL}/`)
      .then(res => res.json())
      .then(data => {
        setAiEnabled(data.ai_enabled || false)
        // Extract available LLMs from backend
        if (data.available_llms) {
          setAvailableLLMs(data.available_llms)
        }
      })
      .catch(() => setAiEnabled(false))
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isOpen) {
      if (inputRef.current) {
        inputRef.current.focus()
      }
      // Unlock audio on chat open (user gesture)
      const unlockAudio = async () => {
        try {
          const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA')
          await silentAudio.play()
          console.log('✅ Audio unlocked on chat open')
        } catch (err) {
          console.log('⚠️ Audio unlock failed (normal on first load)')
        }
      }
      unlockAudio()
    }
  }, [isOpen])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const playDemo = async () => {
    if (!selectedDemo || isPlayingDemo) return

    const scenario = demoScenariosData.scenarios.find(s => s.id === selectedDemo)
    if (!scenario) return

    // CRITICAL: Initialize audio context on user click to unlock autoplay
    // Create a silent audio and play it immediately on this user gesture
    try {
      const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA')
      await silentAudio.play()
      console.log('✅ Audio context unlocked for demo')
    } catch (err) {
      console.warn('⚠️ Could not unlock audio context:', err)
    }

    stopDemoRef.current = false
    disableAutoPlayRef.current = true // CRITICAL: Disable auto-play during demo
    setIsPlayingDemo(true)
    setDemoProgress({ current: 0, total: scenario.messages.length })

    for (let i = 0; i < scenario.messages.length; i++) {
      if (stopDemoRef.current) break

      const messageText = scenario.messages[i]
      setDemoProgress({ current: i + 1, total: scenario.messages.length })

      // Add user message
      setMessages(prev => [...prev, { role: 'user', content: messageText }])

      // Wait before sending to backend
      await new Promise(resolve => setTimeout(resolve, 800))

      setIsLoading(true)

      try {
        const conversationHistory = messages
          .slice(-5)
          .map(msg => ({
            role: msg.role,
            content: msg.content
          }))

        const response = await fetch(`${API_BASE_URL}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: messageText,
            conversation_history: conversationHistory,
            playlists: playlists || []
          })
        })

        if (!response.ok) {
          throw new Error('Failed to get response')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let assistantMessage = ''
        let buffer = '' // Buffer for incomplete lines

        setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }])

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          buffer += chunk
          const lines = buffer.split('\n')

          // Keep the last incomplete line in the buffer
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))

                if (data.chunk) {
                  assistantMessage += data.chunk
                  setMessages(prev => {
                    const newMessages = [...prev]
                    const lastMessage = newMessages[newMessages.length - 1]
                    if (lastMessage && lastMessage.role === 'assistant') {
                      lastMessage.content = assistantMessage
                      lastMessage.isStreaming = !data.done
                    }
                    return newMessages
                  })
                }

                if (data.done && data.full_response !== undefined) {
                  // Execute actions
                  const actionRegex = /\[ACTION:\w+\|[^\]]+\]/g
                  const actions = assistantMessage.match(actionRegex) || []
                  const uniqueActions = [...new Set(actions)]

                  console.log('[DEMO] Actions found:', actions)
                  console.log('[DEMO] Unique actions:', uniqueActions)
                  console.log('[DEMO] Already executed:', Array.from(executedActionsRef.current))

                  uniqueActions.forEach(action => {
                    if (!executedActionsRef.current.has(action)) {
                      console.log('[DEMO] ✅ Executing action:', action)
                      executeAction(action)
                      executedActionsRef.current.add(action)
                    } else {
                      console.log('[DEMO] ⏭️ Skipping already executed:', action)
                    }
                  })
                }
              } catch (err) {
                console.error('Error parsing SSE data:', err)
              }
            }
          }
        }

        setIsLoading(false)
        await new Promise(resolve => setTimeout(resolve, 1500))

      } catch (error) {
        console.error('Demo error:', error)
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Error: ${error.message}`
        }])
        setIsLoading(false)
        setIsPlayingDemo(false)
        return
      }
    }

    disableAutoPlayRef.current = false // Re-enable auto-play after demo
    setIsPlayingDemo(false)
    setDemoProgress({ current: 0, total: 0 })
  }

  const stopDemo = () => {
    stopDemoRef.current = true
    disableAutoPlayRef.current = false // Re-enable auto-play
    setIsPlayingDemo(false)
    setDemoProgress({ current: 0, total: 0 })
    setIsLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setIsLoading(true)

    setMessages(prev => [...prev, { role: 'user', content: userMessage }])

    try {
      const conversationHistory = messages
        .slice(-5)
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }))

      const response = await fetch('http://localhost:8001/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          conversation_history: conversationHistory,
          playlists: playlists || []  // Send current playlists to LLM
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ''
      let contexts = []
      let messageFinalized = false

      setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.chunk) {
                assistantMessage += data.chunk

                // Extract actions but KEEP them in the message for debugging
                const actionRegex = /\[ACTION:\w+\|[^\]]+\]/g
                const actions = assistantMessage.match(actionRegex) || []
                // Don't remove action tags from display - keep them for debugging
                const displayMessage = assistantMessage.trim()

                setMessages(prev => {
                  const newMessages = [...prev]
                  newMessages[newMessages.length - 1] = {
                    role: 'assistant',
                    content: displayMessage,
                    actions: actions,
                    isStreaming: !data.done
                  }
                  return newMessages
                })

                // If this chunk is done (like switching message), start a new message
                if (data.done && data.full_response === undefined) {
                  messageFinalized = true
                  assistantMessage = '' // Reset for next message
                  // Add new message for next chunk
                  setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }])
                }
              }

              if (data.done && data.full_response !== undefined) {
                contexts = data.contexts

                // Execute UNIQUE actions found in the response (avoid duplicates)
                const actionRegex = /\[ACTION:\w+\|[^\]]+\]/g
                const actions = assistantMessage.match(actionRegex) || []
                const uniqueActions = [...new Set(actions)] // Remove duplicates within this message
                console.log('[ChatPanel] Actions found:', actions)
                console.log('[ChatPanel] Unique actions in message:', uniqueActions)
                console.log('[ChatPanel] Already executed actions:', Array.from(executedActionsRef.current))

                // Only execute actions that haven't been executed before
                uniqueActions.forEach(action => {
                  if (!executedActionsRef.current.has(action)) {
                    console.log('[ChatPanel] ✅ Executing NEW action:', action)
                    executeAction(action)
                    executedActionsRef.current.add(action) // Mark as executed
                  } else {
                    console.log('[ChatPanel] ⏭️ SKIPPING duplicate action:', action)
                  }
                })
              }
            } catch (err) {
              console.error('Error parsing SSE data:', err)
            }
          }
        }
      }

      setMessages(prev => {
        const newMessages = [...prev]
        newMessages[newMessages.length - 1].isStreaming = false
        return newMessages
      })

    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please make sure the backend is running and AI is enabled.'
        }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const exampleQuestions = [
    "What's trending in Brazil?",
    "Play the 5th song from Japan",
    "Which countries are listening to Taylor Swift?",
    "Compare US and UK music trends",
    "Show me Canada's top 10",
    "Play some Taylor Swift",
    "What's #1 in South Korea?",
    "Which artist appears in most countries?",
    "Top artists in Europe",
    "Play the 3rd song from France"
  ]

  const handleExampleClick = (question) => {
    setInput(question)
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-[26px] max-[673px]:bottom-[110px] right-6 z-[2100] p-3 rounded-full transition-all duration-300 bg-white hover:bg-gray-50 shadow-lg ${
          !aiEnabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        title={aiEnabled ? 'Toggle AI Chat' : 'AI Not Configured'}
        disabled={!aiEnabled}
      >
        {isOpen ? (
          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>

      {/* Backdrop - Click outside to dismiss */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[1999]"
          onClick={() => setIsOpen(false)}
          aria-label="Close chat"
        />
      )}

      {/* Chat Panel - Bottom Right */}
      {isOpen && (
        <div className="fixed bottom-[86px] max-[673px]:bottom-[170px] right-6 z-[2000] w-72 max-h-[450px] bg-white/80 backdrop-blur-md rounded-2xl border border-white/50 shadow-lg flex flex-col transition-all duration-300 animate-chat-appear">
          {/* Header - Always visible for demo */}
          <div className="relative px-2 py-1.5 border-b border-gray-100 bg-gray-50/90 shadow-sm rounded-t-2xl">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center space-x-1.5">
                <svg className="w-3.5 h-3.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                </svg>
                <div>
                  <h3 className="text-xs font-semibold text-gray-900">Music Agent</h3>
                  <p className="text-[9px] text-gray-500">Global music insights</p>
                </div>
              </div>
            </div>

            {/* Demo Controls */}
            <div className="flex items-center gap-1.5">
              <select
                value={selectedDemo}
                onChange={(e) => {
                  if (isPlayingDemo) {
                    alert('Cannot change demo while playing');
                    return;
                  }

                  const newDemo = e.target.value;
                  if (newDemo && playlists.length > 0) {
                    // Clear all playlists and state for demo
                    if (onClearAll) {
                      onClearAll();
                    }
                    // Clear executed actions
                    executedActionsRef.current.clear();
                    // Clear messages to start fresh
                    setMessages([{
                      role: 'assistant',
                      content: '✨ Demo mode activated! All playlists cleared. Ready for a fresh demo.'
                    }]);

                    alert('Demo preparation: Existing playlists cleared. This is normal for demo mode.');
                  }

                  setSelectedDemo(newDemo);
                }}
                className="flex-1 px-2 py-1 rounded text-[10px] bg-white border border-gray-300 text-gray-700 hover:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select Demo Scenario</option>
                {demoScenariosData.scenarios.map(scenario => (
                  <option key={scenario.id} value={scenario.id}>{scenario.name}</option>
                ))}
              </select>

              <button
                onClick={() => {
                  if (isPlayingDemo) {
                    stopDemo();
                  } else {
                    if (!selectedDemo) {
                      alert('Please select a demo scenario first');
                      return;
                    }
                    playDemo();
                  }
                }}
                className={`px-2 py-1 rounded text-[10px] font-medium flex items-center gap-1 transition-all ${
                  isPlayingDemo
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
                title={isPlayingDemo ? 'Stop demo' : 'Play demo'}
              >
                {isPlayingDemo ? (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                    </svg>
                    <span>{demoProgress.current}/{demoProgress.total}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Play</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="relative flex-1 overflow-y-auto px-2 py-3 flex flex-col-reverse">
            <div className="flex flex-col space-y-1.5 pb-2">
            {messages.map((message, index) => {
              return (
                <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex flex-col gap-1 ${message.role === 'user' ? 'items-end' : 'items-start'} max-w-[85%]`}>
                    <div className={`px-2 py-1 rounded-lg w-fit transition-colors ${
                      message.role === 'user'
                        ? 'bg-white text-gray-900 hover:bg-gray-100'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}>
                      {message.content || message.isStreaming ? (
                        <>
                          {message.content && (
                            <p className={`whitespace-pre-wrap leading-snug ${
                              message.content.startsWith('🔄')
                                ? 'text-[10px] italic opacity-80'
                                : 'text-xs'
                            }`}>{message.content}</p>
                          )}
                          {message.isStreaming && !message.content && (
                            <div className="flex items-center gap-1 min-h-[16px]">
                              <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                              <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                              <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            </div>
                          )}
                        </>
                      ) : null}
                    </div>
                    {message.actions && message.actions.length > 0 && !message.isStreaming && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {message.actions.map((action, actionIndex) => {
                          const label = getActionLabel(action)
                          if (!label) return null
                          return (
                            <div key={actionIndex} className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 rounded-lg text-xs font-semibold border border-green-300 shadow-sm">
                              <span className="text-sm">{label.icon}</span>
                              <span>{label.text}</span>
                              <svg className="w-3.5 h-3.5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Example Questions */}
            {messages.length === 1 && !isLoading && (
              <div className="space-y-1 flex flex-col items-start">
                <p className="text-[10px] text-gray-500 bg-white rounded-full px-2 py-0.5 w-fit">Try asking:</p>
                {exampleQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleExampleClick(question)}
                    className="text-left px-2 py-1 text-[11px] bg-white hover:bg-gray-50 rounded-lg transition-colors text-gray-700 w-fit"
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="relative p-2">
            <div className="flex space-x-1.5 items-center">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about music trends..."
                disabled={isLoading}
                className="flex-1 px-2.5 py-1 bg-white rounded-full text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 text-xs"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="w-7 h-7 flex items-center justify-center bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-full transition-colors flex-shrink-0"
              >
                {isLoading ? (
                  <svg className="w-3.5 h-3.5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

export default ChatPanel
