# Custom Builder Backend

Node/Express backend for your Shopify custom builder flow.

## Endpoint
`POST /api/custom-builder/compose`

This matches the frontend you pasted:

```js
const CUSTOM_BUILDER_API = 'https://YOUR-RENDER-URL/api/custom-builder/compose';
```

## What it expects
JSON body:
- `uploaded_image` (base64 data URL) **required**
- `silhouette_image` / `silhouette_mask` optional
- `text_items` array
- `effect` string
- `gear_1` object **required**
- `gear_2` object **required**
- `product` object with selected Shopify variant data

## What it returns
```json
{
  "success": true,
  "gear_1_image": "https://...",
  "gear_2_image": "https://...",
  "preview_image": "https://..."
}
```

## Render deploy steps
1. Upload this project to GitHub or zip and deploy on Render.
2. Add `OPENAI_API_KEY` and the Cloudinary environment variables in Render's Environment settings.
3. Use `npm install`
4. Start command:
   `npm start`

OpenAI image generation retries temporary connection failures automatically. You can optionally tune
`OPENAI_MAX_RETRIES` (default `3`) and `OPENAI_TIMEOUT_MS` (default `120000`) in Render.

## Important
Right now the image compose logic is a **starter backend**:
- it uses the uploaded image as the base
- applies a simple effect
- draws text items
- generates gear 1, gear 2 and a side-by-side preview
- uploads results to Cloudinary

If your earlier builder sections have exact gear placement / garment mockup rules, I can wire those into `composeService.js` next.
