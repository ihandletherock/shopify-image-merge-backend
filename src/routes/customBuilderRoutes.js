const express = require('express');
const {
  composeGearImages,
  generateSilhouette
} = require('../controllers/customBuilderController');

const router = express.Router();

router.post('/compose', composeGearImages);
router.post('/generate', generateSilhouette);

module.exports = router;
