import React, { useRef, useEffect } from 'react'

const FrequencyVisualizer = ({ currentAudio, isPlaying }) => {
  const canvasRef = useRef(null)
  const animationFrameRef = useRef(null)
  const analyzerRef = useRef(null)
  const audioContextRef = useRef(null)
  const dataArrayRef = useRef(null)
  const sourceNodeRef = useRef(null)

  useEffect(() => {
    // DISABLED: FrequencyVisualizer disabled due to CORS restrictions on iTunes audio
    // iTunes audio sources don't allow cross-origin access via AudioContext
    // createMediaElementSource() takes over audio routing and outputs silence with CORS
    // TODO: Implement a simple visual animation that doesn't require AudioContext

    // Clear canvas
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [currentAudio])

  const draw = () => {
    const canvas = canvasRef.current
    if (!canvas || !analyzerRef.current || !dataArrayRef.current) return

    const ctx = canvas.getContext('2d')
    const analyzer = analyzerRef.current
    const dataArray = dataArrayRef.current
    const bufferLength = analyzer.frequencyBinCount

    // Get frequency data
    analyzer.getByteFrequencyData(dataArray)

    // Clear canvas with transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Vibrant Rainbow Color Scheme
    const rainbowColors = [
      { color: '#FF3B30', rgb: '255, 59, 48' },   // Vibrant Red
      { color: '#FF9500', rgb: '255, 149, 0' },   // Vibrant Orange
      { color: '#FFCC00', rgb: '255, 204, 0' },   // Vibrant Yellow
      { color: '#34C759', rgb: '52, 199, 89' },   // Vibrant Green
      { color: '#5AC8FA', rgb: '90, 200, 250' },  // Vibrant Teal/Cyan
      { color: '#007AFF', rgb: '0, 122, 255' },   // Vibrant Blue
      { color: '#5856D6', rgb: '88, 86, 214' },   // Vibrant Indigo
      { color: '#AF52DE', rgb: '175, 82, 222' },  // Vibrant Purple/Magenta
    ]

    // Draw frequency bars
    const barWidth = (canvas.width / bufferLength) * 1.5
    const spacing = 2
    let x = 0

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * canvas.height * 0.9 // Max 90% of canvas height

      // Cycle through rainbow colors
      const colorIndex = i % rainbowColors.length
      const rainbowColor = rainbowColors[colorIndex]

      // Create gradient for each bar using rainbow colors
      const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height)
      gradient.addColorStop(0, `rgba(${rainbowColor.rgb}, 0.9)`) // Top - more opaque
      gradient.addColorStop(1, `rgba(${rainbowColor.rgb}, 0.5)`) // Bottom - more transparent

      ctx.fillStyle = gradient

      // Rounded bars
      const radius = barWidth / 4
      const actualBarWidth = barWidth - spacing
      const y = canvas.height - barHeight

      ctx.beginPath()
      ctx.moveTo(x + radius, y)
      ctx.lineTo(x + actualBarWidth - radius, y)
      ctx.quadraticCurveTo(x + actualBarWidth, y, x + actualBarWidth, y + radius)
      ctx.lineTo(x + actualBarWidth, canvas.height)
      ctx.lineTo(x, canvas.height)
      ctx.lineTo(x, y + radius)
      ctx.quadraticCurveTo(x, y, x + radius, y)
      ctx.closePath()
      ctx.fill()

      x += barWidth
    }

    // Continue animation
    animationFrameRef.current = requestAnimationFrame(draw)
  }

  return (
    <div className="absolute bottom-full mb-2 left-0 right-0 flex justify-center pointer-events-none z-10">
      <canvas
        ref={canvasRef}
        width={525}
        height={80}
        className="rounded-xl opacity-90 max-w-full px-4"
        style={{ height: '80px' }}
      />
    </div>
  )
}

export default FrequencyVisualizer
