# BubbleLab Deployment

Docker Compose setup for BubbleLab with PostgreSQL, API, and Nginx.

## Quick Start

```bash
cp .env.example .env
# Edit .env with your values
docker-compose up -d
```

Access Bubble Studio at http://localhost:8080

## Database Connection

**Inside Docker** (for API):

```
DATABASE_URL=postgresql://postgres:password@postgres:5432/bubble_lab
```

**Outside Docker** (for local tools):

```
postgresql://postgres:password@localhost:5432/bubble_lab
```

## Common Commands

```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Rebuild
docker-compose up -d --build

# Reset database (deletes data)
docker-compose down -v && docker-compose up -d

# View logs
docker-compose logs -f

# Remove stuck containers
docker rm -f bubblelab-postgres bubblelab-api bubblelab-nginx
```
