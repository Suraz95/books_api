const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  product: { type: String },
  address: { type: String }, 
  quantity: { type: Number },
  price: { type: Number },
  date: { type: String },
});

const buyingSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  username: { type: String },
  orders: [orderSchema]
});

module.exports = mongoose.model("BuyingModule", buyingSchema);
