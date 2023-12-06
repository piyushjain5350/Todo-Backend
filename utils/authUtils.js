const validator = require("validator");

const validateData = ({ name, email, username, password, cnfPassword }) => {
  return new Promise((resolve, reject) => {
    if (!email || !name || !username || !password || !cnfPassword) {
      reject("Missing Credentials");
    }

    if (typeof email !== "string") reject("Invalid email type");
    if (typeof name !== "string") reject("Invalid name type");
    if (typeof username !== "string") reject("Invalid usename type");
    if (typeof password !== "string" || typeof cnfPassword !== "string")
      reject("Invalid password type");

    if (username.length <= 2 || username.length > 30)
      reject("Username length should be 3-30 only");
    if (password.length <= 2 || password.length > 30)
      reject("password length should be 3-30 only");

    if (!validator.isEmail(email)) {
      reject("Invalid email");
    }

    if (password !== cnfPassword) {
      reject("Password Mismatch");
    }

    resolve();
  });
};

module.exports={validateData};