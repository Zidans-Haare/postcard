import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import type { PDFFont } from "pdf-lib";

export interface PostcardFormData {
  fullName: string;
  faculty?: string;
  location?: string;
  term?: string;
  message?: string;
}

const A4_LANDSCAPE: [number, number] = [842, 595];

// Helper to load an image from a URL
async function loadImage(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load image: ${url}`);
  }
  return response.arrayBuffer();
}

// Helper to convert SVG string (or URL) to PNG ArrayBuffer via Canvas
// Note: This runs in the browser.
async function convertSvgToPng(url: string, width: number, height: number, scale: number = 1, removeWhiteBackground: boolean = false): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      // Create canvas at scaled resolution
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }
      // Draw image scaled
      ctx.drawImage(img, 0, 0, width * scale, height * scale);

      if (removeWhiteBackground) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // If pixel is white (or very close to white), make it transparent
          if (r > 240 && g > 240 && b > 240) {
            data[i + 3] = 0; // Alpha = 0
          }
        }
        ctx.putImageData(imageData, 0, 0);
      }

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Canvas toBlob failed"));
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result instanceof ArrayBuffer) {
            resolve(new Uint8Array(reader.result));
          } else {
            reject(new Error("FileReader result is not ArrayBuffer"));
          }
        };
        reader.readAsArrayBuffer(blob);
      }, "image/png");
    };
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

function breakTextIntoLines(
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
  // const sansFont = await doc.embedFont(StandardFonts.HelveticaBold);

  // 1. Background Construction
  // White background for left side
  page.drawRectangle({
    x: 0,
    y: 0,
    width: width,
    height: height,
    color: rgb(1, 1, 1),
  });

  // Black Border
  page.drawRectangle({
    x: 0,
    y: 0,
    width: width,
    height: height,
    borderColor: rgb(0, 0, 0),
    borderWidth: 2,
    color: undefined, // Transparent fill
  });

  // Orange background for right side
  // Width: 356px (approx 5.5/13 of A4 landscape width 842)
  const rightColWidth = 356;
  page.drawRectangle({
    x: width - rightColWidth,
    y: 0,
    width: rightColWidth,
    height: height,
    color: rgb(0.925, 0.427, 0.075), // #ec6d13
  });

  // 2. Assets
  const ASSET_SCALE = 3;

  try {
    // Logo (Left side)
    const logoWidth = 140;
    const logoHeight = 99; // 140 / 1.41 aspect ratio
    const logoPng = await convertSvgToPng("/postkarte-assets/StuRa Logo_Digitale Postkarte 2025.svg", logoWidth, logoHeight, ASSET_SCALE);
    const logoImage = await doc.embedPng(logoPng);
    page.drawImage(logoImage, {
      x: 20,
      y: height - 30 - logoHeight,
      width: logoWidth,
      height: logoHeight,
    });

    // Stamp (Full page overlay)
    // The SVG contains both the stamp and the waves, positioned relative to the full page.
    const stampPng = await convertSvgToPng("/postkarte-assets/Poststempel_Digitale Postkarte 2025.svg", width, height, ASSET_SCALE);
    const stampImage = await doc.embedPng(stampPng);
    page.drawImage(stampImage, {
      x: 0,
      y: 0,
      width: width,
      height: height,
    });

    // Pine Branches (Overlay at bottom)
    // Full width/height to ensure correct positioning if the SVG is designed that way
    // Enable removeWhiteBackground to fix transparency on orange background
    const pinePng = await convertSvgToPng("/postkarte-assets/Tannenzweige_Digitale Postkarte 2025.svg", width, height, ASSET_SCALE, true);
    const pineImage = await doc.embedPng(pinePng);
    page.drawImage(pineImage, {
      x: 0,
      y: 0,
      width: width,
      height: height,
    });

  } catch (e) {
    console.error("Failed to load/convert assets", e);
  }

  // 3. Text Content (Left Side)
  const leftPadding = 20;
  const topPadding = 130; // Below Logo
  // Reduce content width to make text box narrower (approx 60% of available space)
  const availableWidth = width - rightColWidth - leftPadding - 40;
  const contentWidth = availableWidth * 0.72;
  const centerX = leftPadding + (availableWidth / 2);

  let cursorY = height - topPadding;

  // Use Helvetica as standard sans-serif fallback for Open Sans
  const sansFont = await doc.embedFont(StandardFonts.Helvetica);

  // "Liebe Kommiliton:innen" (Centered, Sans-Serif, Normal Weight)
  const headingText = "Liebe Kommiliton:innen";
  const headingSize = 18;
  const headingWidth = sansFont.widthOfTextAtSize(headingText, headingSize);

  page.drawText(headingText, {
    x: centerX - (headingWidth / 2),
    y: cursorY,
    size: 17,
    font: sansFont,
    color: rgb(0.1, 0.1, 0.1),
  });
  cursorY -= 32;

  // Message Body (Centered, Sans-Serif)
  const messageText = data.message || "Hier steht dein Kurztext.";
  const fontSize = 14;
  const lineHeight = 20;

  const lines = breakTextIntoLines(messageText, contentWidth, sansFont, fontSize);

  for (const line of lines) {
    const lineWidth = sansFont.widthOfTextAtSize(line, fontSize);
    page.drawText(line, {
      x: centerX - (lineWidth / 2),
      y: cursorY,
      size: fontSize,
      font: sansFont,
      color: rgb(0.2, 0.2, 0.2),
    });
    cursorY -= lineHeight;
  }

  // Signature Area (Bottom Left, above Pine)
  // Pine branches take up bottom ~150px?
  const footerY = 160;

  // Construct footer string: Location • Faculty • Term
  let footerParts: string[] = [];
  if (data.location?.trim()) footerParts.push(data.location.trim());
  if (data.faculty) footerParts.push(data.faculty);
  if (data.term) footerParts.push(data.term);

  const footerText = footerParts.join(" • ");

  if (footerText) {
    const footerFontSize = 12;
    const footerWidth = sansFont.widthOfTextAtSize(footerText, footerFontSize);

    page.drawText(footerText, {
      x: centerX - (footerWidth / 2),
      y: footerY,
      size: footerFontSize,
      font: sansFont,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  // 4. Address Lines (Right Side)
  const addressX = width - rightColWidth + 40;
  const addressY = 320; // Moved up to match CSS margin-bottom: 280px
  const addressLineHeight = 38; // Increased line height for larger font

  const addressLines = [
    "HTW Dresden",
    "Stabsstelle Internationales",
    "Friedrich-List Platz 1",
    "01069 Dresden",
  ];

  // Use Helvetica as standard sans-serif fallback for Open Sans
  // const sansFont = await doc.embedFont(StandardFonts.Helvetica); // Already embedded above
  // const sansBoldFont = await doc.embedFont(StandardFonts.HelveticaBold); // Not needed anymore

  for (let i = 0; i < addressLines.length; i++) {
    const lineY = addressY - i * addressLineHeight;
    const text = addressLines[i];

    page.drawText(text, {
      x: addressX,
      y: lineY,
      size: 26, // Increased from 22
      font: sansFont, // Always normal weight
      color: rgb(1, 1, 1),
    });

    // Underline (Fixed width)
    const lineWidth = 340; // Increased from 280
    page.drawLine({
      start: { x: addressX, y: lineY - 6 },
      end: { x: addressX + lineWidth, y: lineY - 6 },
      thickness: 1,
      color: rgb(1, 1, 1),
      opacity: 0.6,
    });
  }

  const bytes = await doc.save();
  const normalizedBytes = Uint8Array.from(bytes);
  const blob = new Blob([normalizedBytes], { type: "application/pdf" });
  const fileName = `Digitale_Postkarte_${Date.now()}.pdf`;
  return new File([blob], fileName, { type: "application/pdf" });
}
