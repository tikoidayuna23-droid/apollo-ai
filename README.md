# APOLLO — PHASE 1

## JARVIS-Style Voice AI Agent

**Apollo Phase 1 — JARVIS-Style Voice Foundation**

Apollo is a personal AI assistant built with a voice-first architecture designed to operate as a central intelligent computer assistant for PC/laptop environments.

---

## 🌟 Key Architecture & Phase 1 Capabilities

- **Futuristic Central Core**: Visual state engine with reactive orbital rings, glowing pulse animations, audio waveforms, and state transitions (`IDLE`, `LISTENING`, `THINKING`, `USING_TOOL`, `SPEAKING`, `ERROR`).
- **Unified Agent Pipeline**: Dual voice and text interaction pathways connecting directly into the central `ApolloAgent` loop.
- **Provider Abstraction Layer**: Pluggable AI Model Provider architecture powered server-side by Google Gemini (`gemini-3.7-flash` via `@google/genai`).
- **Tool Registry**:
  - `calculator`: Safe mathematical evaluator executing arithmetic and scientific functions without unrestricted `eval()`.
  - `save_memory`: Explicit persistence of user facts, project names, and preferences.
  - `search_memory`: Memory retrieval and relevance query engine.
- **Persistent Long-Term Memory & Sessions**: Local storage persistence for conversations and remembered user context.
- **Voice Manager & Synthesis**:
  - Speech recognition with real-time interim transcript preview.
  - Natural speech synthesis with pitch, rate, and volume controls.
  - Future `WakeWordProvider` abstraction ready.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Motion, Lucide Icons
- **Backend / API**: Node.js, Express, `@google/genai` TypeScript SDK
- **Speech APIs**: Browser Web Speech API (`SpeechRecognition` & `SpeechSynthesis`)

---

## 🚀 Running Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure Gemini API Key**:
   Set `GEMINI_API_KEY` in `.env` or in the environment:
   ```env
   GEMINI_API_KEY="your_api_key_here"
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in a modern Chromium-based browser (Chrome, Edge, Brave) for full Web Speech API compatibility.

---

## 🎙️ Browser Voice Support

- **Speech Recognition**: Supported natively in Chromium-based browsers (Google Chrome, Microsoft Edge, Brave). In other browsers or when permissions are denied, text input remains fully functional.
- **Speech Synthesis**: Broadly supported across Chrome, Safari, Firefox, and Edge.

---

## 🧭 Future Roadmap (Phase 2+)

- Wake-word background activation ("Hey Apollo")
- Advanced local speech recognition models
- High-fidelity neural TTS voices
- Autonomous web research & grounding
- File & document inspection
- System automation and application launching
- MCP (Model Context Protocol) tool support
