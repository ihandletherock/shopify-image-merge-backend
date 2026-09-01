const Jimp = require('jimp');
const { parseBase64Image } = require('../utils/base64');

async function readBase64(dataUrl) {
  const { buffer } = parseBase64Image(dataUrl);
  return Jimp.read(buffer);
}

function normalizeTextItems(textItems) {
  if (!Array.isArray(textItems)) return [];
  return textItems.filter(Boolean).map((item, index) => ({
    text: String(item.text || '').trim(),
    x: Number(item.x ?? 40),
    y: Number(item.y ?? (40 + index * 34)),
    size: Number(item.size ?? 28),
    color: item.color || '#ffffff',
    align: item.align || 'left'
  }));
}

async function drawTextLayers(image, textItems) {
  const items = normalizeTextItems(textItems);
  if (!items.length) return image;

  const whiteFont = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
  const blackFont = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);

  for (const item of items) {
    const font = item.color && item.color.toLowerCase() === '#000000' ? blackFont : whiteFont;
    image.print(
      font,
      item.x,
      item.y,
      {
        text: item.text,
        alignmentX: item.align === 'center' ? Jimp.HORIZONTAL_ALIGN_CENTER : Jimp.HORIZONTAL_ALIGN_LEFT
      },
      image.bitmap.width - item.x * 2,
      item.size + 20
    );
  }

  return image;
}

async function applySimpleEffect(image, effect) {
  const value = String(effect || '').toLowerCase();

  if (value.includes('gradient')) {
    try {
      image.posterize(4).contrast(0.25).brightness(0.08);
      image.color([
        { apply: 'mix', params: [0x7d3cff, 0.28] },
        { apply: 'mix', params: [0xef3a9a, 0.22] },
        { apply: 'mix', params: [0x13bafc, 0.18] }
      ]);
    } catch (e) {
      image.posterize(4).contrast(0.2);
    }
  } else if (value.includes('mosaic')) {
    image.posterize(8).contrast(0.18).brightness(0.05);
  } else if (value.includes('splatter')) {
    image.contrast(0.12).posterize(20);
  } else if (value.includes('vintage')) {
    image.sepia().contrast(0.05);
  } else if (value.includes('neon')) {
    image.brightness(0.05).contrast(0.2);
  } else if (value.includes('mono')) {
    image.greyscale().contrast(0.1);
  }

  return image;
}

async function composeSingleGear({ baseImageDataUrl, gearConfig, textItems, effect, silhouetteMaskDataUrl }) {
  if (!baseImageDataUrl) {
    throw new Error('Missing uploaded_image');
  }

  const base = await readBase64(baseImageDataUrl);
  base.contain(1400, 1400);

  // optional silhouette mask blend placeholder
  if (silhouetteMaskDataUrl) {
    try {
      const mask = await readBase64(silhouetteMaskDataUrl);
      mask.resize(base.bitmap.width, base.bitmap.height);
      base.mask(mask, 0, 0);
    } catch (e) {
      // ignore invalid mask
    }
  }

  await applySimpleEffect(base, effect);
  await drawTextLayers(base, textItems);

  // gear config placeholder handling
  if (gearConfig && gearConfig.label) {
    const font = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
    base.print(font, 20, base.bitmap.height - 40, `Gear: ${gearConfig.label}`);
  }

  return base.getBufferAsync(Jimp.MIME_PNG);
}

async function composePreview(buffer1, buffer2) {
  const img1 = await Jimp.read(buffer1);
  const img2 = await Jimp.read(buffer2);

  img1.cover(1000, 1000);
  img2.cover(1000, 1000);

  const canvas = new Jimp(2000, 1000, '#111111');
  canvas.composite(img1, 0, 0);
  canvas.composite(img2, 1000, 0);

  return canvas.getBufferAsync(Jimp.MIME_PNG);
}

module.exports = {
  composeSingleGear,
  composePreview
};
