const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
const { Publisher } = require('./models/Book');
const Customer = require("./models/Customer");

app.use(express.json());
app.use(cors());

const db = "mongodb+srv://shaiksuraz50:8Zhg3S9vanvvSlOE@cluster0.tre1ikc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const jwtSecret = 'e0f90e50d589ab7f4a2d1f6e8b6c2d86d761a1f6d937274fa8b2f98e3d50de5b52b7328b9f1e6e2c2eab9e842d2c4d4d2738d0fa7355bb8fd28cf437a9e2d6d6';

const authenticateJWT = (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (!authHeader) {
    return res.status(401).json({ error: 'Access denied, token missing!' });
  } else {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, jwtSecret, (err, decoded) => {
      if (err) {
        return res.status(401).json({ error: 'Invalid token' });
      } else {
        req.user = decoded;
        next();
      }
    });
  }
};

mongoose.connect(db)
  .then(() => {
    console.log("Connection to MongoDB successful");
  })
  .catch((err) => {
    console.log("Error connecting to MongoDB:", err);
  });

const formatDate = (date) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  Customer.findOne({ email })
    .then((user) => {
      if (user) {
        if (user.password === password) {
          const token = jwt.sign({ email: user.email, userType: user.userType, username: user.username }, jwtSecret, { expiresIn: '1d' });

          const loginTimestamp = formatDate(new Date());
          user.timestamps.push({ login: loginTimestamp });

          user.save()
            .then(() => {
              res.json({ token });
            })
            .catch((err) => {
              console.log("Error saving login timestamp:", err);
              res.status(500).json({ error: "Could not save login timestamp" });
            });
        } else {
          res.status(401).json({ error: "The password is incorrect" });
        }
      } else {
        res.status(404).json({ error: "No user exists" });
      }
    })
    .catch((err) => {
      console.log("Error finding user:", err);
      res.status(500).json({ error: "Could not find user" });
    });
});

app.post("/signup", (req, res) => {
  const { name, phone, username, email, password, userType } = req.body;
  Customer.findOne({ $or: [{ email }, { phone }, { username }] })
    .then((existingCustomer) => {
      if (existingCustomer) {
        res.status(400).json({ error: "Email, phone number or username already exists" });
      } else {
        const newCustomer = new Customer({ name, phone, username, email, password, userType });
        newCustomer.save()
          .then((customer) => {
            res.status(201).json({ message: "Successfully registered", customer });
          })
          .catch((err) => {
            console.log("Error creating customer:", err);
            res.status(500).json({ error: "Could not create customer" });
          });
      }
    })
    .catch((err) => {
      console.log("Error finding customer:", err);
      res.status(500).json({ error: "Could not check existing customer" });
    });
});

app.get('/customers', authenticateJWT, (req, res) => {
  Customer.find({ userType: 'customer' })
    .then(customers => {
      res.json(customers);
    })
    .catch(err => {
      console.log("Error fetching customers:", err);
      res.status(500).json({ error: "Could not fetch customers" });
    });
});

app.delete('/customers/:id', authenticateJWT, (req, res) => {
  const { id } = req.params;
  Customer.findByIdAndDelete(id)
    .then(() => {
      res.json({ message: "Customer deleted successfully" });
    })
    .catch(err => {
      console.log("Error deleting customer:", err);
      res.status(500).json({ error: "Could not delete customer" });
    });
});

app.post("/logout", authenticateJWT, (req, res) => {
  const email = req.user.email;

  Customer.findOne({ email })
    .then((user) => {
      if (user) {
        const logoutTimestamp = formatDate(new Date());
        const lastLogin = user.timestamps[user.timestamps.length - 1];

        if (lastLogin && !lastLogin.logout) {
          lastLogin.logout = logoutTimestamp;
        } else {
          user.timestamps.push({ logout: logoutTimestamp });
        }

        user.save()
          .then(() => {
            res.json({ message: "Logout timestamp saved" });
          })
          .catch((err) => {
            console.log("Error saving logout timestamp:", err);
            res.status(500).json({ error: "Could not save logout timestamp" });
          });
      } else {
        res.status(404).json({ error: "No user exists" });
      }
    })
    .catch((err) => {
      console.log("Error finding user:", err);
      res.status(500).json({ error: "Could not find user" });
    });
});
app.get('/user/token', authenticateJWT, (req, res) => {
  const { email, userType } = req.user; // Assuming user email and userType are decoded from JWT
  const token = jwt.sign({ email, userType }, jwtSecret, { expiresIn: '1d' });
  res.json({ userId: email, token }); // Assuming user ID is the email for simplicity
});

app.put('/customers/:id', authenticateJWT, (req, res) => {
  const { id } = req.params;
  const updatedCustomerData = req.body;

  Customer.findByIdAndUpdate(id, updatedCustomerData, { new: true })
    .then(updatedCustomer => {
      if (!updatedCustomer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      res.json(updatedCustomer);
    })
    .catch(err => {
      console.log("Error updating customer:", err);
      res.status(500).json({ error: "Could not update customer" });
    });
});



app.post('/dashboard/book',authenticateJWT, async (req, res) => {
  try {
    const { publisherName, publications } = req.body;

    // Validate request payload
    if (!publisherName || !publications || publications.length === 0) {
      return res.status(400).json({ error: 'Publisher name and publications array are required.' });
    }

    // Process each publication in the request
    for (let publication of publications) {
      const { author, genre, publishedBooks } = publication;

      // Validate required fields
      if (!author || !genre || !publishedBooks || publishedBooks.length === 0) {
        return res.status(400).json({ error: 'Author, genre, and publishedBooks array are required for each publication.' });
      }

      // Find the existing publisher
      let existingPublisher = await Publisher.findOne({ publisherName: publisherName });

      if (existingPublisher) {
        // Check if there's an existing publication with the same author and genre
        let existingPublication = existingPublisher.publications.find(pub => pub.author === author && pub.genre === genre);

        if (existingPublication) {
          // Update existing publication's publishedBooks array with new books
          existingPublication.publishedBooks.push(...publishedBooks);
        } else {
          // Add new publication with author and genre
          existingPublisher.publications.push({ author, genre, publishedBooks });
        }

        // Save the updated existingPublisher
        await existingPublisher.save();
        res.status(200).json(existingPublisher);
      } else {
        // Publisher does not exist, create a new publisher entry with the publication
        const newPublisher = new Publisher({
          publisherName: publisherName,
          publications: [{ author, genre, publishedBooks }],
        });

        const savedPublisher = await newPublisher.save();
        res.status(201).json(savedPublisher);
      }
    }
  } catch (error) {
    console.error('Error saving publisher:', error);
    res.status(500).json({ error: 'Failed to save publisher' });
  }
});


app.get('/books', async (req, res) => {
  try {
    const allPublishers = await Publisher.find().populate('publications.publishedBooks');
    res.json(allPublishers);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.put('/wishlist', authenticateJWT, async (req, res) => {
  const { bookTitle } = req.body; // Extract book title from request body

  try {
    const { email } = req.user; // User information from JWT

    // Find the user based on the email
    const customer = await Customer.findOne({ email }); // Assuming you have a Customer model

    if (!customer) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Add the book to the wishlist if it's not already there
    if (!customer.wishlist.includes(bookTitle)) {
      customer.wishlist.push(bookTitle);
      await customer.save();
    }

    res.status(200).json(customer);
  } catch (error) {
    console.error('Error adding book to wishlist:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.delete('/wishlist', authenticateJWT, async (req, res) => {
  const { bookTitle } = req.body; // Extract book title from request body

  try {
    const { email } = req.user; // User information from JWT

    // Find the user based on the email
    const customer = await Customer.findOne({ email }); // Assuming you have a Customer model

    if (!customer) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove the book from the wishlist if it exists
    const index = customer.wishlist.indexOf(bookTitle);
    if (index > -1) {
      customer.wishlist.splice(index, 1);
      await customer.save();
    }

    res.status(200).json(customer);
  } catch (error) {
    console.error('Error removing book from wishlist:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.get('/wishlist', authenticateJWT, async (req, res) => {
  try {
    const { email } = req.user; // User information from JWT

    // Find the user based on the email
    const customer = await Customer.findOne({ email });

    if (!customer) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ wishlist: customer.wishlist });
  } catch (error) {
    console.error('Error retrieving wishlist:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.get('/books', authenticateJWT, async (req, res) => {
  try {
    const publishers = await Publisher.find();
    const books = publishers.reduce((acc, publisher) => acc.concat(publisher.books), []);
    res.status(200).json(books);
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

app.post('/purchase', authenticateJWT, async (req, res) => {
  try {
    const { bookTitle } = req.body;
    const { username } = req.user;

    const publisher = await Publisher.findOne({ 'publications.publishedBooks.title': bookTitle });
    if (!publisher) {
      return res.status(404).json({ message: 'Book not found' });
    }

    let book;
    publisher.publications.forEach(publication => {
      publication.publishedBooks.forEach(publishedBook => {
        if (publishedBook.title === bookTitle) {
          book = publishedBook;
        }
      });
    });

    if (!book || book.copiesAvailable <= 0) {
      return res.status(400).json({ message: 'No copies available' });
    }

    book.copiesAvailable -= 1;
    book.soldCopies = book.soldCopies ? book.soldCopies + 1 : 1;
    await publisher.save();

    const customer = await Customer.findOne({ username });
    if (customer) {
      const wishlistIndex = customer.wishlist.indexOf(bookTitle);
      if (wishlistIndex > -1) {
        customer.wishlist.splice(wishlistIndex, 1);
      }

      customer.orders.push(bookTitle);
      await customer.save();
    }

    res.status(200).json({ message: 'Purchase successful', book });
  } catch (error) {
    console.error('Error completing purchase:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// In your Express app (e.g., app.js or routes file)
app.put("/books/:id", async (req, res) => {
  const { id } = req.params;
  const { title, description, imageUrl, price, totalCopies, copiesAvailable, soldCopies } = req.body;

  try {
    // Find the book by ID and update it
    const publisher = await Publisher.findOne({ "publications.publishedBooks._id": id });
    if (!publisher) {
      return res.status(404).send("Book not found");
    }

    const publication = publisher.publications.find(pub => pub.publishedBooks.some(book => book._id.equals(id)));
    const book = publication.publishedBooks.id(id);

    book.title = title;
    book.description = description;
    book.imageUrl = imageUrl;
    book.price = price;
    book.totalCopies = totalCopies;
    book.copiesAvailable = copiesAvailable;
    book.soldCopies = soldCopies;

    await publisher.save();
    res.json(book);
  } catch (error) {
    res.status(500).send("Server error");
  }
});

app.delete("/books/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const publisher = await Publisher.findOne({ "publications.publishedBooks._id": id });

    if (!publisher) {
      return res.status(404).send("Book not found");
    }

    const publication = publisher.publications.find(pub =>
      pub.publishedBooks.some(book => book._id.equals(id))
    );

    if (!publication) {
      return res.status(404).send("Book not found");
    }

    // Find the index of the book to remove
    const indexToRemove = publication.publishedBooks.findIndex(book => book._id.equals(id));

    if (indexToRemove === -1) {
      return res.status(404).send("Book not found");
    }

    // Remove the book from the array using splice
    publication.publishedBooks.splice(indexToRemove, 1);

    await publisher.save(); // Save the updated publisher object

    res.send("Book deleted");
  } catch (error) {
    console.error("Error deleting book:", error);
    res.status(500).send("Server error");
  }
});


// DELETE a book
// DELETE a book
app.delete("/publishers/:publisherId/books/:bookId", authenticateJWT, async (req, res) => {
  const { publisherId, bookId } = req.params;

  try {
    // Find the publisher by ID
    const publisher = await Publisher.findById(publisherId);
    if (!publisher) {
      return res.status(404).json({ message: "Publisher not found" });
    }

    // Find the book by ID and remove from publications array
    let bookDeleted = false;
    publisher.publications.forEach(publication => {
      const bookIndex = publication.publishedBooks.findIndex(book => book.id === bookId);
      if (bookIndex !== -1) {
        publication.publishedBooks.splice(bookIndex, 1);
        bookDeleted = true;
      }
    });

    if (!bookDeleted) {
      return res.status(404).json({ message: "Book not found in publisher's publications" });
    }

    // Save the updated publisher
    await publisher.save();

    res.status(200).json({ message: "Book deleted successfully", publisher });
  } catch (error) {
    console.error("Error deleting book:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});



app.get('/my-orders', authenticateJWT, async (req, res) => {
  try {
    const { email } = req.user;

    // Find customer by email
    const customer = await Customer.findOne({ email });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Assuming customer.orders is an array of book titles
    res.status(200).json({ orders: customer.orders });
  } catch (error) {
    console.error('Error retrieving orders:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}); 
app.get('/books/:title', async (req, res) => {
  try {
    const { title } = req.params;
    const publisher = await Publisher.findOne({ 'books.title': title });

    if (!publisher) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const book = publisher.books.find(book => book.title === title);
    res.status(200).json(book);
  } catch (error) {
    console.error('Error retrieving book:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


const PORT = 8000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
