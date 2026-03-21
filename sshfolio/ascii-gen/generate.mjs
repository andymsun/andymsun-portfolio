// Standalone ASCII art generator using ink-picture's algorithms + Sharp
// Bypasses the Ink React rendering layer and writes directly to files
import sharp from "sharp";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const imagePath = join(__dirname, "photo.jpg");

// ink-picture's ASCII character set (ordered by brightness)
const ASCII_CHARS = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. ";

/**
 * toAscii - from ink-picture/build/components/image/Ascii.js
 */
function toAscii(data, width, height, channels, colored = false) {
  let result = "";
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIndex = (y * width + x) * channels;
      const r = data[pixelIndex];
      const g = data[pixelIndex + 1];
      const b = data[pixelIndex + 2];
      const a = channels === 4 ? data[pixelIndex + 3] : 255;
      const intensity = r + g + b + a === 0 ? 0 : (r + g + b + a) / (255 * 4);
      const pixel_char = ASCII_CHARS[ASCII_CHARS.length - 1 - Math.floor(intensity * (ASCII_CHARS.length - 1))];
      result += pixel_char;
    }
    result += "\n";
  }
  return result;
}

/**
 * toBraille - from ink-picture/build/components/image/Braille.js
 */
function rgbaToBlackOrWhite(r, g, b, a) {
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const alphaAdjustedLuminance = luminance * a + 255 * (1 - a);
  return alphaAdjustedLuminance > 128 ? 1 : 0;
}

function toBraille(data, width, height, channels) {
  let result = "";
  for (let y = 0; y < height - 3; y += 4) {
    for (let x = 0; x < width - 1; x += 2) {
      const getPixel = (py, px) => {
        const idx = (py * width + px) * channels;
        return {
          r: data[idx],
          g: data[idx + 1],
          b: data[idx + 2],
          a: channels === 4 ? data[idx + 3] : 1,
        };
      };
      const p = (py, px) => {
        const { r, g, b, a } = getPixel(py, px);
        return rgbaToBlackOrWhite(r, g, b, a);
      };

      const dot1 = p(y, x);
      const dot2 = p(y + 1, x);
      const dot3 = p(y + 2, x);
      const dot4 = p(y, x + 1);
      const dot5 = p(y + 1, x + 1);
      const dot6 = p(y + 2, x + 1);
      const dot7 = p(y + 3, x);
      const dot8 = p(y + 3, x + 1);

      const brailleChar = String.fromCharCode(
        0x2800 +
        (dot8 << 7) + (dot7 << 6) +
        (dot6 << 5) + (dot5 << 4) +
        (dot4 << 3) + (dot3 << 2) +
        (dot2 << 1) + dot1
      );
      result += brailleChar;
    }
    result += "\n";
  }
  return result;
}

/**
 * toHalfBlock - from ink-picture using ▀ and ▄ characters with ANSI colors
 */
function toHalfBlock(data, width, height, channels) {
  let result = "";
  for (let y = 0; y < height - 1; y += 2) {
    for (let x = 0; x < width; x++) {
      const topIdx = (y * width + x) * channels;
      const botIdx = ((y + 1) * width + x) * channels;
      const tr = data[topIdx], tg = data[topIdx + 1], tb = data[topIdx + 2];
      const br = data[botIdx], bg = data[botIdx + 1], bb = data[botIdx + 2];
      // Use ANSI 24-bit color: foreground for top half, background for bottom half
      // ▀ (upper half block) - foreground color shows on top, background on bottom
      result += `\x1b[38;2;${tr};${tg};${tb}m\x1b[48;2;${br};${bg};${bb}m▀\x1b[0m`;
    }
    result += "\n";
  }
  return result;
}

async function generate() {
  console.log("Loading image...");
  const image = sharp(imagePath);
  const metadata = await image.metadata();
  console.log(`Original: ${metadata.width}x${metadata.height}`);

  // --- ASCII ---
  console.log("\n=== Generating ASCII art ===");
  const asciiWidth = 50;
  const asciiHeight = Math.round(asciiWidth * metadata.height / metadata.width / 2); // /2 for char aspect ratio
  const asciiImg = await sharp(imagePath)
    .resize(asciiWidth, asciiHeight, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ascii = toAscii(asciiImg.data, asciiImg.info.width, asciiImg.info.height, asciiImg.info.channels);
  writeFileSync(join(__dirname, "output_ascii.txt"), ascii, "utf-8");
  console.log(`ASCII art saved (${asciiWidth}x${asciiHeight} chars)`);
  console.log(ascii);

  // --- BRAILLE ---
  console.log("\n=== Generating Braille art ===");
  const brailleCharWidth = 30;  // character width
  const braillePixelW = brailleCharWidth * 2;  // 2 pixels per braille char width
  const braillePixelH = Math.round(braillePixelW * metadata.height / metadata.width);
  // Round to multiple of 4 for braille rows
  const brailleH = Math.ceil(braillePixelH / 4) * 4;
  const brailleImg = await sharp(imagePath)
    .resize(braillePixelW, brailleH, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const braille = toBraille(brailleImg.data, brailleImg.info.width, brailleImg.info.height, brailleImg.info.channels);
  writeFileSync(join(__dirname, "output_braille.txt"), braille, "utf-8");
  console.log(`Braille art saved (${brailleCharWidth} chars wide)`);
  console.log(braille);

  // --- HALF BLOCK ---
  console.log("\n=== Generating Half-Block art ===");
  const hbWidth = 40;
  const hbPixelH = Math.round(hbWidth * metadata.height / metadata.width);
  const hbHeight = Math.ceil(hbPixelH / 2) * 2; // round to even for half-blocks
  const hbImg = await sharp(imagePath)
    .resize(hbWidth, hbHeight, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const halfBlock = toHalfBlock(hbImg.data, hbImg.info.width, hbImg.info.height, hbImg.info.channels);
  writeFileSync(join(__dirname, "output_halfblock.txt"), halfBlock, "utf-8");
  console.log(`Half-block art saved (${hbWidth}x${hbHeight / 2} chars)`);
  // Don't print halfblock to console as ANSI codes may mess up the log
  console.log("(Half-block output contains ANSI color codes - view in terminal)");

  console.log("\n✅ All three outputs saved!");
  console.log("  output_ascii.txt");
  console.log("  output_braille.txt");
  console.log("  output_halfblock.txt");
}

generate().catch(console.error);
