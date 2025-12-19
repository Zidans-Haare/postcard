import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
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
  image?: File; // User uploaded photo
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

// Helper to convert SVG string (or URL) to PNG ArrayBuffer via Canvas (runs in the browser)
async function convertSvgToPng(
  url: string,
  width: number,
  height: number,
  scale: number = 1,
  removeWhiteBackground: boolean = false
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, width * scale, height * scale);

      if (removeWhiteBackground) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (r > 240 && g > 240 && b > 240) {
            data[i + 3] = 0;
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
  const resultLines: string[] = [];
  const inputLines = text.split(/\r?\n/);

  for (const inputLine of inputLines) {
    if (inputLine.trim() === "") {
      resultLines.push("");
      continue;
    }

    const words = inputLine.split(" ");
    let currentLine = "";

    for (const word of words) {
      if (word === "") continue;

      let tempWord = word;
      while (tempWord.length > 0) {
        const testLine = currentLine ? `${currentLine} ${tempWord}` : tempWord;
        const width = font.widthOfTextAtSize(testLine, fontSize);

        if (width <= maxWidth) {
          currentLine = testLine;
          tempWord = "";
        } else {
          if (currentLine) {
            resultLines.push(currentLine);
            currentLine = "";
          } else {
            // Forced break for word longer than maxWidth
            let breakIndex = tempWord.length - 1;
            while (breakIndex > 0 && font.widthOfTextAtSize(tempWord.substring(0, breakIndex), fontSize) > maxWidth) {
              breakIndex--;
            }
            if (breakIndex === 0) breakIndex = 1;
            resultLines.push(tempWord.substring(0, breakIndex));
            tempWord = tempWord.substring(breakIndex);
          }
        }
      }
    }
    if (currentLine) {
      resultLines.push(currentLine);
    }
  }

  return resultLines;
}

export async function createPostcardPdf(data: PostcardFormData): Promise<File> {
  const doc = await PDFDocument.create();
  const page = doc.addPage(A4_LANDSCAPE);
  const width = page.getWidth();
  const height = page.getHeight();
  // --- PAGE CONSTRUCTION (Back Side Only) ---

  // 1. Base Backgrounds
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(1, 1, 1),
  });

  const rightColWidth = width / 2;
  page.drawRectangle({
    x: width - rightColWidth,
    y: 0,
    width: rightColWidth,
    height,
    color: rgb(0.925, 0.427, 0.075),
  });

  // 2. Decorative Assets
  const ASSET_SCALE = 3;
  try {
    const pinePng = await convertSvgToPng(
      "/postkarte-assets/Tannenzweige_Digitale Postkarte 2025.svg",
      width,
      height,
      ASSET_SCALE,
      true
    );
    const pineImage = await doc.embedPng(pinePng);
    const pineScale = Math.max(width / pineImage.width, height / pineImage.height);
    const pineDims = pineImage.scale(pineScale);
    page.drawImage(pineImage, {
      x: 0,
      y: 0,
      width: pineDims.width,
      height: pineDims.height,
    });

    const stampPng = await convertSvgToPng(
      "/postkarte-assets/Poststempel_Digitale Postkarte 2025.svg",
      width,
      height,
      ASSET_SCALE
    );
    const stampImage = await doc.embedPng(stampPng);
    page.drawImage(stampImage, {
      x: 0,
      y: 0,
      width,
      height,
    });

    const logoWidth = 140;
    const logoPng = await convertSvgToPng(
      "/postkarte-assets/StuRa Logo_Digitale Postkarte 2025.svg",
      logoWidth,
      100,
      ASSET_SCALE
    );
    const logoImage = await doc.embedPng(logoPng);
    const logoDims = logoImage.scaleToFit(logoWidth, 100);
    page.drawImage(logoImage, {
      x: 20,
      y: height - 30 - logoDims.height,
      width: logoDims.width,
      height: logoDims.height,
    });
  } catch (e) {
    console.error("Failed to load/convert assets", e);
  }

  // 3. Text Content
  const textColor = rgb(0.2, 0.2, 0.2);
  const leftPadding = 20;
  const topPadding = 150;
  const availableWidth = width - rightColWidth - leftPadding - 40;
  const contentWidth = availableWidth * 0.75;
  const centerX = leftPadding + availableWidth / 2;

  const sansFont = await doc.embedFont(StandardFonts.Helvetica);
  let cursorY = height - topPadding;

  const headingText = "Liebe Kommiliton:innen";
  const headingSize = 17;
  const headingWidth = sansFont.widthOfTextAtSize(headingText, headingSize);
  page.drawText(headingText, {
    x: centerX - headingWidth / 2,
    y: cursorY,
    size: headingSize,
    font: sansFont,
    color: rgb(0.1, 0.1, 0.1),
  });
  cursorY -= 32;

  const messageText = data.message || "Hier steht dein Kurztext.";
  const fontSize = 14;
  const lineHeight = 20;
  const lines = breakTextIntoLines(messageText, contentWidth, sansFont, fontSize);
  for (const line of lines) {
    const lineWidth = sansFont.widthOfTextAtSize(line, fontSize);
    page.drawText(line, {
      x: centerX - lineWidth / 2,
      y: cursorY,
      size: fontSize,
      font: sansFont,
      color: textColor,
    });
    cursorY -= lineHeight;
  }

  // Signature Area
  const line1Y = 170;
  const line2Y = 154;
  const footerFontSize = 12;
  const locationText = data.isFreemover ? "Freemover" : data.location?.trim() || "";
  const line2Parts: string[] = [];
  if (data.faculty) line2Parts.push(data.faculty);
  if (data.term) line2Parts.push(data.term);
  const line2Text = line2Parts.join(" • ");

  if (locationText || line2Text) {
    if (locationText && line2Text) {
      const w1 = sansFont.widthOfTextAtSize(locationText, footerFontSize);
      page.drawText(locationText, {
        x: centerX - w1 / 2,
        y: line1Y,
        size: footerFontSize,
        font: sansFont,
        color: textColor,
      });
      const w2 = sansFont.widthOfTextAtSize(line2Text, footerFontSize);
      page.drawText(line2Text, {
        x: centerX - w2 / 2,
        y: line2Y,
        size: footerFontSize,
        font: sansFont,
        color: textColor,
      });
    } else {
      const text = locationText || line2Text;
      const w = sansFont.widthOfTextAtSize(text, footerFontSize);
      const midY = (line1Y + line2Y) / 2;
      page.drawText(text, {
        x: centerX - w / 2,
        y: midY,
        size: footerFontSize,
        font: sansFont,
        color: textColor,
      });
    }
  }

  // 4. Address Side
  const addressX = width - rightColWidth + 40;
  const addressY = 295;
  const addressLineHeight = 38;
  const addressLines = [
    "HTW Dresden",
    "Stabsstelle Internationales",
    "Friedrich-List Platz 1",
    "01069 Dresden",
  ];

  for (let i = 0; i < addressLines.length; i++) {
    const lineY = addressY - i * addressLineHeight;
    page.drawText(addressLines[i], {
      x: addressX,
      y: lineY,
      size: 26,
      font: sansFont,
      color: rgb(1, 1, 1),
    });
    page.drawLine({
      start: { x: addressX, y: lineY - 6 },
      end: { x: addressX + 340, y: lineY - 6 },
      thickness: 1,
      color: rgb(1, 1, 1),
      opacity: 0.6,
    });
  }

  // Vertical Separator
  const separatorX = width / 2;
  page.drawLine({
    start: { x: separatorX, y: 40 },
    end: { x: separatorX, y: height - 40 },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });

  // Final Border
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    borderColor: rgb(0, 0, 0),
    borderWidth: 2,
    color: undefined,
  });

  const bytes = await doc.save();
  const normalizedBytes = Uint8Array.from(bytes);
  const blob = new Blob([normalizedBytes], { type: "application/pdf" });
  const fileName = `Digitale_Postkarte_${Date.now()}.pdf`;
  return new File([blob], fileName, { type: "application/pdf" });
}
