const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');

require('dotenv').config();

// ✅ SendGrid for transactional emails
const sgMail = require('@sendgrid/mail');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ✅ Configure SendGrid API Key
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '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');

const MONGODB_URI = 'mongodb+srv://seniorproject:RsxK1bDyaTDoXnzx@seniorproject.wkyrwfp.mongodb.net/senior_project_db?appName=seniorproject';

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ============================
// ✅ USER SCHEMA (Updated with admin/ban fields)
// ============================
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  bio: { type: String, default: 'No bio available.' },
  profilePicture: { type: String, default: '' },
  isAdmin: { type: Boolean, default: false },  // ✅ NEW: Admin flag
  isBanned: { type: Boolean, default: false },  // ✅ NEW: Ban flag
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// ============================
// ✅ TICKET MESSAGE SCHEMA
// ============================
const messageSchema = new mongoose.Schema({
  ticketId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Ticket', 
    required: true 
  },
  senderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  senderName: { type: String, required: true },
  senderEmail: { type: String, required: true },
  senderRole: { type: String, enum: ['user', 'admin'], required: true },
  message: { type: String, required: true },
  attachments: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  isInternalNote: { type: Boolean, default: false } // For admin-only notes
});

const Message = mongoose.model('Message', messageSchema);

// ============================
// ✅ TICKET SCHEMA (Updated with messaging fields)
// ============================
const ticketSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  category: { 
    type: String, 
    required: true,
    enum: ['Technical', 'Billing', 'Account', 'Feature', 'Bug', 'Booking', 'Other'] 
  },
  priority: { 
    type: String, 
    required: true,
    enum: ['Low', 'Medium', 'High', 'Urgent'] 
  },
  description: { type: String, required: true },
  status: { 
    type: String, 
    default: 'Open',
    enum: ['Open', 'Pending', 'Resolved', 'Closed'] 
  },
  createdAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date },
  assignedTo: { type: String, default: '' },
  lastMessageAt: { type: Date, default: Date.now }, // Track last message time
  messageCount: { type: Number, default: 1 } // Count of messages including initial description
});

const Ticket = mongoose.model('Ticket', ticketSchema);

// ============================
// ✅ DESTINATION SCHEMA
// ============================
const destinationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  country: { type: String, required: true },
  continent: { type: String, required: true },
  estimatedCost: { type: Number, required: true },
  safetyScore: { type: Number, required: true },
  tags: { type: String, default: "" }
});
const Destination = mongoose.model('Destination', destinationSchema);

// ============================
// ✅ CURRENCY SCHEMA
// ============================
const currencySchema = new mongoose.Schema({
  country: { type: String, required: true },
  currencyCode: { type: String, required: true, unique: true },
  costIndex: { type: Number, required: true }
});
const Currency = mongoose.model('Currency', currencySchema);

// --- HTML PAGE ROUTES ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'register.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/profile', (req, res) => res.sendFile(path.join(__dirname, 'profile.html')));
app.get('/members', (req, res) => res.sendFile(path.join(__dirname, 'members.html')));
app.get('/user', (req, res) => res.sendFile(path.join(__dirname, 'user-view.html')));
app.get('/tickets', (req, res) => res.sendFile(path.join(__dirname, 'tickets.html')));
app.get('/tickets-admin', (req, res) => res.sendFile(path.join(__dirname, 'tickets-admin.html')));
app.get('/currency', (req, res) => res.sendFile(path.join(__dirname, 'currency.html')));
app.get('/alerts', (req, res) => res.sendFile(path.join(__dirname, 'alerts.html')));

// --- API ROUTES ---

// ============================
// 1. USER REGISTRATION
// ============================
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'All fields required' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email taken' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ 
      name, 
      email, 
      password: hashedPassword,
      isAdmin: false,  // Default to not admin
      isBanned: false  // Default to not banned
    });
    await newUser.save();

    res.status(201).json({ 
      message: 'Registered', 
      userId: newUser._id,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        isAdmin: newUser.isAdmin,
        isBanned: newUser.isBanned,
        profilePicture: newUser.profilePicture
      }
    });
  } catch (e) {
    console.error('Registration error:', e);
    res.status(500).json({ message: 'Registration error' });
  }
});

// ============================
// 2. USER LOGIN (Updated with MongoDB ban check)
// ============================
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // ✅ Check if user is banned in MongoDB
    if (user.isBanned) {
      console.log(`🚫 Blocked banned user login attempt: ${user.email}`);
      return res.status(403).json({ 
        message: 'Your account has been suspended. Please contact support.' 
      });
    }

    res.json({ 
      message: 'Success', 
      userId: user._id, 
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      isBanned: user.isBanned,
      profilePicture: user.profilePicture
    });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ message: 'Login error' });
  }
});

// ============================
// 3. GET SINGLE USER PROFILE
// ============================
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (e) { 
    console.error('Get user error:', e);
    res.status(500).json({ message: 'Error fetching user' }); 
  }
});

// ============================
// 4. UPDATE USER PROFILE
// ============================
app.put('/api/users/:id', async (req, res) => {
  try {
    const { name, bio, profilePicture } = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { name, bio, profilePicture },
      { new: true }
    ).select('-password');
    res.json(updatedUser);
  } catch (e) { 
    console.error('Update user error:', e);
    res.status(500).json({ message: 'Error updating user' }); 
  }
});

// ============================
// 5. GET ALL USERS
// ============================
app.get('/api/all-users', async (req, res) => {
  try {
    const users = await User.find().select('name bio profilePicture isAdmin isBanned');
    res.json(users);
  } catch (e) { 
    console.error('Get all users error:', e);
    res.status(500).json({ message: 'Error fetching users' }); 
  }
});

// ============================
// 6. GET CURRENT USER STATUS
// ============================
app.get('/api/user/status', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.json({ loggedIn: false });
    }
    
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.json({ loggedIn: false });
    }
    
    res.json({
      loggedIn: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        isBanned: user.isBanned,
        profilePicture: user.profilePicture
      }
    });
  } catch (e) {
    console.error('User status error:', e);
    res.status(500).json({ message: 'Error checking user status' });
  }
});

/* ============================
   ✅ TICKET MESSAGING API
============================ */

// Get all messages for a ticket
app.get('/api/tickets/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.query.userId; // For permission checking
    
    // First, verify the ticket exists
    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    // Check if user has permission to view messages
    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    // Allow access if: user is admin OR user created the ticket
    const isAdmin = user.isAdmin;
    const isTicketOwner = user.email.toLowerCase() === ticket.email.toLowerCase();
    
    if (!isAdmin && !isTicketOwner) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Get messages, filter internal notes for non-admins
    let query = { ticketId: id };
    if (!isAdmin) {
      query.isInternalNote = false;
    }
    
    const messages = await Message.find(query)
      .sort({ createdAt: 1 }) // Oldest first for conversation view
      .populate('senderId', 'name email profilePicture');
    
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send a new message to a ticket
app.post('/api/tickets/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, message, isInternalNote } = req.body;
    
    if (!userId || !message) {
      return res.status(400).json({ message: 'User ID and message are required' });
    }
    
    // Verify ticket exists
    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    // Check if user has permission to send messages
    const isAdmin = user.isAdmin;
    const isTicketOwner = user.email.toLowerCase() === ticket.email.toLowerCase();
    
    if (!isAdmin && !isTicketOwner) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Create new message
    const newMessage = new Message({
      ticketId: id,
      senderId: userId,
      senderName: user.name,
      senderEmail: user.email,
      senderRole: isAdmin ? 'admin' : 'user',
      message: message,
      isInternalNote: isInternalNote || false
    });
    
    await newMessage.save();
    
    // Update ticket's last message time and increment message count
    ticket.lastMessageAt = new Date();
    ticket.messageCount = (ticket.messageCount || 1) + 1;
    
    // Auto-reopen ticket if it was closed/resolved and user is replying
    if ((ticket.status === 'Resolved' || ticket.status === 'Closed') && !isAdmin) {
      ticket.status = 'Open';
    }
    
    await ticket.save();
    
    // Return the created message with sender info
    const populatedMessage = await Message.findById(newMessage._id)
      .populate('senderId', 'name email profilePicture');
    
    res.status(201).json({
      message: 'Message sent successfully',
      ticketMessage: populatedMessage
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get ticket with messages (combined endpoint)
app.get('/api/tickets/:id/details', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.query.userId;
    
    // Get ticket
    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    // Check permissions
    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    const isAdmin = user.isAdmin;
    const isTicketOwner = user.email.toLowerCase() === ticket.email.toLowerCase();
    
    if (!isAdmin && !isTicketOwner) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Get messages
    let query = { ticketId: id };
    if (!isAdmin) {
      query.isInternalNote = false;
    }
    
    const messages = await Message.find(query)
      .sort({ createdAt: 1 })
      .populate('senderId', 'name email profilePicture');
    
    res.json({
      ticket,
      messages,
      userCanReply: true,
      userRole: isAdmin ? 'admin' : 'user'
    });
  } catch (error) {
    console.error('Error fetching ticket details:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ============================
   ✅ FORGOT PASSWORD SYSTEM WITH SENDGRID
============================ */

// Store codes in memory
const resetCodes = new Map(); // email -> { code, expiresAt }

function generate6DigitCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ✅ Helper function to send email with SendGrid
async function sendPasswordResetEmail(toEmail, code) {
  const msg = {
    to: toEmail,
    from: process.env.SENDGRID_VERIFIED_SENDER || 'your-verified-email@example.com',
    subject: 'Password Recovery Code',
    text: `Your 6-digit recovery code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Recovery</h2>
        <p>Your 6-digit recovery code is:</p>
        <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
          ${code}
        </div>
        <p style="color: #666;">This code expires in 10 minutes.</p>
        <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
      </div>
    `
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Password reset email sent to ${toEmail}`);
    return true;
  } catch (error) {
    console.error('❌ SendGrid error:', error.response?.body || error.message);
    return false;
  }
}

// 7. Send reset code
app.post('/api/forgot/send-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const cleanEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.json({ message: 'If this email exists, a code has been sent.' });
    }

    const code = generate6DigitCode();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    resetCodes.set(cleanEmail, { code, expiresAt });

    const emailSent = await sendPasswordResetEmail(cleanEmail, code);
    if (!emailSent) console.error('Failed to send email, but returning generic message');

    return res.json({ message: 'If this email exists, a code has been sent.' });
  } catch (e) {
    console.error('send-code error:', e);
    return res.status(500).json({ message: 'Error sending code' });
  }
});

// 8. Verify code + reset password
app.post('/api/forgot/verify-code-reset', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ message: 'Email, code, and newPassword are required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const entry = resetCodes.get(cleanEmail);

    if (!entry) return res.status(400).json({ message: 'No code requested. Go back and request one.' });

    if (Date.now() > entry.expiresAt) {
      resetCodes.delete(cleanEmail);
      return res.status(400).json({ message: 'Code expired. Request a new one.' });
    }

    if (entry.code !== code) {
      return res.status(400).json({ message: 'Invalid code' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updated = await User.findOneAndUpdate(
      { email: cleanEmail },
      { password: hashedPassword },
      { new: true }
    );

    resetCodes.delete(cleanEmail);

    if (!updated) return res.status(404).json({ message: 'User not found' });

    return res.json({ message: 'Password updated successfully' });
  } catch (e) {
    console.error('verify-code-reset error:', e);
    return res.status(500).json({ message: 'Error resetting password' });
  }
});

/* ============================
   ✅ DESTINATIONS API (for index.html)
============================ */

// Seed destinations
app.post('/api/destinations/seed', async (req, res) => {
  try {
    // prevents duplicates
    await Destination.deleteMany({});

    await Destination.insertMany([
      { name: "Tokyo", country: "Japan", continent: "Asia", estimatedCost: 2500, safetyScore: 9, tags: "sushi, temples, shopping, anime, nightlife" },
      { name: "Paris", country: "France", continent: "Europe", estimatedCost: 2800, safetyScore: 7, tags: "museums, cafes, landmarks, art, nightlife" },
      { name: "New York", country: "USA", continent: "North America", estimatedCost: 3000, safetyScore: 7, tags: "broadway, food, shopping, museums, skyline" },
      { name: "Bali", country: "Indonesia", continent: "Asia", estimatedCost: 1600, safetyScore: 8, tags: "beaches, surfing, temples, hikes, resorts" }
    ]);

    res.json({ ok: true, added: 4 });
  } catch (err) {
    console.error('destinations seed error:', err);
    res.status(500).json({ ok: false, message: 'Seed failed' });
  }
});

// Search destinations
app.get('/api/destinations/search', async (req, res) => {
  try {
    const query = (req.query.query || "").toString().trim();
    const maxBudget = req.query.maxBudget ? Number(req.query.maxBudget) : null;

    const filter = {};
    if (query) {
      filter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { country: { $regex: query, $options: 'i' } },
        { tags: { $regex: query, $options: 'i' } }
      ];
    }
    if (maxBudget !== null && !Number.isNaN(maxBudget)) {
      filter.estimatedCost = { $lte: maxBudget };
    }

    const results = await Destination.find(filter).limit(50);
    res.json({ ok: true, count: results.length, results });
  } catch (err) {
    console.error('destinations search error:', err);
    res.status(500).json({ ok: false, message: 'Search failed' });
  }
});

/* ============================
   ✅ CURRENCY API (for currency.html)
============================ */

// Seed currencies
app.post('/api/currency/seed', async (req, res) => {
  try {
    const count = await Currency.countDocuments();
    if (count > 0) return res.json({ ok: true, added: 0, message: 'Already seeded' });

    const sample = [
      { country: "United States", currencyCode: "USD", costIndex: 100 },
      { country: "Mexico", currencyCode: "MXN", costIndex: 55 },
      { country: "Japan", currencyCode: "JPY", costIndex: 90 },
      { country: "United Kingdom", currencyCode: "GBP", costIndex: 110 },
      { country: "Switzerland", currencyCode: "CHF", costIndex: 145 },
      { country: "China", currencyCode: "CNY", costIndex: 60 },
      { country: "India", currencyCode: "INR", costIndex: 35 },
      { country: "Brazil", currencyCode: "BRL", costIndex: 55 },
      { country: "South Korea", currencyCode: "KRW", costIndex: 85 },
      { country: "Singapore", currencyCode: "SGD", costIndex: 95 },
      { country: "Canada", currencyCode: "CAD", costIndex: 105 },
      { country: "Australia", currencyCode: "AUD", costIndex: 115 },
      { country: "Thailand", currencyCode: "THB", costIndex: 50 },
      { country: "Malaysia", currencyCode: "MYR", costIndex: 50 },
      { country: "Sweden", currencyCode: "SEK", costIndex: 100 },
      { country: "Norway", currencyCode: "NOK", costIndex: 130 },
      { country: "Denmark", currencyCode: "DKK", costIndex: 125 },
      { country: "New Zealand", currencyCode: "NZD", costIndex: 105 },
      { country: "Hong Kong", currencyCode: "HKD", costIndex: 90 },
      { country: "Philippines", currencyCode: "PHP", costIndex: 45 }
    ];

    await Currency.insertMany(sample);
    res.json({ ok: true, added: sample.length });
  } catch (err) {
    console.error('currency seed error:', err);
    res.status(500).json({ ok: false, message: 'Seed failed' });
  }
});

// Get all currency codes
app.get('/api/currency/codes', async (req, res) => {
  try {
    const docs = await Currency.find({}, { country: 1, currencyCode: 1, _id: 0 }).sort({ currencyCode: 1 });
    const codes = docs.map(d => ({ code: d.currencyCode, country: d.country }));
    res.json({ ok: true, codes });
  } catch (err) {
    console.error('currency codes error:', err);
    res.status(500).json({ ok: false, message: 'Failed to load currency codes' });
  }
});

// Get currency leaderboard
app.get('/api/currency/leaderboard', async (req, res) => {
  try {
    const base = (req.query.base || 'USD').toString().toUpperCase();
    const amount = Number(req.query.amount || 1000);
    const top = Number(req.query.top || 20);

    const baseDoc = await Currency.findOne({ currencyCode: base });
    const baseCost = baseDoc ? Number(baseDoc.costIndex) : 100;

    const docs = await Currency.find();

    const results = docs
      .filter(d => d.currencyCode !== base)
      .map(d => {
        const localCost = Number(d.costIndex) || 100;
        const purchasingPowerScore = baseCost / localCost;
        const localAmount = amount * purchasingPowerScore;
        return {
          country: d.country,
          currencyCode: d.currencyCode,
          costIndex: localCost,
          purchasingPowerScore,
          localAmount
        };
      })
      .sort((a, b) => b.purchasingPowerScore - a.purchasingPowerScore)
      .slice(0, top);

    res.json({ ok: true, base, amount, results });
  } catch (err) {
    console.error('currency leaderboard error:', err);
    res.status(500).json({ ok: false, message: 'Leaderboard failed' });
  }
});

/* ============================
   ✅ TICKET SYSTEM API
============================ */

// Get all tickets with optional filters
app.get('/api/tickets', async (req, res) => {
  try {
    const { status, priority, category } = req.query;
    
    // Build filter object
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (priority && priority !== 'all') filter.priority = priority;
    if (category && category !== 'all') filter.category = category;
    
    const tickets = await Ticket.find(filter).sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new ticket
app.post('/api/tickets', async (req, res) => {
  try {
    const { name, email, category, priority, description } = req.body;
    
    // Validate required fields
    if (!name || !email || !category || !priority || !description) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    const newTicket = new Ticket({
      name,
      email,
      category,
      priority,
      description,
      status: 'Open'
    });
    
    await newTicket.save();
    
    res.status(201).json({
      message: 'Ticket submitted successfully',
      ticketId: newTicket._id,
      ticket: newTicket
    });
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a ticket (status)
app.patch('/api/tickets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, assignedTo } = req.body;
    
    if (!status && !assignedTo) {
      return res.status(400).json({ message: 'Status or assignedTo is required' });
    }
    
    const updateData = {};
    if (status) {
      // Validate status value
      const validStatuses = ['Open', 'Pending', 'Resolved'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status value' });
      }
      updateData.status = status;
      if (status === 'Resolved') {
        updateData.resolvedAt = new Date();
      }
    }
    if (assignedTo !== undefined) {
      updateData.assignedTo = assignedTo;
    }
    
    const updatedTicket = await Ticket.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );
    
    if (!updatedTicket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    res.json({
      message: 'Ticket updated successfully',
      ticket: updatedTicket
    });
  } catch (error) {
    console.error('Error updating ticket:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a ticket
app.delete('/api/tickets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedTicket = await Ticket.findByIdAndDelete(id);
    
    if (!deletedTicket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    res.json({ message: 'Ticket deleted successfully' });
  } catch (error) {
    console.error('Error deleting ticket:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get ticket statistics
app.get('/api/tickets/stats', async (req, res) => {
  try {
    const total = await Ticket.countDocuments();
    const open = await Ticket.countDocuments({ status: 'Open' });
    const pending = await Ticket.countDocuments({ status: 'Pending' });
    const resolved = await Ticket.countDocuments({ status: 'Resolved' });
    
    res.json({
      total,
      open,
      pending,
      resolved
    });
  } catch (error) {
    console.error('Error fetching ticket stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ============================
   ✅ ADMIN USER MANAGEMENT API
============================ */

// Get all users (admin only) - THE FIXED ROUTE
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (e) {
    console.error('Get users error:', e);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// Get user statistics
app.get('/api/users/stats', async (req, res) => {
  try {
    const total = await User.countDocuments();
    const active = await User.countDocuments({ isBanned: false });
    const banned = await User.countDocuments({ isBanned: true });
    const admins = await User.countDocuments({ isAdmin: true });
    
    res.json({ total, active, banned, admins });
  } catch (e) {
    console.error('Get user stats error:', e);
    res.status(500).json({ message: 'Error fetching user statistics' });
  }
});

// Ban/Unban user
app.post('/api/users/:id/ban', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    user.isBanned = true;
    await user.save();
    
    res.json({ 
      message: 'User banned successfully', 
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        isBanned: user.isBanned
      }
    });
  } catch (e) {
    console.error('Ban user error:', e);
    res.status(500).json({ message: 'Error banning user' });
  }
});

app.post('/api/users/:id/unban', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    user.isBanned = false;
    await user.save();
    
    res.json({ 
      message: 'User unbanned successfully', 
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        isBanned: user.isBanned
      }
    });
  } catch (e) {
    console.error('Unban user error:', e);
    res.status(500).json({ message: 'Error unbanning user' });
  }
});

// Get single user
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (e) { 
    console.error('Get user error:', e);
    res.status(500).json({ message: 'Error fetching user' }); 
  }
});

// Update user
app.put('/api/users/:id', async (req, res) => {
  try {
    const { name, email, isAdmin } = req.body;
    
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, isAdmin },
      { new: true }
    ).select('-password');
    
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(updatedUser);
  } catch (e) { 
    console.error('Update user error:', e);
    res.status(500).json({ message: 'Error updating user' }); 
  }
});

// Toggle user ban status
app.patch('/api/admin/users/:id/toggle-ban', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    user.isBanned = !user.isBanned;
    await user.save();
    
    res.json({ 
      message: 'Ban status updated', 
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        isBanned: user.isBanned
      }
    });
  } catch (e) {
    console.error('Toggle ban error:', e);
    res.status(500).json({ message: 'Error updating user' });
  }
});

// ============================
// ✅ DEFAULT ADMIN USER CREATION
// ============================
async function createDefaultAdmin() {
  try {
    const adminEmail = 'admin@travelhub.com';
    const existingAdmin = await User.findOne({ email: adminEmail });
    
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const adminUser = new User({
        name: 'System Administrator',
        email: adminEmail,
        password: hashedPassword,
        bio: 'Default system administrator account',
        isAdmin: true,
        isBanned: false
      });
      
      await adminUser.save();
      console.log('✅ Default admin user created: admin@travelhub.com / admin123');
    } else {
      console.log('✅ Admin user already exists');
    }
  } catch (error) {
    console.error('Error creating default admin:', error);
  }
}

// Initialize default admin on server start
createDefaultAdmin();

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));