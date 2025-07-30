//eventApi.js 
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
const { v4: uuidv4 } = require('uuid');
const { logAuditTrail } = require('../utils/auditTrail');
const { getMongoClient } = require('../utils/mongoClient');
const { getUserNamesByStudentIDs } = require('../utils/mongoUserLookup');
const { ObjectId } = require('mongodb');

// Create new event
router.post('/', async (req, res) => {
  const { event_id, event_name, start_date, end_date, location, venue } = req.body;

  // Field-level validation
  if (!event_id || typeof event_id !== 'string' || event_id.trim() === '') {
    return res.status(400).json({ status: "error", field: "event_id", message: "Event ID is required." });
  }
  if (!event_name || typeof event_name !== 'string' || event_name.trim() === '') {
    return res.status(400).json({ status: "error", field: "event_name", message: "Event name is required." });
  }
  if (!start_date || isNaN(Date.parse(start_date))) {
    return res.status(400).json({ status: "error", field: "start_date", message: "Valid start date is required." });
  }
  if (!end_date || isNaN(Date.parse(end_date))) {
    return res.status(400).json({ status: "error", field: "end_date", message: "Valid end date is required." });
  }
  if (new Date(end_date) < new Date(start_date)) {
    return res.status(400).json({ status: "error", field: "end_date", message: "End date cannot be before start date." });
  }
  if (!location || typeof location !== 'string' || location.trim() === '') {
    return res.status(400).json({ status: "error", field: "location", message: "Location is required." });
  }
  if (!venue || typeof venue !== 'string' || venue.trim() === '') {
    return res.status(400).json({ status: "error", field: "venue", message: "Venue is required." });
  }

  // Validate required fields
  if (!event_id || !event_name || !start_date || !location || !venue) {
    await logAuditTrail({
      req,
      action: 'CREATE_EVENT_FAILED',
      userNameFallback: req.session?.studentIDNumber || 'Unknown',
      details: {
        event_id, event_name, start_date, end_date, location, venue,
        reason: 'Missing required fields',
        created_by: req.session?.userId,
        studentIDNumber: req.session?.studentIDNumber,
        role: req.session?.role,
        ip: req.ip
      }
    });
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  // Only allow manager or admin to create events
  if (!req.session || !['manager', 'admin'].includes(req.session.role)) {
    await logAuditTrail({
      req,
      action: 'CREATE_EVENT_FAILED',
      userNameFallback: req.session?.studentIDNumber || 'Unknown',
      details: {
        event_id, event_name,
        reason: 'Unauthorized',
        created_by: req.session?.userId,
        studentIDNumber: req.session?.studentIDNumber,
        role: req.session?.role,
        ip: req.ip
      }
    });
    return res.status(403).json({ error: 'Unauthorized.' });
  }

  // Check for duplicate event_id
  const { data: existing } = await supabase
    .from('events')
    .select('event_id')
    .eq('event_id', event_id)
    .maybeSingle();

  if (existing) {
    await logAuditTrail({
      req,
      action: 'CREATE_EVENT_FAILED',
      userNameFallback: req.session?.studentIDNumber || 'Unknown',
      details: {
        event_id, event_name,
        reason: 'Event ID already exists',
        created_by: req.session?.userId,
        studentIDNumber: req.session?.studentIDNumber,
        role: req.session?.role,
        ip: req.ip
      }
    });
    return res.status(409).json({ error: 'Event ID already exists.' });
  }

  // Get creator info from session
  const created_by = req.session.userId;
  const studentIDNumber = req.session.studentIDNumber || '';

  // Lookup full name from MongoDB
  let created_by_name = 'Unknown';
  try {
    console.log('Connecting to MongoDB with URI:', process.env.MONGODB_URI);
    console.log('Looking up user with studentIDNumber:', studentIDNumber);

    const client = await getMongoClient();
    const db = client.db('myDatabase');
    const user = await db.collection('tblUser').findOne({ studentIDNumber });
    if (user) {
      created_by_name = `${user.firstName} ${user.lastName}`;
    }
    // Do NOT close the client here
  } catch (err) {
    console.error('MongoDB lookup error:', err);
  }

  // Insert the event with created_by_name
  const { data, error } = await supabase
    .from('events')
    .insert([{
      event_id,
      event_name,
      start_date,
      end_date,
      location,
      venue,
      created_by,
      studentIDNumber,
      created_by_name
    }])
    .select()
    .maybeSingle();

  // Audit trail
  await logAuditTrail({
    req,
    action: error ? 'CREATE_EVENT_FAILED' : 'CREATE_EVENT',
    userNameFallback: req.session?.studentIDNumber || event_name,
    details: {
      event_id, event_name, start_date, end_date, location, venue,
      created_by,
      studentIDNumber,
      role: req.session?.role,
      ip: req.ip,
      error: error?.message
    }
  });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ status: "success", event: data });
});

// GET /latest
router.get('/latest', async (req, res) => {
  const { data: events, error } = await supabase
    .from('events')
    .select('event_id, event_name, start_date, end_date, venue, location, status, studentIDNumber')
    .eq('status', 'active')
    .order('start_date', { ascending: true })
    .limit(5);

  if (error) return res.json([]);

  const studentIDs = [...new Set(events.map(ev => ev.studentIDNumber).filter(Boolean))];
  const userMap = await getUserNamesByStudentIDs(studentIDs);

  const enrichedEvents = events.map(ev => ({
    ...ev,
    created_by_name: userMap[ev.studentIDNumber] || 'Unknown'
  }));

  res.json(enrichedEvents);
});

router.get('/upcoming', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const { data: events, error } = await supabase
    .from('events')
    .select('event_id, event_name, start_date, end_date, location, venue, status, studentIDNumber, created_by_name')
    .eq('status', 'active')
    .gte('end_date', today)
    .order('start_date', { ascending: true });

  if (error) return res.json([]);

  // No need to enrich with MongoDB, just return what Supabase has
  res.json(events);
});

router.get('/current', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const { data: event, error } = await supabase
    .from('events')
    .select('event_id, event_name, event_date, studentIDNumber')
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !event) return res.status(404).json({ message: "No current event found." });

  let created_by = 'Unknown';
  if (event.studentIDNumber) {
    const userMap = await getUserNamesByStudentIDs([event.studentIDNumber]);
    created_by = userMap[event.studentIDNumber] || 'Unknown';
  }

  res.json({ ...event, created_by });
});

// GET /api/events/all - returns all events
router.get('/all', async (req, res) => {
  try {
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .order('start_date', { ascending: false });
    if (error) return res.status(500).json([]);

    const studentIDs = [...new Set(events.map(ev => ev.studentIDNumber).filter(Boolean))];
    const userMap = await getUserNamesByStudentIDs(studentIDs);

    const enrichedEvents = events.map(ev => ({
      ...ev,
      created_by_name: userMap[ev.studentIDNumber] || 'Unknown'
    }));

    res.json(enrichedEvents); // <-- Return array, not { events: ... }
  } catch (err) {
    res.status(500).json([]);
  }
});

// GET /
router.get('/', async (req, res) => {
  // Fetch events from Supabase
  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .gte('end_date', new Date().toISOString().slice(0, 10))
    .order('start_date', { ascending: true });

  if (error) return res.status(500).json({ message: 'Failed to load events.' });

  const studentIDs = [...new Set(events.map(ev => ev.studentIDNumber).filter(Boolean))];
  const userMap = await getUserNamesByStudentIDs(studentIDs);

  const enrichedEvents = events.map(ev => ({
    ...ev,
    created_by_name: userMap[ev.studentIDNumber] || 'Unknown'
  }));

  res.json({ events: enrichedEvents });
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('events')
    .select('event_id, event_name, start_date, end_date, location, venue, status')
    .eq('event_id', id)
    .maybeSingle();
  if (error || !data) return res.status(404).json({ message: 'Event not found.' });
  res.json(data);
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { event_name, start_date, end_date, location, venue, status } = req.body; // <-- add status
  const updateFields = { event_name, start_date, end_date, location, venue };
  if (status) updateFields.status = status; // <-- only update if provided

  const { data, error } = await supabase
    .from('events')
    .update(updateFields)
    .eq('event_id', id)
    .select()
    .maybeSingle();
  // Add validation
  if (!event_name || !start_date || !end_date || !location) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  if (error || !data) {
    console.error('Update error:', error);
    return res.status(400).json({ message: error?.message || 'Update failed.' });
  }

  // Audit trail for update/edit
  await logAuditTrail({
    req,
    action: 'UPDATE_EVENT',
    userNameFallback: req.session?.studentIDNumber || event_name,
    details: {
      event_id: id,
      event_name,
      start_date,
      end_date,
      location,
      venue,
      updated_by: req.session?.userId,
      studentIDNumber: req.session?.studentIDNumber,
      role: req.session?.role,
      ip: req.ip,
      updated_event: data
    }
  });

  res.json({ status: 'success', event: data });
  console.log('Update request body:', req.body);
  console.log('Update params:', req.params);
});

router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['active', 'archived'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status.' });
  }
  const { data, error } = await supabase
    .from('events')
    .update({ status })
    .eq('event_id', id)
    .select()
    .maybeSingle();
  if (error || !data) return res.status(400).json({ message: error?.message || 'Status update failed.' });

  // Audit trail for archive/un-archive
  await logAuditTrail({
    req,
    action: status === 'archived' ? 'ARCHIVE_EVENT' : 'UNARCHIVE_EVENT',
    userNameFallback: req.session?.studentIDNumber || data.event_name,
    details: {
      event_id: id,
      status,
      updated_by: req.session?.userId,
      studentIDNumber: req.session?.studentIDNumber,
      role: req.session?.role,
      ip: req.ip,
      updated_event: data
    }
  });

  res.json({ status: 'success', event: data });
});

// DELETE /api/events/:id - delete an event
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { password, cascade } = req.body;

  // Fetch the event to check creator
  const { data: event, error: fetchError } = await supabase
    .from('events')
    .select('event_id, created_by, event_name, studentIDNumber')
    .eq('event_id', id)
    .maybeSingle();

  if (fetchError || !event) {
    await logAuditTrail({
      req,
      action: 'DELETE_EVENT_FAILED',
      userNameFallback: req.session?.studentIDNumber || 'Unknown',
      details: {
        event_id: id,
        reason: 'Event not found',
        created_by: req.session?.userId,
        studentIDNumber: req.session?.studentIDNumber,
        role: req.session?.role,
        ip: req.ip
      }
    });
    return res.status(404).json({ error: 'Event not found.' });
  }

  // Only creator or admin can delete
  const isCreator = event.created_by === req.session.userId;
  const isAdmin = req.session.role === 'admin';

  if (!isCreator && !isAdmin) {
    await logAuditTrail({
      req,
      action: 'DELETE_EVENT_FAILED',
      userNameFallback: req.session?.studentIDNumber || event.event_name,
      details: {
        event_id: id,
        reason: 'Unauthorized delete attempt',
        created_by: req.session?.userId,
        studentIDNumber: req.session?.studentIDNumber,
        role: req.session?.role,
        ip: req.ip
      }
    });
    return res.status(403).json({ error: 'Only admin and creator of event is allowed to delete this event.' });
  }

  // Password required
  if (!password) {
    return res.status(400).json({ error: 'Password is required for deletion.' });
  }

  // Fetch user from MongoDB
  const client = await getMongoClient();
  const db = client.db('myDatabase'); 
  //console.log('Session:', req.session);
  let mongoUserId = req.session.userId;
  try {
    mongoUserId = new ObjectId(req.session.userId);
  } catch (e) {
    // If not a valid ObjectId, keep as string
  }
  const user = await db.collection('tblUser').findOne({ _id: mongoUserId });
  //console.log('User found:', user);

  if (!user || !user.password) {
    return res.status(403).json({ error: 'User not found or password not set.' });
  }

  // Validate password
  const bcrypt = require('bcrypt');
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    await logAuditTrail({
      req,
      action: 'DELETE_EVENT_FAILED',
      userNameFallback: req.session?.studentIDNumber || event.event_name,
      details: {
        event_id: id,
        reason: 'Incorrect password',
        created_by: req.session?.userId,
        studentIDNumber: req.session?.studentIDNumber,
        role: req.session?.role,
        ip: req.ip
      }
    });
    return res.status(403).json({ error: 'Incorrect password.' });
  }

  // Check for associated attendance records
  const { data: attendanceRecords, error: attendanceError } = await supabase
    .from('attendance_records')
    .select('id')
    .eq('event_id', id);

  if (attendanceError) {
    return res.status(500).json({ error: 'Failed to check attendance records.' });
  }

  if (attendanceRecords && attendanceRecords.length > 0 && !cascade) {
    return res.status(409).json({
      error: 'This event has attendance records. You must delete them first or confirm cascade delete.',
      hasAttendance: true
    });
  }

  // If cascade is requested, delete attendance records first
  if (attendanceRecords && attendanceRecords.length > 0 && cascade) {
    const { error: cascadeError } = await supabase
      .from('attendance_records')
      .delete()
      .eq('event_id', id);
    if (cascadeError) {
      return res.status(500).json({ error: 'Failed to delete attendance records.' });
    }
  }

  // Delete the event
  const { error: deleteError } = await supabase
    .from('events')
    .delete()
    .eq('event_id', id);

  await logAuditTrail({
    req,
    action: deleteError ? 'DELETE_EVENT_FAILED' : 'DELETE_EVENT',
    userNameFallback: req.session?.studentIDNumber || event.event_name,
    details: {
      event_id: id,
      event_name: event.event_name,
      deleted_by: req.session?.userId,
      studentIDNumber: req.session?.studentIDNumber,
      role: req.session?.role,
      ip: req.ip,
      error: deleteError?.message
    }
  });

  if (deleteError) {
    return res.status(500).json({ error: deleteError.message });
  }

  res.json({ status: 'success', message: 'Event deleted.' });
});

router.get('/today', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('start_date', today);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// When returning events, enrich with creator name
router.get('/', async (req, res) => {
  // Fetch events from Supabase
  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .gte('end_date', new Date().toISOString().slice(0, 10))
    .order('start_date', { ascending: true });

  if (error) return res.status(500).json({ message: 'Failed to load events.' });
 
  // MongoDB lookup for creator names
  const studentIDs = [...new Set(events.map(ev => ev.studentIDNumber).filter(Boolean))];
  const userMap = await getUserNamesByStudentIDs(studentIDs);
  // Do NOT close the client here

  const enrichedEvents = events.map(ev => ({
    ...ev,
    created_by_name: userMap[ev.studentIDNumber] || 'Unknown'
  }));

  res.json({ events: enrichedEvents });
});

// ...existing code for rendering the All table...
function renderAllEventsTable(events, currentUserId, currentUserRole) {
  const tbody = document.getElementById('allEventsList');
  tbody.innerHTML = '';
  events.forEach(event => {
    const tr = document.createElement('tr');
    // ...other columns...
    // Status column
    const statusTd = document.createElement('td');
    statusTd.textContent = event.status;

    // Show Delete button only for creator or admin
    if (event.created_by === currentUserId || currentUserRole === 'admin') {
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.className = 'btn btn-danger btn-sm';
      deleteBtn.onclick = async () => {
        const password = prompt('Enter your password to confirm deletion:');
        if (!password) return;
        const res = await fetch(`/api/events/${event.event_id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const result = await res.json();
        if (result.status === 'success') {
          alert('Event deleted.');
          tr.remove(); // Remove row from table
        } else {
          alert(result.error || 'Delete failed.');
        }
      };
      statusTd.appendChild(deleteBtn);
    }

    tr.appendChild(statusTd);
    tbody.appendChild(tr);
  });
}

module.exports = router;
