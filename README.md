# pdfcrop Web App

A WebAssembly-powered PDF cropping tool that runs entirely in your browser. No server uploads, 100% private and secure.

## Features

- 🔒 **100% Private** - All processing happens in your browser via WebAssembly
- 📄 **PDF Viewer** - View and navigate your PDF with PDF.js
- ✂️ **Auto-detect** - Automatically detect content boundaries
- 🎯 **Manual Selection** - Draw custom crop regions per page
- 📏 **Flexible Margins** - Adjust margins with precision
- 📑 **Page Range** - Crop specific pages or ranges
- ⚡ **Fast** - Parallel processing powered by Rust + WASM
- 🌐 **Browser Support** - Works on Chrome, Firefox, Safari, Edge

## Quick Start

```bash
# Install dependencies
npm install

# Install Trunk (WASM build tool)
cargo install trunk

# Run development server
trunk serve

# Build for production
trunk build --release
```

Visit `http://localhost:8080` to use the app.

## How It Works

1. **Upload PDF** - Drag and drop or select a PDF file
2. **Review Auto-detect** - See automatically detected crop regions
3. **Adjust** - Fine-tune margins or draw custom regions
4. **Select Pages** - Choose which pages to crop
5. **Download** - Get your cropped PDF instantly

## Architecture

- **Frontend**: Vanilla JS + Tailwind CSS
- **PDF Rendering**: PDF.js (Mozilla)
- **WASM Backend**: Rust `pdfcrop` library
- **Build Tool**: Trunk

## Privacy & Security

Your PDF **never leaves your device**. All processing happens locally in your browser using WebAssembly. No server uploads, no tracking, no data collection.

## Development

```bash
# Watch mode with hot reload
trunk serve --open

# Build optimized WASM
trunk build --release --public-url /pdfcrop/

# Run tests
cargo test

# Check WASM compatibility
cargo build --target wasm32-unknown-unknown --lib --no-default-features
```

## Deployment

This app is deployed to GitHub Pages at [pdfcrop.github.io](https://pdfcrop.github.io).

### Deploy Command
```bash
trunk build --release --public-url /pdfcrop/
# Push dist/ to gh-pages branch
```

## Browser Compatibility

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ Full | Including parallel processing |
| Firefox | ✅ Full | Including parallel processing |
| Safari | ✅ Full | Sequential processing (parallel optional) |
| Edge | ✅ Full | Including parallel processing |

## License

MIT OR Apache-2.0
