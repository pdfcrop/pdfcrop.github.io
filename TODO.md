# TODO: Implementation Phases

## ✅ Phase 1: WASM Foundation (COMPLETED)
- [x] WASM compilation working
- [x] Per-page bbox support in API
- [x] Page range selection in API
- [x] WASM bindings created

## ✅ Phase 2: Project Structure (COMPLETED)
- [x] Git submodule setup (files created, needs git commands)
- [x] Cargo.toml configuration
- [x] Trunk.toml build configuration
- [x] Tailwind CSS setup
- [x] index.html with full UI structure
- [x] Basic app.js with WASM integration

## 📋 Phase 3: PDF Viewer & Upload (NEXT)
- [ ] Integrate PDF.js library properly
- [ ] Implement PDF rendering to canvas
- [ ] Generate page thumbnails
- [ ] Implement page navigation
- [ ] Add zoom controls
- [ ] Canvas coordinate conversion utilities

## 📋 Phase 4: Interactive Bbox Selection
- [ ] Implement bbox-overlay.js for canvas drawing
- [ ] Mouse event handlers for rectangle selection
- [ ] Visual feedback during selection
- [ ] Convert canvas coords ↔ PDF points
- [ ] Display auto-detected bbox as outline
- [ ] Per-page bbox storage and display

## 📋 Phase 5: Processing & Download
- [ ] Web Worker setup for WASM (worker.js)
- [ ] Progress indicator during processing
- [ ] Error handling and user feedback
- [ ] Before/after comparison view
- [ ] File size comparison display

## 📋 Phase 6: Polish & UX
- [ ] Mobile responsive design
- [ ] Keyboard shortcuts
- [ ] Help tooltips
- [ ] Examples/demo PDFs
- [ ] Safari-specific testing
- [ ] Accessibility improvements

## 📋 Phase 7: Deployment
- [ ] GitHub Actions CI/CD
- [ ] Deploy to GitHub Pages
- [ ] Configure custom domain (optional)
- [ ] Add coi-serviceworker.js for SharedArrayBuffer
- [ ] Performance testing
- [ ] Documentation

## Current Status
Phase 2 is complete. All foundational files are in place. The web app can:
- Load and display the UI
- Handle file uploads
- Call WASM functions (cropPdf, detectBbox, etc.)
- Download cropped PDFs

**Next step**: Phase 3 - Integrate PDF.js for actual PDF viewing in canvas.
