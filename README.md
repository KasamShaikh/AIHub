# AIHub — Showcase

A clean, shareable showcase of AI accelerators (proofs of concept) built on Azure.
Designed for managers, leadership and customers — each accelerator card shows a short
description, the tech stack, business impact / ROI, and links to the GitHub repo
(Star / Fork) where available.

It is a **zero-build static site** (plain HTML/CSS/JS) — ideal for **GitHub Pages**.

## Project structure

```
Accelerator/
├─ index.html                 # Page: hero, search/filter, card grid, detail modal, footer
├─ .nojekyll                  # Tells GitHub Pages to serve files as-is (no Jekyll)
├─ README.md                  # This file
└─ assets/
   ├─ css/styles.css          # Azure-inspired theme (light + dark)
   ├─ js/app.js               # Renders cards from data, search/filter, modal, theme toggle
   ├─ img/favicon.svg         # Site icon
   └─ data/projects.json      # ← Single place to edit all accelerators
```

## Add or edit an accelerator

Everything is driven by [`assets/data/projects.json`](assets/data/projects.json).
Add an object to the array:

```jsonc
{
  "id": "my-accelerator",            // unique slug
  "name": "My Accelerator",
  "tagline": "One-line pitch.",
  "icon": "shield",                  // shield | trending | mail | scan | mic | wand
  "accent": "fintech",               // fraud | fintech | ops | doc | voice | mlops (banner gradient)
  "domain": "Domain shown as badge & filter chip",
  "description": "A short paragraph for the detail view.",
  "techStack": ["Azure OpenAI", "FastAPI", "React"],
  "roi": ["Impact bullet 1", "Impact bullet 2"],
  "repoUrl": "https://github.com/USER/REPO",  // or null to hide GitHub/Star/Fork buttons
  "demoUrl": null                              // optional live demo URL (opens in new tab)
}
```

- Set `repoUrl` to `null` and the GitHub / Star / Fork buttons are hidden automatically.
- Set `demoUrl` to a URL to show an **Open demo** button in the detail view.
- `icon` and `accent` are optional-but-recommended; unknown values fall back gracefully.

## Run locally

Because the site fetches `projects.json`, serve it over HTTP (opening the file directly
will be blocked by the browser):

```powershell
cd Accelerator
python -m http.server 8000
# then open http://localhost:8000
```

## Deploy to GitHub Pages

1. Create a new GitHub repo and push the contents of this `Accelerator/` folder to it.
2. In the repo: **Settings → Pages**.
3. Under **Build and deployment**, set **Source = Deploy from a branch**,
   **Branch = `main`**, **Folder = `/ (root)`**, then **Save**.
4. Your site goes live at `https://<your-username>.github.io/<repo-name>/`.

The included `.nojekyll` file ensures all assets are served as-is.

---

Curated by **Kasam Shaikh** · Built on Azure AI.
