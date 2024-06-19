const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  imageUrl: { type: String, required: true },
  price: { type: Number, required: true },
  totalCopies: { type: Number, required: true },
  copiesAvailable: { type: Number, required: true },
  soldCopies: { type: Number, default: 0 }
});

const publicationSchema = new mongoose.Schema({
  author: { type: String, required: true },
  genre: { type: String, required: true },
  publishedBooks: [bookSchema]
});

const publisherSchema = new mongoose.Schema({
  publisherName: { type: String, required: true },
  publications: [publicationSchema]
});

const Publisher = mongoose.model("Publisher", publisherSchema);

module.exports = { Publisher };
