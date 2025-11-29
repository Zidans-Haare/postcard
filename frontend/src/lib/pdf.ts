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
const LEFT_SAFE_MARGIN = 70;
const RIGHT_SAFE_MARGIN = 40;

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
  const leftMargin = LEFT_SAFE_MARGIN;
  const rightMargin = RIGHT_SAFE_MARGIN;
  const contentWidth = width - RIGHT_COLUMN_WIDTH - leftMargin - rightMargin;
  let cursorY = height - 120;

  const drawCenteredText = (
    text: string,
    y: number,
    options: { font: PDFFont; size: number; color: ReturnType<typeof rgb> }
  ) => {
    const { font, size, color } = options;
    const textWidth = font.widthOfTextAtSize(text, size);
    const startX = leftMargin + (contentWidth - textWidth) / 2;
    page.drawText(text, {
      x: startX,
      y,
      size,
      font,
      color,
    });
  };

  // Logo-Platzhalter (anged. Textlogo)
  drawCenteredText("StuRa", cursorY, {
    font: sansFont,
    size: 22,
    color: rgb(0.153, 0.302, 0.408),
  });
  drawCenteredText("HTWD", cursorY - 24, {
    font: sansFont,
    size: 22,
    color: ORANGE,
  });

  cursorY -= 70;

  drawCenteredText("Liebe Kommiliton:innen", cursorY, {
    font: serifBoldFont,
    size: 22,
    color: rgb(0.1, 0.1, 0.1),
  });
  cursorY -= 42;

  const locationLine = data.location?.trim()
    ? `Liebe Grüße aus ${data.location.trim()}`
    : "Liebe Grüße aus meinem Auslandsaufenthalt";

  drawCenteredText(locationLine, cursorY, {
    font: serifBoldFont,
    size: 18,
    color: rgb(0.1, 0.1, 0.1),
  });
  cursorY -= 36;

  const message = data.message?.trim() || "Hier steht dein Kurztext.";
  const paragraphWidth = contentWidth;
  const messageLines = wrapText(message, paragraphWidth, serifFont, 16);

  for (const line of messageLines) {
    drawCenteredText(line, cursorY, {
      font: serifFont,
      size: 16,
      color: rgb(0.2, 0.2, 0.2),
    });
    cursorY -= 22;
  }

  // Datum/Signatur
  const footerY = 80;
  drawCenteredText(data.fullName || "HTW-Outgoing", footerY + 20, {
    font: serifBoldFont,
    size: 14,
    color: rgb(0.1, 0.1, 0.1),
  });

  const now = new Date();
  const metaLine = `Erstellt am ${now.toLocaleDateString("de-DE")}`;
  drawCenteredText(metaLine, footerY, {
    font: serifFont,
    size: 12,
    color: rgb(0.45, 0.45, 0.45),
  });

  // dezente Bodenfläche
  page.drawRectangle({
    x: leftMargin,
    y: footerY - 52,
    width: contentWidth,
    height: 14,
    color: rgb(0.82, 0.91, 0.86),
  });

  const bytes = await doc.save();
  const normalizedBytes = Uint8Array.from(bytes);
  const blob = new Blob([normalizedBytes], { type: "application/pdf" });
  const fileName = `Digitale_Postkarte_${Date.now()}.pdf`;
  return new File([blob], fileName, { type: "application/pdf" });
}
