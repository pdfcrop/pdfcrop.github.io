# Setup Guide for pdfcrop Web App

## Prerequisites

1. **Rust** (1.86+) - https://rustup.rs
2. **Trunk** - `cargo install trunk`
3. **Node.js & npm** - https://nodejs.org
4. **Git** - https://git-scm.com

## Initial Setup (One-time)

### 1. Set up this directory as a Git repository

This directory needs to be its own Git repository that will be linked as a submodule to the main pdfcrop repo.

```bash
cd examples/pdfcrop.github.io

# Initialize git repo (if not already done)
git init

# Add remote (replace with your actual repo URL)
git remote add origin https://github.com/pdfcrop/pdfcrop.github.io.git

# Add all files
git add .

# Create initial commit
git commit -m "Initial web app structure

- Cargo.toml for WASM compilation
- Trunk.toml for build configuration
- Tailwind CSS setup
- Complete HTML/CSS structure
- JavaScript foundation with WASM integration
- Privacy-first design with no server uploads"

# Push to remote
git push -u origin main
```

### 2. Add as submodule to main pdfcrop repo

From the **parent directory** (pdfcrop root):

```bash
cd ../..  # Back to pdfcrop root

# Remove the examples/pdfcrop.github.io directory first
rm -rf examples/pdfcrop.github.io

# Add as submodule
git submodule add https://github.com/pdfcrop/pdfcrop.github.io.git examples/pdfcrop.github.io

# Commit the submodule addition
git add .gitmodules examples/pdfcrop.github.io
git commit -m "Add pdfcrop.github.io web app as submodule"
```

## Development Setup

### 1. Install dependencies

```bash
cd examples/pdfcrop.github.io

# Install Tailwind CSS
npm install

# Install WASM target (if not already installed)
rustup target add wasm32-unknown-unknown
```

### 2. Build WASM module

```bash
# Development build
trunk build

# Or production build
trunk build --release
```

### 3. Run development server

```bash
# Start dev server with hot reload
trunk serve --open

# Or specify port
trunk serve --port 8080 --open
```

Visit `http://localhost:8080` in your browser.

## Testing

### Test WASM compilation

```bash
# Test that WASM builds successfully
cargo build --target wasm32-unknown-unknown --lib --no-default-features
```

### Test in different browsers

- ✅ Chrome/Chromium
- ✅ Firefox
- ✅ Safari (important for WASM compatibility)
- ✅ Edge

## Deployment to GitHub Pages

### Option 1: Manual deployment

```bash
# Build for production with correct public URL
trunk build --release --public-url /

# The dist/ folder can be deployed to GitHub Pages
# You can push dist/ to gh-pages branch:
git subtree push --prefix dist origin gh-pages
```

### Option 2: GitHub Actions (Recommended)

Create `.github/workflows/deploy.yml` in the web app repo:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Rust
        uses: actions-rust-lang/setup-rust-toolchain@v1
        with:
          toolchain: stable
          target: wasm32-unknown-unknown

      - name: Install Trunk
        uses: jetli/trunk-action@v0.4.0
        with:
          version: 'latest'

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Build
        run: trunk build --release --public-url /

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: $\{{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

## Browser Compatibility Notes

### Safari

Safari has excellent WASM support but requires special consideration:

1. **SharedArrayBuffer**: Requires Cross-Origin-Isolation headers
   - Use `coi-serviceworker.js` polyfill for GitHub Pages
   - Or disable parallel processing (use sequential WASM)

2. **PDF.js**: Use version 4.0+ which has full Safari support

3. **Testing**: Always test on actual Safari (not just WebKit)

### CORS Issues

If you encounter CORS issues during development:

```bash
# Trunk handles this automatically, but if needed:
trunk serve --address 0.0.0.0 --port 8080
```

## Project Structure

```
pdfcrop.github.io/
├── Cargo.toml           # WASM build config
├── Trunk.toml           # Trunk build config
├── package.json         # Tailwind dependencies
├── tailwind.config.js   # Tailwind configuration
├── input.css            # Tailwind directives
├── index.html           # Main HTML
├── src/
│   └── lib.rs          # Re-exports pdfcrop WASM bindings
├── js/
│   ├── app.js          # Main application (DONE)
│   ├── pdf-viewer.js   # PDF.js integration (TODO: Phase 3)
│   ├── bbox-overlay.js # Canvas overlay (TODO: Phase 4)
│   ├── worker.js       # Web Worker (TODO: Phase 5)
│   └── utils.js        # Utilities (TODO: Phase 3-4)
├── dist/               # Build output (gitignored)
├── README.md           # Project documentation
├── SETUP.md            # This file
└── TODO.md             # Implementation phases

## Troubleshooting

### WASM build fails

```bash
# Clean and rebuild
cargo clean
trunk clean
trunk build
```

### Tailwind CSS not updating

```bash
# Rebuild Tailwind manually
npx tailwindcss -i ./input.css -o ./dist/app.css --watch
```

### "Module not found" errors

Make sure you've built the WASM module first:
```bash
trunk build
```

### Safari WASM errors

Check that you're using sequential processing (no SharedArrayBuffer):
```bash
cargo build --target wasm32-unknown-unknown --lib --no-default-features --release
```

## Next Steps

1. Complete Phase 3: PDF.js integration
2. Complete Phase 4: Interactive bbox selection
3. Complete Phase 5: Web Worker for processing
4. Deploy to GitHub Pages
5. Test across all browsers

## Resources

- [Trunk Documentation](https://trunkrs.dev)
- [wasm-bindgen Book](https://rustwasm.github.io/wasm-bindgen/)
- [PDF.js Documentation](https://mozilla.github.io/pdf.js/)
- [Tailwind CSS](https://tailwindcss.com/docs)
