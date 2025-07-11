//eventApi.js
const express = require('express');
const router = express.Router();
const { supabase } = require('../supabaseClient');
const { v4: uuidv4 } = require('uuid');

// Create new event
router.post('/', async (req, res) => {
  const { event_name, event_date, location } = req.body;

  const { data: mapping, error: mappingError } = await supabase
    .from('user_mapping')
    .select('uuid')
    .eq('object_id', req.session.userId)
    .single();

  console.log('Mapping Query Result:', mapping);
  console.log('Mapping Query Error:', mappingError);

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
      event_date,
      location,
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
    .select('event_name,event_date,location')
    .order('event_date', { ascending: true }) // ascending: nearest first
    .limit(5);
  res.json(data || []);
});

router.get('/upcoming', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('events')
    .select('id,event_name,event_date')
    .gte('event_date', today)
    .order('event_date', { ascending: true });
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
      .order('event_date', { ascending: false });
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
    filter = { event_date: { gte: new Date().toISOString().slice(0, 10) } };
  }
  // Fetch events from Supabase
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .gte('event_date', new Date().toISOString().slice(0, 10))
    .order('event_date', { ascending: true });

  if (error) return res.status(500).json({ message: 'Failed to load events.' });
  res.json({ events: data });
});

module.exports = router;
