// Polyfill for DOMMatrix before importing pdfjs-dist
global.DOMMatrix = class DOMMatrix {
  constructor() {
    this.a = 1; this.b = 0; this.c = 0; this.d = 1;
    this.e = 0; this.f = 0;
    this.m11 = 1; this.m12 = 0; this.m13 = 0; this.m14 = 0;
    this.m21 = 0; this.m22 = 1; this.m23 = 0; this.m24 = 0;
    this.m31 = 0; this.m32 = 0; this.m33 = 1; this.m34 = 0;
    this.m41 = 0; this.m42 = 0; this.m43 = 0; this.m44 = 1;
  }
  translate(tx, ty) { return this; }
  scale(sx, sy) { return this; }
  multiply() { return this; }
  transformPoint() { return { x: 0, y: 0 }; }
};

const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
const { getDocument } = pdfjsLib;
const { readFileSync } = await import('fs');
const { resolve } = await import('path');

const pdfPath = resolve('D:/first  cc/LibTV使用指南.pdf');
const data = new Uint8Array(readFileSync(pdfPath));

const loadingTask = getDocument({ data });
const pdf = await loadingTask.promise;

console.log(`Total pages: ${pdf.numPages}\n`);

for (let i = 1; i <= Math.min(pdf.numPages, 15); i++) {
  const page = await pdf.getPage(i);
  const content = await page.getTextContent();
  const text = content.items.map(item => item.str).join(' ');
  console.log(`=== Page ${i} ===`);
  console.log(text.slice(0, 3000));
  console.log('');
}
