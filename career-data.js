// Career timeline: the single source for the years-of-experience figure.
// Add a role here when it changes. Months are 1-12; end: null means "present".
// Used in the browser by script.js and at edit time by scripts/sync-years.js.

const careerRoles = [
  { title: "Software Programmer", start: { year: 2020, month: 1 }, end: { year: 2021, month: 9 } },
  { title: "Software Engineer I", start: { year: 2022, month: 5 }, end: null }
];

// Whole years actually worked (gaps between roles are not counted), rounded down.
function careerYears(now = new Date()) {
  let months = 0;
  for (const role of careerRoles) {
    const end = role.end || { year: now.getFullYear(), month: now.getMonth() + 1 };
    // Inclusive of both the start and end month.
    months += (end.year - role.start.year) * 12 + (end.month - role.start.month) + 1;
  }
  return Math.floor(months / 12);
}

if (typeof module !== "undefined") module.exports = { careerRoles, careerYears };
