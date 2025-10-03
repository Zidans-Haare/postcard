import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { PDFFont } from "pdf-lib";

export interface PostcardFormData {
  fullName: string;
  faculty?: string;
  location?: string;
  term?: string;
  message?: string;
}

const A4_LANDSCAPE: [number, number] = [842, 595];

function wrapText(
  text: string,
  maxWidth: number,
  font: PDFFont,
  fontSize: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

export async function createPostcardPdf(data: PostcardFormData): Promise<File> {
  const doc = await PDFDocument.create();
  const page = doc.addPage(A4_LANDSCAPE);
  const width = page.getWidth();
  const height = page.getHeight();

  const headerFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await doc.embedFont(StandardFonts.Helvetica);

  // Hintergrund
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(0.95, 0.96, 0.98),
  });

  page.drawRectangle({
    x: 40,
    y: height - 160,
    width: width - 80,
    height: 120,
    color: rgb(0.2, 0.38, 0.63),
  });
  page.drawRectangle({
    x: 40,
    y: 40,
    width: width - 80,
    height: height - 240,
    color: rgb(1, 1, 1),
  });

  const margin = 60;
  let cursorY = height - 120;

  page.drawText("Digitale Postkarte", {
    x: margin,
    y: cursorY,
    size: 24,
    font: headerFont,
    color: rgb(1, 1, 1),
  });
  cursorY -= 50;

  page.drawText(data.fullName, {
    x: margin,
    y: cursorY,
    size: 32,
    font: headerFont,
    color: rgb(0.1, 0.13, 0.18),
  });
  cursorY -= 40;

  if (data.faculty) {
    page.drawText(data.faculty, {
      x: margin,
      y: cursorY,
      size: 18,
      font: bodyFont,
      color: rgb(0.27, 0.33, 0.42),
    });
    cursorY -= 28;
  }

  const infoLines: string[] = [];
  if (data.location) {
    infoLines.push(`Ort/Uni: ${data.location}`);
  }
  if (data.term) {
    infoLines.push(`Zeitraum: ${data.term}`);
  }

  let infoCursorY = cursorY;
  for (const info of infoLines) {
    page.drawText(info, {
      x: margin,
      y: infoCursorY,
      size: 16,
      font: bodyFont,
      color: rgb(0.29, 0.34, 0.45),
    });
    infoCursorY -= 24;
  }

  const message = data.message?.trim();
  if (message) {
    const maxWidth = width - margin * 2;
    const lines = wrapText(message, maxWidth, bodyFont, 18);
    let messageY = infoCursorY - 20;
    page.drawText("Kurztext", {
      x: margin,
      y: messageY,
      size: 16,
      font: headerFont,
      color: rgb(0.2, 0.38, 0.63),
    });
    messageY -= 26;
    for (const line of lines) {
      page.drawText(line, {
        x: margin,
        y: messageY,
        size: 18,
        font: bodyFont,
        color: rgb(0.1, 0.13, 0.18),
      });
      messageY -= 24;
    }
  }

  const now = new Date();
  const metaLine = `Erstellt am ${now.toLocaleDateString("de-DE")} um ${now
    .toLocaleTimeString("de-DE")
    .slice(0, 5)} Uhr`;
  page.drawText(metaLine, {
    x: margin,
    y: 60,
    size: 12,
    font: bodyFont,
    color: rgb(0.38, 0.43, 0.55),
  });

  const bytes = await doc.save();
  const blob = new Blob([bytes], { type: "application/pdf" });
  const fileName = `Digitale_Postkarte_${Date.now()}.pdf`;
  return new File([blob], fileName, { type: "application/pdf" });
}
