# Chiranjeet Banerjee - Portfolio Site

One-page portfolio with built-in CMS. Experience Design Lead and AI Strategist.

## Architecture

```
portfolio/
  index.html                    # Public portfolio (Caveat + DM Sans + JetBrains Mono)
  admin.html                    # Private CMS panel (password protected)
  site-content.json             # CMS-exported site content (auto-read by index.html)
  generate-manifest.sh          # Auto-generates manifest from .md files
  case-studies/
    manifest.json               # Case study index (metadata, images, links)
    *.md                        # Individual case study markdown files
  images/
    case-studies/               # Case study images (thumbnails, screenshots, etc.)
```

## Admin CMS (admin.html)

A self-contained, password-protected content management panel. No backend required.

### Features

| Feature | What it does |
|---|---|
| Dashboard | Stats overview, quick actions |
| Site Content | Edit hero, about, experience sections |
| Case Studies | Full CRUD: metadata, markdown editor with live preview, image linking |
| Images | Upload images, click to copy file paths for use in markdown |
| Figma integration | Link Figma file URLs and embed URLs per case study |
| Framer integration | Link Framer project URLs per case study |
| Google Docs import | Paste content or fetch from published URL, auto-convert to Markdown |
| Export | Download manifest.json, .md files, site-content.json, images |

### Default passphrase

`chiranjeet2026` (change in admin.html, line: `const ADMIN_PASSPHRASE = ...`)

### Workflow

1. Open `admin.html` in browser
2. Edit content, case studies, upload images
3. Use Export tab to download updated files
4. Replace files in project folder
5. Deploy

## How Case Studies Work

The site reads `case-studies/manifest.json` on load. Each entry supports:

```json
{
  "id": "project-slug",
  "title": "Project Title",
  "year": "2024",
  "type": "Product Design",
  "domain": "Fintech",
  "summary": "Short description",
  "tags": ["UX Design", "Research"],
  "thumbnail": "images/case-studies/project-thumb.jpg",
  "file": "case-studies/project-slug.md",
  "images": ["images/case-studies/img1.jpg", "images/case-studies/img2.png"],
  "links": {
    "figma": "https://figma.com/file/...",
    "figmaEmbed": "https://figma.com/embed?...",
    "framer": "https://framer.com/projects/...",
    "extra": [{"label": "Prototype", "url": "https://..."}]
  }
}
```

### Adding via CLI (without CMS)

1. Create `.md` file in `case-studies/`
2. Add images to `images/case-studies/`
3. Run `./generate-manifest.sh`

## Image Organization

```
images/
  case-studies/
    project-name-thumb.jpg      # Thumbnail (auto-detected by generate-manifest.sh)
    project-name-hero.jpg       # Hero image
    project-name-wireframe.png  # Process artifact
    project-name-final.jpg      # Final design
```

Reference in markdown: `![Description](images/case-studies/filename.jpg)`

## Tech Stack

- HTML/CSS/JS: Zero build step, single files
- Caveat (display), DM Sans (body), JetBrains Mono (code)
- marked.js (~40KB): Markdown rendering
- anime.js (~17KB): Scroll animations
- Total: ~46KB index.html + ~54KB admin.html

## SEO + AI Visibility

- JSON-LD (Person, ProfessionalService schemas)
- Open Graph + Twitter Card meta
- Semantic HTML5 with ARIA labels
- Content structured for LLM discovery

## Deployment

Static site. Deploy to Vercel, Netlify, GitHub Pages, or Cloudflare Pages.
Keep admin.html off public deployment, or add server-level auth.

## Accessibility

- WCAG AA contrast
- Keyboard navigation
- prefers-reduced-motion respected
- Semantic heading hierarchy
