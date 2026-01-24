#!/usr/bin/env node
/**
 * Generate PWA icons from favicon.svg
 *
 * Usage: node scripts/generate-icons.mjs
 *
 * Requires: npm install -D sharp
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '../public');
const svgPath = path.join(publicDir, 'favicon.svg');

const svgBuffer = fs.readFileSync(svgPath);

// Icon configurations
const icons = [
  { name: 'apple-touch-icon.png', size: 180, maskable: false },
  { name: 'icon-192.png', size: 192, maskable: false },
  { name: 'icon-512.png', size: 512, maskable: false },
  { name: 'icon-maskable-192.png', size: 192, maskable: true },
  { name: 'icon-maskable-512.png', size: 512, maskable: true },
];

async function generateIcon({ name, size, maskable }) {
  const outputPath = path.join(publicDir, name);

  if (maskable) {
    // Maskable icons need safe zone padding (10% on each side = 20% total)
    // The icon content should fit within the inner 80% circle
    const padding = Math.round(size * 0.1);
    const innerSize = size - (padding * 2);

    // Create a background canvas with padding
    const background = sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 10, g: 10, b: 11, alpha: 1 }, // #0a0a0b from SVG
      }
    });

    // Resize the SVG to fit in the inner area
    const resizedIcon = await sharp(svgBuffer)
      .resize(innerSize, innerSize)
      .toBuffer();

    // Composite the icon onto the background with padding
    await background
      .composite([{
        input: resizedIcon,
        top: padding,
        left: padding,
      }])
      .png()
      .toFile(outputPath);
  } else {
    // Regular icons - just resize
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
  }

  console.log(`Generated: ${name} (${size}x${size}${maskable ? ' maskable' : ''})`);
}

async function main() {
  console.log('Generating PWA icons from favicon.svg...\n');

  for (const icon of icons) {
    await generateIcon(icon);
  }

  console.log('\nDone! Icons generated in client/public/');
}

main().catch(console.error);
