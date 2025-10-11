#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Setting up BubbleLab environment files...${NC}\n"

# Function to copy env file if it doesn't exist
setup_env() {
    local dir=$1
    local app_name=$2

    if [ -f "$dir/.env" ]; then
        echo -e "${YELLOW}⚠️  $app_name: .env already exists, skipping...${NC}"
    elif [ -f "$dir/.env.example" ]; then
        cp "$dir/.env.example" "$dir/.env"
        echo -e "${GREEN}✅ $app_name: Created .env from .env.example${NC}"
    else
        echo -e "${YELLOW}⚠️  $app_name: No .env.example found, skipping...${NC}"
    fi
}

# Setup frontend env
setup_env "apps/bubble-studio" "Frontend (bubble-studio)"

# Setup backend env
setup_env "apps/bubblelab-api" "Backend (bubblelab-api)"

echo -e "\n${GREEN}✨ Environment setup complete!${NC}"
echo -e "\n${BLUE}📝 Next steps:${NC}"
echo -e "1. Edit ${YELLOW}apps/bubble-studio/.env${NC} if needed"
echo -e "2. Edit ${YELLOW}apps/bubblelab-api/.env${NC} if needed"
echo -e "3. Run ${YELLOW}pnpm install${NC} to install dependencies"
echo -e "4. Start the backend: ${YELLOW}cd apps/bubblelab-api && pnpm run dev${NC}"
echo -e "5. Start the frontend: ${YELLOW}cd apps/bubble-studio && pnpm run dev${NC}"
echo -e "\n${BLUE}💡 Tip: By default, the .env.example files are configured for dev mode (no auth required)${NC}\n"
