/**
 * pdfcrop Web Application
 * Main application entry point
 */

import init, {
    cropPdf,
    getPageCount,
    detectBbox,
    getPageDimensions,
    WasmCropOptions,
    WasmBoundingBox
} from '../pkg/pdfcrop_web.js';

// Global state
let wasmModule = null;
let currentPDF = null;
let currentPage = 1;
let totalPages = 0;
let pageBboxes = new Map();  // page_num → {left, bottom, right, top}

/**
 * Initialize the application
 */
async function initialize() {
    console.log('Initializing pdfcrop web app...');

    try {
        // Initialize WASM module
        wasmModule = await init();
        console.log('WASM module initialized successfully');

        // Set up event listeners
        setupEventListeners();

        console.log('Application ready!');
    } catch (error) {
        console.error('Failed to initialize application:', error);
        alert('Failed to initialize the application. Please refresh the page.');
    }
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
    // File upload
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const browseButton = document.getElementById('browse-button');

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-primary-500', 'bg-primary-50/50');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('border-primary-500', 'bg-primary-50/50');
    });

    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-primary-500', 'bg-primary-50/50');

        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type === 'application/pdf') {
            await handleFileUpload(files[0]);
        } else {
            alert('Please drop a PDF file');
        }
    });

    // Click to browse
    dropZone.addEventListener('click', () => fileInput.click());
    browseButton.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            await handleFileUpload(e.target.files[0]);
        }
    });

    // Margin controls
    const uniformMargin = document.getElementById('uniform-margin');
    const marginLeft = document.getElementById('margin-left');
    const marginRight = document.getElementById('margin-right');
    const marginTop = document.getElementById('margin-top');
    const marginBottom = document.getElementById('margin-bottom');

    uniformMargin.addEventListener('input', (e) => {
        const value = e.target.value;
        document.getElementById('uniform-margin-value').textContent = value;
        marginLeft.value = value;
        marginRight.value = value;
        marginTop.value = value;
        marginBottom.value = value;
    });

    // Preset buttons
    document.querySelectorAll('.preset-button').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.dataset.preset;
            applyPreset(preset);
        });
    });

    // Page range select
    const pageRangeSelect = document.getElementById('page-range-select');
    const customRangeInput = document.getElementById('custom-range-input');

    pageRangeSelect.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
            customRangeInput.classList.remove('hidden');
        } else {
            customRangeInput.classList.add('hidden');
        }
    });

    // Crop button
    document.getElementById('crop-button').addEventListener('click', handleCrop);

    // Auto-detect button
    document.getElementById('auto-detect-button').addEventListener('click', handleAutoDetect);

    // Page navigation
    document.getElementById('prev-page').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderPage(currentPage);
        }
    });

    document.getElementById('next-page').addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderPage(currentPage);
        }
    });

    // Reset button
    document.getElementById('reset-crop').addEventListener('click', () => {
        pageBboxes.clear();
        renderPage(currentPage);
    });
}

/**
 * Handle file upload
 */
async function handleFileUpload(file) {
    console.log('Loading PDF:', file.name);
    showLoading('Loading PDF...');

    try {
        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Get page count
        totalPages = await getPageCount(uint8Array);
        console.log('PDF loaded. Total pages:', totalPages);

        // Store PDF data
        currentPDF = uint8Array;
        currentPage = 1;
        pageBboxes.clear();

        // Update UI
        document.getElementById('total-pages').textContent = totalPages;
        document.getElementById('current-page').textContent = currentPage;

        // Show application section
        document.getElementById('upload-section').classList.add('hidden');
        document.getElementById('app-section').classList.remove('hidden');

        // Render first page
        await renderPage(currentPage);

        hideLoading();
    } catch (error) {
        console.error('Error loading PDF:', error);
        alert('Failed to load PDF: ' + error.message);
        hideLoading();
    }
}

/**
 * Render a PDF page (placeholder - will use PDF.js in Phase 3)
 */
async function renderPage(pageNum) {
    console.log('Rendering page:', pageNum);
    // This will be implemented with PDF.js in Phase 3
    // For now, just update the page number
    document.getElementById('current-page').textContent = pageNum;
}

/**
 * Handle auto-detect bbox
 */
async function handleAutoDetect() {
    if (!currentPDF) return;

    showLoading('Detecting crop region...');

    try {
        const bbox = await detectBbox(currentPDF, currentPage - 1);  // 0-indexed
        console.log('Detected bbox:', bbox);

        // Display detected bbox
        const bboxDisplay = document.getElementById('detected-bbox');
        bboxDisplay.innerHTML = `
            Left: ${bbox.left.toFixed(2)}<br>
            Bottom: ${bbox.bottom.toFixed(2)}<br>
            Right: ${bbox.right.toFixed(2)}<br>
            Top: ${bbox.top.toFixed(2)}<br>
            Size: ${bbox.width.toFixed(2)} × ${bbox.height.toFixed(2)} pt
        `;
        bboxDisplay.classList.remove('hidden');

        // Store bbox for this page
        pageBboxes.set(currentPage - 1, {
            left: bbox.left,
            bottom: bbox.bottom,
            right: bbox.right,
            top: bbox.top
        });

        hideLoading();
    } catch (error) {
        console.error('Error detecting bbox:', error);
        alert('Failed to detect crop region: ' + error.message);
        hideLoading();
    }
}

/**
 * Handle crop operation
 */
async function handleCrop() {
    if (!currentPDF) return;

    showLoading('Cropping PDF...');

    try {
        // Build options
        const options = new WasmCropOptions();

        // Set margins
        const ml = parseFloat(document.getElementById('margin-left').value) || 0;
        const mt = parseFloat(document.getElementById('margin-top').value) || 0;
        const mr = parseFloat(document.getElementById('margin-right').value) || 0;
        const mb = parseFloat(document.getElementById('margin-bottom').value) || 0;
        options.setMargins(ml, mt, mr, mb);

        // Set options
        options.setShrinkToContent(document.getElementById('shrink-to-content').checked);
        options.setClipContent(document.getElementById('clip-content').checked);

        // Convert page bboxes Map to Object
        const bboxesObject = pageBboxes.size > 0
            ? Object.fromEntries(pageBboxes)
            : null;

        // Get page range
        const pageRange = getPageRange();

        // Crop PDF
        const croppedPDF = await cropPdf(currentPDF, options, bboxesObject, pageRange);
        console.log('PDF cropped successfully. Size:', croppedPDF.length, 'bytes');

        // Download the result
        downloadPDF(croppedPDF, 'cropped.pdf');

        hideLoading();
    } catch (error) {
        console.error('Error cropping PDF:', error);
        alert('Failed to crop PDF: ' + error.message);
        hideLoading();
    }
}

/**
 * Get page range based on selection
 */
function getPageRange() {
    const select = document.getElementById('page-range-select');
    const value = select.value;

    if (value === 'all') {
        return null;  // Crop all pages
    } else if (value === 'current') {
        return [currentPage - 1];  // Current page only (0-indexed)
    } else if (value === 'custom') {
        const text = document.getElementById('page-range-text').value;
        // Parse range like "1-5, 8, 10-12" into array of page numbers (0-indexed)
        const pages = parsePageRange(text);
        return pages.length > 0 ? pages : null;
    }

    return null;
}

/**
 * Parse page range string into array of page numbers
 * Example: "1-5, 8, 10-12" → [0, 1, 2, 3, 4, 7, 9, 10, 11]
 */
function parsePageRange(text) {
    const pages = new Set();
    const parts = text.split(',').map(s => s.trim());

    for (const part of parts) {
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(s => parseInt(s.trim()));
            for (let i = start; i <= end; i++) {
                pages.add(i - 1);  // Convert to 0-indexed
            }
        } else {
            const page = parseInt(part);
            if (!isNaN(page)) {
                pages.add(page - 1);  // Convert to 0-indexed
            }
        }
    }

    return Array.from(pages).sort((a, b) => a - b);
}

/**
 * Apply preset margins
 */
function applyPreset(preset) {
    const presets = {
        tight: 0,
        standard: 5,
        generous: 10,
        custom: null
    };

    const value = presets[preset];
    if (value !== null) {
        document.getElementById('uniform-margin').value = value;
        document.getElementById('uniform-margin-value').textContent = value;
        document.getElementById('margin-left').value = value;
        document.getElementById('margin-right').value = value;
        document.getElementById('margin-top').value = value;
        document.getElementById('margin-bottom').value = value;
    }
}

/**
 * Download PDF file
 */
function downloadPDF(uint8Array, filename) {
    const blob = new Blob([uint8Array], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Show loading overlay
 */
function showLoading(message = 'Processing...') {
    document.getElementById('loading-message').textContent = message;
    document.getElementById('loading-overlay').classList.remove('hidden');
}

/**
 * Hide loading overlay
 */
function hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
}

// Initialize application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}
