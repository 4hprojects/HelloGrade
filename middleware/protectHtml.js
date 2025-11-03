const path = require('path');

module.exports = function protectHtml(rootDir) {
  return function (req, res, next) {
    const pathStr = req.path.toLowerCase();
    const isProtectedDashboard = pathStr === '/dashboard.html';
    const isProtectedTeacherHtml = /^\/teacher\/.+\.html$/.test(pathStr);

    if (isProtectedDashboard || isProtectedTeacherHtml) {
      if (!req.session?.userId) {
        return res.status(401).sendFile(path.join(rootDir, 'public', 'login.html'));
      }
      if (isProtectedTeacherHtml) {
        const role = req.session?.role;
        if (role !== 'teacher' && role !== 'admin') {
          return res.status(403).sendFile(path.join(rootDir, 'public', '403.html'));
        }
      }
    }
    next();
  };
};