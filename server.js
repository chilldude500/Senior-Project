const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static HTML files (index.html, login.html, register.html)
app.use(express.static(path.join(__dirname)));

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

// Destination Schema
const destinationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    country: {
        type: String,
        required: true,
        trim: true
    },
    continent: {
        type: String,
        required: true,
        trim: true
    },
    estimatedCost: {
        type: Number,
        required: true,
        min: 0
    },
    safetyScore: {
        type: Number,
        required: true,
        min: 1,
        max: 10
    },
    tags: [{
        type: String,
        trim: true
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Alert Schema
const alertSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ['flight', 'weather', 'currency']
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    destination: {
        type: String,
        trim: true
    },
    country: {
        type: String,
        trim: true
    },
    airportCode: {
        type: String,
        trim: true
    },
    flightNumber: {
        type: String,
        trim: true
    },
    currencyCode: {
        type: String,
        trim: true
    },
    percentChange: {
        type: Number
    },
    details: {
        type: String,
        trim: true
    },
    severity: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Subscription Schema
const subscriptionSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    destination: {
        type: String,
        trim: true
    },
    currencyCode: {
        type: String,
        trim: true
    },
    minSeverity: {
        type: Number,
        default: 1,
        min: 1,
        max: 5
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Models
const Destination = mongoose.model('Destination', destinationSchema);
const Alert = mongoose.model('Alert', alertSchema);
const Subscription = mongoose.model('Subscription', subscriptionSchema);
const User = mongoose.model('User', userSchema);

// Home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Register page
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'register.html'));
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


// Login endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // Find user by email
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Success (for now, we just return user info — no sessions/JWT yet)
        return res.status(200).json({
            message: 'Login successful',
            userId: user._id,
            name: user.name,
            email: user.email
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ message: 'Server error during login' });
    }
});

// API: Search destinations
app.get('/api/destinations/search', async (req, res) => {
    try {
        const { query = '', maxBudget, continent, minSafety } = req.query;
        
        let filter = {};
        
        // Search by query
        if (query) {
            filter.$or = [
                { name: { $regex: query, $options: 'i' } },
                { country: { $regex: query, $options: 'i' } },
                { tags: { $regex: query, $options: 'i' } }
            ];
        }
        
        // Filter by budget
        if (maxBudget) {
            filter.estimatedCost = { $lte: Number(maxBudget) };
        }
        
        // Filter by continent
        if (continent && continent !== 'Any') {
            filter.continent = continent;
        }
        
        // Filter by safety
        if (minSafety && minSafety !== '0') {
            filter.safetyScore = { $gte: Number(minSafety) };
        }
        
        const results = await Destination.find(filter).sort({ name: 1 });
        
        res.json({ 
            ok: true, 
            count: results.length, 
            results: results.map(d => ({
                name: d.name,
                country: d.country,
                continent: d.continent,
                estimatedCost: d.estimatedCost,
                safetyScore: d.safetyScore,
                tags: d.tags
            }))
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ ok: false, message: 'Server error during search' });
    }
});

// API: Get alerts
app.get('/api/alerts', async (req, res) => {
    try {
        const { type, destination, currencyCode, minSeverity } = req.query;
        
        let filter = {};
        
        if (type) filter.type = type;
        if (destination) filter.destination = { $regex: destination, $options: 'i' };
        if (currencyCode) filter.currencyCode = currencyCode.toUpperCase();
        if (minSeverity && minSeverity !== '0') filter.severity = { $gte: Number(minSeverity) };
        
        const results = await Alert.find(filter).sort({ severity: -1, createdAt: -1 });
        
        res.json({ 
            ok: true, 
            count: results.length, 
            results: results.map(a => ({
                type: a.type,
                title: a.title,
                destination: a.destination,
                country: a.country,
                airportCode: a.airportCode,
                flightNumber: a.flightNumber,
                currencyCode: a.currencyCode,
                percentChange: a.percentChange,
                details: a.details,
                severity: a.severity
            }))
        });
    } catch (error) {
        console.error('Get alerts error:', error);
        res.status(500).json({ ok: false, message: 'Server error loading alerts' });
    }
});

// API: Seed alerts (add sample data)
app.post('/api/alerts/seed', async (req, res) => {
    try {
        // Sample alerts data
        const sampleAlerts = [
            { type: "flight", title: "Flight Delay", destination: "Tokyo", country: "Japan", airportCode: "HND", flightNumber: "NH111", details: "3-hour delay due to weather", severity: 4 },
            { type: "weather", title: "Typhoon Warning", destination: "Tokyo", country: "Japan", details: "Typhoon approaching, flights may be cancelled", severity: 5 },
            { type: "currency", title: "JPY Drop", destination: "Tokyo", country: "Japan", currencyCode: "JPY", percentChange: -2.5, details: "Japanese Yen dropped against USD", severity: 2 },
            { type: "flight", title: "Cancellation", destination: "Paris", country: "France", airportCode: "CDG", flightNumber: "AF222", details: "Flight cancelled due to strike", severity: 5 },
            { type: "weather", title: "Heat Wave", destination: "Paris", country: "France", details: "Extreme heat warning, 40°C expected", severity: 3 },
            { type: "flight", title: "Gate Change", destination: "New York", country: "USA", airportCode: "JFK", flightNumber: "AA333", details: "Gate changed from B12 to C7", severity: 1 },
            { type: "currency", title: "EUR Strengthens", destination: "Paris", country: "France", currencyCode: "EUR", percentChange: 1.8, details: "Euro gains against major currencies", severity: 2 },
            { type: "weather", title: "Snow Storm", destination: "New York", country: "USA", details: "Heavy snowfall expected, travel disruptions likely", severity: 4 },
            { type: "flight", title: "Baggage Delay", destination: "London", country: "UK", airportCode: "LHR", flightNumber: "BA444", details: "Baggage handling delay, expect 2-hour wait", severity: 2 },
            { type: "currency", title: "GBP Volatility", destination: "London", country: "UK", currencyCode: "GBP", percentChange: -1.2, details: "British Pound showing high volatility", severity: 3 }
        ];
        
        // Clear existing alerts (optional)
        // await Alert.deleteMany({});
        
        // Insert sample alerts
        const inserted = await Alert.insertMany(sampleAlerts);
        
        res.json({ ok: true, added: inserted.length });
    } catch (error) {
        console.error('Seed alerts error:', error);
        res.status(500).json({ ok: false, message: 'Server error seeding alerts' });
    }
});

// API: Seed destinations (add sample data)
app.post('/api/destinations/seed', async (req, res) => {
    try {
        // Sample destinations data
        const sampleDestinations = [
            { name: "Tokyo", country: "Japan", continent: "Asia", estimatedCost: 2500, safetyScore: 9, tags: ["city", "modern", "food"] },
            { name: "Paris", country: "France", continent: "Europe", estimatedCost: 1800, safetyScore: 8, tags: ["romantic", "culture", "food"] },
            { name: "New York", country: "USA", continent: "North America", estimatedCost: 2200, safetyScore: 7, tags: ["city", "shopping", "nightlife"] },
            { name: "Bali", country: "Indonesia", continent: "Asia", estimatedCost: 1200, safetyScore: 7, tags: ["beach", "relaxing", "adventure"] },
            { name: "London", country: "UK", continent: "Europe", estimatedCost: 2000, safetyScore: 9, tags: ["city", "history", "culture"] },
            { name: "Barcelona", country: "Spain", continent: "Europe", estimatedCost: 1500, safetyScore: 8, tags: ["beach", "architecture", "food"] },
            { name: "Dubai", country: "UAE", continent: "Asia", estimatedCost: 2800, safetyScore: 9, tags: ["luxury", "shopping", "modern"] },
            { name: "Sydney", country: "Australia", continent: "Oceania", estimatedCost: 2300, safetyScore: 9, tags: ["beach", "nature", "city"] },
            { name: "Rome", country: "Italy", continent: "Europe", estimatedCost: 1700, safetyScore: 8, tags: ["history", "food", "culture"] },
            { name: "Bangkok", country: "Thailand", continent: "Asia", estimatedCost: 1000, safetyScore: 7, tags: ["city", "food", "shopping"] }
        ];
        
        // Clear existing destinations (optional)
        // await Destination.deleteMany({});
        
        // Insert sample destinations
        const inserted = await Destination.insertMany(sampleDestinations);
        
        res.json({ ok: true, added: inserted.length });
    } catch (error) {
        console.error('Seed destinations error:', error);
        res.status(500).json({ ok: false, message: 'Server error seeding destinations' });
    }
});

// API: Subscribe to alerts
app.post('/api/alerts/subscribe', async (req, res) => {
    try {
        const { email, destination, currencyCode, minSeverity } = req.body;
        
        if (!email) {
            return res.json({ ok: false, message: "Email is required" });
        }
        
        // Check if subscription already exists
        const existing = await Subscription.findOne({ 
            email: email.toLowerCase().trim(),
            destination: destination || null,
            currencyCode: currencyCode ? currencyCode.toUpperCase() : null
        });
        
        if (existing) {
            return res.json({ ok: false, message: "Subscription already exists for this criteria" });
        }
        
        // Create new subscription
        const subscription = new Subscription({
            email: email.toLowerCase().trim(),
            destination: destination ? destination.trim() : null,
            currencyCode: currencyCode ? currencyCode.toUpperCase().trim() : null,
            minSeverity: minSeverity || 1
        });
        
        await subscription.save();
        
        res.json({ ok: true, message: "Subscription added successfully" });
    } catch (error) {
        console.error('Subscribe error:', error);
        res.status(500).json({ ok: false, message: 'Server error during subscription' });
    }
});

// API: Get user alerts based on subscriptions
app.get('/api/alerts/forUser', async (req, res) => {
    try {
        const { email } = req.query;
        
        if (!email) {
            return res.json({ ok: false, message: "Email is required" });
        }
        
        // Get user's subscriptions
        const subscriptions = await Subscription.find({ 
            email: email.toLowerCase().trim() 
        });
        
        if (subscriptions.length === 0) {
            return res.json({ ok: true, count: 0, results: [] });
        }
        
        // Build filter based on subscriptions
        let filter = { $or: [] };
        
        for (const sub of subscriptions) {
            let subFilter = {};
            
            if (sub.destination) {
                subFilter.destination = { $regex: sub.destination, $options: 'i' };
            }
            
            if (sub.currencyCode) {
                subFilter.currencyCode = sub.currencyCode;
            }
            
            subFilter.severity = { $gte: sub.minSeverity };
            
            filter.$or.push(subFilter);
        }
        
        // If no specific filters in subscriptions, get all alerts with minSeverity
        if (filter.$or.length === 0) {
            const minSeverity = Math.min(...subscriptions.map(s => s.minSeverity));
            filter = { severity: { $gte: minSeverity } };
        }
        
        const results = await Alert.find(filter).sort({ severity: -1, createdAt: -1 });
        
        res.json({ 
            ok: true, 
            count: results.length, 
            results: results.map(a => ({
                type: a.type,
                title: a.title,
                destination: a.destination,
                country: a.country,
                airportCode: a.airportCode,
                flightNumber: a.flightNumber,
                currencyCode: a.currencyCode,
                percentChange: a.percentChange,
                details: a.details,
                severity: a.severity
            }))
        });
    } catch (error) {
        console.error('Get user alerts error:', error);
        res.status(500).json({ ok: false, message: 'Server error loading user alerts' });
    }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});