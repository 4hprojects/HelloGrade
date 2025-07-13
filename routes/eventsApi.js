//eventApi.js 
const express = require('express');
const router = express.Router();
const { supabase } = require('../supabaseClient');
const { v4: uuidv4 } = require('uuid');

// Create new event
router.post('/', async (req, res) => {
  const { event_name, start_date, end_date, location, venue } = req.body; // <-- updated line

  if (new Date(start_date) < new Date()) {
    return res.status(400).json({ message: "Start date cannot be in the past." });
  }

  const { data: mapping, error: mappingError } = await supabase
    .from('user_mapping')
    .select('uuid')
    .eq('object_id', req.session.userId)
    .single();

  if (!mapping || mappingError) {
    console.error('User mapping not found:', mappingError || 'No mapping for userId');
    return res.status(400).json({ status: "error", message: "User mapping not found." });
  }

  const userId = mapping.uuid;

  const { data, error } = await supabase
    .from('events')
    .insert([{
      id: uuidv4(),
      event_name,
      start_date, // <-- updated line
      end_date, // <-- updated line
      location,
      venue, // <-- add venue here
      user_id: userId
    }])
    .select()
    .maybeSingle();

  if (error) return res.status(400).json({ status: "error", message: error.message });
  res.json({ status: "success", event: data });
});

// Get latest events (last 5)
router.get('/latest', async (req, res) => {
  const { data, error } = await supabase
    .from('events')
    .select('id, event_name, start_date, end_date, venue, location, status') // <-- include id and status
    .eq('status', 'active')
    .order('start_date', { ascending: true })
    .limit(5);
  res.json(data || []);
});

router.get('/upcoming', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('events')
    .select('id,event_name,start_date,end_date,location,venue')
    .gte('end_date', today)
    .order('start_date', { ascending: true });
  res.json(data || []);
});

router.get('/current', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('events')
    .select('id, event_name, event_date')
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) return res.status(404).json({ message: "No current event found." });
  res.json(data);
});

// GET /api/events/all - returns all events
router.get('/all', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('start_date', { ascending: false });
    if (error) return res.status(500).json({ status: "error", message: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ status: "error", message: err.toString() });
  }
});

router.get('/', async (req, res) => {
  console.log('Session in /api/events:', req.session);
  // Only upcoming events if ?upcoming=1
  let filter = {};
  if (req.query.upcoming === '1') {
    filter = { end_date: { gte: new Date().toISOString().slice(0, 10) } };
  }
  // Fetch events from Supabase
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .gte('end_date', new Date().toISOString().slice(0, 10))
    .order('start_date', { ascending: true });

  if (error) return res.status(500).json({ message: 'Failed to load events.' });
  res.json({ events: data });
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('events')
    .select('id, event_name, start_date, end_date, location, venue, status')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return res.status(404).json({ message: 'Event not found.' });
  res.json(data);
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { event_name, start_date, end_date, location, venue } = req.body;
  const { data, error } = await supabase
    .from('events')
    .update({ event_name, start_date, end_date, location, venue })
    .eq('id', id)
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
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error || !data) return res.status(400).json({ message: error?.message || 'Status update failed.' });
  res.json({ status: 'success', event: data });
});

module.exports = router;
