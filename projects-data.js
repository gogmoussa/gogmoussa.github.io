// Portfolio Projects Dataset for George Moussa
// Data fetched and curated directly from github.com/gogmoussa

const projectsData = [
  {
    id: "documind",
    title: "DocuMind",
    badge: "Flagship / AI Engineering",
    category: "ai",
    tagline: "Architectural Intelligence & Visual Logic Mapping for Codebases",
    shortDescription: "Transforms complex, opaque codebases into interactive blueprints using AST-native static analysis (ts-morph) and LLM reasoning, eliminating architectural drift.",
    fullDescription: "In modern software engineering, architecture documents often drift the moment they are committed. DocuMind solves this by treating code as the living source of truth. By combining TypeScript AST parser analysis with LLM reasoning, it automatically maps dependencies, groups modules into hierarchical 'Zonal Folders', and surfaces architectural intent without manual diagrams.",
    tech: ["TypeScript", "ts-morph (AST)", "LLMs", "Node.js", "Data Flow Viz"],
    github: "https://github.com/gogmoussa/documind",
    liveDemo: null,
    metrics: "2 GitHub Stars · AST-Native · Zero-Stale Docs",
    highlights: [
      "Precision AST parsing via ts-morph instead of brittle regex tokenization",
      "Dynamic module grouping into hierarchical Zonal Folders for encapsulation",
      "Living blueprints that synchronize with every git commit to stop architectural drift"
    ],
    architecture: `AST Parsing (ts-morph) ──> Dependency Graph ──> LLM Contextualizer ──> Interactive Blueprint`
  },
  {
    id: "inner-compass",
    title: "Inner Compass",
    badge: "Mobile App",
    category: "mobile",
    tagline: "Mindful Reflection & Decision Assistant for Personal Growth",
    shortDescription: "A beautifully crafted React Native mobile app helping users develop consistent self-reflection through guided journaling, AI insights, and calm decision analysis.",
    fullDescription: "Inner Compass is built upon calm technology and self-determination principles. It provides gentle, guilt-free daily journaling prompts, weekly life-domain deep dives, and an AI-driven decision assistant designed to facilitate clarity rather than create addiction or anxiety.",
    tech: ["React Native", "Expo", "TypeScript", "AI Prompts", "Calm Design System"],
    github: "https://github.com/gogmoussa/Inner-Compass",
    liveDemo: null,
    metrics: "Cross-Platform · Offline-First · Adaptive Themes",
    highlights: [
      "Daily guided reflections and structured weekly life domain retrospectives",
      "AI-powered decision assistant providing objective reflection framing",
      "Fluid, calming design system with custom micro-interactions and dark/light adaptive palettes"
    ],
    architecture: `Expo Client ──> Local Storage Encrypted Store ──> AI Insight Engine ──> Reflection Timeline`
  },
  {
    id: "desktop-local-agent",
    title: "Desktop Local Agent",
    badge: "AI Systems",
    category: "ai",
    tagline: "Autonomous Local System Assistant & Interactive PowerShell Agent",
    shortDescription: "Python agent powered by local Ollama LLMs that translates natural language tasks into iterative PowerShell system execution with a rich terminal interface.",
    fullDescription: "A private, zero-telemetry desktop agent that gives users the power to delegate real OS administration and file management tasks to a local LLM. It interprets user goals, plans execution steps, executes PowerShell commands natively on Windows, and dynamically inspects results.",
    tech: ["Python", "Ollama", "PowerShell", "Rich CLI", "Local LLMs"],
    github: "https://github.com/gogmoussa/desktop_local_agent",
    liveDemo: null,
    metrics: "100% Local Inference · Multi-Model Support · Rich TUI",
    highlights: [
      "Completely offline AI processing utilizing locally hosted models via Ollama",
      "Multi-model switching (Llama, Mistral, Gemma, DeepSeek) with conversational memory",
      "Iterative command loop with output validation and safety boundary controls"
    ],
    architecture: `Natural Language Prompt ──> Local Ollama Engine ──> PowerShell Executor ──> TUI Rich Stream`
  },
  {
    id: "local-ai",
    title: "Local AI Companion",
    badge: "Full-Stack AI",
    category: "ai",
    tagline: "Private Desktop AI Assistant with Streaming Backend & Vector Memory",
    shortDescription: "Full-stack on-device AI assistant combining a high-performance FastAPI streaming backend with a modern React + Vite dark interface and vector memory.",
    fullDescription: "Built for privacy-conscious developers who refuse to send sensitive personal data or proprietary code to cloud providers. It pairs a low-latency FastAPI server interfacing directly with Ollama, streamed responses via Server-Sent Events, and long-term context retention using ChromaDB vector store.",
    tech: ["FastAPI", "React", "Vite", "Ollama", "ChromaDB", "Python", "Tailwind CSS"],
    github: "https://github.com/gogmoussa/Local_AI",
    liveDemo: null,
    metrics: "Zero Cloud Dependencies · Sub-100ms Local Latency · SSE Streams",
    highlights: [
      "Zero cloud exfiltration: prompt tokens and weights remain strictly on the local workstation",
      "Asynchronous streaming tokens via FastAPI endpoints to a responsive React front-end",
      "Long-term contextual recall pipeline integrated with local vector embeddings"
    ],
    architecture: `React/Vite UI ──(SSE Stream)──> FastAPI Async Backend ──> Local Ollama + ChromaDB`
  },
  {
    id: "your-north-star",
    title: "Your North Star",
    badge: "Calm Web App",
    category: "web",
    tagline: "Calm Personal Alignment System & 12-Week Focus Engine",
    shortDescription: "Browser-based focus tool grounded in Self-Determination Theory. Zero notification badges, 12-week goal execution, and 100% offline-first privacy.",
    fullDescription: "Created to combat modern productivity app burnout. Your North Star features a minimalist 'Golden Hour' aesthetic, encourages a single 12-week objective with measurable key results, limits weekly commitments to three high-impact priorities, and stores all user data locally.",
    tech: ["React", "Vite", "Custom Design Tokens", "LocalStorage", "Calm Tech"],
    github: "https://github.com/gogmoussa/YourNorthStar",
    liveDemo: null,
    metrics: "100% Offline Capable · Zero Ad/Tracking · Zero Guilt",
    highlights: [
      "Vision definition module compressing aspirational goals into a single North Star anchor",
      "Strict 3-priority weekly limit to maximize cognitive clarity and execution quality",
      "Client-side local storage engine ensuring absolute personal privacy"
    ],
    architecture: `Client App (React + Vite) ──> LocalStorage Engine ──> Zero Server Calls`
  },
  {
    id: "video-generation",
    title: "AI Story Video Generator",
    badge: "Generative AI",
    category: "ai",
    tagline: "Local Cinematic Storytelling & Automated Video Pipeline",
    shortDescription: "End-to-end generative pipeline running on consumer GPUs: scripts stories via Ollama, generates visual frames with SD-Turbo, synthesizes audio, and stitches video.",
    fullDescription: "An automated multimedia engine that transforms a high-level concept into a produced cinematic short. Using Ollama for scriptwriting, Diffusers (SD-Turbo) with CUDA hardware acceleration for scene art, local TTS for narration, and MoviePy with Ken Burns pan/zoom effects.",
    tech: ["Python", "diffusers (SD-Turbo)", "CUDA", "Ollama", "MoviePy", "pyttsx3"],
    github: "https://github.com/gogmoussa/video_generation",
    liveDemo: null,
    metrics: "Local GPU Accelerated · Automated Editing · Ken Burns FX",
    highlights: [
      "Autonomous 4-stage pipeline: Narrative Scripting ➔ Diffusion Art ➔ Voiceover ➔ Render",
      "CUDA-optimized SD-Turbo inference producing keyframe art in under 2 seconds per frame",
      "Cinematic post-production rendering with dynamic camera pans, vignettes, and lower-thirds"
    ],
    architecture: `Story Prompt ──> Ollama Script ──> SD-Turbo Frames ──> Audio + FX Video Render`
  },
  {
    id: "energy-predictions",
    title: "Energy Consumption Predictions",
    badge: "Machine Learning",
    category: "data",
    tagline: "Temporal Time-Series Forecasting with PyTorch LSTM Networks",
    shortDescription: "Data science and deep learning project modeling power grid demand fluctuations using recurrent Long Short-Term Memory (LSTM) networks in PyTorch.",
    fullDescription: "A machine learning exploration into seasonal and hourly electricity consumption patterns. Implemented an end-to-end data processing and modeling pipeline featuring sequence windowing, data normalization, training loop optimization, and loss visualization.",
    tech: ["PyTorch", "Python", "LSTMs", "Pandas", "NumPy", "Matplotlib"],
    github: "https://github.com/gogmoussa/EnergyConsumptionPredictions",
    liveDemo: null,
    metrics: "PyTorch 2.x · 2-Layer LSTM · Temporal Validation",
    highlights: [
      "Engineered multi-step sliding window sequences for temporal feature extraction",
      "Implemented custom 2-layer LSTM recurrent architecture with Dropout regularization",
      "Comprehensive visualization comparing model inference trajectories against actual grid load"
    ],
    architecture: `Raw Time Series ──> Normalization & Windowing ──> 2-Layer LSTM ──> Evaluation Curves`
  },
  {
    id: "reddit-scrapper",
    title: "Reddit Pain-Point Miner",
    badge: "NLP & Data Mining",
    category: "data",
    tagline: "Unsupervised Topic Modeling & Voice-of-Customer Intelligence",
    shortDescription: "Collects organic discussions around market niches, clusters complaints with BERTopic NLP, and visualizes market opportunities in a glassmorphic web dashboard.",
    fullDescription: "Designed to uncover unmet user needs and real market friction points. It scrapes target subreddit threads using Apify actors, embeds and clusters text using BERTopic transformers, and surfaces high-frequency complaint clusters in a modern web dashboard.",
    tech: ["Python", "BERTopic", "Apify", "Flask", "Chart.js", "Glassmorphic CSS"],
    github: "https://github.com/gogmoussa/personal-reddit-scrapper",
    liveDemo: null,
    metrics: "Unsupervised NLP · Persistent Cache · Interactive Charting",
    highlights: [
      "Automated extraction of organic discussions circumventing client-side rate limits",
      "Transformer-based semantic grouping of unstructured complaints into actionable themes",
      "Interactive Glassmorphic dashboard with frequency distribution graphs and raw text inspection"
    ],
    architecture: `Subreddit Threads ──> Apify Scraper ──> BERTopic NLP ──> Glassmorphic Dashboard`
  },
  {
    id: "maple-bridge",
    title: "Maple Bridge",
    badge: "Full-Stack Web",
    category: "web",
    tagline: "Newcomer Settlement Platform & Community Guide for Canada",
    shortDescription: "A full-stack web application designed to help newcomers to Canada navigate their transition smoothly with curated resources, tailored guides, and an AI assistant.",
    fullDescription: "Moving to a new country presents immense administrative, social, and logistical hurdles. Maple Bridge provides personalized onboarding pathways, curated government and community resources, an AI assistant for quick answers, and community connection portals.",
    tech: ["Flask", "Python", "JavaScript", "HTML5/CSS3", "RESTful APIs"],
    github: "https://github.com/gogmoussa/Maple-Bridge",
    liveDemo: null,
    metrics: "Social Impact · Rapid Prototype · Tailored Onboarding",
    highlights: [
      "Custom onboarding questionnaire delivering location-specific recommendations",
      "Integrated 24/7 AI chat assistance for newcomer settlement questions",
      "Clean modular backend with decoupled services for resources, community, and support"
    ],
    architecture: `Client Web Pages ──> Flask REST Service ──> Settlement Resource Directory`
  },
  {
    id: "kahoot-multiplayer",
    title: "Distributed Multiplayer Quiz Engine",
    badge: "Distributed Systems",
    category: "systems",
    tagline: "Concurrent Real-Time Client-Server Network Architecture",
    shortDescription: "High-concurrency C# .NET multiplayer quiz system featuring real-time socket communications, concurrent game state synchronization, and administrative host orchestration.",
    fullDescription: "Engineered a low-latency socket-based multiplayer platform inspired by Kahoot. Handles simultaneous client connections, real-time question distribution, sub-millisecond answer timestamping, and authoritative host server game loops.",
    tech: ["C#", ".NET", "TCP / Sockets", "Multi-threading", "Concurrent Systems"],
    github: "https://github.com/gogmoussa/Kahoot-Multiplayer",
    liveDemo: null,
    metrics: "Multi-threaded · Raw TCP Sockets · Custom Packet Protocol",
    highlights: [
      "Custom binary/string messaging protocol over raw TCP sockets",
      "Thread-safe connection pooling and concurrent player state management",
      "Decoupled administrator host console for controlling game pace and real-time scoreboards"
    ],
    architecture: `Multiple Game Clients ──(Raw TCP)──> Concurrent C# Socket Server ──> Host Console`
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = projectsData;
}
