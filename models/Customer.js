const mongoose = require('mongoose');

const timestampSchema = new mongoose.Schema({
  login: { type: String },
  logout: { type: String }
});

const addressSchema = new mongoose.Schema({
  name: { type: String },
  phone: { type: Number },
  pincode: { type: Number },
  state: { type: String },
  city: { type: String },
  locality: { type: String },
  landmark: { type: String },
});

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: Number, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  userType: { type: String, required: true, enum: ['customer', 'admin'] },
  addresses: [addressSchema],
  timestamps: [timestampSchema],
  wishlist: [String],
});

module.exports = mongoose.model('Customer', customerSchema);
