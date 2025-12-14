const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const MONGODB_URI = 'mongodb+srv://seniorproject:RsxK1bDyaTDoXnzx@seniorproject.wkyrwfp.mongodb.net/senior_project_db?appName=seniorproject';

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// UPDATED USER SCHEMA
const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    bio: { type: String, default: '' },
    profilePicture: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// PAGES
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'register.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/profile', (req, res) => res.sendFile(path.join(__dirname, 'profile.html')));

// API: REGISTER
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
    } catch (e) { res.status(500).json({ message: 'Error' }); }
});

// API: LOGIN
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        res.json({ message: 'Success', userId: user._id, name: user.name });
    } catch (e) { res.status(500).json({ message: 'Error' }); }
});

// API: GET PROFILE
app.get('/api/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) return res.status(404).json({ message: 'Not found' });
        res.json(user);
    } catch (e) { res.status(500).json({ message: 'Error' }); }
});

// API: UPDATE PROFILE
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

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));