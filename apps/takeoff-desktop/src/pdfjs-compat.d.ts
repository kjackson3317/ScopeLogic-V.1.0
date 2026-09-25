import 'pdfjs-dist';
import type { PageViewport, RenderTask } from 'pdfjs-dist';

declare module 'pdfjs-dist' {
  interface PDFPageProxy {
    render(params: { canvasContext: CanvasRenderingContext2D; viewport: PageViewport }): RenderTask;
  }
}
