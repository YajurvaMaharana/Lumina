<div align="center">

# ✨ Lumina

### Premium Animated & Interactive Journaling & Productivity Dashboard

*A zero-knowledge, privacy-first AI journaling and productivity dashboard designed for developers, traders, and high-performance professionals. It merges high-end motion design, fluid WebGL graphics, and intelligent agentic workflows with uncompromising security.*

---

</div>

## 🚀 Key Features & Architecture

### 1. Zero-Knowledge Client-Side Encryption
* **Browser-Native Cryptography**: Utilizes the Web Crypto API with **AES-256-GCM** encryption and **PBKDF2** key derivation (250,000–600,000 iterations of SHA-256).
* **True Zero-Knowledge**: All journal text is fully encrypted locally in the browser before transmission. The backend never sees plaintext data or your master passphrase.

### 2. Immersive Visual & Motion Design
* **Dynamic Aurora Background**: Built using `ogl` (WebGL) with custom color-stops, amplitude, and blend controls, supporting both deep dark-mode aesthetics and custom light-mode adjustments.
* **Startup Splash Animation**: Features a synchronized transition where the central **Neural Orbit logo** and **"Lumina"** typography smoothly scale and slide into the header bar on boot.
* **Expanding Rounded Navigation**: Minimalist, icon-only header navigation that gracefully expands on interaction to display feature names for seamless routing across modules.

### 3. Comprehensive Feature Suite
* **Autonomous Mentorship & AI Sync**: Socratic reflection prompts, multi-persona AI switching (Empathetic Friend, Analytical Coach, Neutral Listener), and full conversation context tracking.
* **Trading Psychology & BTC/USD Price Overlay**: Real-time bias detection (FOMO, revenge trading, loss aversion) paired with live market context tracking.
* **Cognitive State & Performance Sync**: Daily streak tracking with flame indicators, longitudinal mood/emotional valence charts, and performance tracking.
* **Exportable Audit Trail & Data Portability**: Secure client-side export options allowing users to generate PDF, JSON, or Markdown records of their decrypted logs.

## 🛠️ Tech Stack

* **Frontend**: React, Vite, Tailwind CSS, Lucide Icons, Chart.js / Recharts
* **Graphics & Motion**: WebGL (`ogl`) for the Aurora background canvas
* **Security**: Web Crypto API (`CryptoSubtle`, AES-GCM, PBKDF2)
* **AI Integration**: Google Gemini API for real-time prompt generation, emotional valence detection, and cognitive analysis

## 💻 Local Development & Setup

### Prerequisites
* **Node.js**: v18+ recommended
* **Package Manager**: `npm` or `yarn`

## 🚀 Installation & Setup

Get Lumina up and running locally in under 2 minutes. Follow these simple steps:

### 1. Clone the Repository
```bash
git clone [https://github.com/your-username/lumina-journal.git](https://github.com/your-username/lumina-journal.git)
cd lumina-journal
```bash
gcloud run services update ai-journal \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```
2. Install Dependencies
Make sure you have Node.js (v18+) installed, then run:
npm install

3. Configure Environment Variables
Create a .env file in the root directory of your project and add your Google Gemini API key:
VITE_GEMINI_API_KEY=your_gemini_api_key_here

4. Run the Development Server
Start the local Vite dev server:
npm run dev

5. Access the Dashboard
Open your web browser and navigate to:
👉 http://localhost:3000

## ☁️ Deployment Guide (Cloud Run)

Deploying Lumina to Google Cloud Run ensures enterprise-grade hosting with auto-scaling and serverless reliability. 

### 1. Build the Production Bundle
Compile your React application for production:
```bash
npm run build
````

2. Containerize with Docker
Ensure your project contains a standard Dockerfile, then build and submit the container image to Google Artifact Registry / Container Registry:
gcloud builds submit --tag gcr.io/your-project-id/lumina-journal

3. Deploy to Cloud Run
Deploy the containerized service to your preferred region (e.g., us-central1):
gcloud run deploy lumina-journal \
  --image gcr.io/your-project-id/lumina-journal \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars VITE_GEMINI_API_KEY=your_gemini_api_key_here

4. Verify Live Endpoint
Once deployment completes, Cloud Run will output a secure public URL (e.g., https://lumina-journal-xyz-uc.a.run.app). Open this link in your browser to experience the live production deployment.
