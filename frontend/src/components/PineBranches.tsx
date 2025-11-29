"use client";

import { useEffect, useRef, useState } from "react";
import styles from "../app/page.module.css";

interface PineBranchesProps {
    src: string;
    className?: string;
}

export default function PineBranches({ src, className }: PineBranchesProps) {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = src;

        img.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            // Set canvas dimensions to image dimensions
            canvas.width = img.width;
            canvas.height = img.height;

            // Draw image
            ctx.drawImage(img, 0, 0);

            // Remove white background
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

            // Convert to data URL
            setImageUrl(canvas.toDataURL("image/png"));
        };
    }, [src]);

    if (!imageUrl) {
        // Return a placeholder or the original image while processing (optional)
        // For now, returning nothing to avoid flash of white box
        return null;
    }

    return (
        <img
            src={imageUrl}
            alt=""
            className={className}
        />
    );
}
