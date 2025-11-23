/**
 * Interactive BBox Selection Overlay
 *
 * Handles mouse and touch interactions for drawing bounding boxes
 * on the PDF canvas overlay.
 */

import type { PDFViewer, PDFBBox } from './pdf-viewer';

// Canvas Rectangle interface
interface CanvasRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

// BBox Overlay options
interface BBoxOverlayOptions {
    onBboxChange?: ((bbox: PDFBBox | null) => void) | null;
    onBboxComplete?: ((bbox: PDFBBox | null) => void) | null;
    strokeStyle?: string;
    fillStyle?: string;
    lineWidth?: number;
    lineDash?: number[];
}

export class BBoxOverlay {
    private overlayCanvas: HTMLCanvasElement;
    private pdfViewer: PDFViewer;
    private ctx: CanvasRenderingContext2D;

    // Selection state
    private isDrawing: boolean = false;
    private startX: number = 0;
    private startY: number = 0;
    private currentX: number = 0;
    private currentY: number = 0;
    private currentBbox: PDFBBox | null = null;

    // Callbacks
    private onBboxChange: ((bbox: PDFBBox | null) => void) | null;
    private onBboxComplete: ((bbox: PDFBBox | null) => void) | null;

    // Style
    private strokeStyle: string;
    private fillStyle: string;
    private lineWidth: number;
    private lineDash: number[];

    // Bound event handlers
    private handleMouseDown: (e: MouseEvent) => void;
    private handleMouseMove: (e: MouseEvent) => void;
    private handleMouseUp: (e: MouseEvent) => void;
    private handleTouchStart: (e: TouchEvent) => void;
    private handleTouchMove: (e: TouchEvent) => void;
    private handleTouchEnd: (e: TouchEvent) => void;

    constructor(overlayCanvas: HTMLCanvasElement, pdfViewer: PDFViewer, options: BBoxOverlayOptions = {}) {
        this.overlayCanvas = overlayCanvas;
        this.pdfViewer = pdfViewer;

        const ctx = overlayCanvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to get overlay canvas 2D context');
        }
        this.ctx = ctx;

        // Callbacks
        this.onBboxChange = options.onBboxChange || null;
        this.onBboxComplete = options.onBboxComplete || null;

        // Style
        this.strokeStyle = options.strokeStyle || '#0ea5e9';
        this.fillStyle = options.fillStyle || 'rgba(14, 165, 233, 0.15)';
        this.lineWidth = options.lineWidth || 2;
        this.lineDash = options.lineDash || [];

        // Bind event handlers
        this.handleMouseDown = this.onMouseDown.bind(this);
        this.handleMouseMove = this.onMouseMove.bind(this);
        this.handleMouseUp = this.onMouseUp.bind(this);
        this.handleTouchStart = this.onTouchStart.bind(this);
        this.handleTouchMove = this.onTouchMove.bind(this);
        this.handleTouchEnd = this.onTouchEnd.bind(this);

        // Enable by default
        this.enable();
    }

    /**
     * Enable bbox selection
     */
    enable(): void {
        // Mouse events
        this.overlayCanvas.addEventListener('mousedown', this.handleMouseDown);
        this.overlayCanvas.addEventListener('mousemove', this.handleMouseMove);
        this.overlayCanvas.addEventListener('mouseup', this.handleMouseUp);

        // Touch events
        this.overlayCanvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
        this.overlayCanvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        this.overlayCanvas.addEventListener('touchend', this.handleTouchEnd);

        // Change cursor
        this.overlayCanvas.style.cursor = 'crosshair';
    }

    /**
     * Disable bbox selection
     */
    disable(): void {
        // Remove mouse events
        this.overlayCanvas.removeEventListener('mousedown', this.handleMouseDown);
        this.overlayCanvas.removeEventListener('mousemove', this.handleMouseMove);
        this.overlayCanvas.removeEventListener('mouseup', this.handleMouseUp);

        // Remove touch events
        this.overlayCanvas.removeEventListener('touchstart', this.handleTouchStart);
        this.overlayCanvas.removeEventListener('touchmove', this.handleTouchMove);
        this.overlayCanvas.removeEventListener('touchend', this.handleTouchEnd);

        // Reset cursor
        this.overlayCanvas.style.cursor = 'default';
    }

    /**
     * Get mouse position relative to canvas
     */
    getCanvasCoordinates(event: MouseEvent): { x: number; y: number } {
        const rect = this.overlayCanvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }

    /**
     * Get touch position relative to canvas
     */
    getTouchCoordinates(event: TouchEvent): { x: number; y: number } {
        const rect = this.overlayCanvas.getBoundingClientRect();
        const touch = event.touches[0] || event.changedTouches[0];
        return {
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top
        };
    }

    /**
     * Handle mouse down
     */
    private onMouseDown(event: MouseEvent): void {
        event.preventDefault();
        const pos = this.getCanvasCoordinates(event);
        this.startDrawing(pos.x, pos.y);
    }

    /**
     * Handle mouse move
     */
    private onMouseMove(event: MouseEvent): void {
        if (!this.isDrawing) return;
        event.preventDefault();
        const pos = this.getCanvasCoordinates(event);
        this.updateDrawing(pos.x, pos.y);
    }

    /**
     * Handle mouse up
     */
    private onMouseUp(event: MouseEvent): void {
        if (!this.isDrawing) return;
        event.preventDefault();
        const pos = this.getCanvasCoordinates(event);
        this.finishDrawing(pos.x, pos.y);
    }

    /**
     * Handle touch start
     */
    private onTouchStart(event: TouchEvent): void {
        event.preventDefault();
        const pos = this.getTouchCoordinates(event);
        this.startDrawing(pos.x, pos.y);
    }

    /**
     * Handle touch move
     */
    private onTouchMove(event: TouchEvent): void {
        if (!this.isDrawing) return;
        event.preventDefault();
        const pos = this.getTouchCoordinates(event);
        this.updateDrawing(pos.x, pos.y);
    }

    /**
     * Handle touch end
     */
    private onTouchEnd(event: TouchEvent): void {
        if (!this.isDrawing) return;
        event.preventDefault();
        const pos = this.getTouchCoordinates(event);
        this.finishDrawing(pos.x, pos.y);
    }

    /**
     * Start drawing bbox
     */
    private startDrawing(x: number, y: number): void {
        this.isDrawing = true;
        this.startX = x;
        this.startY = y;
        this.currentX = x;
        this.currentY = y;

        // Clear previous selection
        this.clear();
    }

    /**
     * Update drawing bbox
     */
    private updateDrawing(x: number, y: number): void {
        this.currentX = x;
        this.currentY = y;

        // Redraw
        this.draw();

        // Trigger change callback
        if (this.onBboxChange) {
            const bbox = this.getCanvasBbox();
            const pdfBbox = this.canvasBboxToPdf(bbox);
            this.onBboxChange(pdfBbox);
        }
    }

    /**
     * Finish drawing bbox
     */
    private finishDrawing(x: number, y: number): void {
        this.currentX = x;
        this.currentY = y;
        this.isDrawing = false;

        // Get final bbox
        const canvasBbox = this.getCanvasBbox();
        const pdfBbox = this.canvasBboxToPdf(canvasBbox);

        // Store current bbox
        this.currentBbox = pdfBbox;

        // Final draw
        this.draw();

        // Trigger complete callback
        if (this.onBboxComplete) {
            this.onBboxComplete(pdfBbox);
        }
    }

    /**
     * Get current canvas bbox from drawing coordinates
     */
    private getCanvasBbox(): CanvasRect {
        const x1 = Math.min(this.startX, this.currentX);
        const y1 = Math.min(this.startY, this.currentY);
        const x2 = Math.max(this.startX, this.currentX);
        const y2 = Math.max(this.startY, this.currentY);

        return {
            x: x1,
            y: y1,
            width: x2 - x1,
            height: y2 - y1
        };
    }

    /**
     * Convert canvas bbox to PDF bbox
     */
    private canvasBboxToPdf(canvasBbox: CanvasRect): PDFBBox | null {
        if (!this.pdfViewer) return null;
        return this.pdfViewer.canvasRectToPDFBbox(canvasBbox);
    }

    /**
     * Draw current selection
     */
    private draw(): void {
        // Clear overlay
        this.clear();

        // Get bbox rectangle
        const bbox = this.getCanvasBbox();

        // Draw rectangle
        this.ctx.save();
        this.ctx.strokeStyle = this.strokeStyle;
        this.ctx.fillStyle = this.fillStyle;
        this.ctx.lineWidth = this.lineWidth;
        this.ctx.setLineDash(this.lineDash);

        // Fill
        this.ctx.fillRect(bbox.x, bbox.y, bbox.width, bbox.height);

        // Stroke
        this.ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);

        this.ctx.restore();

        // Draw corner handles if not currently drawing
        if (!this.isDrawing) {
            this.drawHandles(bbox);
        }
    }

    /**
     * Draw resize handles at corners
     */
    private drawHandles(bbox: CanvasRect): void {
        const handleSize = 8;
        const handles = [
            { x: bbox.x, y: bbox.y },                                    // Top-left
            { x: bbox.x + bbox.width, y: bbox.y },                      // Top-right
            { x: bbox.x, y: bbox.y + bbox.height },                     // Bottom-left
            { x: bbox.x + bbox.width, y: bbox.y + bbox.height }         // Bottom-right
        ];

        this.ctx.save();
        this.ctx.fillStyle = '#fff';
        this.ctx.strokeStyle = this.strokeStyle;
        this.ctx.lineWidth = 2;

        handles.forEach(handle => {
            this.ctx.fillRect(
                handle.x - handleSize / 2,
                handle.y - handleSize / 2,
                handleSize,
                handleSize
            );
            this.ctx.strokeRect(
                handle.x - handleSize / 2,
                handle.y - handleSize / 2,
                handleSize,
                handleSize
            );
        });

        this.ctx.restore();
    }

    /**
     * Clear overlay
     */
    clear(): void {
        this.ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    }

    /**
     * Set bbox and draw it
     */
    setBbox(pdfBbox: PDFBBox | null): void {
        if (!this.pdfViewer || !pdfBbox) {
            this.currentBbox = null;
            this.clear();
            return;
        }

        this.currentBbox = pdfBbox;

        // Convert to canvas coordinates and draw
        const canvasRect = this.pdfViewer.pdfBboxToCanvasRect(pdfBbox);

        // Set drawing coordinates
        this.startX = canvasRect.x;
        this.startY = canvasRect.y;
        this.currentX = canvasRect.x + canvasRect.width;
        this.currentY = canvasRect.y + canvasRect.height;

        // Draw
        this.draw();
    }

    /**
     * Get current bbox in PDF coordinates
     */
    getBbox(): PDFBBox | null {
        return this.currentBbox;
    }
}

/**
 * Create and export a bbox overlay instance
 */
export function createBBoxOverlay(overlayCanvasId: string, pdfViewer: PDFViewer, options: BBoxOverlayOptions = {}): BBoxOverlay {
    const overlayCanvas = document.getElementById(overlayCanvasId);
    if (!overlayCanvas) {
        throw new Error(`Canvas element with id "${overlayCanvasId}" not found`);
    }
    return new BBoxOverlay(overlayCanvas, pdfViewer, options);
}
