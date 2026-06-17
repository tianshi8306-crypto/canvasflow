const fs = require('fs');
const zlib = require('zlib');

const docxPath = 'C:/Users/凡/.qclaw/workspace/CanvasFlow_AI_Studio_软件操作说明书.docx';

async function main() {
  const buffer = fs.readFileSync(docxPath);
  console.log('File size:', buffer.length);
  
  // Parse ZIP format - scan for local file headers
  let pos = 0;
  let found = false;
  
  while (pos < buffer.length - 4) {
    const sig = buffer.readUInt32LE(pos);
    if (sig === 0x04034b50) {
      // Local file header
      const ver = buffer.readUInt16LE(pos + 4);
      const flags = buffer.readUInt16LE(pos + 6);
      const compMethod = buffer.readUInt16LE(pos + 8);
      const fnameLen = buffer.readUInt16LE(pos + 26);
      const extraLen = buffer.readUInt16LE(pos + 28);
      const fname = buffer.toString('utf8', pos + 30, pos + 30 + fnameLen);
      
      if (fname === 'word/document.xml') {
        const compSize = buffer.readUInt32LE(pos + 18);
        const dataOffset = pos + 30 + fnameLen + extraLen;
        
        console.log('Found document.xml at offset', dataOffset);
        console.log('Compression method:', compMethod);
        console.log('Compressed size:', compSize);
        
        const compressed = buffer.slice(dataOffset, dataOffset + compSize);
        
        let xmlContent;
        if (compMethod === 8) {
          // Deflate
          try {
            const decompressed = zlib.inflateRawSync(compressed);
            xmlContent = decompressed.toString('utf8');
          } catch (e) {
            // Try with different window
            try {
              const decompressed = zlib.inflateSync(compressed);
              xmlContent = decompressed.toString('utf8');
            } catch (e2) {
              console.log('Decompression error:', e2.message);
              return;
            }
          }
        } else if (compMethod === 0) {
          // Stored (no compression)
          xmlContent = compressed.toString('utf8');
        }
        
        // Extract text
        const regex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
        const texts = [];
        let match;
        while ((match = regex.exec(xmlContent)) !== null) {
          if (match[1].trim()) texts.push(match[1]);
        }
        
        const output = texts.join('\n');
        fs.writeFileSync('D:/vibevideo/docx_content.txt', output, 'utf8');
        console.log('Extracted', texts.length, 'text nodes');
        console.log('First 5000 chars:');
        console.log(output.slice(0, 5000));
        found = true;
        break;
      }
      
      const compSize = buffer.readUInt32LE(pos + 18);
      const dataOffset = pos + 30 + fnameLen + extraLen;
      pos = dataOffset + compSize;
    } else {
      pos++;
    }
  }
  
  if (!found) console.log('document.xml not found in ZIP');
}

main().catch(console.error);
