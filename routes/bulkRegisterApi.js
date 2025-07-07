const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const APPSCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz8rsTh7FsEUbpq1FR33VMQ_2auDYpjuq6SJTbOmgzHqHSRThylSkpEe7ZTExBo8099jQ/exec';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

router.post('/process-bulkregister', async (req, res) => {
  try {
    // 1. Fetch all rows from BulkRegister tab
    const sheetRes = await fetch(`${APPSCRIPT_URL}?bulkregister=1`);
    const rows = await sheetRes.json();

    // 2. Fetch all events once before the loop
    const eventsRes = await fetch(`${BASE_URL}/api/events/all`);
    const events = await eventsRes.json();

    let registered = 0, duplicate = 0, error = 0;
    let processedRows = [];

    // Find the most current/upcoming event
    const now = new Date();
    const upcomingEvents = events
      .filter(ev => new Date(ev.event_date) >= now)
      .sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
    const mostCurrentEvent = upcomingEvents[0] || events[0];

    for (const row of rows) {
      // Skip if status is not blank
      if (row.status && String(row.status).trim() !== '') {
        continue;
      }

      // Autofill event_id if blank
      if (!row.event_id || String(row.event_id).trim() === '') {
        row.event_id = mostCurrentEvent.id;
      }

      // Check for duplicate RFID in Supabase
      let isDuplicate = false;
      if (row.rfid && String(row.rfid).trim() !== '') {
        const { data: existing } = await supabase
          .from('attendees')
          .select('id')
          .eq('rfid', row.rfid)
          .maybeSingle();
        if (existing) isDuplicate = true;
      }

      // === Validation ===
      let statusMsg = '';
      const requiredFields = ['first_name', 'last_name', 'organization', 'email', 'event_id'];
      const missingFields = requiredFields.filter(f => !row[f] || String(row[f]).trim() === '');
      // Basic email format check
      const emailValid = row['email'] && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row['email']);

      if (missingFields.length > 0) {
        statusMsg = 'Error: Missing ' + missingFields.join(', ');
      } else if (!emailValid) {
        statusMsg = 'Error: Invalid email format';
      } else if (isDuplicate) {
        duplicate++;
        statusMsg = 'Duplicate';
      } else {
        // Try to register
        try {
          // Find event by id for info (optional)
          let event = events.find(ev => String(ev.id) === String(row.event_id));
          if (!event) {
            event = mostCurrentEvent;
            row.event_id = event.id;
            statusMsg = `Info: Event not found, assigned to "${event.event_name}"`;
          }

          // Proceed with registration using event_id
          const payload = {
            id: uuidv4(),
            first_name: row['first_name'] || '',
            middle_name: row['middle_name'] || '',
            last_name: row['last_name'] || '',
            organization: row['organization'] || '',
            email: row['email'] || '',
            contact_no: row['phone_no'] || '',
            rfid: row['rfid'] || '',
            event_id: row['event_id']
          };
          const { error: regErr } = await supabase
            .from('attendees')
            .insert([payload]);
          if (regErr) {
            error++;
            statusMsg = 'Error: ' + regErr.message;
          } else {
            registered++;
            if (!statusMsg) statusMsg = 'Registered';
          }
        } catch (err) {
          error++;
          statusMsg = 'Error: ' + err.message;
        }
      }

      // Update Status in Google Sheet
      await fetch(APPSCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updateBulkRegisterStatus: "1",
          rowIndex: row._rowIndex,
          status: statusMsg
        })
      });

      processedRows.push({ ...row, status: statusMsg });
    }

    res.json({
      registered,
      duplicate,
      error,
      processedRows
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;