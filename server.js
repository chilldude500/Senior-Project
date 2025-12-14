const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); //added this to find html files-david

// MongoDB Connection
const MONGODB_URI = 'mongodb+srv://seniorproject:RsxK1bDyaTDoXnzx@seniorproject.wkyrwfp.mongodb.net/senior_project_db?appName=seniorproject';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// User Model
const User = mongoose.model('User', userSchema);

// Destination Schema (Use Case #4)
const destinationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  country: { type: String, required: true, trim: true },
  continent: { type: String, default: "", trim: true },
  estimatedCost: { type: Number, default: 0 },   // for budget searching
  safetyScore: { type: Number, default: 0 },     // optional filter
  tags: { type: [String], default: [] }          // keyword searching
});

const Destination = mongoose.model('Destination', destinationSchema);


// Register endpoint
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validate input
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const newUser = new User({
            name,
            email,
            password: hashedPassword
        });

        await newUser.save();

        res.status(201).json({ 
            message: 'User registered successfully',
            userId: newUser._id 
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

// Use Case #4: Search Destinations
app.get('/api/destinations/search', async (req, res) => {
  try {
    const query = (req.query.query || '').trim();
    const maxBudget = Number(req.query.maxBudget || 0);
    const continent = (req.query.continent || '').trim();
    const minSafety = Number(req.query.minSafety || 0);

    const filter = {};

    // keyword match: name OR country OR tags
    if (query.length > 0) {
      filter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { country: { $regex: query, $options: 'i' } },
        { tags: { $elemMatch: { $regex: query, $options: 'i' } } }
      ];
    }

    // budget filter
    if (!Number.isNaN(maxBudget) && maxBudget > 0) {
      filter.estimatedCost = { $lte: maxBudget };
    }

    // continent filter
    if (continent.length > 0 && continent !== 'Any') {
      filter.continent = continent;
    }

    // safety filter
    if (!Number.isNaN(minSafety) && minSafety > 0) {
      filter.safetyScore = { $gte: minSafety };
    }

    const results = await Destination
      .find(filter)
      .sort({ safetyScore: -1, estimatedCost: 1 })
      .limit(50);

    res.json({ ok: true, count: results.length, results });
  } catch (error) {
    console.error('Search destinations error:', error);
    res.status(500).json({ ok: false, message: 'Server error searching destinations' });
  }
});


// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
