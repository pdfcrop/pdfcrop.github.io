/**
 * pdfcrop Web Application
 * Main application entry point
 */

// Import styles
import '../../input.css';

import init, {
    cropPdf,
    getPageCount,
    detectBbox,
    getPageDimensions,
    WasmCropOptions,
    WasmBoundingBox,
    InitOutput
} from '../../pkg/pdfcrop';

import { PDFViewer, createPDFViewer } from './pdf-viewer';
import { BBoxOverlay, createBBoxOverlay } from './bbox-overlay';

// PDF Bounding Box interface
interface PDFBBox {
    left: number;
    bottom: number;
    right: number;
    top: number;
}

// Global state
let wasmModule: InitOutput | null = null;
let pdfViewer: PDFViewer | null = null;
let bboxOverlay: BBoxOverlay | null = null;
let currentPDFData: Uint8Array | null = null;  // Store PDF data as Uint8Array
let currentPDFFilename: string = 'document.pdf';  // Store original filename
let currentPage: number = 1;
let totalPages: number = 0;
let pageBboxes: Map<number, PDFBBox> = new Map();  // page_num → {left, bottom, right, top}
let clipHintTimeout: number | undefined;

/**
 * Initialize the application
 */
async function initialize() {
    console.log('Initializing pdfcrop web app...');

    try {
        // Initialize WASM module
        wasmModule = await init();
        console.log('WASM module initialized successfully');

        // Initialize PDF viewer
        pdfViewer = createPDFViewer('pdf-canvas', 'overlay-canvas');
        console.log('PDF viewer initialized');

        // Initialize BBox overlay with callbacks
        bboxOverlay = createBBoxOverlay('overlay-canvas', pdfViewer, {
            onBboxChange: (pdfBbox) => {
                // Update bbox display during drawing
                if (pdfBbox) {
                    updateBboxDisplay(pdfBbox);
                }
            },
            onBboxComplete: (pdfBbox) => {
                // Store bbox when drawing is complete
                if (pdfBbox) {
                    console.log('BBox selected:', pdfBbox);
                    pageBboxes.set(currentPage - 1, pdfBbox);
                    updateBboxDisplay(pdfBbox);
                    autoEnableClipMode();
                }
            }
        });
        console.log('BBox overlay initialized');

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
    const dropZone = document.getElementById('drop-zone') as HTMLDivElement;
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const browseButton = document.getElementById('browse-button') as HTMLButtonElement;

    if (!dropZone || !fileInput || !browseButton) {
        console.error('Required upload elements not found');
        return;
    }

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

        const files = e.dataTransfer?.files;
        if (files && files.length > 0 && files[0].type === 'application/pdf') {
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
        const target = e.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
            await handleFileUpload(target.files[0]);
        }
    });

    // Margin controls
    const uniformMargin = document.getElementById('uniform-margin') as HTMLInputElement;
    const marginLeft = document.getElementById('margin-left') as HTMLInputElement;
    const marginRight = document.getElementById('margin-right') as HTMLInputElement;
    const marginTop = document.getElementById('margin-top') as HTMLInputElement;
    const marginBottom = document.getElementById('margin-bottom') as HTMLInputElement;
    const uniformMarginValue = document.getElementById('uniform-margin-value') as HTMLSpanElement;

    if (uniformMargin && marginLeft && marginRight && marginTop && marginBottom && uniformMarginValue) {
        uniformMargin.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            const value = target.value;
            uniformMarginValue.textContent = value;
            marginLeft.value = value;
            marginRight.value = value;
            marginTop.value = value;
            marginBottom.value = value;
        });
    }

    // Preset buttons
    document.querySelectorAll('.preset-button').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = (btn as HTMLButtonElement).dataset.preset;
            if (preset) {
                applyPreset(preset);
            }
        });
    });

    // Page range select
    const pageRangeSelect = document.getElementById('page-range-select') as HTMLSelectElement;
    const customRangeInput = document.getElementById('custom-range-input') as HTMLDivElement;

    if (pageRangeSelect && customRangeInput) {
        pageRangeSelect.addEventListener('change', (e) => {
            const target = e.target as HTMLSelectElement;
            if (target.value === 'custom') {
                customRangeInput.classList.remove('hidden');
            } else {
                customRangeInput.classList.add('hidden');
            }
        });
    }

    // Crop button
    const cropButton = document.getElementById('crop-button') as HTMLButtonElement;
    if (cropButton) {
        cropButton.addEventListener('click', handleCrop);
    }

    // Auto-detect button
    const autoDetectButton = document.getElementById('auto-detect-button') as HTMLButtonElement;
    if (autoDetectButton) {
        autoDetectButton.addEventListener('click', handleAutoDetect);
    }

    // Page navigation
    const prevPageButton = document.getElementById('prev-page') as HTMLButtonElement;
    const nextPageButton = document.getElementById('next-page') as HTMLButtonElement;

    if (prevPageButton) {
        prevPageButton.addEventListener('click', async () => {
            if (pdfViewer && currentPage > 1) {
                await pdfViewer.previousPage();
            }
        });
    }

    if (nextPageButton) {
        nextPageButton.addEventListener('click', async () => {
            if (pdfViewer && currentPage < totalPages) {
                await pdfViewer.nextPage();
            }
        });
    }

    // Reset button
    const resetButton = document.getElementById('reset-crop') as HTMLButtonElement;
    if (resetButton) {
        resetButton.addEventListener('click', () => {
            pageBboxes.clear();
            if (bboxOverlay) {
                bboxOverlay.clear();
            }
            // Hide bbox display
            const bboxDisplay = document.getElementById('detected-bbox');
            if (bboxDisplay) {
                bboxDisplay.classList.add('hidden');
            }
        });
    }

    // Zoom controls
    const zoomInButton = document.getElementById('zoom-in') as HTMLButtonElement;
    const zoomOutButton = document.getElementById('zoom-out') as HTMLButtonElement;
    const zoomFitButton = document.getElementById('zoom-fit') as HTMLButtonElement;

    if (zoomInButton) {
        zoomInButton.addEventListener('click', async () => {
            if (pdfViewer) {
                await pdfViewer.zoomIn();
                updateZoomLevel();
            }
        });
    }

    if (zoomOutButton) {
        zoomOutButton.addEventListener('click', async () => {
            if (pdfViewer) {
                await pdfViewer.zoomOut();
                updateZoomLevel();
            }
        });
    }

    if (zoomFitButton) {
        zoomFitButton.addEventListener('click', async () => {
            if (pdfViewer) {
                await pdfViewer.fitToPage();
                updateZoomLevel();
            }
        });
    }
}

/**
 * Update zoom level display
 */
function updateZoomLevel(): void {
    if (!pdfViewer) return;

    const zoomLevelEl = document.getElementById('zoom-level');
    if (zoomLevelEl) {
        const scale = pdfViewer.getScale();
        zoomLevelEl.textContent = Math.round(scale * 100) + '%';
    }
}

/**
 * Handle file upload
 */
async function handleFileUpload(file: File): Promise<void> {
    console.log('Loading PDF:', file.name);
    showLoading('Loading PDF...');

    try {
        // Read file as ArrayBuffer and convert to Uint8Array
        const arrayBuffer = await file.arrayBuffer();
        currentPDFData = new Uint8Array(arrayBuffer);
        currentPDFFilename = file.name;
        pageBboxes.clear();

        // Create a copy for PDF.js using slice() to get a new ArrayBuffer
        const pdfCopy = currentPDFData.slice();

        // Load PDF into viewer
        totalPages = await pdfViewer.loadPDF(pdfCopy);
        currentPage = 1;
        console.log('PDF loaded. Total pages:', totalPages);

        // Set up PDF viewer callbacks
        pdfViewer.onPageChange = (pageNum, total) => {
            currentPage = pageNum;
            const currentPageEl = document.getElementById('current-page');
            if (currentPageEl) {
                currentPageEl.textContent = pageNum.toString();
            }

            // Update navigation buttons
            const prevButton = document.getElementById('prev-page') as HTMLButtonElement;
            const nextButton = document.getElementById('next-page') as HTMLButtonElement;
            if (prevButton) prevButton.disabled = (pageNum === 1);
            if (nextButton) nextButton.disabled = (pageNum === total);

            // Update zoom level display
            updateZoomLevel();

            // Show bbox if exists for this page
            renderBboxOverlay();
        };

        // Update UI
        const totalPagesEl = document.getElementById('total-pages');
        const currentPageEl = document.getElementById('current-page');
        if (totalPagesEl) totalPagesEl.textContent = totalPages.toString();
        if (currentPageEl) currentPageEl.textContent = currentPage.toString();

        // Update navigation buttons
        const prevButton = document.getElementById('prev-page') as HTMLButtonElement;
        const nextButton = document.getElementById('next-page') as HTMLButtonElement;
        if (prevButton) prevButton.disabled = true;
        if (nextButton) nextButton.disabled = (totalPages === 1);

        // Generate thumbnails for all pages
        await generateThumbnails();

        // Show application section
        const uploadSection = document.getElementById('upload-section');
        const appSection = document.getElementById('app-section');
        if (uploadSection) uploadSection.classList.add('hidden');
        if (appSection) appSection.classList.remove('hidden');

        // Update zoom level display
        updateZoomLevel();

        hideLoading();
    } catch (error) {
        console.error('Error loading PDF:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        alert('Failed to load PDF: ' + errorMessage);
        hideLoading();
    }
}

/**
 * Render a PDF page using PDF viewer
 */
async function renderPage(pageNum: number): Promise<void> {
    if (!pdfViewer) return;

    try {
        await pdfViewer.renderPage(pageNum);
        renderBboxOverlay();
    } catch (error) {
        console.error('Error rendering page:', error);
    }
}

/**
 * Render bbox overlay on current page
 */
function renderBboxOverlay(): void {
    if (!bboxOverlay) return;

    // Check if we have a bbox for current page (0-indexed in map)
    const bbox = pageBboxes.get(currentPage - 1);
    console.log(`[DEBUG] renderBboxOverlay: page ${currentPage}, bbox:`, bbox, 'total stored bboxes:', pageBboxes.size);

    if (bbox) {
        bboxOverlay.setBbox(bbox);
        updateBboxDisplay(bbox);
    } else {
        bboxOverlay.clear();
        // Hide bbox display
        const bboxDisplay = document.getElementById('detected-bbox');
        if (bboxDisplay) {
            bboxDisplay.classList.add('hidden');
        }
    }
}

/**
 * Automatically enable clip mode when the user defines a manual bbox
 */
function autoEnableClipMode(): void {
    const clipCheckbox = document.getElementById('clip-content') as HTMLInputElement | null;
    const clipHint = document.getElementById('clip-enabled-hint');

    if (!clipCheckbox) return;

    if (!clipCheckbox.checked) {
        clipCheckbox.checked = true;
        if (clipHint) {
            clipHint.classList.remove('hidden');
            clipHint.textContent = 'Clip content enabled to remove hidden text/images outside your crop.';
            if (clipHintTimeout) {
                window.clearTimeout(clipHintTimeout);
            }
            clipHintTimeout = window.setTimeout(() => {
                clipHint?.classList.add('hidden');
            }, 4000);
        }
    }
}

/**
 * Update bbox display panel
 */
function updateBboxDisplay(bbox: PDFBBox | null): void {
    const bboxDisplay = document.getElementById('detected-bbox');
    if (!bbox) {
        bboxDisplay.classList.add('hidden');
        return;
    }

    const width = bbox.right - bbox.left;
    const height = bbox.top - bbox.bottom;

    bboxDisplay.innerHTML = `
        Left: ${bbox.left.toFixed(2)}<br>
        Bottom: ${bbox.bottom.toFixed(2)}<br>
        Right: ${bbox.right.toFixed(2)}<br>
        Top: ${bbox.top.toFixed(2)}<br>
        Size: ${width.toFixed(2)} × ${height.toFixed(2)} pt
    `;
    bboxDisplay.classList.remove('hidden');
}

/**
 * Generate thumbnails for all pages
 */
async function generateThumbnails() {
    const thumbnailContainer = document.getElementById('thumbnail-container');
    if (!thumbnailContainer) return;

    thumbnailContainer.innerHTML = '';

    for (let i = 1; i <= totalPages; i++) {
        const thumbnailDiv = document.createElement('div');
        thumbnailDiv.className = 'thumbnail-item cursor-pointer p-2 rounded hover:bg-gray-100 transition-colors';
        thumbnailDiv.dataset.page = i;

        const canvas = document.createElement('canvas');
        canvas.className = 'w-full border border-gray-200 rounded mb-1';

        const pageLabel = document.createElement('div');
        pageLabel.className = 'text-xs text-center text-gray-600';
        pageLabel.textContent = `Page ${i}`;

        thumbnailDiv.appendChild(canvas);
        thumbnailDiv.appendChild(pageLabel);
        thumbnailContainer.appendChild(thumbnailDiv);

        // Render thumbnail
        try {
            await pdfViewer.renderThumbnail(i, canvas, 120);
        } catch (error) {
            console.error(`Error rendering thumbnail for page ${i}:`, error);
        }

        // Click handler
        thumbnailDiv.addEventListener('click', async () => {
            // Remove active class from all thumbnails
            document.querySelectorAll('.thumbnail-item').forEach(t => {
                t.classList.remove('bg-primary-100', 'border-primary-500');
            });

            // Add active class to clicked thumbnail
            thumbnailDiv.classList.add('bg-primary-100', 'border-primary-500');

            // Render the page
            currentPage = i;
            await renderPage(i);
        });

        // Highlight first page initially
        if (i === 1) {
            thumbnailDiv.classList.add('bg-primary-100', 'border-primary-500');
        }
    }
}

/**
 * Handle auto-detect bbox
 */
async function handleAutoDetect(): Promise<void> {
    if (!currentPDFData || !bboxOverlay) return;

    showLoading('Detecting crop region...');

    try {
        // Create a copy using slice() to get a fresh ArrayBuffer
        const pdfCopy = currentPDFData.slice();
        const bbox = await detectBbox(pdfCopy, currentPage - 1);  // 0-indexed
        console.log('Detected bbox:', bbox);

        // Store bbox for this page (0-indexed)
        const pdfBbox: PDFBBox = {
            left: bbox.left,
            bottom: bbox.bottom,
            right: bbox.right,
            top: bbox.top
        };
        pageBboxes.set(currentPage - 1, pdfBbox);

        // Render the bbox overlay on canvas
        bboxOverlay.setBbox(pdfBbox);
        updateBboxDisplay(pdfBbox);

        hideLoading();
    } catch (error) {
        console.error('Error detecting bbox:', error);
        console.error('Error type:', typeof error);
        console.error('Error details:', error);

        let errorMessage = 'Unknown error';
        if (error instanceof Error) {
            errorMessage = error.message;
        } else if (typeof error === 'string') {
            errorMessage = error;
        } else if (error && typeof error === 'object') {
            errorMessage = String(error);
        }

        alert('Failed to detect crop region: ' + errorMessage + '\n\nCheck browser console (F12) for full error details.');
        hideLoading();
    }
}

/**
 * Handle crop operation
 */
async function handleCrop(): Promise<void> {
    if (!currentPDFData) return;

    showLoading('Cropping PDF...');

    try {
        // Build options
        const options = new WasmCropOptions();

        // Set margins
        const marginLeftEl = document.getElementById('margin-left') as HTMLInputElement;
        const marginTopEl = document.getElementById('margin-top') as HTMLInputElement;
        const marginRightEl = document.getElementById('margin-right') as HTMLInputElement;
        const marginBottomEl = document.getElementById('margin-bottom') as HTMLInputElement;

        const ml = parseFloat(marginLeftEl?.value || '0') || 0;
        const mt = parseFloat(marginTopEl?.value || '0') || 0;
        const mr = parseFloat(marginRightEl?.value || '0') || 0;
        const mb = parseFloat(marginBottomEl?.value || '0') || 0;
        options.setMargins(ml, mt, mr, mb);

        // Set options
        const shrinkToContentEl = document.getElementById('shrink-to-content') as HTMLInputElement;
        const clipContentEl = document.getElementById('clip-content') as HTMLInputElement;

        options.setShrinkToContent(shrinkToContentEl?.checked || false);
        options.setClipContent(clipContentEl?.checked || false);

        // Convert page bboxes Map to Object
        // Note: Don't pass bboxes if none are set - WASM will auto-detect
        const bboxesObject = pageBboxes.size > 0
            ? Object.fromEntries(pageBboxes)
            : null;

        // Get page range
        const pageRange = getPageRange();

        // Debug logging
        console.log('Crop PDF debug:');
        console.log('- Total pages:', totalPages);
        console.log('- Current page:', currentPage);
        console.log('- Page range:', pageRange);
        console.log('- BBoxes object:', bboxesObject);
        console.log('- PDF data length:', currentPDFData.length);

        // Create a copy using slice() to get a fresh ArrayBuffer
        const pdfCopy = currentPDFData.slice();

        // Crop PDF
        const croppedPDF = await cropPdf(pdfCopy, options, bboxesObject, pageRange);
        console.log('PDF cropped successfully. Size:', croppedPDF.length, 'bytes');

        // Generate output filename based on input filename
        const baseName = currentPDFFilename.replace(/\.pdf$/i, '');
        const outputFilename = `${baseName}-crop.pdf`;

        // Download the result
        downloadPDF(croppedPDF, outputFilename);

        hideLoading();
    } catch (error) {
        console.error('Error cropping PDF:', error);
        console.error('Error type:', typeof error);
        console.error('Error details:', error);

        let errorMessage = 'Unknown error';
        if (error instanceof Error) {
            errorMessage = error.message;
        } else if (typeof error === 'string') {
            errorMessage = error;
        } else if (error && typeof error === 'object') {
            errorMessage = String(error);
        }

        alert('Failed to crop PDF: ' + errorMessage + '\n\nCheck browser console (F12) for full error details.');
        hideLoading();
    }
}

/**
 * Get page range based on selection
 */
function getPageRange(): number[] | null {
    const select = document.getElementById('page-range-select') as HTMLSelectElement;
    if (!select) {
        console.warn('Page range select not found');
        return null;
    }

    const value = select.value;
    console.log(`getPageRange: dropdown value = "${value}"`);
    console.log(`getPageRange: current page = ${currentPage}`);

    if (value === 'all') {
        console.log('getPageRange: returning null (all pages)');
        return null;  // Crop all pages
    } else if (value === 'current') {
        const result = [currentPage - 1];  // Current page only (0-indexed)
        console.log(`getPageRange: returning [${result}] (current page only)`);
        return result;
    } else if (value === 'custom') {
        const textEl = document.getElementById('page-range-text') as HTMLInputElement;
        const text = textEl?.value || '';
        // Parse range like "1-5, 8, 10-12" into array of page numbers (0-indexed)
        const pages = parsePageRange(text);
        const result = pages.length > 0 ? pages : null;
        console.log(`getPageRange: custom range "${text}" => ${JSON.stringify(result)}`);
        return result;
    }

    console.log('getPageRange: unknown value, returning null');
    return null;
}

/**
 * Parse page range string into array of page numbers
 * Example: "1-5, 8, 10-12" → [0, 1, 2, 3, 4, 7, 9, 10, 11]
 */
function parsePageRange(text: string): number[] {
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
function applyPreset(preset: string): void {
    const presets: Record<string, number | null> = {
        tight: 0,
        standard: 5,
        generous: 10,
        custom: null
    };

    const value = presets[preset];
    if (value !== null && value !== undefined) {
        const uniformMargin = document.getElementById('uniform-margin') as HTMLInputElement;
        const uniformMarginValue = document.getElementById('uniform-margin-value') as HTMLSpanElement;
        const marginLeft = document.getElementById('margin-left') as HTMLInputElement;
        const marginRight = document.getElementById('margin-right') as HTMLInputElement;
        const marginTop = document.getElementById('margin-top') as HTMLInputElement;
        const marginBottom = document.getElementById('margin-bottom') as HTMLInputElement;

        const valueStr = value.toString();
        if (uniformMargin) uniformMargin.value = valueStr;
        if (uniformMarginValue) uniformMarginValue.textContent = valueStr;
        if (marginLeft) marginLeft.value = valueStr;
        if (marginRight) marginRight.value = valueStr;
        if (marginTop) marginTop.value = valueStr;
        if (marginBottom) marginBottom.value = valueStr;
    }
}

/**
 * Download PDF file
 */
function downloadPDF(uint8Array: Uint8Array, filename: string): void {
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
function showLoading(message: string = 'Processing...'): void {
    document.getElementById('loading-message').textContent = message;
    document.getElementById('loading-overlay').classList.remove('hidden');
}

/**
 * Hide loading overlay
 */
function hideLoading(): void {
    document.getElementById('loading-overlay').classList.add('hidden');
}

// Initialize application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}
