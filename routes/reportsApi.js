//reportsApi.js
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { ObjectId } = require('mongodb');

// Initialize Supabase client (adjust with your env vars)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

// GET /api/attendees - List all attendees with event and payment status
router.get('/attendees', async (req, res) => {
  try {
    // Join attendees, events, and payment_info (latest payment_status)
    const { data: attendees, error } = await supabase
      .from('attendees')
      .select(`
        attendee_no, last_name, first_name, organization, designation, email, contact_no, rfid, confirmation_code, accommodation, event_id, event_name:events(event_name),
        payment_info:payment_info(payment_status)
      `);

    if (error) throw error;

    // Flatten payment_status (show latest if multiple)
    const result = attendees.map(att => ({
      ...att,
      event_name: att.event_name?.event_name || '',
      payment_status: Array.isArray(att.payment_info) && att.payment_info.length > 0
        ? att.payment_info[att.payment_info.length - 1].payment_status
        : '',
    }));

    res.json(result);
  } catch (err) {
    console.error('Error fetching attendees:', err);
    res.status(500).json({ status: 'error', message: 'Failed to fetch attendees.' });
  }
});

// GET /api/attendees/:attendee_no - Get single attendee
router.get('/attendees/:attendee_no', async (req, res) => {
  try {
    const { attendee_no } = req.params;
    const { data, error } = await supabase
      .from('attendees')
      .select('*')
      .eq('attendee_no', attendee_no)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch attendee.' });
  }
});

// PUT /api/attendees/:attendee_no/rfid - Update RFID
router.put('/attendees/:attendee_no/rfid', async (req, res) => {
  try {
    const { attendee_no } = req.params;
    const { rfid } = req.body;
    const { error } = await supabase
      .from('attendees')
      .update({ rfid })
      .eq('attendee_no', attendee_no);
    if (error) throw error;
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to update RFID.' });
  }
});

// GET /api/payments/:attendee_no - Get all payments for attendee
router.get('/payments/:attendee_no', async (req, res) => {
  try {
    const { attendee_no } = req.params;
    const { data, error } = await supabase
      .from('payment_info')
      .select('*')
      .eq('attendee_no', attendee_no)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch payments.' });
  }
});

// PUT /api/payments/:payment_id - Update payment record
router.put('/payments/:payment_id', async (req, res) => {
  try {
    const { payment_id } = req.params;
    const updateFields = req.body;
    const { error } = await supabase
      .from('payment_info')
      .update(updateFields)
      .eq('payment_id', payment_id);
    if (error) throw error;
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to update payment.' });
  }
});

// POST /api/payments - Add new payment record
router.post('/payments', async (req, res) => {
  try {
    const payment = req.body;
    const { error } = await supabase
      .from('payment_info')
      .insert([payment]);
    if (error) throw error;
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to add payment.' });
  }
});

module.exports = router;