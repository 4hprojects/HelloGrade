const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// GET /api/activity/json/:filename
router.get('/json/:filename', (req, res) => {
  const { filename } = req.params;
  // Prevent directory traversal
  if (!/^[a-zA-Z0-9\-_]+$/.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename.' });
  }
  const filePath = path.join(__dirname, '../public/activity/json', `${filename}.json`);
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return res.status(404).json({ error: 'Quiz not found.' });
    res.json(JSON.parse(data));
  });
});

module.exports = router;