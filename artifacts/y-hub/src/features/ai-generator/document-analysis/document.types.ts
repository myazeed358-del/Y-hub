export interface SemanticChunk {
  text: string;
  source: string;
}

export interface DocumentAnalysisResult {
  chunks: SemanticChunk[];
  rawText: string;
}
