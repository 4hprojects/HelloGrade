const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid'); // npm install uuid
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

// Create new event
router.post('/', async (req, res) => {
      console.log('Received event POST:', req.body);
  const { event_name, event_date, location } = req.body;
  if (!event_name || !event_date || !location) {
    return res.status(400).json({ status: "error", message: "All fields required." });
  }
  const id = uuidv4(); // Generate a unique ID
  const { data, error } = await supabase
    .from('events')
    .insert([{ id, event_name, event_date, location }])
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

module.exports = router;