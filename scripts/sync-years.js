#!/usr/bin/env node
// Rewrites the years-of-experience figure in files that can't run JavaScript
// (meta tags, JSON-LD, llms.txt) plus the no-JS fallback text in index.html.
// Usage: node scripts/sync-years.js   (from the repo root)

const fs = require("fs");
const path = require("path");
const { careerYears } = require("../career-data.js");

const root = path.join(__dirname, "..");
const years = careerYears();
const files = ["index.html", "llms.txt"];

for (const file of files) {
  const full = path.join(root, file);
  const before = fs.readFileSync(full, "utf8");
  const after = before
    // "6+ years" in prose, meta descriptions and structured data
    .replace(/\b\d+\+ years/g, `${years}+ years`)
    // the homepage stat counter's fallback value
    .replace(/data-count="\d+" id="stat-years">\d+</, `data-count="${years}" id="stat-years">${years}<`);
  if (after !== before) {
    fs.writeFileSync(full, after);
    console.log(`updated ${file}`);
  }
}
console.log(`years of experience: ${years}+`);
