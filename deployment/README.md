# NodeX Deployment

Centralized deployment configuration for all NodeX applications using Docker Compose and Nginx.

## Quick Start

1. **Setup environment variables:**

   ```bash
   make env-setup
   # Edit .env file with your configuration
   ```

2. **Start services:**

   ```bash
   # Production mode
   make up

   # Development mode
   make dev
   ```

3. **View logs:**
   ```bash
   make logs
   ```

## Configuration

All configuration is managed through the `.env` file:

- `NODEX_API_PORT`: NodeX API internal port (default: 3001)
- `NGINX_PORT`: External nginx port (default: 80)
- `NODEX_API_URL`: Public URL for the API
- Database and credential configurations

## Railway Deployment

1. Connect your GitHub repo to Railway
2. Set the root directory to `/deployment`
3. Configure environment variables in Railway dashboard
4. Deploy!

Railway will automatically:

- Build the Docker image
- Use the configuration from `config/railway.json`
- Set up health checks
- Handle restarts

## Directory Structure

```
deployment/
├── nginx/                 # Nginx configuration
│   ├── nginx.conf        # Main nginx config
│   └── conf.d/           # Service-specific configs
├── config/               # Deployment configs
│   ├── railway.json      # Railway configuration
│   └── supervisord.conf  # Process manager config
├── docker-compose.yml    # Production compose file
├── docker-compose.dev.yml # Development overrides
├── Dockerfile           # Multi-stage production build
├── Makefile            # Convenience commands
└── .env.example        # Environment template
```

## Adding New Services

1. Add service to `docker-compose.yml`
2. Create nginx config in `nginx/conf.d/`
3. Update `Dockerfile` if needed
4. Add environment variables to `.env.example`

## Commands

- `make help` - Show all available commands
- `make build` - Build containers
- `make up` - Start production services
- `make dev` - Start development services
- `make logs` - View logs
- `make down` - Stop services
- `make clean` - Clean up volumes
