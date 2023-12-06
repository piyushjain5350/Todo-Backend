const { app } = require(".");

app.post("/login", (req, res) => {
  console.log(req.body);
  const { email, password } = req.body;
  return res.send("Login post");
});
