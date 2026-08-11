import { copyFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
await mkdir(join(root, 'public'), { recursive: true });
await copyFile(join(root, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs'), join(root, 'public', 'pdf.worker.min.mjs'));
console.log('PDF.js worker copied to public/pdf.worker.min.mjs');
