//eventApi.js
const express = require('express');
const router = express.Router();
const { supabase } = require('../supabaseClient');
const { v4: uuidv4 } = require('uuid');

// Create new event
router.post('/', async (req, res) => {
  try {
    console.log('Session ID:', req.sessionID);
    console.log('Session User:', req.session.userId);
    
    const { event_name, event_date, location } = req.body;

    // 1. Verify user exists in MongoDB first
    const user = await usersCollection.findOne({ 
      _id: new ObjectId(req.session.userId) 
    });
    
    if (!user) {
      console.error('User not found in MongoDB');
      return res.status(400).json({ 
        status: "error", 
        message: "User not found" 
      });
    }

    // 2. Create event in Supabase using session userId directly
    const { data, error } = await supabase
      .from('events')
      .insert([{
        id: uuidv4(),
        event_name,
        event_date,
        location,
        user_id: req.session.userId // Use MongoDB _id directly
      }])
      .select()
      .maybeSingle();

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(400).json({ 
        status: "error", 
        message: error.message 
      });
    }

    // 3. Log successful creation
    console.log('Event created successfully:', data);
    res.json({ 
      status: "success", 
      event: data 
    });

  } catch (err) {
    console.error('Server error in event creation:', err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
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
