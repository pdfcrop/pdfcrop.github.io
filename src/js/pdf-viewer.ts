/**
 * PDF.js Integration Module
 *
 * Handles PDF loading, rendering, and coordinate conversion using PDF.js
 * Compatible with Chrome, Firefox, Safari, and Edge
 */

import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy, PageViewport } from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).toString();

// PDF Bounding Box interface
export interface PDFBBox {
    left: number;
    bottom: number;
    right: number;
    top: number;
}

// Canvas Rectangle interface
interface CanvasRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

// Bbox drawing style options
interface BBoxStyle {
    strokeStyle?: string;
    lineWidth?: number;
    lineDash?: number[];
    fillStyle?: string;
}

/**
 * PDFViewer class
 * Manages PDF loading, rendering, and viewport
 */
export class PDFViewer {
    private canvas: HTMLCanvasElement;
    private overlayCanvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private overlayCtx: CanvasRenderingContext2D;

    private pdfDocument: PDFDocumentProxy | null = null;
    private currentPage: number = 1;
    private totalPages: number = 0;
    private scale: number = 1.0;
    private manualScale: boolean = false;  // Track if scale was manually set
    private currentPageObject: PDFPageProxy | null = null;
    private currentViewport: PageViewport | null = null;

    // Callbacks
    public onPageChange: ((pageNum: number, total: number) => void) | null = null;
    public onDocumentLoad: ((totalPages: number) => void) | null = null;

    constructor(canvasId: string, overlayCanvasId: string) {
        const canvas = document.getElementById(canvasId);
        const overlayCanvas = document.getElementById(overlayCanvasId);

        if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
            throw new Error(`Canvas element with id "${canvasId}" not found`);
        }
        if (!overlayCanvas || !(overlayCanvas instanceof HTMLCanvasElement)) {
            throw new Error(`Overlay canvas element with id "${overlayCanvasId}" not found`);
        }

        this.canvas = canvas;
        this.overlayCanvas = overlayCanvas;

        const ctx = this.canvas.getContext('2d');
        const overlayCtx = this.overlayCanvas.getContext('2d');

        if (!ctx || !overlayCtx) {
            throw new Error('Failed to get canvas 2D context');
        }

        this.ctx = ctx;
        this.overlayCtx = overlayCtx;
    }

    /**
     * Load a PDF from Uint8Array
     */
    async loadPDF(pdfData: Uint8Array): Promise<number> {
        try {
            // Load the PDF document
            const loadingTask = pdfjsLib.getDocument({ data: pdfData });
            this.pdfDocument = await loadingTask.promise;
            this.totalPages = this.pdfDocument.numPages;

            console.log('PDF loaded successfully. Pages:', this.totalPages);

            // Trigger callback
            if (this.onDocumentLoad) {
                this.onDocumentLoad(this.totalPages);
            }

            // Render first page
            await this.renderPage(1);

            return this.totalPages;
        } catch (error) {
            console.error('Error loading PDF:', error);
            throw new Error('Failed to load PDF: ' + error.message);
        }
    }

    /**
     * Render a specific page
     */
    async renderPage(pageNum: number): Promise<PageViewport> {
        if (!this.pdfDocument) {
            throw new Error('No PDF document loaded');
        }

        if (pageNum < 1 || pageNum > this.totalPages) {
            throw new Error(`Invalid page number: ${pageNum}`);
        }

        try {
            // Get the page
            this.currentPageObject = await this.pdfDocument.getPage(pageNum);
            this.currentPage = pageNum;

            // Calculate viewport to fit canvas container (only if not manually zoomed)
            if (!this.manualScale) {
                const parentEl = this.canvas.parentElement;
                const containerWidth = (parentEl?.clientWidth || 800) - 64; // padding
                const containerHeight = (parentEl?.clientHeight || 600) - 64;

                // Get default viewport (scale 1.0)
                const defaultViewport = this.currentPageObject.getViewport({ scale: 1.0 });

                // Calculate scale to fit container
                const scaleX = containerWidth / defaultViewport.width;
                const scaleY = containerHeight / defaultViewport.height;
                this.scale = Math.max(0.5, Math.min(scaleX, scaleY, 3.0)); // Between 0.5x and 3x zoom
            }

            // Get viewport with calculated scale
            this.currentViewport = this.currentPageObject.getViewport({ scale: this.scale });

            // Set canvas dimensions
            this.canvas.width = this.currentViewport.width;
            this.canvas.height = this.currentViewport.height;
            this.overlayCanvas.width = this.currentViewport.width;
            this.overlayCanvas.height = this.currentViewport.height;

            // Clear canvas
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            // Render the page
            const renderContext = {
                canvasContext: this.ctx,
                viewport: this.currentViewport
            };

            await this.currentPageObject.render(renderContext).promise;

            console.log(`Page ${pageNum} rendered successfully`);

            // Trigger callback
            if (this.onPageChange) {
                this.onPageChange(pageNum, this.totalPages);
            }

            return this.currentViewport;
        } catch (error) {
            console.error('Error rendering page:', error);
            throw new Error('Failed to render page: ' + error.message);
        }
    }

    /**
     * Navigate to next page
     */
    async nextPage(): Promise<void> {
        if (this.currentPage < this.totalPages) {
            await this.renderPage(this.currentPage + 1);
        }
    }

    /**
     * Navigate to previous page
     */
    async previousPage(): Promise<void> {
        if (this.currentPage > 1) {
            await this.renderPage(this.currentPage - 1);
        }
    }

    /**
     * Go to specific page
     */
    async goToPage(pageNum: number): Promise<PageViewport> {
        return await this.renderPage(pageNum);
    }

    /**
     * Get current page dimensions in PDF points
     */
    getPageDimensions(): { width: number; height: number } | null {
        if (!this.currentPageObject) {
            return null;
        }

        const viewport = this.currentPageObject.getViewport({ scale: 1.0 });
        return {
            width: viewport.width,
            height: viewport.height
        };
    }

    /**
     * Convert canvas coordinates to PDF points
     * Canvas origin: top-left, PDF origin: bottom-left
     */
    canvasToPDF(canvasX: number, canvasY: number): { x: number; y: number } | null {
        if (!this.currentViewport) {
            return null;
        }

        // Get page dimensions at scale 1.0
        const pageDims = this.getPageDimensions();

        // Convert canvas coords to PDF points
        const pdfX = (canvasX / this.scale);
        const pdfY = pageDims.height - (canvasY / this.scale);  // Flip Y axis

        return {
            x: pdfX,
            y: pdfY
        };
    }

    /**
     * Convert PDF points to canvas coordinates
     */
    pdfToCanvas(pdfX: number, pdfY: number): { x: number; y: number } | null {
        if (!this.currentViewport) {
            return null;
        }

        const pageDims = this.getPageDimensions();

        // Convert PDF points to canvas coords
        const canvasX = pdfX * this.scale;
        const canvasY = (pageDims.height - pdfY) * this.scale;  // Flip Y axis

        return {
            x: canvasX,
            y: canvasY
        };
    }

    /**
     * Convert canvas rectangle to PDF bbox
     * @param rect - {x, y, width, height} in canvas coordinates
     * @returns {left, bottom, right, top} in PDF points
     */
    canvasRectToPDFBbox(rect: CanvasRect): PDFBBox {
        const topLeft = this.canvasToPDF(rect.x, rect.y);
        const bottomRight = this.canvasToPDF(rect.x + rect.width, rect.y + rect.height);

        return {
            left: topLeft.x,
            bottom: bottomRight.y,
            right: bottomRight.x,
            top: topLeft.y
        };
    }

    /**
     * Convert PDF bbox to canvas rectangle
     * @param bbox - {left, bottom, right, top} in PDF points
     * @returns {x, y, width, height} in canvas coordinates
     */
    pdfBboxToCanvasRect(bbox: PDFBBox): CanvasRect {
        const topLeft = this.pdfToCanvas(bbox.left, bbox.top);
        const bottomRight = this.pdfToCanvas(bbox.right, bbox.bottom);

        return {
            x: topLeft.x,
            y: topLeft.y,
            width: bottomRight.x - topLeft.x,
            height: bottomRight.y - topLeft.y
        };
    }

    /**
     * Render a thumbnail for a specific page
     */
    async renderThumbnail(pageNum: number, thumbnailCanvas: HTMLCanvasElement, maxWidth: number = 150): Promise<void> {
        if (!this.pdfDocument) {
            return;
        }

        try {
            const page = await this.pdfDocument.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.0 });

            // Calculate scale to fit thumbnail width
            const scale = maxWidth / viewport.width;
            const scaledViewport = page.getViewport({ scale });

            // Set canvas size
            thumbnailCanvas.width = scaledViewport.width;
            thumbnailCanvas.height = scaledViewport.height;

            // Render
            const ctx = thumbnailCanvas.getContext('2d');
            const renderContext = {
                canvasContext: ctx,
                viewport: scaledViewport
            };

            await page.render(renderContext).promise;
        } catch (error) {
            console.error('Error rendering thumbnail:', error);
        }
    }

    /**
     * Clear overlay canvas
     */
    clearOverlay(): void {
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    }

    /**
     * Draw a bbox rectangle on overlay
     */
    drawBboxOnOverlay(bbox: PDFBBox, style: BBoxStyle = {}): void {
        const {
            strokeStyle = '#0ea5e9',
            lineWidth = 2,
            lineDash = [],
            fillStyle = 'rgba(14, 165, 233, 0.1)'
        } = style;

        const rect = this.pdfBboxToCanvasRect(bbox);

        this.overlayCtx.save();
        this.overlayCtx.strokeStyle = strokeStyle;
        this.overlayCtx.lineWidth = lineWidth;
        this.overlayCtx.setLineDash(lineDash);
        this.overlayCtx.fillStyle = fillStyle;

        // Fill
        this.overlayCtx.fillRect(rect.x, rect.y, rect.width, rect.height);

        // Stroke
        this.overlayCtx.strokeRect(rect.x, rect.y, rect.width, rect.height);

        this.overlayCtx.restore();
    }

    /**
     * Get current scale
     */
    getScale(): number {
        return this.scale;
    }

    /**
     * Set zoom scale and re-render
     */
    async setScale(newScale: number): Promise<void> {
        this.scale = Math.max(0.5, Math.min(3.0, newScale)); // Clamp between 0.5x and 3x
        this.manualScale = true;  // Mark as manually scaled
        await this.renderPage(this.currentPage);
    }

    /**
     * Zoom in
     */
    async zoomIn(): Promise<void> {
        await this.setScale(this.scale * 1.25);
    }

    /**
     * Zoom out
     */
    async zoomOut(): Promise<void> {
        await this.setScale(this.scale / 1.25);
    }

    /**
     * Fit to width
     */
    async fitToWidth(): Promise<void> {
        if (!this.currentPageObject) return;

        const containerWidth = this.canvas.parentElement!.clientWidth - 64;
        const defaultViewport = this.currentPageObject.getViewport({ scale: 1.0 });
        const newScale = containerWidth / defaultViewport.width;

        await this.setScale(newScale);
    }

    /**
     * Fit to page (default)
     */
    async fitToPage(): Promise<void> {
        this.manualScale = false;  // Reset manual scale flag
        await this.renderPage(this.currentPage);
    }
}

/**
 * Create and export a PDF viewer instance
 */
export function createPDFViewer(canvasId: string = 'pdf-canvas', overlayCanvasId: string = 'overlay-canvas'): PDFViewer {
    return new PDFViewer(canvasId, overlayCanvasId);
}
