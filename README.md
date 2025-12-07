# OneSound - AI Music Studio

<div align="center">
  <img src="https://via.placeholder.com/100x100.png?text=OneSound" alt="OneSound Logo" width="100" />
  <h3>Redefine Your Sound.</h3>
  <p>An advanced AI-powered music production environment for remastering, composition, and vocal synthesis.</p>
</div>

---

## 🎵 Overview

**OneSound** is a Next-Gen Music Studio built for creators who want to leverage the power of Artificial Intelligence to enhance their workflow. Whether you are remastering a vintage track or generating a new lo-fi beat from scratch, OneSound provides the tools to make it happen in real-time.

## ✨ Core Features

*   **Original Music Creation**: Generate fully arranged tracks with lyrics, instruments, and specific moods using the Gemini API.
*   **Track Remastering**: Simulate high-end remastering effects (e.g., "Vintage Tape", "Modern Clarity") for your existing audio files.
*   **AI Vocal Synthesis**: Turn generated lyrics into spoken/sung audio with diverse voice profiles (Kore, Fenrir, Puck, Zephyr).
*   **Dynamic Visualizer**: Real-time FFT (Fast Fourier Transform) audio visualization.
*   **Cloud Library**: Save your productions securely to the cloud (powered by Supabase).
*   **Immersive Player**: A Spotify-like full-screen player experience with synchronized lyrics.

## 🛠 Tech Stack

*   **Frontend**: React 18, Vite, TypeScript
*   **Styling**: Tailwind CSS, Lucide React (Icons)
*   **AI Engine**: Google GenAI SDK (Gemini 2.5 Flash, Gemini 3 Pro Vision)
*   **Backend / Storage**: Supabase (Database & Storage buckets)
*   **Auth**: Google One Tap (OAuth)

## 🚀 Getting Started

### Prerequisites

1.  **Node.js**: Version 18+
2.  **Google API Key**: Enable Gemini API access.
3.  **Supabase Project**: Create a project with `tracks` table and storage buckets (`audio`, `covers`).

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/onesound.git
    cd onesound
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Set up environment variables:
    Create a `.env` file in the root directory:
    ```env
    API_KEY=your_google_gemini_api_key
    ```
    *Note: Supabase keys are currently located in `constants.ts` for this demo build.*

4.  Run the development server:
    ```bash
    npm run dev
    ```

## 📂 Project Structure

```
/src
  ├── components/    # UI Components (Player, Sidebar, Visualizer)
  ├── hooks/         # Custom React Hooks (useAudioPlayer, useLibrary)
  ├── services/      # API Integrations (Gemini, Supabase)
  ├── utils/         # Helper functions (Audio decoding, formatting)
  ├── types.ts       # TypeScript interfaces
  └── App.tsx        # Main Entry Point
```

## 🔒 License

Private Software. Copyright © 2025 John Wesley Quintero.

> "Let's build, brother."
