const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const OpenAI = require('openai');
const { uploadBufferToCloudinary } = require('../utils/cloudinaryUpload');

function openAIFetch(url, options = {}) {
  return globalThis.fetch(url, {
    ...options,
    ...(options.body ? { duplex: 'half' } : {})
  });
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: Number(process.env.OPENAI_MAX_RETRIES || 3),
  timeout: Number(process.env.OPENAI_TIMEOUT_MS || 120000),
  fetch: openAIFetch
});

function isOpenAIConnectionError(error) {
  const connectionCodes = new Set(['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN']);
  return error?.name === 'APIConnectionError' || connectionCodes.has(error?.code) || connectionCodes.has(error?.cause?.code);
}

exports.checkOpenAIConnection = async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ success: false, status: 'missing_api_key' });
  }

  try {
    await openai.models.list();
    return res.json({ success: true, status: 'connected' });
  } catch (error) {
    console.error('OpenAI connectivity check failed:', error);
    return res.status(isOpenAIConnectionError(error) ? 503 : error.status || 502).json({
      success: false,
      status: isOpenAIConnectionError(error) ? 'connection_failed' : 'api_error',
      message: error.status === 401 ? 'OpenAI rejected the API key.' : 'OpenAI connectivity check failed.'
    });
  }
}

function parseDataUrl(dataUrl, fieldName = 'image') {
  if (!dataUrl || typeof dataUrl !== 'string') {
    throw new Error(`${fieldName} is required.`);
  }

  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error(`${fieldName} must be a valid base64 image data URL.`);
  }

  return {
    buffer: Buffer.from(match[2], 'base64'),
    mimeType: match[1]
  };
}

function extensionFromMimeType(mimeType) {
  switch (mimeType.toLowerCase()) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return 'bin';
  }
}

function createTempImageFile(buffer, extension = 'png') {
  const fileName = `openai-${crypto.randomBytes(6).toString('hex')}.${extension}`;
  const filePath = path.join(os.tmpdir(), fileName);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

exports.generateSilhouette = async (req, res, next) => {
  try {
    const { uploaded_image, prompt } = req.body || {};

    if (!uploaded_image) {
      return res.status(422).json({
        success: false,
        message: 'uploaded_image is required.'
      });
    }

    if (!prompt) {
      return res.status(422).json({
        success: false,
        message: 'prompt is required.'
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'OpenAI API key is not configured.'
      });
    }

    const { buffer: imageBuffer, mimeType } = parseDataUrl(uploaded_image, 'uploaded_image');
    const extension = extensionFromMimeType(mimeType);
    const imageFile = await OpenAI.toFile(imageBuffer, `uploaded-image.${extension}`, { type: mimeType });

    const result = await openai.images.edit({
      model: 'gpt-image-1',
      image: imageFile,
      prompt: prompt,
      size: '1024x1024',
      background: 'transparent',
      output_format: 'png',
      n: 1
    });

    const base64 = result?.data?.[0]?.b64_json;
    if (!base64) {
      throw new Error('OpenAI did not return an edited image.');
    }

    const generatedImage = `data:image/png;base64,${base64}`;

    return res.json({
      success: true,
      generated_image: generatedImage
    });
  } catch (error) {
    if (isOpenAIConnectionError(error)) {
      console.error('OpenAI image generation connection failed:', error);
      return res.status(503).json({
        success: false,
        message: 'Image generation service is temporarily unavailable. Please try again.'
      });
    }

    next(error);
  }
};

exports.composeGearImages = async (req, res, next) => {
  try {
    const {
      section_id,
      uploaded_image,
      gear_1,
      gear_2,
      preview_image,
      product
    } = req.body || {};

    const gear1ComposedImage =
      gear_1?.composed_image ||
      gear_1?.preview_image ||
      gear_1?.overlay_image ||
      gear_1?.image ||
      null;

    const gear2ComposedImage =
      gear_2?.composed_image ||
      gear_2?.preview_image ||
      gear_2?.overlay_image ||
      gear_2?.image ||
      null;

    const previewImageDataUrl =
      preview_image ||
      gear_2?.preview_image ||
      gear_2?.composed_image ||
      gear_1?.preview_image ||
      gear_1?.composed_image ||
      null;

    if (!uploaded_image) {
      return res.status(422).json({
        success: false,
        message: 'uploaded_image is required.'
      });
    }

    if (!gear_1 || !gear1ComposedImage) {
      return res.status(422).json({
        success: false,
        message: 'gear_1.composed_image is required.'
      });
    }

    if (!gear_2 || !gear2ComposedImage) {
      return res.status(422).json({
        success: false,
        message: 'gear_2.composed_image is required.'
      });
    }

    if (!previewImageDataUrl) {
      return res.status(422).json({
        success: false,
        message: 'preview_image is required.'
      });
    }

    const hash = crypto.randomBytes(6).toString('hex');
    const folder = `custom-builder/${product?.handle || 'builder'}/${hash}`;

    const uploadedImageData = parseDataUrl(uploaded_image, 'uploaded_image');
    const gear1ImageData = parseDataUrl(gear1ComposedImage, 'gear_1.composed_image');
    const gear2ImageData = parseDataUrl(gear2ComposedImage, 'gear_2.composed_image');
    const previewImageData = parseDataUrl(previewImageDataUrl, 'preview_image');

    const [uploadedImageUpload, gear1Upload, gear2Upload, previewUpload] = await Promise.all([
      uploadBufferToCloudinary(uploadedImageData.buffer, folder, 'uploaded-image'),
      uploadBufferToCloudinary(gear1ImageData.buffer, folder, 'gear-1'),
      uploadBufferToCloudinary(gear2ImageData.buffer, folder, 'gear-2'),
      uploadBufferToCloudinary(previewImageData.buffer, folder, 'preview')
    ]);

    return res.json({
      success: true,
      message: 'Custom gear images uploaded successfully.',
      section_id: section_id || null,
      product: product || null,
      uploaded_image: uploadedImageUpload.secure_url,
      gear_1_image: gear1Upload.secure_url,
      gear_2_image: gear2Upload.secure_url,
      preview_image: previewUpload.secure_url
    });
  } catch (error) {
    next(error);
  }
};