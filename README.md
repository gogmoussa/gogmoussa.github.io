# gogmoussa.github.io

Personal site for George Moussa: portfolio, experience, projects and writing.

Live at **https://gogmoussa.github.io/**

## How it's built

Hand-written HTML, CSS and plain JavaScript. There is no framework, bundler or build step. GitHub Pages serves the `main` branch as is, and `.nojekyll` stops it from running Jekyll. Every push to `main` goes live within a minute or two.

Page views are counted with [GoatCounter](https://gogmoussa.goatcounter.com/).

## Files

```text
index.html              Home page: hero, about, experience, featured work, writing, projects, stack, contact
blog.html               Writing index, rendered from blog-data.js
404.html                Not-found page
articles/               One standalone HTML page per article (articles/index.html redirects to blog.html)

styles.css              All styles for every page
script.js               Home page behaviour: project grid and filters, project modal, terminal, counters
nav.js                  Shared navigation for blog.html and 404.html

career-data.js          Job start and end dates; the one place the years-of-experience figure comes from
projects-data.js        Project cards and modal content shown on the home page
blog-data.js            Article list and content shown on blog.html

campfire-night/         Campfire Night, the browser game (a build, not edited here; see below)

assets/profile.jpg      Profile photo
assets/favicon.svg      Site icon

llms.txt                Plain-text summary of the site for AI assistants and crawlers
sitemap.xml, robots.txt Search engine files
googleac1396fc70c1a97a.html  Google Search Console ownership check (keep it)
scripts/sync-years.js   Updates the years figure in places that can't run JavaScript
```

## Common edits

**Add or change a project.** Edit `projects-data.js`. Each entry has a `category` that drives the filter buttons on the home page.

**Publish an article.** Add the page under `articles/`, add an entry to `blog-data.js`, and add its URL to `sitemap.xml`. If it should appear on the home page, update the writing section in `index.html` too.

**Change jobs or the years of experience.** Edit `career-data.js`. The figure is the time actually worked across all roles, rounded down, so gaps between jobs don't count. In the browser, `script.js` fills in the stat counter and every `<span data-years>` on the home page. Meta tags, structured data and `llms.txt` can't run JavaScript, so after changing dates (or about once a year as the number ticks over) run:

```bash
node scripts/sync-years.js
```

It rewrites every "N+ years" in `index.html` and `llms.txt` to match, then commit the result.

**Update Campfire Night.** The game is built (and minified) in the private `polymath-lab` repo. Don't edit `campfire-night/` by hand: from the lab, run `projects/inner_work_3d/tools/package_camp.sh <this repo>/campfire-night`, delete the `campfire-night.zip` it leaves next to the folder, and commit. Its card is `campfire-night` in `projects-data.js`.

## Preview locally

Any static file server works. From the repo root:

```bash
python -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` directly works too, but `404.html` uses root-relative paths that only resolve through a server.
