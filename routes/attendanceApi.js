require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const express = require('express');
const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

async function logAttendance(req, res) {
  try {
    const { rfid, attendee_no, event_id, status, timestamp } = req.body;

    // 1. Find attendee_id in Supabase
    const { data: attendees } = await supabase
      .from('attendees')
      .select('id')
      .or(`attendee_no.eq.${attendee_no},rfid.eq.${rfid}`)
      .limit(1);

    let record = {
      event_id,
      status: status || 'present',
      timestamp: timestamp || new Date().toISOString(),
      rfid,
      attendee_id: null,
      note: null,
      time: req.body.time,
      date: req.body.date,
      slot: req.body.slot
    };

    if (attendees && attendees.length > 0) {
      // Registered
      record.attendee_id = attendees[0].id;
    } else {
      // Unregistered
      record.note = "unregistered";
    }

    // 2. Insert attendance record in Supabase
    const { error: insertError } = await supabase
      .from('attendance_records')
      .insert([record]);
    if (insertError) {
      return res.status(500).json({ status: "error", message: insertError.message });
    }

    // 3. Relay to Google Sheets (Apps Script)
    // Build the payload for Google Sheets
    const sheetPayload = {
      ...req.body,
      id_number: req.body.attendee_no || "unregistered"
    };

    await fetch('https://script.google.com/macros/s/AKfycbz8rsTh7FsEUbpq1FR33VMQ_2auDYpjuq6SJTbOmgzHqHSRThylSkpEe7ZTExBo8099jQ/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sheetPayload)
    });

    res.json({ status: "success" });
  } catch (err) {
    console.error(err); // Add this line to log the error in your server console
    res.status(500).json({ status: "error", message: err.toString() });
  }
}

router.post('/', logAttendance);

// GET /api/attendance/all - returns all attendance records with attendee and event info
router.get('/all', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('attendance_records')
      .select(`
        id,
        date,
        time,
        slot,
        status,
        rfid,
        attendee_id,
        event_id,
        note,
        attendee:attendee_id (
          attendee_no,
          first_name,
          middle_name,
          last_name,
          organization,
          contact_no,
          rfid
        ),
        event:event_id (
          event_name,
          event_date,
          location
        )
      `)
      .order('date', { ascending: false })
      .order('time', { ascending: false });
    if (error) return res.status(500).json({ status: "error", message: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ status: "error", message: err.toString() });
  }
});

module.exports = router;