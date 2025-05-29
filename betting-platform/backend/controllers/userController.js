// controllers/userController.js
const User = require('../models/User');
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const Withdrawal = require('../models/Withdrawal');
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

const JWT_SECRET = process.env.JWT_SECRET || "supersecret"; // 🔐 store this in .env

function isStrongPassword(password) {
  const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  return strongPasswordRegex.test(password);
}

// ⏱ For login endpoint (apply in router)
exports.loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10, // limit to 10 requests per 15 min
  message: "Too many login attempts. Try again later.",
});

exports.loginUser = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (!isStrongPassword(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.' });
  }

  try {
    let user = await User.findOne({ username });
    //if (!user) return res.status(401).json({ error: "Invalid credentials" });

    if (!user) {
      // Register new user with hashed password
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      user = await User.create({ username, password: hashedPassword });
      console.log(`🆕 New user created: ${username}`);
    } else {
      // Compare entered password with stored hash
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.status(401).json({ error: 'Invalid password' });
      }
      user.last_active = new Date();
      await user.save();
      console.log(`👋 Welcome back, ${username}`);
    }

    const token = jwt.sign(
      { username: user.username, isAdmin: user.isAdmin || false },
      JWT_SECRET,
      { expiresIn: "7d" }
    );    

    res.json({
      token,
      username: user.username,
      balance: user.balance,
      last_active: user.last_active,
      isAdmin: user.isAdmin || false,
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getBalance = async (req, res) => {
  const { username } = req.params;
  if (!username) return res.status(400).json({ error: 'Missing username' });

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ balance: user.balance });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
};


exports.getUserWithdrawals = async (req, res) => {
  const { username } = req.params;
  if (!username) return res.status(400).json({ error: "Username is required" });

  try {
    const withdrawals = await Withdrawal.find({ username }).sort({ timestamp: -1 });
    res.json(withdrawals);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch withdrawal history" });
  }
};