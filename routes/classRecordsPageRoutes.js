const express = require('express');
const path = require('path');

module.exports = function classRecordsPageRoutes(rootDir) {
  const router = express.Router();

  // 1) Redirect "/classrecords.html" => "/classrecords"
  router.get('/classrecords.html', (req, res) => {
    if (!req.session || !req.session.userId) {
      return res.redirect('/login');
    }
    return res.redirect('/classrecords');
  });

  // 2) Serve "/classrecords" only if logged in
  router.get('/classrecords', (req, res) => {
    if (!req.session || !req.session.userId) {
      return res.redirect('/login');
    }
    res.sendFile(path.join(rootDir, 'public', 'classrecords.html'));
  });

  return router;
};
