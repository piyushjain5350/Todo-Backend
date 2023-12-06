const express = require("express");
require("dotenv").config();
const cli = require("cli-color");
const mongoose = require("mongoose");
const userModel = require("./Models/userModels");
const bcrypt = require("bcrypt");
const validator = require("validator");
const session = require("express-session");
const mongoDbStore = require("connect-mongodb-session")(session);
const todoModel = require("./Models/todoModels");
const { validateData } = require("./utils/authUtils");
const { validateTodo } = require("./utils/todoValidate");
const { isAuth } = require("./middlewares/isAuth");
const rateLimiting = require("./middlewares/rateLimiting");

//constants
const app = express();
const PORT = process.env.PORT;
const store = new mongoDbStore({
  uri: process.env.MONGO_URI,
  collection: "sessions",
});

//mongoDb Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log(cli.green("DataBase connected sucessfully"));
  })
  .catch((err) => {
    console.log(cli.red(err));
  });

//middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(
  session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: false,
    store: store,
  })
);

app.use(express.static("public"));

//api
app.get("/", (req, res) => {
  return res.send("Home Page");
});

app.get("/register", (req, res) => {
  return res.render("register");
});

app.post("/register", async (req, res) => {
  //   console.log(req.body);
  const { name, email, username, password, cnfPassword } = req.body;

  //data validation
  try {
    await validateData({ email, name, username, password, cnfPassword });
  } catch (error) {
    return res.send({
      status: 400,
      message: "User Data Error",
      error: error,
      data: req.body,
    });
  }

  //email and username already exists
  const emailExists = await userModel.findOne({ email });
  if (emailExists) {
    return res.send({
      status: 400,
      message: "Email already exists",
    });
  }
  const usernameExists = await userModel.findOne({ username });
  if (usernameExists) {
    return res.send({
      status: 400,
      message: "Username already exists",
    });
  }

  //password hashing
  const hashedPassword = await bcrypt.hash(
    password,
    parseInt(process.env.SALT)
  );

  const userObj = new userModel({
    name,
    email,
    username,
    password: hashedPassword,
  });

  //store in db

  try {
    const userDb = await userObj.save();
    return res.redirect("/login");
  } catch (error) {
    return res.send({
      status: "500",
      message: "Database error",
      error: error,
    });
  }
});

app.get("/login", (req, res) => {
  return res.render("login");
});

app.post("/login", async (req, res) => {
  //   console.log(req.body);
  const { loginId, password } = req.body;

  //data validation
  if (!loginId || !password)
    return res.send({
      status: 400,
      message: "Missing credentials",
    });

  if (typeof loginId !== "string" || typeof password !== "string") {
    return res.send({
      status: 400,
      message: "Invalid data format",
    });
  }

  try {
    let userDb;
    //either username or email
    if (validator.isEmail(loginId)) {
      userDb = await userModel.findOne({ email: loginId });
      if (!userDb) {
        return res.send({
          status: 400,
          message: "Email not found",
        });
      }
    } else {
      userDb = await userModel.findOne({ username: loginId });
      if (!userDb) {
        return res.send({
          status: 400,
          message: "Username not found",
        });
      }
    }

    //password comparison
    const isMatched = await bcrypt.compare(password, userDb.password);
    if (!isMatched) {
      return res.send({
        status: 400,
        message: "Incorrect Passoword",
      });
    }

    req.session.isAuth = true;
    req.session.user = {
      username: userDb.username,
      email: userDb.email,
      userId: userDb._id,
    };

    return res.redirect("/dashboard");
  } catch (error) {
    return res.send({
      status: 500,
      message: "Database Error",
      error: error,
    });
  }
});

app.get("/dashboard", isAuth, (req, res) => {
  return res.render("dashboard");
});

//logout api
app.post("/logout", isAuth, (req, res) => {
  req.session.destroy((error) => {
    if (error) throw error;
    return res.redirect("/login");
  });
});

app.post("/logout_from_all_devices", isAuth, async (req, res) => {
  //create the session schema
  const sessionSchema = new mongoose.Schema({ _id: String }, { strict: false });
  const sessionModel = mongoose.model("session", sessionSchema);

  //get the user data who is making the request
  const username = req.session.user.username;

  //delete the sessions from db
  try {
    const deleteDb = await sessionModel.deleteMany({
      "session.user.username": username,
    });
    console.log(deleteDb);
    return res.redirect("/login");
  } catch (error) {
    return res.send({
      status: 500,
      message: "logout unsuccessfull",
      error: error,
    });
  }
});

//todo

//create
app.post("/create-item", isAuth,rateLimiting , async (req, res) => {
  // console.log(req.body);
  const todoText = req.body.todo;
  const username = req.session.user.username;

  //validate data
  try {
    await validateTodo({ todoText });
  } catch (error) {
    return res.send({
      status: 400,
      message: "Data Incorrect",
      error: error,
    });
  }
  console.log(username);
  const todoObj = new todoModel({
    todo: todoText,
    username: username,
  });

  try {
    const todoDb = await todoObj.save();
    console.log(todoDb);
    return res.send({
      status: 201,
      message: "Data recorded",
    });
  } catch (error) {
    return res.send({
      status: 500,
      message: "Database error",
      error: error,
    });
  }
});

//edit
app.post("/edit-item", isAuth, rateLimiting, async (req, res) => {
  const username = req.session.user.username;
  const { id, newData } = req.body;

  if (!id || !newData) {
    return res.send({
      status: 400,
      message: "Credential missing",
    });
  }

  if (newData.length < 3 || newData.length > 100) {
    return res.send({
      status: 400,
      message: "Todo length should be 3 to 100",
    });
  }

  try {
    const todoDb = await todoModel.findOne({ _id: id });

    console.log(todoDb);

    if (todoDb.username !== username) {
      return res.send({
        status: 403,
        message: "Not allowed to edit ,auth failed",
      });
    }

    const todoPrev = await todoModel.findOneAndUpdate(
      { _id: id },
      { todo: newData }
    );
    console.log(todoPrev);

    return res.send({
      status: 200,
      message: "Todo has been updated successfully",
    });
  } catch (error) {
    return res.send({
      status: 500,
      message: "Database error",
      error: error,
    });
  }
});

//delete
app.post("/delete-item", isAuth,rateLimiting , async (req, res) => {
  const { id } = req.body;

  const username = req.session.user.username;

  if (!id) {
    return res.send({
      status: 400,
      message: "Missing credentials",
    });
  }

  //find the todo with todoID
  try {
    const todoDetails = await todoModel.findOne({ _id: id });

    //check ownership
    if (todoDetails.username !== username) {
      return res.send({
        status: 403,
        message: "Not allowed to delete, authorisation failed",
      });
    }

    //update the todo in DB

    const todoDb = await todoModel.findOneAndDelete({ _id: id });
    //console.log("hello", todoDb);

    return res.send({
      status: 200,
      message: "Todo has been deleted successfully",
    });
  } catch (error) {
    return res.send({
      status: 500,
      message: "Database error",
      error: error,
    });
  }
});

// read
// app.get("/read-item", isAuth, async (req, res) => {
//   const username = req.session.user.username;

//   try {
//     const todoDb = await todoModel.find({ username: username });
//     console.log(todoDb);
//     return res.send({
//       status: 200,
//       message: "Read successfull",
//       data: todoDb,
//     });
//   } catch (error) {
//     return res.send({
//       status: 500,
//       message: "Database Error",
//       error: error,
//     });
//   }
// });

//pagination
app.get("/pagination_dashboard",isAuth, async(req,res)=>{
  const SKIP=req.query.skip||0;
  const LIMIT=5;
  const username=req.session.user.username;

  try {
    const todoDb=await todoModel.aggregate([
      {
        $match:{username:username},
      },
      {
        $facet: {
          data: [{ $skip: parseInt(SKIP) }, { $limit: LIMIT }],
        },
      }
    ]);

    console.log(todoDb[0].data);
    return res.send({
      status:200,
      message:"Successful",
      data:todoDb[0].data
    })
    
  } catch (error) {
    return res.send({
      status: 500,
      message: "Database Error",
      error: error,
    })
  }
})


//listener
app.listen(PORT, () => {
  console.log(cli.yellow(`Server is running on ${PORT}`));
  console.log(cli.yellow.underline(`http://localhost:${PORT}/`));
});
