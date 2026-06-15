// Minimal type shim — word-extractor ships no .d.ts. We only use extract()+getBody().
declare module "word-extractor" {
  export interface ExtractedDocument {
    getBody(): string;
    getFootnotes(): string;
    getHeaders(): string;
  }
  export default class WordExtractor {
    extract(input: string | Buffer): Promise<ExtractedDocument>;
  }
}
