require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const twilio = require('twilio');
const nodemailer = require('nodemailer');

const app = express();

// CORS configuration - allow only your frontend domain
app.use(cors({
  origin: 'https://pinkpulsehealth.info', // Replace with your actual frontend URL
  methods: ['GET', 'POST'],
}));

app.use(express.json());

// Twilio client setup
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail', 
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS, 
  },
  tls: {
    rejectUnauthorized: false, 
  },
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch((err) => console.error('MongoDB connection error:', err));

// User Schema and Model
const userSchema = new mongoose.Schema({
  email: { type: String, required: true },
  whatsappNumber: { type: String, required: true },
  dob: { type: Date, required: true },
  password: { type: String, required: true },
});

const User = mongoose.model('User', userSchema);

// Helper function to format phone numbers
const formatPhoneNumber = (number) => {
  if (!number) return null; 
  if (number.startsWith('0')) {
    return `+94${number.slice(1)}`;
  }
  return number;
};

app.get('/', (req, res) => {
  res.send("Welcome to Express server");
});

// Route to send SMS to all users
app.post('/sendSmsToAll', async (req, res) => {
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message content is required' });
  }

  try {
    const users = await User.find({});
    const phoneNumbers = users.map((user) => formatPhoneNumber(user.whatsappNumber)).filter(Boolean);

    const sendSmsPromises = phoneNumbers.map((number) => {
      return client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: number,
      }).catch(err => {
        console.error(`Failed to send SMS to ${number}:`, err.message);
      });
    });

    await Promise.all(sendSmsPromises);
    res.status(200).json({ message: 'Messages sent successfully' });
  } catch (err) {
    console.error('Error sending SMS:', err.message);
    res.status(500).json({ error: 'Failed to send messages', details: err.message });
  }
});

// Route to send Email to all users
app.post('/sendEmailToAll', async (req, res) => {
  const { subject, text } = req.body;

  if (!subject || !text) {
    return res.status(400).json({ error: 'Subject and message content are required' });
  }

  try {
    const users = await User.find({});
    const emailAddresses = users.map((user) => user.email).filter(Boolean);

    const sendEmailPromises = emailAddresses.map((email) => {
      return transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject,
        text,
      }).catch(err => {
        console.error(`Failed to send email to ${email}:`, err.message);
      });
    });

    await Promise.all(sendEmailPromises);
    res.status(200).json({ message: 'Emails sent successfully' });
  } catch (err) {
    console.error('Error sending emails:', err.message);
    res.status(500).json({ error: 'Failed to send emails', details: err.message });
  }
});

// Handle favicon requests
app.get('/favicon.ico', (req, res) => res.status(204));

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
