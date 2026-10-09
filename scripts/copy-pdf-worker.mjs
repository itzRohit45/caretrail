// pdf.js renders PDFs in a web worker; serve the worker file from /public (copied at install/build).
import { copyFile } from "node:fs/promises";
await copyFile(new URL("../node_modules/pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), new URL("../public/pdf.worker.min.mjs", import.meta.url));
