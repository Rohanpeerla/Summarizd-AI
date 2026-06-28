import * as pdfjsLib from "pdfjs-dist";
// Use the bundled worker as a URL (Vite handles this).
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import mammoth from "mammoth";
import JSZip from "jszip";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface ParsedDoc {
  id: string;
  name: string;
  content: string;
  words: number;
  type: string;
}

function detectType(name: string): string {
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".pptx")) return "pptx";
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".xlsx")) return "xlsx";
  if (name.endsWith(".md")) return "markdown";
  return "text";
}

async function parsePptx(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  // Find slide files in order
  const slideFiles: { num: number; path: string }[] = [];
  zip.forEach((relativePath) => {
    const match = relativePath.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
    if (match) {
      slideFiles.push({ num: parseInt(match[1], 10), path: relativePath });
    }
  });
  slideFiles.sort((a, b) => a.num - b.num);

  const texts: string[] = [];
  for (const { path } of slideFiles) {
    const xml = await zip.file(path)?.async("string");
    if (!xml) continue;
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "application/xml");
    // All text elements are <a:t> inside DrawingML
    const nodes = doc.getElementsByTagName("a:t");
    const slideText: string[] = [];
    for (let i = 0; i < nodes.length; i++) {
      const t = nodes[i].textContent?.trim();
      if (t) slideText.push(t);
    }
    if (slideText.length) {
      texts.push(slideText.join(" "));
    }
  }
  return texts.join("\n\n").trim();
}

async function parseDocx(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}

export async function parseFile(file: File): Promise<ParsedDoc> {
  const name = file.name.toLowerCase();
  const type = detectType(name);
  let content = "";

  if (type === "pdf") {
    content = await parsePdf(file);
  } else if (type === "pptx") {
    content = await parsePptx(file);
  } else if (type === "docx") {
    content = await parseDocx(file);
  } else if (type === "text" || type === "markdown") {
    content = await file.text();
  } else {
    // Fallback: try as text
    content = await file.text();
  }

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    content,
    words: content.trim().split(/\s+/).filter(Boolean).length,
    type,
  };
}

export async function parseFiles(files: FileList | File[]): Promise<ParsedDoc[]> {
  const docs: ParsedDoc[] = [];
  for (const file of Array.from(files)) {
    docs.push(await parseFile(file));
  }
  return docs;
}

async function parsePdf(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const pageContent = await page.getTextContent();
    const pageText = pageContent.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((it: any) => ("str" in it ? it.str : ""))
      .join(" ");
    text += pageText + "\n\n";
  }
  return text.trim();
}
