# Registration Application with MongoDB

This is a simple registration application with a sky blue background, Register and Login buttons, and MongoDB integration.

## Features
- Sky blue background
- Register and Login buttons (only Register is functional)
- Registration form with name, email, and password fields
- Data saved to MongoDB
- Automatic redirect to main page after registration

## Prerequisites
- Node.js installed
- MongoDB installed and running

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Start MongoDB
Make sure MongoDB is running on your system:
```bash
# On Mac/Linux
mongod

# On Windows
# MongoDB should be running as a service, or start it manually
```

### 3. Start the Backend Server
```bash
npm start
```
The server will run on http://localhost:3000

### 4. Open the Application
Open `index.html` in your web browser. You can do this by:
- Double-clicking the file, or
- Using a local web server like Live Server in VS Code

## File Structure
- `index.html` - Main page with Register and Login buttons
- `register.html` - Registration form page
- `server.js` - Node.js backend server with MongoDB integration
- `package.json` - Node.js dependencies

## How It Works
1. Click the "Register" button on the main page
2. Fill out the registration form with name, email, and password
3. Click "Register" to submit
4. The data is sent to the backend and saved to MongoDB
5. After successful registration, you're redirected back to the main page

## Security Notes
- Passwords are hashed using bcrypt before storing in the database
- CORS is enabled for local development
- Email addresses are stored in lowercase and are unique

## MongoDB Collection
The user data is stored in:
- Database: `registration_db`
- Collection: `users`
- Fields: name, email, password (hashed), createdAt

## Troubleshooting
- If you see "Error connecting to server", make sure the backend is running (`npm start`)
- If you see MongoDB connection errors, ensure MongoDB is installed and running
- If registration fails with "Email already registered", the email is already in the database
