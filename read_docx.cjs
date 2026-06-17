// Use JSZip to read the docx file
const JSZip = require('jszip');
const fs = require('fs');
const path = require('path');

async function main() {
  const docxPath = path.resolve('C:/Users/凡/.qclaw/workspace/CanvasFlow_AI_Studio_软件操作说明书.docx');
  
  // Try to read the file
  let data;
  try {
    data = fs.readFileSync(docxPath);
  } catch (e) {
    // Try with short path
    console.log('Error reading:', e.message);
    return;
  }
  
  const zip = await JSZip.loadAsync(data);
  const xmlContent = await zip.file('word/document.xml').async('string');
  
  // Extract text from XML
  const regex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  const texts = [];
  let match;
  while ((match = regex.exec(xmlContent)) !== null) {
    if (match[1].trim()) {
      texts.push(match[1]);
    }
  }
  
  const output = texts.join('\n');
  fs.writeFileSync('D:/vibevideo/docx_content.txt', output, 'utf8');
  console.log('Extracted', texts.length, 'text nodes');
  console.log('First 5000 chars:');
  console.log(output.slice(0, 5000));
}

main().catch(console.error);
