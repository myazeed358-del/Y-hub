/// <reference lib="webworker" />

self.onmessage = async (e: MessageEvent) => {
  const { arrayBuffer } = e.data;

  if (!arrayBuffer) return;

  try {
    importScripts('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js');
    
    const pdfjsLib = (self as any).pdfjsLib;
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    const totalPages = pdf.numPages;
    let fullText = '';
    
    // 1. Extract all text with page markers
    for (let i = 1; i <= totalPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      
      fullText += `\\n--- PAGE ${i} ---\\n` + pageText;

      self.postMessage({ type: 'progress', currentPage: i, totalPages });
    }

    // 2. Semantic Chunking Logic with Metadata Tracking
    self.postMessage({ type: 'status', message: 'Performing semantic chunking...' });
    
    // We will split by paragraphs/sections while preserving the closest Page marker
    // Markers look like: \\n--- PAGE X ---\\n
    const rawChunks = fullText.split(/(?=\\n--- PAGE \\d+ ---\\n)|\\n\\n/gi);
    
    const semanticChunks: { text: string, source: string }[] = [];
    let currentChunk = '';
    let currentPage = 'Page 1';
    
    for (const piece of rawChunks) {
      // Check if this piece contains a page marker
      const pageMatch = piece.match(/\\n--- PAGE (\\d+) ---\\n/);
      if (pageMatch) {
        currentPage = `Page ${pageMatch[1]}`;
      }
      
      const cleanPiece = piece.replace(/\\n--- PAGE \\d+ ---\\n/g, '').replace(/\\s{3,}/g, ' ').trim();
      
      if (!cleanPiece) continue;

      if (currentChunk.length + cleanPiece.length < 1500) {
        currentChunk += (currentChunk ? '\\n' : '') + cleanPiece;
      } else {
        if (currentChunk.trim().length > 50) {
          semanticChunks.push({ text: currentChunk.trim(), source: currentPage });
        }
        currentChunk = cleanPiece;
      }
    }
    if (currentChunk.trim().length > 50) {
      semanticChunks.push({ text: currentChunk.trim(), source: currentPage });
    }

    // Convert chunks to JSON string to simulate a Vector DB storage format
    const chunkedResult = JSON.stringify(semanticChunks);

    self.postMessage({
      type: 'complete',
      text: chunkedResult, // Returning the semantic chunks with metadata
      rawText: fullText
    });

  } catch (error: any) {
    self.postMessage({
      type: 'error',
      error: error.message || 'Failed to parse PDF inside worker'
    });
  }
};
