const express = require('express');
const router = express.Router();
router.get('/reports/payments', async (req, res) => {
  const { event_id } = req.query;
  if (!event_id) return res.status(400).json([]);
  const { data, error } = await supabase
    .from('payment_info')
    .select(`
      attendee_no,
      payment_status,
      amount,
      form_of_payment,
      date_full_payment,
      date_partial_payment,
      account,
      or_number,
      quickbooks_no,
      shipping_tracking_no,
      notes,
      created_at,
      attendees:first_name,
      attendees:last_name,
      attendees:organization
    `)
    .eq('event_id', event_id);
  if (error) return res.status(500).json([]);
  // Flatten attendee fields for frontend
  const result = data.map(row => ({
    ...row,
    first_name: row.attendees?.first_name || '',
    last_name: row.attendees?.last_name || '',
    organization: row.attendees?.organization || ''
  }));
  res.json(result);
});

module.exports = router;
