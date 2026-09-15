import { useEffect, useRef, useState } from 'react';

type Props = {
  pdfDoc: any;
  pageNumber: number;
};

export default function PageThumbnail({ pdfDoc, pageNumber }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!pdfDoc || !canvasRef.current) return;

    const render = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        const base = page.getViewport({ scale: 1 });
        const targetWidth = 48;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const scale = (targetWidth / base.width) * dpr;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = Math.max(1, Math.ceil(viewport.width));
        canvas.height = Math.max(1, Math.ceil(viewport.height));
        canvas.style.width = `${targetWidth}px`;
        canvas.style.height = `${Math.max(32, Math.round(viewport.height / dpr))}px`;
        await page.render({ canvasContext: context, viewport }).promise;
      } catch {
        if (!cancelled) setFailed(true);
      }
    };

    void render();
    return () => { cancelled = true; };
  }, [pdfDoc, pageNumber]);

  return (
    <span className={failed ? 'page-thumb true-thumb failed' : 'page-thumb true-thumb'}>
      <canvas ref={canvasRef} />
      {failed && <span>{pageNumber}</span>}
    </span>
  );
}
