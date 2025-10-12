
# Real-Time Canvas for TouchDesigner 🎨

A high-performance web application optimized for real-time drawing and streaming to TouchDesigner via WebSocket. Features vector-based drawing with intelligent throttling and automatic reconnection.

## ✨ Features

- **Vector-based Drawing**: Optimized for TouchDesigner with minimal bandwidth usage
- **Real-time Streaming**: Low-latency WebSocket communication
- **Auto-reconnection**: Robust connection handling with exponential backoff
- **AI Integration**: Send prompts directly to TouchDesigner for AI-assisted drawing
- **Performance Optimized**: Intelligent throttling and compression
- **Responsive Design**: Works on desktop and mobile devices

## 🚀 Quick Start

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser to `http://localhost:3000`

4. Connect to TouchDesigner via WebSocket at `ws://localhost:3000/ws`

## 📡 TouchDesigner Integration

The application sends vector data optimized for TouchDesigner:

```javascript
// Stroke data format
{
  type: 'stroke',
  payload: {
    points: [{x: 100, y: 200}, {x: 150, y: 250}],
    color: '#FF0000',
    brushSize: 10,
    timestamp: 1234567890
  }
}

// AI Prompt format
{
  type: 'prompt',
  payload: {
    prompt: 'A vibrant landscape',
    timestamp: 1234567890
  }
}
```

## ⚙️ Configuration

The app includes optimized settings for TouchDesigner:

- **Max Points per Stroke**: 500 (configurable)
- **Send Frequency**: 16ms (~60fps)
- **Auto-reconnection**: 5 attempts with exponential backoff
- **Compression**: Vector data for minimal bandwidth

## 🛠️ Development

```bash
# Build for production
npm run build

# Start production server
npm start

# View server stats
curl http://localhost:3000/api/stats
```

## 📊 Performance Monitoring

The server provides real-time statistics at `/api/stats`:
- Connected clients
- Total messages sent
- Memory usage
- Uptime

## 🔧 Technical Details

- **Frontend**: React 19 + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + WebSocket
- **Optimizations**: Vector drawing, intelligent throttling, auto-reconnection
- **TouchDesigner Protocol**: Custom optimized message format

View your app in:
