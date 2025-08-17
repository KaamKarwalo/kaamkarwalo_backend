const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');   // add at top with other imports
const nodemailer = require("nodemailer");

require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Connected to MongoDB');
}).catch((err) => {
  console.error('❌ MongoDB connection failed:', err.message);
});

// Schema
const userSchema = new mongoose.Schema({
  userId: String,
  role: String,
  name: String,
  email: String,
  phone: String,
  workerType: String,
  password: String,
  city: String,
  district: String,
  state: String,
  address: String,
  location: String
});


User = mongoose.model('User', userSchema);

// Email transporter using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.ADMIN_EMAIL,
    pass: process.env.ADMIN_EMAIL_PASS
  }
});

// API to register a user
/*
app.post('/api/register', async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.status(201).json({ message: '✅ User registered successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
*/
app.post('/api/register', async (req, res) => {
  try {
    const { phone, password, role } = req.body;

    const exists = await User.findOne({ phone });
    if (exists) return res.status(400).json({ message: "Phone already registered" });

    const newUser = new User({
      ...req.body,
      phone: String(phone),
      password: password,
      role: role || "customer" // default to customer if not passed
    });

    await newUser.save();
    res.json({ message: `${role} registered successfully` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Login API
/*
app.post('/api/login', async (req, res) => {
  const { phone, password } = req.body;
  try {
    const user = await User.findOne({ phone, password });
    if (!user) return res.status(401).json({ error: 'Invalid phone or password' });
    res.json({ message: '✅ Login successful', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
*/
app.post('/api/login', async (req, res) => {
  const { phone, password } = req.body;
  console.log("Login attempt:", { phone, password });

  try {
    const user = await User.findOne({ phone });
    if (!user) {
      console.log("❌ Phone not found in DB");
      return res.status(401).json({ error: 'Invalid phone number' });
    }

    console.log("✅ Phone found:", user.phone);
    console.log("🔑 Password match?", user.password === password);

    if (user.password !== password) {
      console.log("❌ Password incorrect");
      return res.status(401).json({ error: 'Incorrect password' });
    }

    res.json({ message: '✅ Login successful', user });
  } catch (err) {
    console.error("❌ Login error:", err.message);
    res.status(500).json({ error: err.message });
  }
});




// ----------------- BOOKING SCHEMA -----------------
const bookingSchema = new mongoose.Schema({
  customerId: String,
  customerName: String,
  customerPhone: String,
  workerId: String,
  workerName: String,
  workerPhone: String,
  service: String,
  date: { type: Date, default: Date.now },
  status: { type: String, default: "pending" },
  paymentReceived: { type: Boolean, default: false },
  rating: { type: Number, default: null },
  feedback: { type: String, default: '' }
});
const Booking = mongoose.model('Booking', bookingSchema);

// ----------------- BOOKINGS API -----------------
app.post('/api/bookings', async (req, res) => {
  try {
    const booking = new Booking(req.body);
    await booking.save();

    // WhatsApp message text
    const message = `📢 New Booking Received:
Customer: ${booking.customerName} (${booking.customerPhone})
Service: ${booking.service}
Worker: ${booking.workerName} (${booking.workerPhone})
Date: ${new Date(booking.date).toLocaleString()}`;

    // Try sending WhatsApp notification
    try {
      await axios.post(
        `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: process.env.ADMIN_WHATSAPP,
          type: "text",
          text: { body: message }
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            "Content-Type": "application/json"
          }
        }
      );
      console.log("✅ WhatsApp notification sent");
      // Send Admin Email also
      try {
        await transporter.sendMail({
          from: `"KaamKarwalo" <${process.env.ADMIN_EMAIL}>`,
          to: process.env.ADMIN_EMAIL,
          subject: "📢 New Booking Alert",
          text: `📢 New Booking Received!
          Customer: ${booking.customerName} (${booking.customerPhone})
          Service: ${booking.service}
          Worker: ${booking.workerName} (${booking.workerPhone})
          Date: ${new Date(booking.date).toLocaleString()}

          Please check the dashboard for more details.`
        });
        console.log("✅ Admin email sent");
      } catch (emailErr) {
        console.error("❌ Failed to send admin email:", emailErr.message);
      }
    } catch (waErr) {
      console.error("⚠️ WhatsApp send failed:", waErr.response?.data || waErr.message);
    }

    res.json({ message: "✅ Booking saved", booking });
  } catch (err) {
    console.error("❌ Error saving booking:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get all bookings (for admin/worker dashboards later)
app.get('/api/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find();
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});






// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

//Admin A
// Get user by ID
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get All Users

app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/debug-all-users', async (req, res) => {
  const users = await User.find();
  console.log("📦 All Users in DB:");
  users.forEach((user, i) => {
    console.log(`\n#${i + 1}`);
    console.log("Phone Type:", typeof user.phone);
    console.log("Phone:", user.phone);
    console.log("Password:", user.password);
    console.log("Role:", user.role);
  });
  res.send("✅ All users printed in terminal");
});








