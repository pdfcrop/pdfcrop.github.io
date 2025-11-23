# pdfcrop Web App

A WebAssembly-powered PDF cropping tool that runs entirely in your browser. No server uploads, 100% private and secure.

> **Note**: This web app lives in the `examples/pdfcrop.github.io/` directory of the main [pdfcrop](https://github.com/pdfcrop/pdfcrop) Rust project. The build instructions assume this directory structure.

## Features

- 🔒 **100% Private** - All processing happens in your browser via WebAssembly
- 📄 **PDF Viewer** - View and navigate PDFs with zoom and page thumbnails
- ✂️ **Auto-detect** - Automatically detect content boundaries using rendering
- 🎯 **Manual Selection** - Draw custom crop regions per page
- 📏 **Flexible Margins** - Adjust margins (uniform or per-side)
- 📑 **Page Range** - Crop all, odd, even, or custom page ranges
- ⚡ **Fast** - Powered by Rust + WASM
- 🌐 **Works Offline** - No internet required after initial load

## Quick Start

```bash
# Build WASM (from parent directory)
cd ../..
cargo install wasm-pack
wasm-pack build --target web --release --out-dir examples/pdfcrop.github.io/pkg

# Return to web app directory
cd examples/pdfcrop.github.io

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

Visit `http://localhost:8080` to use the app.

## How It Works

1. **Upload PDF** - Drag and drop or select a PDF file
2. **Auto-detect** - Automatically detects content boundaries
3. **Adjust** - Fine-tune margins or draw custom crop regions
4. **Select Pages** - Choose which pages to crop
5. **Download** - Get your cropped PDF instantly

## Architecture

- **Frontend**: TypeScript + Tailwind CSS
- **PDF Rendering**: PDF.js
- **PDF Processing**: Rust `pdfcrop` library compiled to WASM
- **Build Tool**: Vite

## Privacy & Security

Your PDF **never leaves your device**. All processing happens locally in your browser using WebAssembly. No server uploads, no tracking, no data collection.

## Development

```bash
# Development server with hot reload
npm run dev

# Rebuild WASM (after Rust changes)
cd ../.. && wasm-pack build --target web --release --out-dir examples/pdfcrop.github.io/pkg && cd -

# Build for production
npm run build

# Preview production build
npm run preview

# Format code
npm run format
```

## License

MIT OR Apache-2.0
