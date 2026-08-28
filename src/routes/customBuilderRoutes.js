const express = require('express');
const {
  composeGearImages,
  generateSilhouette,
  checkOpenAIConnection
} = require('../controllers/customBuilderController');

const router = express.Router();

router.post('/compose', composeGearImages);
router.post('/generate', generateSilhouette);
router.get('/health/openai', checkOpenAIConnection);

module.exports = router;
