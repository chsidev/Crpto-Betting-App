const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');

exports.getWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find().sort({ timestamp: -1 });
    res.json(withdrawals);
  } catch (err) {
    console.error("Error fetching withdrawals:", err);
    res.status(500).json({ error: 'Failed to fetch withdrawals' });
  }
};

exports.approveWithdrawal = async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Withdrawal ID required' });

  try {
    const withdrawal = await Withdrawal.findById(id);
    if (!withdrawal) return res.status(404).json({ error: 'Request not found' });
    if (withdrawal.status !== 'pending') return res.status(400).json({ error: 'Already processed' });

    const user = await User.findOne({ username: withdrawal.username });
    if (!user) return res.status(404).json({ error: "User not found" });

    withdrawal.status = 'completed';
    await withdrawal.save();
    
    req.app.get('io').emit('withdrawal:update');

    res.json({ message: 'Withdrawal marked as completed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve withdrawal' });
  }
};

exports.rejectWithdrawal = async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: "Withdrawal ID required" });
  
    try {
      const withdrawal = await Withdrawal.findById(id);
      if (!withdrawal) return res.status(404).json({ error: "Request not found" });
      if (withdrawal.status !== "pending") return res.status(400).json({ error: "Already processed" });
  
      withdrawal.status = "rejected";
      await withdrawal.save();
  
      const user = await User.findOne({ username: withdrawal.username });
      if (user) {
        user.balance += withdrawal.amount;
        await user.save();
      }
      
      req.app.get('io').emit('withdrawal:update');
  
      res.json({ message: "Withdrawal rejected and refunded" });
    } catch (err) {
      res.status(500).json({ error: "Failed to reject withdrawal" });
    }
  };

  
