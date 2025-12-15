#!/bin/bash

echo "🌍 Starting GlobeBeats..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from .env.example..."
    cp .env.example .env
    echo "✅ Created .env file. Please edit it with your API keys!"
    echo ""
fi

# Start services
echo "🚀 Starting Docker containers..."
docker-compose up --build
