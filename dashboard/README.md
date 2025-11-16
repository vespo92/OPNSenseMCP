# OPNsense MCP Dashboard

Real-time web dashboard for monitoring and managing the OPNsense MCP server.

## Features

- **Real-Time Event Stream** - Live SSE connection showing events as they happen
- **Plugin Management** - View, monitor, and manage all loaded plugins
- **System Monitoring** - Track system health, resource usage, and performance
- **Event Filtering** - Filter events by severity, type, plugin, and more
- **Data Export** - Export event logs to CSV
- **Responsive Design** - Works on desktop, tablet, and mobile

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- OPNsense MCP Server v2.0 running on port 3000

### Installation

```bash
cd dashboard
npm install
```

### Development

```bash
npm run dev
```

Dashboard will be available at http://localhost:5173

### Production Build

```bash
npm run build
npm run preview
```

## Architecture

Built with:
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **React Query** - Data fetching
- **Recharts** - Data visualization
- **Server-Sent Events** - Real-time updates

## Pages

### Dashboard (`/dashboard`)
- Overview of system health
- Plugin statistics
- Real-time event timeline
- Quick metrics

### Plugins (`/plugins`)
- List all plugins grouped by category
- Plugin health status
- Version information
- Quick actions

### Events (`/events`)
- Real-time event stream
- Filter by severity, type, plugin
- Export to CSV
- Detailed event inspection

### System Status (`/system`)
- Overall system health
- Plugin health breakdown
- Resource usage (CPU, memory)
- Uptime tracking

## SSE Integration

The dashboard connects to the following SSE endpoints:

- `/sse/events` - All events
- `/sse/events/firewall` - Firewall events only
- `/sse/events/vpn` - VPN events only
- `/sse/events/security` - Security events only

### Custom Filters

```javascript
// Filter by severity
/sse/events?severity=error&severity=critical

// Filter by plugin
/sse/events?plugins=core-firewall&plugins=vpn-openvpn

// Filter by type
/sse/events?types=firewall.rule.created
```

## API Endpoints Used

- `GET /api/plugins` - List all plugins
- `GET /api/plugins/{id}` - Get plugin details
- `GET /api/plugins/{id}/health` - Check plugin health
- `GET /api/events/history` - Get event history
- `GET /api/events/stats` - Get event statistics
- `GET /api/system/status` - Get system status
- `GET /api/system/stats` - Get system statistics

## Configuration

The dashboard proxies API requests to the MCP server. Update `vite.config.ts` if your server runs on a different port:

```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // Change this
        changeOrigin: true,
      },
    },
  },
});
```

## Development

### Project Structure

```
dashboard/
├── src/
│   ├── components/     # Reusable components
│   ├── pages/          # Page components
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utility functions
│   ├── types/          # TypeScript types
│   ├── App.tsx         # Main app component
│   └── main.tsx        # Entry point
├── public/             # Static assets
└── index.html          # HTML template
```

### Adding a New Page

1. Create page component in `src/pages/`
2. Add route in `src/App.tsx`
3. Add navigation link in `src/components/Layout.tsx`

### Custom Hooks

- `useSSE(url, filter)` - Subscribe to SSE events
- React Query hooks for API data fetching

## Deployment

### Static Hosting

Build and deploy the `dist/` folder to any static host:

```bash
npm run build
# Deploy dist/ folder
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY dashboard/package*.json ./
RUN npm ci
COPY dashboard/ ./
RUN npm run build
EXPOSE 5173
CMD ["npm", "run", "preview"]
```

### Nginx

```nginx
server {
    listen 80;
    server_name dashboard.example.com;

    root /var/www/dashboard/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3000;
    }

    location /sse {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
    }
}
```

## Troubleshooting

### SSE Connection Issues

- Ensure MCP server is running on port 3000
- Check CORS configuration in server
- Verify firewall allows connections

### Events Not Showing

- Check browser console for errors
- Verify SSE endpoint is accessible
- Check server logs for issues

### API Errors

- Verify proxy configuration in `vite.config.ts`
- Check MCP server is responding on `/api/*` endpoints
- Review browser network tab for failed requests

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md)

## License

MIT
