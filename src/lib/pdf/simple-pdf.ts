import "server-only";

export type PdfSection = {
  title: string;
  lines: string[];
};

function sanitize(text: string) {
  return text
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

function escapePdfText(text: string) {
  return sanitize(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapText(text: string, maxChars: number) {
  const clean = sanitize(text).trim();
  if (!clean) return [""];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    if (word.length <= maxChars) {
      current = word;
    } else {
      let rest = word;
      while (rest.length > maxChars) {
        lines.push(rest.slice(0, maxChars));
        rest = rest.slice(maxChars);
      }
      current = rest;
    }
  }

  if (current) lines.push(current);
  return lines;
}

export function createSimplePdf(title: string, subtitle: string, sections: PdfSection[]) {
  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 42;
  const topY = 795;
  const bottomY = 48;
  const pages: string[][] = [[]];
  let pageIndex = 0;
  let y = topY;

  const currentPage = () => pages[pageIndex];
  const newPage = () => {
    pages.push([]);
    pageIndex += 1;
    y = topY;
  };

  const ensureSpace = (height: number) => {
    if (y - height < bottomY) newPage();
  };

  const addText = (text: string, options?: { bold?: boolean; size?: number; indent?: number; gapAfter?: number }) => {
    const size = options?.size ?? 9;
    const bold = options?.bold ?? false;
    const indent = options?.indent ?? 0;
    const gapAfter = options?.gapAfter ?? 3;
    const maxChars = Math.max(20, Math.floor((pageWidth - marginX * 2 - indent) / (size * 0.53)));
    const wrapped = wrapText(text, maxChars);
    const lineHeight = size + 3;
    ensureSpace(wrapped.length * lineHeight + gapAfter);

    wrapped.forEach((line) => {
      currentPage().push(`BT /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${marginX + indent} ${y} Tm (${escapePdfText(line)}) Tj ET`);
      y -= lineHeight;
    });
    y -= gapAfter;
  };

  const addRule = () => {
    ensureSpace(10);
    currentPage().push(`0.75 w ${marginX} ${y} m ${pageWidth - marginX} ${y} l S`);
    y -= 10;
  };

  addText(title, { bold: true, size: 18, gapAfter: 5 });
  addText(subtitle, { size: 10, gapAfter: 8 });
  addRule();

  sections.forEach((section) => {
    ensureSpace(30);
    addText(section.title, { bold: true, size: 12, gapAfter: 5 });
    if (section.lines.length === 0) {
      addText("Sem dados para este período.", { size: 9, indent: 8, gapAfter: 5 });
    } else {
      section.lines.forEach((line) => addText(line, { size: 8.5, indent: 8, gapAfter: 1.5 }));
    }
    y -= 5;
  });

  pages.forEach((commands, index) => {
    commands.push(`BT /F1 7 Tf 1 0 0 1 ${marginX} 25 Tm (Página ${index + 1} de ${pages.length}) Tj ET`);
  });

  const objects: Record<number, string> = {};
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

  const pageRefs: string[] = [];
  pages.forEach((commands, index) => {
    const contentId = 5 + index * 2;
    const pageId = contentId + 1;
    const stream = commands.join("\n");
    const streamLength = Buffer.byteLength(stream, "latin1");
    objects[contentId] = `<< /Length ${streamLength} >>\nstream\n${stream}\nendstream`;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    pageRefs.push(`${pageId} 0 R`);
  });
  objects[2] = `<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pages.length} >>`;

  const maxObjectId = Math.max(...Object.keys(objects).map(Number));
  let pdf = "%PDF-1.4\n%µµµµ\n";
  const offsets: number[] = new Array(maxObjectId + 1).fill(0);

  for (let id = 1; id <= maxObjectId; id += 1) {
    offsets[id] = Buffer.byteLength(pdf, "latin1");
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${maxObjectId + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let id = 1; id <= maxObjectId; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${maxObjectId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Uint8Array(Buffer.from(pdf, "latin1"));
}
