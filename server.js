require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(cors());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------
// DATABASE SETUP (MongoDB)
// ---------------------------------------------------------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const InviteSchema = new mongoose.Schema({
  guestId: { type: String, required: true, unique: true },
  guestName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Invite = mongoose.model('Invite', InviteSchema);

// ---------------------------------------------------------
// AUTHENTICATION MIDDLEWARE
// ---------------------------------------------------------
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// ---------------------------------------------------------
// API ROUTES
// ---------------------------------------------------------

// Admin Login
app.post('/api/admin/login', (req, res) => {
  if (req.body.password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ admin: true }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Incorrect password' });
  }
});

// Create Invitation (Admin Only)
app.post('/api/invites', authenticateToken, async (req, res) => {
  try {
    const guestId = crypto.randomBytes(4).toString('hex'); // Generates e.g., '8f3a5b2c'
    const newInvite = new Invite({ guestId, guestName: req.body.guestName });
    await newInvite.save();
    res.status(201).json(newInvite);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create invite' });
  }
});

// Get All Invitations (Admin Only)
app.get('/api/invites', authenticateToken, async (req, res) => {
  try {
    const invites = await Invite.find().sort({ createdAt: -1 });
    res.json(invites);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invites' });
  }
});

// Delete Invitation (Admin Only)
app.delete('/api/invites/:id', authenticateToken, async (req, res) => {
  try {
    await Invite.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// Get Guest Name for Wedding Card (Public - used by invite.html)
app.get('/api/invites/public/:guestId', async (req, res) => {
  try {
    const invite = await Invite.findOne({ guestId: req.params.guestId });
    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    res.json({ guestName: invite.guestName });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------
// FRONTEND ROUTING
// ---------------------------------------------------------

// Route dynamic /invite/:id to the static invite.html file
app.get('/invite/:guestId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'invite.html'));
});

// Redirect root to admin dashboard
app.get('/', (req, res) => {
  res.redirect('/admin.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));