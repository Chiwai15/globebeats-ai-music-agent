import React from 'react'

const Header = ({ isConnected, countriesCount, error }) => {
  return (
    <>
      {/* Logo - Top Left */}
      <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-10 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-md border border-slate-700/50 shadow-xl">
        <div className="flex items-center space-x-2">
          <div className="text-xl">🌍</div>
          <div>
            <h1 className="text-sm font-bold text-white">GlobeBeats</h1>
            <p className="text-[10px] text-amber-400">⚠️ Demo Only - No data retained • Click play to enable audio</p>
          </div>
        </div>
      </div>

      {/* Status Indicators - Top Right */}
      <div className="absolute top-3 right-3 z-10 flex items-center space-x-2">
        {error ? (
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-red-500/20 backdrop-blur-md rounded-md border border-red-500/30 shadow-xl">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span className="text-xs text-red-300">{error}</span>
          </div>
        ) : (
          <>
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-900/80 backdrop-blur-md rounded-md border border-slate-700/50 shadow-xl">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
              <span className="text-xs text-slate-300">
                {isConnected ? 'Live' : 'Connecting...'}
              </span>
            </div>
          </>
        )}
      </div>
    </>
  )
}

export default Header
