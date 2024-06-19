const mongoose = require('mongoose');

const timestampSchema = new mongoose.Schema({
  login: { type: String },
  logout: { type: String }
});

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: Number, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  userType: { type: String, required: true, enum: ['customer', 'admin'] },
  timestamps: [timestampSchema],
  wishlist: [String],
  orders: [String]  // Change Orders to orders for consistency
});

module.exports = mongoose.model('Customer', customerSchema);
