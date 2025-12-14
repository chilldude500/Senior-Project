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

// Destination Schema (Use Case #4) -david
const destinationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  country: { type: String, required: true, trim: true },
  continent: { type: String, default: "", trim: true },
  estimatedCost: { type: Number, default: 0 },   // for budget searching
  safetyScore: { type: Number, default: 0 },     // optional filter
  tags: { type: [String], default: [] }          // keyword searching
});

const Destination = mongoose.model('Destination', destinationSchema);

// ============================
// Use Case #5: Currency Leaderboard
// ============================

// Currency Schema
// exchangeRateToUSD means: "1 USD = X units of this currency"
// Example: JPY 150 => 1 USD = 150 JPY
const currencySchema = new mongoose.Schema({
  country: { type: String, required: true, trim: true },
  currencyCode: { type: String, required: true, trim: true, uppercase: true, unique: true },
  currencyName: { type: String, default: "", trim: true },

  // Approx "cost of living" / basket index to simulate "purchasing power"
  // Higher = more expensive, so purchasing power is lower.
  costIndex: { type: Number, default: 100 },

  // 1 USD = exchangeRateToUSD of this currency
  exchangeRateToUSD: { type: Number, required: true }
}); 

const Currency = mongoose.model("Currency", currencySchema);

// USE CASE #5 - david 
app.get("/api/currency/leaderboard", async (req, res) => {
  try {
    const base = String(req.query.base || "USD").trim().toUpperCase();
    const amount = Number(req.query.amount || 100);
    const top = Math.min(Number(req.query.top || 50), 100);

    if (Number.isNaN(amount) || amount <= 0) {
      return res.status(400).json({ ok: false, message: "amount must be a positive number" });
    }

    const currencies = await Currency.find({}).lean();

    if (currencies.length === 0) {
      return res.json({ ok: true, message: "No currencies seeded yet.", base, amount, count: 0, results: [] });
    }

    // Find base currency rate
    const baseRow = currencies.find(c => c.currencyCode === base);
    if (!baseRow) {
      return res.status(400).json({
        ok: false,
        message: `Base currency '${base}' not found in DB. Seed currencies first, or use a supported code.`
      });
    }

    // Convert user's "home amount" -> USD
    // If 1 USD = baseRate units of base currency, then:
    // USD = amount / baseRate
    const usdAmount = amount / baseRow.exchangeRateToUSD;

    const results = currencies.map(c => {
      const localAmount = usdAmount * c.exchangeRateToUSD;

      // Simple purchasing power proxy:
      // more local money + cheaper costIndex => higher score
      const costIndex = (Number(c.costIndex) > 0) ? Number(c.costIndex) : 100;
      const purchasingPowerScore = localAmount / costIndex;

      return {
        country: c.country,
        currencyCode: c.currencyCode,
        currencyName: c.currencyName,
        costIndex,
        exchangeRateToUSD: c.exchangeRateToUSD,
        usdAmount: Number(usdAmount.toFixed(2)),
        localAmount: Number(localAmount.toFixed(2)),
        purchasingPowerScore: Number(purchasingPowerScore.toFixed(6))
      };
    });

    results.sort((a, b) => b.purchasingPowerScore - a.purchasingPowerScore);

    res.json({
      ok: true,
      base,
      amount,
      usdAmount: Number(usdAmount.toFixed(2)),
      count: results.length,
      results: results.slice(0, top)
    });
  } catch (err) {
    console.error("Currency leaderboard error:", err);
    res.status(500).json({ ok: false, message: "Server error building currency leaderboard" });
  }
});

/**
 * POST /api/currency/seed
 * Seeds/Upserts currency data so you can demo the leaderboard.
 */
app.post("/api/currency/seed", async (req, res) => {
  try {
    const seed = [
      // country, code, name, costIndex, 1 USD = X currency
      { country: "United States", currencyCode: "USD", currencyName: "US Dollar", costIndex: 100, exchangeRateToUSD: 1 },

      { country: "Japan", currencyCode: "JPY", currencyName: "Japanese Yen", costIndex: 85, exchangeRateToUSD: 150 },
      { country: "United Kingdom", currencyCode: "GBP", currencyName: "British Pound", costIndex: 120, exchangeRateToUSD: 0.79 },
      { country: "European Union", currencyCode: "EUR", currencyName: "Euro", costIndex: 110, exchangeRateToUSD: 0.92 },

      { country: "Mexico", currencyCode: "MXN", currencyName: "Mexican Peso", costIndex: 55, exchangeRateToUSD: 17.2 },
      { country: "Canada", currencyCode: "CAD", currencyName: "Canadian Dollar", costIndex: 95, exchangeRateToUSD: 1.36 },
      { country: "Australia", currencyCode: "AUD", currencyName: "Australian Dollar", costIndex: 105, exchangeRateToUSD: 1.52 },

      { country: "South Korea", currencyCode: "KRW", currencyName: "South Korean Won", costIndex: 80, exchangeRateToUSD: 1330 },
      { country: "Thailand", currencyCode: "THB", currencyName: "Thai Baht", costIndex: 50, exchangeRateToUSD: 36.0 },
      { country: "Vietnam", currencyCode: "VND", currencyName: "Vietnamese Dong", costIndex: 45, exchangeRateToUSD: 24500 },

      { country: "Brazil", currencyCode: "BRL", currencyName: "Brazilian Real", costIndex: 50, exchangeRateToUSD: 5.0 },
      { country: "India", currencyCode: "INR", currencyName: "Indian Rupee", costIndex: 40, exchangeRateToUSD: 83.0 },

      { country: "Switzerland", currencyCode: "CHF", currencyName: "Swiss Franc", costIndex: 160, exchangeRateToUSD: 0.88 },
      { country: "South Africa", currencyCode: "ZAR", currencyName: "South African Rand", costIndex: 45, exchangeRateToUSD: 18.6 }
    ];

    const ops = seed.map(doc => ({
      updateOne: {
        filter: { currencyCode: doc.currencyCode },
        update: { $set: doc },
        upsert: true
      }
    }));

    const r = await Currency.bulkWrite(ops);
    res.json({ ok: true, message: "Currency seed complete", result: r });
  } catch (err) {
    console.error("Currency seed error:", err);
    res.status(500).json({ ok: false, message: "Server error seeding currencies" });
  }
});


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

// Use Case #4: Search Destinations - david
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
