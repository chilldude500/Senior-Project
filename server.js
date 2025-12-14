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


// Use Case #5: Currency Leaderboard

// Currency Schema
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


// POST /api/currency/seed
// Seeds/Upserts currency data so you can demo the leaderboard.

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

// USE CASE #7
// ============================
// Alert Schema
const alertSchema = new mongoose.Schema({
  type: { type: String, required: true, trim: true }, // "flight" | "weather" | "currency"
  title: { type: String, required: true, trim: true },
  details: { type: String, default: "", trim: true },

  // Optional fields depending on alert type
  destination: { type: String, default: "", trim: true },  // e.g., "Tokyo"
  country: { type: String, default: "", trim: true },       // e.g., "Japan"
  airportCode: { type: String, default: "", trim: true, uppercase: true }, // e.g., "LAX"
  flightNumber: { type: String, default: "", trim: true },  // e.g., "AA100"

  severity: { type: Number, default: 1 }, // 1 (low) .. 5 (high)

  // Currency alerts
  currencyCode: { type: String, default: "", trim: true, uppercase: true }, // e.g., "JPY"
  percentChange: { type: Number, default: 0 }, // e.g., -6.2 means "dropped 6.2%"

  createdAt: { type: Date, default: Date.now }
});

const Alert = mongoose.model("Alert", alertSchema);

// A "subscription" so you can say user wants alerts for a destination/currency
const alertSubSchema = new mongoose.Schema({
  email: { type: String, required: true, trim: true, lowercase: true },
  destination: { type: String, default: "", trim: true }, // e.g., "Tokyo"
  country: { type: String, default: "", trim: true },
  currencyCode: { type: String, default: "", trim: true, uppercase: true }, // e.g., "JPY"
  minSeverity: { type: Number, default: 1 }, // show alerts >= this
  createdAt: { type: Date, default: Date.now }
});

const AlertSub = mongoose.model("AlertSub", alertSubSchema);

/**
 * GET /api/alerts
 * Optional query:
 *  - type=flight|weather|currency
 *  - destination=Tokyo
 *  - currencyCode=JPY
 *  - minSeverity=3
 */
app.get("/api/alerts", async (req, res) => {
  try {
    const type = String(req.query.type || "").trim().toLowerCase();
    const destination = String(req.query.destination || "").trim();
    const currencyCode = String(req.query.currencyCode || "").trim().toUpperCase();
    const minSeverity = Number(req.query.minSeverity || 0);

    const filter = {};
    if (type) filter.type = type;
    if (destination) filter.destination = { $regex: destination, $options: "i" };
    if (currencyCode) filter.currencyCode = currencyCode;
    if (!Number.isNaN(minSeverity) && minSeverity > 0) filter.severity = { $gte: minSeverity };

    const results = await Alert.find(filter)
      .sort({ createdAt: -1, severity: -1 })
      .limit(100);

    res.json({ ok: true, count: results.length, results });
  } catch (err) {
    console.error("Get alerts error:", err);
    res.status(500).json({ ok: false, message: "Server error fetching alerts" });
  }
});


// POST /api/alerts/seed
 // Seeds demo alerts (so you can show it working).
 
app.post("/api/alerts/seed", async (req, res) => {
  try {
    const seed = [
      {
        type: "flight",
        title: "Flight Delay: AA100",
        details: "Departure delayed due to aircraft maintenance.",
        airportCode: "LAX",
        flightNumber: "AA100",
        destination: "Tokyo",
        country: "Japan",
        severity: 4
      },
      {
        type: "weather",
        title: "Weather Warning: Heavy Rain",
        details: "Flood advisory issued. Avoid low-lying areas.",
        destination: "Tokyo",
        country: "Japan",
        severity: 5
      },
      {
        type: "currency",
        title: "Currency Drop Alert: JPY",
        details: "JPY weakened significantly against USD.",
        currencyCode: "JPY",
        percentChange: -6.2,
        destination: "Tokyo",
        country: "Japan",
        severity: 3
      },
      {
        type: "weather",
        title: "Weather Warning: Heat Advisory",
        details: "High temperatures expected. Stay hydrated.",
        destination: "Phoenix",
        country: "United States",
        severity: 3
      },
      {
        type: "flight",
        title: "Flight Delay: DL220",
        details: "Delayed due to inbound aircraft late arrival.",
        airportCode: "JFK",
        flightNumber: "DL220",
        destination: "London",
        country: "United Kingdom",
        severity: 2
      },
      {
        type: "currency",
        title: "Currency Drop Alert: MXN",
        details: "MXN dropped vs USD.",
        currencyCode: "MXN",
        percentChange: -3.4,
        destination: "Cancun",
        country: "Mexico",
        severity: 2
      }
    ];

    await Alert.insertMany(seed);
    res.json({ ok: true, message: "Seeded alerts", added: seed.length });
  } catch (err) {
    console.error("Seed alerts error:", err);
    res.status(500).json({ ok: false, message: "Server error seeding alerts" });
  }
});


// POST /api/alerts/subscribe
// body: { email, destination?, country?, currencyCode?, minSeverity? }

app.post("/api/alerts/subscribe", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const destination = String(req.body.destination || "").trim();
    const country = String(req.body.country || "").trim();
    const currencyCode = String(req.body.currencyCode || "").trim().toUpperCase();
    const minSeverity = Number(req.body.minSeverity || 1);

    if (!email) return res.status(400).json({ ok: false, message: "email is required" });

    const sub = await AlertSub.create({
      email,
      destination,
      country,
      currencyCode,
      minSeverity: (!Number.isNaN(minSeverity) && minSeverity >= 1) ? minSeverity : 1
    });

    res.json({ ok: true, message: "Subscribed", subId: sub._id });
  } catch (err) {
    console.error("Subscribe error:", err);
    res.status(500).json({ ok: false, message: "Server error subscribing" });
  }
});


// GET /api/alerts/forUser?email=...
//Returns alerts matching that user's subscription filters.
 
app.get("/api/alerts/forUser", async (req, res) => {
  try {
    const email = String(req.query.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, message: "email is required" });

    const subs = await AlertSub.find({ email }).lean();
    if (subs.length === 0) return res.json({ ok: true, message: "No subscriptions for this email", count: 0, results: [] });

    // Build OR filters from subscriptions
    const or = subs.map(s => {
      const f = { severity: { $gte: s.minSeverity || 1 } };
      if (s.destination) f.destination = { $regex: s.destination, $options: "i" };
      if (s.country) f.country = { $regex: s.country, $options: "i" };
      if (s.currencyCode) f.currencyCode = s.currencyCode;
      return f;
    });

    const results = await Alert.find({ $or: or }).sort({ createdAt: -1, severity: -1 }).limit(100);
    res.json({ ok: true, count: results.length, results });
  } catch (err) {
    console.error("Alerts for user error:", err);
    res.status(500).json({ ok: false, message: "Server error fetching user alerts" });
  }
});


// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
