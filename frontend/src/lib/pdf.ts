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
const RIGHT_COLUMN_WIDTH = 250;
const ORANGE = rgb(0.894, 0.392, 0.012);

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

  const serifFont = await doc.embedFont(StandardFonts.TimesRoman);
  const serifBoldFont = await doc.embedFont(StandardFonts.TimesRomanBold);
  const sansFont = await doc.embedFont(StandardFonts.HelveticaBold);

  // Grundfläche (weiß)
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(1, 1, 1),
  });

  // Rechte orangene Spalte
  page.drawRectangle({
    x: width - RIGHT_COLUMN_WIDTH,
    y: 0,
    width: RIGHT_COLUMN_WIDTH,
    height,
    color: ORANGE,
  });

  // Briefmarkenwellen (vereinfachtes Ornament)
  const stampBaseX = width - RIGHT_COLUMN_WIDTH + 40;
  const stampBaseY = height - 140;
  const waveWidth = 150;
  for (let i = 0; i < 4; i += 1) {
    page.drawLine({
      start: { x: stampBaseX, y: stampBaseY - i * 12 },
      end: { x: stampBaseX + waveWidth, y: stampBaseY - i * 12 },
      thickness: 1.5,
      color: rgb(1, 1, 1),
    });
  }
  page.drawCircle({
    x: stampBaseX + waveWidth + 28,
    y: stampBaseY - 10,
    size: 36,
    borderColor: rgb(1, 1, 1),
    borderWidth: 2,
  });

  // Adresse rechts
  const addressX = width - RIGHT_COLUMN_WIDTH + 30;
  let addressY = height - 220;
  const addressLines = [
    "HTW Dresden",
    "Stabstelle Internationales",
    "Friedrich-List Platz 1",
    "01069 Dresden",
  ];
  for (const [index, line] of addressLines.entries()) {
    page.drawText(line, {
      x: addressX,
      y: addressY,
      size: 16,
      font: sansFont,
      color: rgb(1, 1, 1),
    });
    addressY -= 28;
    if (index < addressLines.length - 1) {
      page.drawLine({
        start: { x: addressX, y: addressY + 24 },
        end: { x: width - 40, y: addressY + 24 },
        thickness: 1,
        color: rgb(1, 1, 1),
      });
    }
  }

  // Linker Textbereich
  const leftMargin = 70;
  let cursorY = height - 120;

  // Logo-Platzhalter
  page.drawText("STURA", {
    x: leftMargin,
    y: cursorY,
    size: 24,
    font: sansFont,
    color: rgb(0.153, 0.302, 0.408),
  });
  page.drawText("HTWD", {
    x: leftMargin,
    y: cursorY - 24,
    size: 24,
    font: sansFont,
    color: ORANGE,
  });

  cursorY -= 70;

  page.drawText("Liebe Kommiliton:innen", {
    x: leftMargin,
    y: cursorY,
    size: 22,
    font: serifBoldFont,
    color: rgb(0.1, 0.1, 0.1),
  });
  cursorY -= 40;

  const locationLine = data.location?.trim()
    ? `Liebe Grüße aus ${data.location.trim()}`
    : "Liebe Grüße aus meinem Auslandsaufenthalt";

  page.drawText(locationLine, {
    x: leftMargin,
    y: cursorY,
    size: 18,
    font: serifBoldFont,
    color: rgb(0.1, 0.1, 0.1),
  });
  cursorY -= 32;

  const message = data.message?.trim() || "Hier steht dein Kurztext.";
  const paragraphWidth = width - RIGHT_COLUMN_WIDTH - leftMargin - 40;
  const messageLines = wrapText(message, paragraphWidth, serifFont, 16);

  for (const line of messageLines) {
    page.drawText(line, {
      x: leftMargin,
      y: cursorY,
      size: 16,
      font: serifFont,
      color: rgb(0.2, 0.2, 0.2),
    });
    cursorY -= 22;
  }

  // Datum/Signatur
  const footerY = 80;
  page.drawText(data.fullName || "HTW-Outgoing", {
    x: leftMargin,
    y: footerY + 20,
    size: 14,
    font: serifBoldFont,
    color: rgb(0.1, 0.1, 0.1),
  });

  const now = new Date();
  const metaLine = `Erstellt am ${now.toLocaleDateString("de-DE")}`;
  page.drawText(metaLine, {
    x: leftMargin,
    y: footerY,
    size: 12,
    font: serifFont,
    color: rgb(0.45, 0.45, 0.45),
  });

  const bytes = await doc.save();
  const blob = new Blob([bytes], { type: "application/pdf" });
  const fileName = `Digitale_Postkarte_${Date.now()}.pdf`;
  return new File([blob], fileName, { type: "application/pdf" });
}
