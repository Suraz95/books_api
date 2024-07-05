const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const app = express();
const { Publisher } = require("./models/Book");
const Contact = require('./models/ContactUs');
const BuyingModule = require("./models/Buying");
const Customer = require("./models/Customer");

app.use(express.json());
app.use(cors());

const db =
  "mongodb+srv://shaiksuraz50:czPhpDlMZGoilAaJ@cluster0.zm4vqsc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const jwtSecret =
  "e0f90e50d589ab7f4a2d1f6e8b6c2d86d761a1f6d937274fa8b2f98e3d50de5b52b7328b9f1e6e2c2eab9e842d2c4d4d2738d0fa7355bb8fd28cf437a9e2d6d6";

const authenticateJWT = (req, res, next) => {
  const authHeader = req.header("Authorization");
  if (!authHeader) {
    return res.status(401).json({ error: "Access denied, token missing!" });
  } else {
    const token = authHeader.split(" ")[1];
    jwt.verify(token, jwtSecret, (err, decoded) => {
      if (err) {
        return res.status(401).json({ error: "Invalid token" });
      } else {
        req.user = decoded;
        next();
      }
    });
  }
};

mongoose
  .connect(db)
  .then(() => {
    console.log("Connection to MongoDB successful");
  })
  .catch((err) => {
    console.log("Error connecting to MongoDB:", err);
  });

const formatDate = (date) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};
app.get("/",(req,res)=>{
  res.send("hello");
})
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  Customer.findOne({ email })
    .then((user) => {
      if (user) {
        if (user.password === password) {
          const token = jwt.sign(
            {
              email: user.email,
              userType: user.userType,
              username: user.username,
            },
            jwtSecret,
            { expiresIn: "7d" }
          );

          const loginTimestamp = formatDate(new Date());
          user.timestamps.push({ login: loginTimestamp });

          user
            .save()
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
app.post("/signup", async (req, res) => {
  const { name, phone, username, email, password, userType } = req.body;

  try {
    // Check if the customer already exists
    const existingCustomer = await Customer.findOne({
      $or: [{ email }, { phone }, { username }],
    });

    if (existingCustomer) {
      return res
        .status(400)
        .json({ error: "Email, phone number or username already exists" });
    }

    // Create a new customer
    const newCustomer = new Customer({
      name,
      phone,
      username,
      email,
      password,
      userType,
    });
    const customer = await newCustomer.save();

    // Update or create a BuyingModule entry with the email
    let buyingModule = await BuyingModule.findOne({ email });

    if (!buyingModule) {
      buyingModule = new BuyingModule({ email, username, orders: [] });
    }

    await buyingModule.save();

    res.status(201).json({ message: "Successfully registered", customer });
  } catch (err) {
    console.error("Error during signup process:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/customers", authenticateJWT, (req, res) => {
  Customer.find({ userType: "customer" })
    .then((customers) => {
      res.json(customers);
    })
    .catch((err) => {
      console.log("Error fetching customers:", err);
      res.status(500).json({ error: "Could not fetch customers" });
    });
});

app.delete("/customers/:id", authenticateJWT, (req, res) => {
  const { id } = req.params;
  Customer.findByIdAndDelete(id)
    .then(() => {
      res.json({ message: "Customer deleted successfully" });
    })
    .catch((err) => {
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

        user
          .save()
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
app.get("/user/token", authenticateJWT, (req, res) => {
  const { email, userType } = req.user; // Assuming user email and userType are decoded from JWT
  const token = jwt.sign({ email, userType }, jwtSecret, { expiresIn: "1d" });
  res.json({ userId: email, token }); // Assuming user ID is the email for simplicity
});

app.put("/customers/:id", authenticateJWT, (req, res) => {
  const { id } = req.params;
  const updatedCustomerData = req.body;

  Customer.findByIdAndUpdate(id, updatedCustomerData, { new: true })
    .then((updatedCustomer) => {
      if (!updatedCustomer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(updatedCustomer);
    })
    .catch((err) => {
      console.log("Error updating customer:", err);
      res.status(500).json({ error: "Could not update customer" });
    });
});

app.post("/dashboard/book", authenticateJWT, async (req, res) => {
  try {
    const { publisherName, publications } = req.body;

    // Validate request payload
    if (!publisherName || !publications || publications.length === 0) {
      return res
        .status(400)
        .json({ error: "Publisher name and publications array are required." });
    }

    // Process each publication in the request
    for (let publication of publications) {
      const { author, genre, publishedBooks } = publication;

      // Validate required fields
      if (!author || !genre || !publishedBooks || publishedBooks.length === 0) {
        return res.status(400).json({
          error:
            "Author, genre, and publishedBooks array are required for each publication.",
        });
      }

      // Find the existing publisher
      let existingPublisher = await Publisher.findOne({
        publisherName: publisherName,
      });

      if (existingPublisher) {
        // Check if there's an existing publication with the same author and genre
        let existingPublication = existingPublisher.publications.find(
          (pub) => pub.author === author && pub.genre === genre
        );

        if (existingPublication) {
          // Update existing publication's publishedBooks array with new books
          existingPublication.publishedBooks.push(...publishedBooks);
        } else {
          // Add new publication with author and genre
          existingPublisher.publications.push({
            author,
            genre,
            publishedBooks,
          });
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
    console.error("Error saving publisher:", error);
    res.status(500).json({ error: "Failed to save publisher" });
  }
});

app.get("/books", async (req, res) => {
  try {
    const allPublishers = await Publisher.find().populate(
      "publications.publishedBooks"
    );
    res.json(allPublishers);
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

app.put("/wishlist", authenticateJWT, async (req, res) => {
  const { bookTitle } = req.body; // Extract book title from request body

  try {
    const { email } = req.user; // User information from JWT

    // Find the user based on the email
    const customer = await Customer.findOne({ email }); // Assuming you have a Customer model

    if (!customer) {
      return res.status(404).json({ error: "User not found" });
    }

    // Add the book to the wishlist if it's not already there
    if (!customer.wishlist.includes(bookTitle)) {
      customer.wishlist.push(bookTitle);
      await customer.save();
    }

    res.status(200).json(customer);
  } catch (error) {
    console.error("Error adding book to wishlist:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
app.delete("/wishlist", authenticateJWT, async (req, res) => {
  const { bookTitle } = req.body; // Extract book title from request body

  try {
    const { email } = req.user; // User information from JWT

    // Find the user based on the email
    const customer = await Customer.findOne({ email }); // Assuming you have a Customer model

    if (!customer) {
      return res.status(404).json({ error: "User not found" });
    }

    // Remove the book from the wishlist if it exists
    const index = customer.wishlist.indexOf(bookTitle);
    if (index > -1) {
      customer.wishlist.splice(index, 1);
      await customer.save();
    }

    res.status(200).json(customer);
  } catch (error) {
    console.error("Error removing book from wishlist:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
app.get("/wishlist", authenticateJWT, async (req, res) => {
  try {
    const { email } = req.user; // User information from JWT

    // Find the user based on the email
    const customer = await Customer.findOne({ email });

    if (!customer) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ wishlist: customer.wishlist });
  } catch (error) {
    console.error("Error retrieving wishlist:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/books", authenticateJWT, async (req, res) => {
  try {
    const publishers = await Publisher.find();
    const books = publishers.reduce(
      (acc, publisher) => acc.concat(publisher.books),
      []
    );
    res.status(200).json(books);
  } catch (error) {
    console.error("Error fetching books:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

app.post("/purchase", authenticateJWT, async (req, res) => {
  try {
    const { bookTitle, quantity, address } = req.body;
    const { username, email } = req.user;

    console.log("Received purchase request:", { bookTitle, quantity, address, username, email });

    // Validate request body
    if (!bookTitle || !quantity || !address) {
      console.log("Missing required fields:", { bookTitle, quantity, address });
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Find the publisher with the book and update atomically
    const updatedPublisher = await Publisher.findOneAndUpdate(
      { "publications.publishedBooks.title": bookTitle },
      {
        $inc: { "publications.$[outer].publishedBooks.$[inner].copiesAvailable": -quantity },
        $inc: { "publications.$[outer].publishedBooks.$[inner].soldCopies": quantity },
      },
      {
        arrayFilters: [
          { "outer.publishedBooks.title": bookTitle },
          { "inner.title": bookTitle },
        ],
        new: true, // Return the updated document
      }
    );

    // Check if publisher is found
    if (!updatedPublisher) {
      console.log("Publisher not found for book:", bookTitle);
      return res.status(404).json({ message: "Book not found" });
    }

    // Find the updated book within the publisher's publications
    const publication = updatedPublisher.publications.find(pub => {
      return pub.publishedBooks.some(book => book.title === bookTitle);
    });

    if (!publication) {
      console.log("Publication not found for book:", bookTitle);
      return res.status(404).json({ message: "Publication not found" });
    }

    const book = publication.publishedBooks.find(book => book.title === bookTitle);
    
    if (!book) {
      console.log("Book not found in publication:", bookTitle);
      return res.status(404).json({ message: "Book not found" });
    }

    // Calculate total price based on quantity
    const totalPrice = book.price * quantity;
    console.log("Total price calculated:", totalPrice);

    // Update or create BuyingModule record for the user
    let buyingModule = await BuyingModule.findOne({ email });
    if (!buyingModule) {
      console.log("Creating new BuyingModule entry for user:", email);
      buyingModule = new BuyingModule({
        email,
        username,
        orders: [],
      });
    } else {
      console.log("Found existing BuyingModule entry for user:", email);
    }

    // Create new order object and save to BuyingModule
    const newOrder = {
      product: bookTitle,
      address,
      quantity,
      price: totalPrice,
      date: new Date().toISOString(),
    };
    buyingModule.orders.push(newOrder);
    await buyingModule.save();
    console.log("BuyingModule updated successfully");

    // Respond with success message
    res.status(200).json({ message: "Purchase successful", book });
  } catch (error) {
    console.error("Error completing purchase:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


// In your Express app (e.g., app.js or routes file)
app.delete("/publishers/:publisherId/books/:bookId", authenticateJWT, async (req, res) => {
  const { publisherId, bookId } = req.params;

  try {
    const publisher = await Publisher.findById(publisherId);
    if (!publisher) {
      return res.status(404).json({ message: "Publisher not found" });
    }

    let bookDeleted = false;
    publisher.publications.forEach((publication) => {
      const bookIndex = publication.publishedBooks.findIndex(
        (book) => book._id.equals(bookId)
      );
      if (bookIndex !== -1) {
        publication.publishedBooks.splice(bookIndex, 1);
        bookDeleted = true;
      }
    });

    if (!bookDeleted) {
      return res
        .status(404)
        .json({ message: "Book not found in publisher's publications" });
    }

    await publisher.save();
    res.status(200).json({ message: "Book deleted successfully", publisher });
  } catch (error) {
    console.error("Error deleting book:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.put("/books/:id", async (req, res) => {
  const { id } = req.params;
  const {
    title,
    description,
    imageUrl,
    price,
    totalCopies,
    copiesAvailable,
    soldCopies,
  } = req.body;

  try {
    // Find the book by ID and update it
    const publisher = await Publisher.findOne({
      "publications.publishedBooks._id": id,
    });
    if (!publisher) {
      return res.status(404).send("Book not found");
    }

    const publication = publisher.publications.find((pub) =>
      pub.publishedBooks.some((book) => book._id.equals(id))
    );
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
    const publisher = await Publisher.findOne({
      "publications.publishedBooks._id": id,
    });

    if (!publisher) {
      return res.status(404).send("Book not found");
    }

    const publication = publisher.publications.find((pub) =>
      pub.publishedBooks.some((book) => book._id.equals(id))
    );

    if (!publication) {
      return res.status(404).send("Book not found");
    }

    // Find the index of the book to remove
    const indexToRemove = publication.publishedBooks.findIndex((book) =>
      book._id.equals(id)
    );

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
app.delete(
  "/publishers/:publisherId/books/:bookId",
  authenticateJWT,
  async (req, res) => {
    const { publisherId, bookId } = req.params;

    try {
      // Find the publisher by ID
      const publisher = await Publisher.findById(publisherId);
      if (!publisher) {
        return res.status(404).json({ message: "Publisher not found" });
      }

      // Find the book by ID and remove from publications array
      let bookDeleted = false;
      publisher.publications.forEach((publication) => {
        const bookIndex = publication.publishedBooks.findIndex(
          (book) => book.id === bookId
        );
        if (bookIndex !== -1) {
          publication.publishedBooks.splice(bookIndex, 1);
          bookDeleted = true;
        }
      });

      if (!bookDeleted) {
        return res
          .status(404)
          .json({ message: "Book not found in publisher's publications" });
      }

      // Save the updated publisher
      await publisher.save();

      res.status(200).json({ message: "Book deleted successfully", publisher });
    } catch (error) {
      console.error("Error deleting book:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);


app.get("/my-orders", authenticateJWT, async (req, res) => {
  try {
    const { email } = req.user;

    // Find buying module by email
    const buyingModule = await BuyingModule.findOne({ email });

    if (!buyingModule) {
      return res.status(404).json({ error: "Buying module not found" });
    }

    // Return orders from the buying module
    res.status(200).json({ orders: buyingModule.orders });
  } catch (error) {
    console.error("Error retrieving orders:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
app.get("/books/:title", async (req, res) => {
  try {
    const { title } = req.params;
    const publisher = await Publisher.findOne({ "books.title": title });

    if (!publisher) {
      return res.status(404).json({ error: "Book not found" });
    }

    const book = publisher.books.find((book) => book.title === title);
    res.status(200).json(book);
  } catch (error) {
    console.error("Error retrieving book:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
app.post("/update-address", async (req, res) => {
  const { email, address } = req.body;

  if (!email || !address) {
    return res.status(400).send("Email and address are required");
  }

  try {
    const user = await Customer.findOne({ email });
    if (!user) {
      return res.status(404).send("User not found");
    }

    user.addresses.push(address);
    await user.save();

    res.status(200).send("Address updated successfully");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
});
app.get("/user/address/:email", async (req, res) => {
  try {
    const user = await Customer.findOne({ email: req.params.email });
    if (user) {
      res.status(200).json({ addresses: user.addresses });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});
app.get('/buyingmodules', async (req, res) => {
  try {
    const buyingData = await BuyingModule.find();
    res.json(buyingData);
  } catch (error) {
    res.status(500).send("Error fetching buying data");
  }
});
app.post('/send-message', async (req, res) => {
  const { name, email, message } = req.body;

  try {
    const newContact = new Contact({
      name,
      email,
      message
    });

    await newContact.save();
    res.status(200).json({ success: true, message: 'Message sent successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
const PORT = 8000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
