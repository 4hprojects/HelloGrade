const { supabase } = require('../supabaseClient');

async function logAuditTrail({ req, action, userNameFallback = 'admin' }) {
  const user_id = req.user?.studentIDNumber || req.user?.userId || 'admin';
  const user_role = req.user?.role || 'admin';
  const user_name = req.user?.name || req.user?.studentIDNumber || req.user?.userId || userNameFallback || 'admin';

  await supabase
    .from('audit_trail')
    .insert([{
      user_id,
      user_role,
      user_name,
      action,
      user_agent: req.headers['user-agent'],
      ip_address: req.ip
    }]);
}

module.exports = { logAuditTrail };