
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
// Set this in your environment variables or .env file
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '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');

const MONGODB_URI = 'mongodb+srv://seniorproject:RsxK1bDyaTDoXnzx@seniorproject.wkyrwfp.mongodb.net/senior_project_db?appName=seniorproject';

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// USER SCHEMA
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  bio: { type: String, default: 'No bio available.' },
  profilePicture: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// --- HTML PAGE ROUTES ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'register.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/profile', (req, res) => res.sendFile(path.join(__dirname, 'profile.html')));
app.get('/members', (req, res) => res.sendFile(path.join(__dirname, 'members.html')));
app.get('/user', (req, res) => res.sendFile(path.join(__dirname, 'user-view.html')));

// --- API ROUTES ---

// 1. Register
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'All fields required' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email taken' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: 'Registered', userId: newUser._id });
  } catch (e) {
    res.status(500).json({ message: 'Error' });
  }
});

// 2. Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    res.json({ message: 'Success', userId: user._id, name: user.name });
  } catch (e) {
    res.status(500).json({ message: 'Error' });
  }
});

// 3. Get Single Profile
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'Not found' });
    res.json(user);
  } catch (e) { res.status(500).json({ message: 'Error' }); }
});

// 4. Update Profile
app.put('/api/users/:id', async (req, res) => {
  try {
    const { name, bio, profilePicture } = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { name, bio, profilePicture },
      { new: true }
    ).select('-password');
    res.json(updatedUser);
  } catch (e) { res.status(500).json({ message: 'Error' }); }
});

// 5. Get ALL Users
app.get('/api/all-users', async (req, res) => {
  try {
    const users = await User.find().select('name bio profilePicture');
    res.json(users);
  } catch (e) { res.status(500).json({ message: 'Error fetching users' }); }
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

// 6. Send reset code
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

// 7. Verify code + reset password
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

const destinationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  country: { type: String, required: true },
  continent: { type: String, required: true },
  estimatedCost: { type: Number, required: true },
  safetyScore: { type: Number, required: true },
  tags: { type: String, default: "" }
});
const Destination = mongoose.model('Destination', destinationSchema);

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

const currencySchema = new mongoose.Schema({
  country: { type: String, required: true },
  currencyCode: { type: String, required: true, unique: true },
  costIndex: { type: Number, required: true }
});
const Currency = mongoose.model('Currency', currencySchema);

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

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
