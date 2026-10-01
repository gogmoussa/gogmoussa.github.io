# George Moussa — Software Engineering Portfolio

> **Public-facing developer portfolio website engineered for high performance, zero build dependencies, and seamless GitHub Pages deployment.**

Live Deployment Target: **[https://gogmoussa.github.io/](https://gogmoussa.github.io/)**  
GitHub Profile: **[github.com/gogmoussa](https://github.com/gogmoussa)**  
LinkedIn: **[linkedin.com/in/gogmoussa](https://www.linkedin.com/in/gogmoussa/)**

---

## 🌟 Highlights & Features

- **Flagship Project Spotlights**: Deep dives into **DocuMind** (AST-native static analysis with `ts-morph` and LLMs) and **Inner Compass** (calm React Native reflection app).
- **Interactive REPL Terminal**: Live interactive terminal simulator showcasing engineering profiles, AST mapping outputs, local Ollama execution logs, and live GitHub stats.
- **Dynamic Project Filtering**: Filter across AI & Agents, Full-Stack Web, Mobile Apps, Data & ML, and Distributed Systems, with instantaneous keyword search.
- **Inspect Architecture Modals**: Detailed architectural breakdowns, data pipeline diagrams, and engineering challenges for each project.
- **Live GitHub Telemetry**: Real-time stats integration with GitHub REST API (`https://api.github.com/users/gogmoussa`) with baseline offline fallback.
- **Calm & Deep-Tech Aesthetic**: Obsidian dark theme (`#07090e`), electric cyan/indigo accents, glassmorphic cards, and responsive mobile-first navigation.
- **Zero Build Friction**: Pure modern HTML5, CSS3, and ES6 JavaScript. No bundling, Webpack, or npm build steps required to run or deploy.

---

## 📁 Repository Structure

```text
├── .nojekyll              # Prevents GitHub Pages from running Jekyll transformations
├── index.html             # Semantic, SEO-optimized markup & OpenGraph tags
├── styles.css             # High-craft CSS design system & glassmorphism
├── script.js              # Project rendering, filters, modal inspector, & terminal logic
├── projects-data.js       # Curated repository dataset with architecture specs
├── assets/
│   ├── avatar.jpg         # Profile photo
│   └── favicon.svg        # Custom vector brand mark
└── README.md              # Deployment guide & documentation
```

---

## 🚀 How to Deploy to GitHub Pages

You can publish this portfolio to the web in less than 2 minutes using either of the following two options:

### Option 1: Dedicated User Site (`https://gogmoussa.github.io/`) [Recommended]

1. Create a new public repository on GitHub named:
   ```text
   gogmoussa.github.io
   ```
2. In your terminal inside this folder (`c:\Projects\George's_Portfolio`), initialize git, commit, and push:
   ```bash
   git init
   git add .
   git commit -m "Initial portfolio release"
   git branch -M main
   git remote add origin https://github.com/gogmoussa/gogmoussa.github.io.git
   git push -u origin main
   ```
3. GitHub Pages automatically publishes repositories named `<username>.github.io` to the web! Within 1–2 minutes, your website is live at `https://gogmoussa.github.io/`.

---

### Option 2: Project Repository (e.g., `portfolio` or `george-portfolio`)

If you want to keep the repository named `portfolio`:
1. Push this folder to `https://github.com/gogmoussa/portfolio`
2. Go to your repository on GitHub: **Settings** ➔ **Pages**
3. Under **Branch**, select `main` and folder `/ (root)`
4. Click **Save**. Your site will be live at `https://gogmoussa.github.io/portfolio/`.

---

## 💻 Local Preview

You can preview the site locally anytime:
- Simply double-click `index.html` to open it in your default web browser, or
- Run a lightweight local HTTP server:
  ```bash
  # Python
  python -m http.server 8000
  ```
  Then navigate to `http://localhost:8000`.
