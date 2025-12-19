import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import type { PDFFont } from "pdf-lib";

export interface PostcardFormData {
  fullName: string;
  email: string;
  faculty?: string;
  location?: string;
  country?: string;
  term?: string;
  message?: string;
  isFreemover?: boolean;
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

  // 2. Right Side (Address Side)
  // Draw vertical separator line
  const separatorX = width / 2;
  page.drawLine({
    start: { x: separatorX, y: 40 },
    end: { x: separatorX, y: height - 40 },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });

  // --- STAMP & POSTMARK ---
  // Load stamp based on country
  let stampBytes: ArrayBuffer | null = null;
  if (data.country) {
    try {
      // Try PNG first (preferred format from requirements)
      stampBytes = await loadImage(`/stamps/${data.country}.png`).catch(() => null);
      if (!stampBytes) {
        // Try SVG if PNG fails (though we asked for PNGs, good to have fallback if user provides SVGs)
        // Note: SVG loading in browser context might need conversion. 
        // For now, let's assume PNGs are provided as requested.
        // If we really need SVG support here, we'd need to fetch it as text and use convertSvgToPng.
        // But let's stick to the requirements document asking for PNGs.
        console.warn(`Stamp for ${data.country} not found (checked .png).`);
      }
    } catch (e) {
      console.error("Error loading stamp:", e);
    }
  }

  const stampWidth = 60;
  const stampHeight = 70; // Approximation, will adjust ratio
  const stampX = width - stampWidth - 20;
  const stampY = height - stampHeight - 20;

  if (stampBytes) {
    try {
      const stampImage = await doc.embedPng(stampBytes);
      // Maintain aspect ratio
      const stampDims = stampImage.scaleToFit(stampWidth, stampHeight);

      page.drawImage(stampImage, {
        x: width - stampDims.width - 20, // Align right
        y: height - stampDims.height - 20, // Align top
        width: stampDims.width,
        height: stampDims.height,
      });
    } catch (e) {
      console.error("Failed to embed stamp image:", e);
    }
  } else {
    // Fallback: Draw a placeholder rectangle if no stamp found
    page.drawRectangle({
      x: stampX,
      y: stampY,
      width: stampWidth,
      height: stampHeight,
      borderColor: rgb(0.7, 0.7, 0.7),
      borderWidth: 1,
      color: rgb(0.95, 0.95, 0.95),
    });
  }

  // Draw Postmark (Stempel) OVER the stamp
  // We use the existing 'stempel.png' if available, or draw a simple one
  // The original code didn't seem to load a 'stempel.png', it just drew text?
  // Looking at previous file content, I don't see a stempel image being loaded.
  // I will draw a simple vector postmark or load one if it exists.
  // Since I don't have a stempel asset, I'll draw a circle and some wavy lines.

  // Draw simulated postmark
  const postmarkX = stampX - 10;
  const postmarkY = stampY - 10;
  const postmarkRadius = 25;

  page.drawCircle({
    x: postmarkX,
    y: postmarkY,
    size: postmarkRadius,
    borderColor: rgb(0.2, 0.2, 0.2),
    borderWidth: 2,
    opacity: 0.7,
  });

  // Wavy lines
  // ... (omitted for simplicity, circle is enough for now)

  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText("HTW DRESDEN", {
    x: postmarkX - 20,
    y: postmarkY + 5,
    size: 6,
    font: font,
    color: rgb(0.2, 0.2, 0.2),
    rotate: degrees(-15),
    opacity: 0.7,
  });
  page.drawText(new Date().toLocaleDateString("de-DE"), {
    x: postmarkX - 15,
    y: postmarkY - 5,
    size: 6,
    font: font,
    color: rgb(0.2, 0.2, 0.2),
    rotate: degrees(-15),
    opacity: 0.7,
  });

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
  const topPadding = 180; // Below Logo (Increased from 130)
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
  cursorY -= 48; // Increased gap from 32

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
  const footerY = 200; // Moved up from 160 to avoid pine branches

  // Signature Area (Bottom Left, above Pine)
  const line1Y = 210;
  const line2Y = 194;
  const footerFontSize = 12;

  // Line 1: Location (Uni, Land) or Freemover
  const locationText = data.isFreemover ? "Freemover" : (data.location?.trim() || "");

  // Line 2: Faculty • Term
  let line2Parts: string[] = [];
  if (data.faculty) line2Parts.push(data.faculty);
  if (data.term) line2Parts.push(data.term);
  const line2Text = line2Parts.join(" • ");

  if (locationText && line2Text) {
    // Both lines present
    const w1 = sansFont.widthOfTextAtSize(locationText, footerFontSize);
    page.drawText(locationText, {
      x: centerX - (w1 / 2),
      y: line1Y,
      size: footerFontSize,
      font: sansFont,
      color: rgb(0.4, 0.4, 0.4),
    });

    const w2 = sansFont.widthOfTextAtSize(line2Text, footerFontSize);
    page.drawText(line2Text, {
      x: centerX - (w2 / 2),
      y: line2Y,
      size: footerFontSize,
      font: sansFont,
      color: rgb(0.4, 0.4, 0.4),
    });
  } else if (locationText || line2Text) {
    // Only one of them present -> center vertically between line1Y and line2Y
    const text = locationText || line2Text;
    const w = sansFont.widthOfTextAtSize(text, footerFontSize);
    const midY = (line1Y + line2Y) / 2;
    page.drawText(text, {
      x: centerX - (w / 2),
      y: midY,
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
