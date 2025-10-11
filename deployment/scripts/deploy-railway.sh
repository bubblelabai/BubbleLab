#!/bin/bash

# Railway deployment script

echo "🚀 Deploying to Railway..."

# Check if railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Please install it first:"
    echo "npm install -g @railway/cli"
    exit 1
fi

# Check if we're in the deployment directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Please run this script from the deployment directory"
    exit 1
fi

# Login to Railway if needed
echo "📝 Checking Railway authentication..."
railway whoami || railway login

# Deploy
echo "🔨 Building and deploying..."
railway up

echo "✅ Deployment complete!"
echo "🔍 Check deployment status with: railway logs"