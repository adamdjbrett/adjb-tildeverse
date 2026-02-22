const { DateTime } = require("luxon");
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

function getCommandLines(command) {
  try {
    const output = execSync(command, {
      cwd: __dirname,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function getCreationDateIso() {
  const firstCommit = getCommandLines("git log --reverse --date=iso-strict --format=%ad -- .")[0];
  if (firstCommit) {
    const parsed = DateTime.fromISO(firstCommit, { zone: "utc" });
    if (parsed.isValid) {
      return parsed.toISO();
    }
  }

  const stats = fs.statSync(path.join(__dirname, "package.json"));
  return DateTime.fromJSDate(stats.birthtime, { zone: "utc" }).toISO();
}

function parseAuthorsAndContributors() {
  const lines = getCommandLines("git shortlog -sne --all");
  return lines
    .map((line) => line.replace(/^\d+\s+/, "").trim())
    .filter(Boolean);
}

function parseCoAuthors() {
  const lines = getCommandLines("git log --all --format=%B");
  const matches = lines
    .filter((line) => line.toLowerCase().startsWith("co-authored-by:"))
    .map((line) => line.replace(/^co-authored-by:\s*/i, "").trim())
    .filter(Boolean);
  return Array.from(new Set(matches));
}

module.exports = function (eleventyConfig) {
  const contributors = parseAuthorsAndContributors();
  const coAuthors = parseCoAuthors();
  const allPeople = Array.from(new Set([...contributors, ...coAuthors]));
  const eleventyPkgPath = path.join(__dirname, "node_modules", "@11ty", "eleventy", "package.json");
  const eleventyVersion = JSON.parse(fs.readFileSync(eleventyPkgPath, "utf8")).version;

  eleventyConfig.addPassthroughCopy({ "src/assets/css": "assets/css" });
  eleventyConfig.addPassthroughCopy({ "src/favicon.png": "favicon.png" });
  eleventyConfig.addPassthroughCopy({ "src/og-image.png": "og-image.png" });

  eleventyConfig.addFilter("readableDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("yyyy-LL-dd");
  });
  eleventyConfig.addFilter("ymd", (value) => {
    if (!value) return "";
    if (value instanceof Date) {
      return DateTime.fromJSDate(value, { zone: "utc" }).toFormat("yyyy-LL-dd");
    }
    return DateTime.fromISO(String(value), { zone: "utc" }).toFormat("yyyy-LL-dd");
  });

  eleventyConfig.addFilter("absoluteUrl", (path, base) => {
    if (!path) return base;
    return new URL(path, base).toString();
  });

  eleventyConfig.addShortcode("inlineCss", (filePath) => {
    const fullPath = path.join(__dirname, String(filePath));
    const css = fs.readFileSync(fullPath, "utf8");
    return `<style>${css}</style>`;
  });

  eleventyConfig.addGlobalData("build", {
    eleventyVersion,
    createdAt: getCreationDateIso(),
    deployedAt: DateTime.now().toUTC().toISO(),
  });
  eleventyConfig.addGlobalData("contributors", {
    authorsAndContributors: contributors,
    coAuthors,
    all: allPeople,
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site",
    },
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
};
