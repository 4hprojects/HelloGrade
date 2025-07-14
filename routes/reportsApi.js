//reportsApi.js
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { ObjectId } = require('mongodb');
const { logAuditTrail } = require('../utils/auditTrail');
const { paymentUpdateSummary } = require('../utils/auditTrailUtils');

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

// PUT /api/attendees/:attendee_no - Update attendee info
router.put('/attendees/:attendee_no', async (req, res) => {
  try {
    const { attendee_no } = req.params;
    const updateFields = req.body;
    const { error } = await supabase
      .from('attendees')
      .update(updateFields)
      .eq('attendee_no', attendee_no);
    if (error) throw error;
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to update attendee.' });
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
  const { payment_id } = req.params;
  const updates = req.body;
  const user = req.user;

  // Fetch old payment for comparison
  const { data: oldPayment, error: fetchError } = await supabase
    .from('payment_info')
    .select('*')
    .eq('payment_id', payment_id)
    .single();

  if (fetchError || !oldPayment) {
    return res.status(404).json({ error: 'Payment not found' });
  }

  // Update payment
  const { data: updated, error } = await supabase
    .from('payment_info')
    .update(updates)
    .eq('payment_id', payment_id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: 'Failed to update payment' });
  }

  // Prepare changes summary
  const changes = {};
  for (const key in updates) {
    if (updates[key] !== oldPayment[key]) {
      changes[key] = [oldPayment[key], updates[key]];
    }
  }

  // Only log if there are changes
  if (Object.keys(changes).length > 0) {
    await logAuditTrail({
      req,
      action: 'Update Payment',
      details: paymentUpdateSummary({
        payment_id,
        attendee_no: oldPayment.attendee_no,
        changes
      })
    });
  }

  res.json({ success: true, updated });
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

// GET /api/reports/attendees - Get all attendees for report
router.get('/reports/attendees', async (req, res) => {
  try {
    // Get all attendees
    const { data: attendees, error: attendeesError } = await supabase
      .from('attendees')
      .select('*');
    if (attendeesError) throw attendeesError;

    // For each attendee, get their latest payment_info record
    const attendeesWithStatus = await Promise.all(attendees.map(async att => {
      const { data: paymentData, error: paymentError } = await supabase
        .from('payment_info')
        .select('payment_status')
        .eq('attendee_no', att.attendee_no)
        .order('date_full_payment', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1);
      if (paymentError) {
        return { ...att, payment_status: null };
      }
      const latestPayment = paymentData && paymentData[0];
      return { ...att, payment_status: latestPayment ? latestPayment.payment_status : null };
    }));

    res.json({ attendees: attendeesWithStatus });
  } catch (err) {
    console.error('Error fetching attendees for report:', err);
    res.status(500).json({ status: 'error', message: 'Failed to fetch attendees for report.' });
  }
});

// PUT /api/attendees/:attendee_no/payment-info - Update payment info
router.put('/attendees/:attendee_no/payment-info', async (req, res) => {
  try {
    const { attendee_no } = req.params;
    const { payment_status, form_of_payment } = req.body;
    // Update the latest payment_info record for this attendee
    const { data, error } = await supabase
      .from('payment_info')
      .update({ payment_status, form_of_payment })
      .eq('attendee_no', attendee_no)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to update payment info.' });
  }
});

// Example: For each attendee, get the latest payment_info record
router.get('/attendees/latest-payments', async (req, res) => {
  try {
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

    // For each attendee, get the latest payment_info record
    const attendeesWithLatestPayments = await Promise.all(result.map(async att => {
      const { data: paymentData, error: paymentError } = await supabase
        .from('payment_info')
        .select('payment_status')
        .eq('attendee_no', att.attendee_no)
        .order('date_full_payment', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1);

      if (paymentError) {
        console.error('Error fetching payment info:', paymentError);
        return { ...att, payment_status: null };
      }

      const latestPayment = paymentData[0];
      return { ...att, payment_status: latestPayment ? latestPayment.payment_status : null };
    }));

    res.json(attendeesWithLatestPayments);
  } catch (err) {
    console.error('Error fetching attendees with latest payments:', err);
    res.status(500).json({ status: 'error', message: 'Failed to fetch attendees with latest payments.' });
  }
});

// Add this inside your search bar for attendees
router.get('/attendees/filter', async (req, res) => {
  try {
    const { status } = req.query;
    let query = supabase.from('attendees').select(`
      attendee_no, last_name, first_name, organization, designation, email, contact_no, rfid, confirmation_code, accommodation, event_id, event_name:events(event_name),
      payment_info:payment_info(payment_status)
    `);

    if (status) {
      query = query.eq('payment_info.payment_status', status);
    }

    const { data: attendees, error } = await query;

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
    console.error('Error filtering attendees:', err);
    res.status(500).json({ status: 'error', message: 'Failed to filter attendees.' });
  }
});

// Attendance records
router.get('/attendance-records', async (req, res) => {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('date, time, raw_last_name, raw_first_name, raw_rfid, slot, event_id');
  if (error) return res.status(500).json([]);
  res.json(data);
});

// Events
router.get('/events', async (req, res) => {
  const { data, error } = await supabase
    .from('events')
    .select('event_id, event_name, start_date, end_date, status, location, venue');
  if (error) return res.status(500).json([]);
  res.json(data);
});

// Audit trail
router.get('/audit-trail', async (req, res) => {
  const { data, error } = await supabase
    .from('audit_trail')
    .select('user_name, user_role, action, action_time, ip_address, details');
  if (error) return res.status(500).json([]);
  res.json(data);
});

module.exports = router;
