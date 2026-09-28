# GitHub Pages Deployment

Version: 0.1  
Date: 2026-09-28

## 1. Target

Primary development/public-demo URL:

```text
https://edisontw.github.io/Claw-Chaos/
```

Repository:

```text
edisontw/Claw-Chaos
```

GitHub Pages is a static hosting target. The browser build must therefore contain all client-side game logic and static assets.

A future backend, multiplayer server, user account service, telemetry service, or authoritative economy would require a separate service.

---

## 2. Why use GitHub Actions

Claw Chaos is expected to use Vite and requires a build step.

Use:

```text
Settings
→ Pages
→ Build and deployment
→ Source
→ GitHub Actions
```

Do not use a raw `docs/` branch deployment for the final game build.

---

## 3. Required Vite base path

Because this is a project Pages site rather than the root `edisontw.github.io` repository, production assets must use:

```text
/Claw-Chaos/
```

Example `vite.config.ts`:

```ts
import { defineConfig } from "vite";

export default defineConfig({
  base: "/Claw-Chaos/",
});
```

This is critical for:
- JS chunks,
- CSS,
- textures,
- models,
- audio,
- WebAssembly files.

Avoid hand-written root-relative runtime paths such as:

```text
/assets/model.glb
```

Prefer:
- Vite imports,
- `new URL(..., import.meta.url)`,
- or paths constructed from the configured base URL.

If the project later moves to a custom domain served at domain root, the production base can become `/`.

---

## 4. Required package scripts

Initial `package.json` should provide at least:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

Recommended later:

```json
{
  "scripts": {
    "lint": "...",
    "test": "...",
    "build": "vite build"
  }
}
```

The workflow can run lint/tests before deployment.

Commit `package-lock.json` so CI can use `npm ci`.

---

## 5. Local production-path test

Before enabling Pages:

```bash
npm ci
npm run build
npm run preview
```

With `base: "/Claw-Chaos/"`, verify the production build at the path shown by Vite, typically equivalent to:

```text
http://localhost:4173/Claw-Chaos/
```

Confirm that:
- JavaScript loads,
- Rapier/physics WASM loads,
- models load,
- textures load,
- audio loads,
- no `404` appears for `/assets`.

---

## 6. GitHub Pages workflow

Create after M00 has a working Vite application:

```text
.github/workflows/deploy-pages.yml
```

Recommended workflow:

```yaml
name: Deploy Claw Chaos to GitHub Pages

on:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v7

      - name: Setup Node
        uses: actions/setup-node@v7
        with:
          node-version: "lts/*"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint --if-present

      - name: Test
        run: npm run test --if-present

      - name: Setup Pages
        uses: actions/configure-pages@v6

      - name: Build
        run: npm run build

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v5
        with:
          path: "./dist"

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}

    permissions:
      pages: write
      id-token: write

    runs-on: ubuntu-latest
    needs: build

    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v5
```

Use the current official action versions when the workflow is actually introduced; re-check GitHub/Vite documentation if significant time has passed.

---

## 7. GitHub repository settings

After the Vite scaffold and workflow are committed:

1. Open the repository.
2. Go to **Settings**.
3. Open **Pages** under Code and automation.
4. Under **Build and deployment**, set **Source** to **GitHub Actions**.
5. Save if prompted.
6. Go to **Actions**.
7. Open the Pages deployment workflow.
8. Run manually once with **Run workflow**, or push a commit to `main`.
9. Wait for both `build` and `deploy` jobs to pass.
10. Open the deployment URL shown in the `github-pages` environment.

Expected default URL:

```text
https://edisontw.github.io/Claw-Chaos/
```

---

## 8. Branch policy

Recommended:
- `main` = deployable source of truth,
- feature work via branches/PRs when changes become larger,
- GitHub Pages deploy only from `main`.

Do not deploy arbitrary experimental branches to the production Pages URL.

A separate preview service can be introduced later if preview deployments become useful.

---

## 9. SPA routing

GitHub Pages serves static files and does not provide an arbitrary server-side SPA fallback.

For the initial game:
- prefer one entry page,
- use query parameters or hash routing for debug/test scenes if needed.

Examples:

```text
/Claw-Chaos/?scene=calibration-empty-swing
/Claw-Chaos/#challenge/bridge-01
```

Avoid relying on a direct route such as:

```text
/Claw-Chaos/challenge/bridge-01
```

unless a compatible Pages 404/fallback strategy is intentionally implemented.

---

## 10. WebAssembly

Rapier/WASM is suitable for static hosting.

Initial recommendation:
- use the normal single-threaded browser/WASM path,
- do not depend on SharedArrayBuffer/multithreaded WASM for the baseline GitHub Pages build.

Reason:
- advanced browser threading may require COOP/COEP response headers,
- GitHub Pages does not provide general-purpose custom response-header configuration.

If multithreaded physics becomes necessary, reassess hosting architecture rather than compromising deployment reliability.

---

## 11. Large 3D assets

GitHub Pages currently has a published-site size limit, so content must remain disciplined.

For the web demo:
- use GLB/glTF,
- use mesh compression where supported,
- use WebP/AVIF/KTX2/Basis-style texture compression where practical,
- stream/lazy-load nonessential content,
- avoid shipping every future arcade/prize asset in the first bundle,
- use compressed audio,
- reuse materials and geometry.

Recommended design goal:
- keep the public demo far below the Pages maximum rather than treating the limit as a budget.

If the project eventually needs a very large asset library:
- move large downloadable content to another CDN/object store,
- keep GitHub Pages as the shell/demo,
- or move the full build to more suitable hosting.

---

## 12. GitHub Pages service limits to remember

As of the 2026-09-28 documentation review, GitHub documents:
- recommended Pages source repository size around 1 GB,
- published Pages site maximum 1 GB,
- deployment timeout at 10 minutes,
- soft bandwidth limit around 100 GB/month.

These are external service limits and may change.

Re-check official GitHub documentation before a major public release.

---

## 13. Caching and versioning

Vite hashes production JS/CSS asset filenames, which helps cache busting.

For manually loaded game assets:
- prefer versioned or hashed asset filenames/manifests,
- avoid reusing the same URL for incompatible binary content when browser caching may persist,
- include build/config version in diagnostic UI.

A stale browser cache must be considered when diagnosing "new main but old asset" reports.

---

## 14. Loading screen

A realistic 3D simulator may take time to initialize.

The web build should include:
- immediate lightweight HTML/CSS loading state,
- staged loading progress,
- clear error if WebGL/WebGPU initialization fails,
- clear error if physics WASM fails,
- retry/reload path.

Do not leave a blank canvas while tens of megabytes load.

---

## 15. Browser target

Use the Vite production browser target as baseline and document any stricter requirements introduced by:
- rendering engine,
- WebGPU,
- WASM,
- texture compression.

The first Pages demo should have a WebGL-compatible path unless the team deliberately decides otherwise.

WebGPU may be an enhancement, not the only rendering path during early development.

---

## 16. Deployment smoke test

Every production deployment should verify:

1. site returns successfully,
2. main JS/CSS load,
3. WASM loads,
4. base path is correct,
5. first physics scene initializes,
6. keyboard/mouse input works,
7. audio can start after user gesture,
8. browser console has no fatal 404/CORS/runtime error,
9. reload at the main project URL still works,
10. build version/commit can be identified.

These are also tracked in `docs/ACCEPTANCE_TESTS.md`.

---

## 17. Current repository state

As of 2026-09-28:
- M00 Vite/TypeScript/Three.js/Rapier scaffold is complete,
- production base is `/Claw-Chaos/`,
- `.github/workflows/deploy-pages.yml` is active,
- repository Pages source is GitHub Actions,
- the first production deployment completed successfully,
- pushes to `main` now run the Pages build/deploy workflow.

Current public target:

```text
https://edisontw.github.io/Claw-Chaos/
```

The deployment workflow runs install, lint, tests and production build before publishing `dist/`. Keep experimental branch work off the production Pages URL until merged to `main`.

## 18. Official references

- GitHub Pages overview: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- GitHub Pages custom workflows: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- GitHub Pages limits: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- Vite static deployment / GitHub Pages: https://vite.dev/guide/static-deploy
