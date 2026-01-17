# 🚀 AntiGravity

**AI-Powered Video Editor** — On-device, privacy-first video editing with intelligent automation.

![AntiGravity](https://img.shields.io/badge/AntiGravity-AI%20Video%20Editor-blue?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6.4-646CFF?style=flat-square&logo=vite&logoColor=white)

---

## ✨ Features

- **🎬 Drag & Drop Upload** — Import MP4, MOV, WebM, and AVI files
- **🧠 AI-Powered Analysis** — TensorFlow.js vision analysis runs entirely in-browser
- **🔒 Privacy-First** — All processing happens locally; your videos never leave your device
- **⚡ WebAssembly Composition** — FFmpeg.wasm for fast, native-like video rendering
- **🤖 Agentic Brain** — Claude-powered decision engine for intelligent editing suggestions

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **Vite** | Lightning-fast dev server & build tool |
| **TypeScript** | Type-safe development |
| **FFmpeg.wasm** | Video encoding/decoding in WebAssembly |
| **TensorFlow.js** | On-device ML for frame analysis |
| **Anthropic SDK** | AI-powered editing suggestions |
| **IndexedDB (idb)** | Local storage for projects |

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The app will be available at **http://localhost:5173/**

---

## 📁 Project Structure

```
src/
├── main.ts                 # Application entry point
├── domain/
│   ├── models/             # Data models & types
│   └── logic/              # Business logic
├── services/
│   ├── AgenticBrain.ts     # AI decision engine
│   ├── VisionAnalyst.ts    # TensorFlow.js frame analysis
│   ├── CompositionService.ts # FFmpeg.wasm video composition
│   └── VideoIngestService.ts # Video import & processing
└── ui/
    ├── Dashboard.ts        # Main UI component
    └── styles/             # CSS styles
```

---

## 🧠 Architecture

### Core Services

1. **VideoIngestService** — Handles video file imports, extracts metadata, and prepares frames for analysis

2. **VisionAnalyst** — Uses TensorFlow.js to analyze video frames, detect scenes, and identify key moments

3. **AgenticBrain** — The AI decision engine that suggests edits, cuts, and enhancements based on analysis

4. **CompositionService** — Renders the final video using FFmpeg.wasm, applying effects and transitions

---

## 🔧 Configuration

Create a `.env` file for API keys (optional for AI features):

```env
VITE_ANTHROPIC_API_KEY=your_api_key_here
```

---

## 📝 License

MIT © Daniel Castillo

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/DanielSensual">DanielSensual</a>
</p>
