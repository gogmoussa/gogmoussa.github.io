// Technical Blog Posts Dataset for George Moussa
// Human-written, candid engineering deep dives based on real project code and trade-offs.

const blogPosts = [
  {
    id: "why-ast-parsing-beats-regex",
    title: "Why I stopped using regex to understand TypeScript codebases",
    subtitle: "What building DocuMind taught me about architectural drift, ts-morph, and the limits of token search.",
    date: "March 2026",
    readTime: "7 min read",
    tags: ["TypeScript", "Compiler API", "ts-morph", "Architecture"],
    summary: "When codebases grow past 50,000 lines, documentation drifts almost immediately. I tried using grep and regex to map out module relationships, hit wall after wall with re-exports and barrel files, and ended up rewriting the pipeline around the TypeScript AST.",
    content: `
      <p>A few months ago, I was looking through a mid-sized codebase and trying to answer a deceptively simple question: <em>if I change this authentication hook, what services actually care?</em></p>

      <p>The project had an architecture document in the root directory. It had neat Mermaid diagrams and boxes showing service boundaries. But within ten minutes of digging through the code, I realized the diagram was completely fictional. Someone had refactored the auth layer three months earlier, added two middleware layers, and never touched the diagram. That was the moment I started working on <strong>DocuMind</strong>.</p>

      <h3>The naive approach: Regex and string scanning</h3>
      <p>My first attempt was quick and dirty: read every <code>.ts</code> and <code>.tsx</code> file, run a regex over <code>import ... from '...'</code> statements, and build a directed graph in memory.</p>
      
      <p>It worked on a small toy project with ten files. On a real repo, it fell apart within minutes:</p>
      <ul>
        <li><strong>Barrel files (<code>index.ts</code>):</strong> Re-exports like <code>export * from './auth'</code> completely hid the actual origins of functions.</li>
        <li><strong>Type-only imports:</strong> <code>import type { User }</code> was treated as a runtime dependency even though it disappears after compilation.</li>
        <li><strong>Path aliases:</strong> Aliases like <code>@/components/button</code> required custom config parsing just to resolve disk paths.</li>
        <li><strong>Dynamic imports:</strong> <code>await import(...)</code> calls were missed entirely.</li>
      </ul>

      <pre><code>// Regex thought this was a runtime coupling:
import type { SessionPayload } from '@/services/auth';

// But at runtime, this file never touches auth directly.
// A regex counter declared this a critical architectural link.</code></pre>

      <h3>Switching to AST static analysis with ts-morph</h3>
      <p>I ditched regex and rewrote the extraction engine using <code>ts-morph</code>, a TypeScript Compiler API wrapper. Instead of treating code as arbitrary strings, the tool analyzes the syntax tree exactly how the TypeScript compiler itself does.</p>

      <p>Suddenly, resolving an import was no longer a string guess:</p>

      <pre><code>import { Project } from 'ts-morph';

const project = new Project({ tsConfigFilePath: './tsconfig.json' });
const sourceFiles = project.getSourceFiles();

for (const file of sourceFiles) {
  for (const importDecl of file.getImportDeclarations()) {
    // 1. Ignore type-only imports for runtime dependency graphs
    if (importDecl.isTypeOnly()) continue;

    // 2. Resolve the exact target file on disk through the compiler
    const resolvedSourceFile = importDecl.getModuleSpecifierSourceFile();
    if (!resolvedSourceFile) continue;

    const targetPath = resolvedSourceFile.getFilePath();
    graph.addEdge(file.getFilePath(), targetPath);
  }
}</code></pre>

      <h3>Grouping modules into "Zonal Folders"</h3>
      <p>Having a graph of 300 nodes and 1,200 edges is almost as useless as having no documentation at all. It's just a hairball. You can't read it.</p>

      <p>The real breakthrough came when I implemented <strong>hierarchical grouping</strong>. Instead of drawing raw edges between individual files, DocuMind groups files by their highest common directory boundary (what I call "Zonal Folders"), collapses internal chatter, and only exposes public interface edges between zones.</p>

      <p>When you view the system, you first see 4 or 5 macro zones: <code>API Gateway</code>, <code>Core Services</code>, <code>Data Stores</code>, and <code>Client Shell</code>. You click into a zone, and it unpacks the internal files.</p>

      <h3>The takeaway</h3>
      <p>Source code is the only source of truth that never lies. If your architecture documentation requires a developer to remember to update a Markdown file or draw a diagram, it will fail. Automating the blueprint directly from the AST turned out to be the only reliable way to keep docs synchronized with code.</p>
    `
  },
  {
    id: "running-local-llms-on-windows",
    title: "Running a local AI agent on Windows without cloud telemetry",
    subtitle: "How I built Desktop Local Agent using Ollama, Python, and PowerShell without sending terminal data to the cloud.",
    date: "January 2026",
    readTime: "6 min read",
    tags: ["Python", "Ollama", "PowerShell", "Local AI", "Security"],
    summary: "Cloud-hosted AI coding assistants are great, but handing over your local file system and execution tokens to a remote server isn't always acceptable. Here is how I built an autonomous local terminal agent using Ollama and Python.",
    content: `
      <p>I use terminal tools constantly, and while cloud-based AI tools are capable, there are plenty of times where I want complete privacy. I don't want my directory structure, internal script names, or environment variable keys uploaded to a third-party server.</p>

      <p>That pushed me to build <strong>Desktop Local Agent</strong>: a Python tool running directly against a local Ollama instance on my machine, executing real PowerShell commands interactively.</p>

      <h3>Why local models are finally good enough for this</h3>
      <p>A year ago, running an agent locally on an 8GB or 12GB GPU resulted in sluggish responses or hallucinated command syntax. With modern quantized models like Llama 3 and DeepSeek via Ollama, local inference is fast enough to give you sub-second prompt evaluation.</p>

      <p>The setup is straightforward: Ollama runs as a background service on <code>http://localhost:11434</code>, and Python talks to it using its native client library:</p>

      <pre><code>import ollama

response = ollama.chat(
    model='llama3',
    messages=[
        {'role': 'system', 'content': SYSTEM_PROMPT},
        {'role': 'user', 'content': user_task}
    ]
)
command = response['message']['content']</code></pre>

      <h3>The hard part: Safe command execution on Windows</h3>
      <p>Giving an LLM permission to run shell commands is inherently dangerous. If the model hallucinates <code>Remove-Item -Recurse -Force C:\\</code>, you have a bad day.</p>

      <p>I added several layers of defensive design in the execution loop:</p>
      <ol>
        <li><strong>Strict Markdown / JSON Output Parsing:</strong> The prompt forces the LLM to output the command in a fenced block with an explicit intent explanation.</li>
        <li><strong>Blacklisted destructive patterns:</strong> Commands containing unconditional recursive deletes or volume manipulation are trapped before reaching the shell.</li>
        <li><strong>Interactive Human-in-the-Loop Confirmation:</strong> By default, the agent prints the proposed PowerShell command with syntax highlighting using the <code>rich</code> library and waits for confirmation before execution.</li>
      </ol>

      <pre><code>import subprocess

def execute_powershell(command: str) -> tuple[int, str, str]:
    # Run through powershell.exe with -NoProfile for clean execution
    process = subprocess.Popen(
        ["powershell", "-NoProfile", "-Command", command],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    stdout, stderr = process.communicate()
    return process.returncode, stdout, stderr</code></pre>

      <h3>Context preservation across steps</h3>
      <p>Most tasks aren't one-liners. For example, <em>"find all files modified today and compress them into a zip archive"</em> requires first listing files, inspecting the result, and then running the compression cmdlet.</p>

      <p>I structured the agent's memory as an iterative tape: the output of the first PowerShell run feeds back into the prompt history as a tool observation, allowing the model to correct itself if a path had spaces or a flag needed adjustment.</p>

      <h3>What I learned</h3>
      <p>You don't need a massive 70B cloud model to handle daily developer workflow automation. A lightweight 8B model running locally on your hardware gives you near-zero latency, works completely offline, and ensures your private system state never leaves your computer.</p>
    `
  },
  {
    id: "engineering-calm-technology",
    title: "The engineering behind 'Calm Tech': Building Inner Compass",
    subtitle: "Why streak counters and notification badges create anxiety, and how we engineered an offline-first journaling app in React Native.",
    date: "November 2025",
    readTime: "5 min read",
    tags: ["React Native", "Expo", "Calm Tech", "TypeScript", "UX"],
    summary: "Most modern mobile apps are designed to optimize daily active metrics through guilt and red badges. When building Inner Compass, we set out to build the exact opposite: an app grounded in Self-Determination Theory that respects user attention.",
    content: `
      <p>If you open almost any modern journaling or habit tracking app, you're immediately hit with the same playbook: a flaming streak badge warning you that your 14-day record is at risk, red notification dots, and push notifications guilt-tripping you at 9:00 PM.</p>

      <p>When I started designing <strong>Inner Compass</strong>, my goal was to see if we could build a productivity and reflection tool that treats human attention with respect. That required making deliberate engineering decisions from day one.</p>

      <h3>1. Eliminating the streak mechanic</h3>
      <p>Streak counters seem harmless, but psychology research on Self-Determination Theory shows they replace intrinsic motivation with extrinsic fear of loss. Miss one day due to an emergency, and the streak resets to zero, causing users to abandon the habit altogether.</p>

      <p>Instead of a streak counter, Inner Compass uses a <strong>gentle timeline rhythm</strong>. There is no counter telling you how many days in a row you logged. If you journal once this week, the app celebrates that single entry. If you miss three weeks, your previous entries are right where you left them with no red warning banners.</p>

      <h3>2. Offline-first local storage architecture</h3>
      <p>Personal journals contain vulnerable thoughts. Storing them on a remote database where an engineer could theoretically read them in a production database console felt wrong.</p>

      <p>We built Inner Compass with an <strong>offline-first local persistence model</strong> in React Native:</p>

      <pre><code>// Client-side encrypted store layer
export async function saveReflection(entry: ReflectionEntry): Promise<void> {
  const existing = await getReflections();
  const updated = [entry, ...existing];
  
  // Store directly on device flash storage
  await AsyncStorage.setItem('@inner_compass_reflections', JSON.stringify(updated));
}</code></pre>

      <p>Zero network requests are sent during normal usage. The user owns their data, and it works flawlessly on an airplane or without cellular signal.</p>

      <h3>3. Visual restraint and micro-interactions</h3>
      <p>In mobile UI design, it's tempting to use loud primary colors and bouncing modal alerts. For Inner Compass, we built a custom design system based on muted earthy tones (deep sage, warm slate, muted amber) and subtle spring physics.</p>

      <p>Using React Native's reanimated library, transitions feel organic rather than jarring:</p>

      <pre><code>// Gentle fade and scale transition
const animatedStyle = useAnimatedStyle(() => {
  return {
    opacity: withTiming(isFocused.value ? 1 : 0.7, { duration: 250 }),
    transform: [{ scale: withSpring(isFocused.value ? 1 : 0.98) }]
  };
});</code></pre>

      <h3>Conclusion</h3>
      <p>Building calm technology isn't just about UI colors; it's a structural commitment. It means saying no to analytics trackers that slow down boot times, saying no to streak databases, and prioritizing user mental space over vanity retention metrics.</p>
    `
  },
  {
    id: "local-video-generation-pipeline",
    title: "Chaining Ollama, SD-Turbo, and MoviePy on a consumer GPU",
    subtitle: "Overcoming VRAM bottlenecks and audio desync to generate cinematic videos entirely on a local machine.",
    date: "January 2026",
    readTime: "8 min read",
    tags: ["Generative AI", "Python", "diffusers", "CUDA", "MoviePy"],
    summary: "Cloud video generation APIs charge per second of footage. I wanted to see if I could automate a full script-to-video pipeline locally on a single consumer graphics card without running out of memory.",
    content: `
      <p>Generating videos with AI usually means signing up for third-party cloud APIs that quickly burn through credits. I wanted to see how far I could push a local machine running Python, CUDA, and open-source models.</p>

      <p>The result was <strong>AI Story Video Generator</strong>: an automated pipeline that takes a high-level topic (e.g., <em>"The discovery of deep-sea hydrothermal vents"</em>) and produces a finished, edited MP4 with narration, images, and camera movement.</p>

      <h3>The 4-stage local pipeline</h3>
      <ol>
        <li><strong>Script Generation:</strong> Ollama runs a local model to write a 4-scene narrative script, breaking it into visual image prompts and narration lines.</li>
        <li><strong>Image Synthesis:</strong> Stable Diffusion Turbo (via Hugging Face <code>diffusers</code>) generates 512x512 keyframes in 1 step per scene.</li>
        <li><strong>Speech Synthesis:</strong> Local TTS generates the spoken voice track and measures audio duration per scene.</li>
        <li><strong>Cinematic Assembly:</strong> MoviePy stitches the audio and images together, applying a subtle Ken Burns zoom and lower-third typography.</li>
      </ol>

      <h3>The VRAM bottleneck and the fix</h3>
      <p>Running both Ollama and a Stable Diffusion pipeline simultaneously on a graphics card with 8GB or 12GB of VRAM will easily cause an out-of-memory (OOM) crash if you are not careful.</p>

      <p>The solution was strict <strong>sequential memory unloading</strong>:</p>

      <pre><code>import torch
from diffusers import AutoPipelineForText2Image

def generate_scene_art(prompts: list[str]) -> list[str]:
    # 1. Load diffusion model into GPU memory
    pipe = AutoPipelineForText2Image.from_pretrained(
        "stabilityai/sd-turbo",
        torch_dtype=torch.float16,
        variant="fp16"
    ).to("cuda")

    image_paths = []
    for i, prompt in enumerate(prompts):
        image = pipe(prompt=prompt, num_inference_steps=1, guidance_scale=0.0).images[0]
        path = f"output/frame_{i}.png"
        image.save(path)
        image_paths.append(path)

    # 2. Crucial: Delete pipeline and flush PyTorch CUDA cache before audio/video stage
    del pipe
    torch.cuda.empty_cache()
    
    return image_paths</code></pre>

      <p>By forcing memory deallocation between stages, peak VRAM usage stays safely below 4.5 GB, allowing the system to run comfortably on standard gaming hardware.</p>

      <h3>Overcoming MoviePy audio sync on Windows</h3>
      <p>If you've ever used MoviePy on Windows, you've probably encountered subtle audio drift where narration finishes two seconds before or after the video clip ends.</p>

      <p>The issue stems from relying on video duration as the master clock. I inverted the architecture: <strong>audio duration is the source of truth</strong>. Each image clip's duration is set dynamically to match its corresponding voice clip duration plus an intentional 0.3-second buffer:</p>

      <pre><code>audio_clip = AudioFileClip(audio_path)
video_clip = ImageClip(image_path).set_duration(audio_clip.duration + 0.3)
video_clip = video_clip.set_audio(audio_clip)</code></pre>

      <h3>Final thoughts</h3>
      <p>Local generative tooling is reaching a tipping point. Being able to take a concept, generate the script, synthesize art in under 2 seconds per frame, and render a high-definition video without a single API key is remarkably empowering.</p>
    `
  },
  {
    id: "energy-forecasting-lstm-lessons",
    title: "Predicting energy grid load with PyTorch: What worked and what broke",
    subtitle: "Practical lessons in time-series forecasting, avoiding lookahead data leakage, and why simpler recurrent architectures often win.",
    date: "September 2025",
    readTime: "5 min read",
    tags: ["PyTorch", "Deep Learning", "Time Series", "Python", "Data Science"],
    summary: "Forecasting continuous power consumption sounds straightforward until you hit temporal leakage, normalization pitfalls, and hyperparameter instability. Here is what I learned building an LSTM forecasting pipeline from scratch.",
    content: `
      <p>Time-series forecasting is one of those machine learning subfields that looks easy in theory and constantly surprises you in practice. Unlike typical classification problems where you can shuffle data randomly into train and test sets, chronological data has strict time causality.</p>

      <p>In this project, I built an LSTM pipeline in PyTorch to forecast electricity demand using real grid consumption datasets.</p>

      <h3>The trap of naive normalization</h3>
      <p>The single biggest mistake people make in time-series modeling is <strong>lookahead data leakage</strong> during feature scaling.</p>

      <p>If you do this:</p>
      <pre><code># WRONG: Leaks future test distribution into the training set
scaler = MinMaxScaler()
all_data_scaled = scaler.fit_transform(raw_dataframe)
train = all_data_scaled[:split_idx]
test = all_data_scaled[split_idx:]</code></pre>

      <p>Your model will appear to achieve unrealistically low test loss, but it will fail in production because the scaler used the maximum value of the entire dataset (including unseen future peaks). You must always fit the scaler exclusively on training records:</p>

      <pre><code># CORRECT: Strict temporal boundary
scaler = MinMaxScaler()
train_scaled = scaler.fit_transform(raw_dataframe[:split_idx])
test_scaled = scaler.transform(raw_dataframe[split_idx:])</code></pre>

      <h3>Model architecture: 2-layer LSTM with Dropout</h3>
      <p>I experimented with deeper 4-layer architectures and multi-head attention mechanisms, but on this dataset, a clean 2-layer LSTM with 64 hidden units and 0.2 dropout performed best without overfitting:</p>

      <pre><code>import torch.nn as nn

class EnergyLSTM(nn.Module):
    def __init__(self, input_dim=1, hidden_dim=64, num_layers=2, output_dim=1):
        super(EnergyLSTM, self).__init__()
        self.lstm = nn.LSTM(
            input_dim, 
            hidden_dim, 
            num_layers, 
            batch_first=True, 
            dropout=0.2
        )
        self.fc = nn.Linear(hidden_dim, output_dim)

    def forward(self, x):
        out, _ = self.lstm(x)
        out = self.fc(out[:, -1, :])
        return out</code></pre>

      <h3>Core takeaway</h3>
      <p>In tabular and time-series engineering, data hygiene matters ten times more than model complexity. Preventing leakage, choosing proper lookback window sizes (e.g. 24-hour cycles for energy load), and verifying against simple rolling-mean baselines will teach you more than tuning learning rate schedules blindly.</p>
    `
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = blogPosts;
}
