var express = require('express');
var router = express.Router();
const bcrypt = require('bcrypt');
var jwt = require('jsonwebtoken');
var User = require("../models/user.js");

const saltRounds = 10

function checkUserAndGenerateToken(data, req, res) {
  jwt.sign({ user: data.username, id: data._id }, process.env.PRIVATE_KEY, { expiresIn: '1d' }, (err, token) => {
    if (err) {
      res.status(400).json({
        status: false,
        errorMessage: err,
      });
    } else {
      res.json({
        message: 'Login Successfully.',
        token: token,
        status: true
      });
    }
  });
}

/* login api */
router.post("/login", (req, res) => {
  try {
    if (req.body && req.body.username && req.body.password) {
      User.findOne({ username: req.body.username }, async (err, user) => {
        if (user && !err) {
          if (bcrypt.compareSync(req.body.password, user.password)) {
            checkUserAndGenerateToken(user, req, res);
          } else {
            res.status(400).json({
              errorMessage: 'Username or password is incorrect!',
              status: false
            });
          }

        } else {
          res.status(400).json({
            errorMessage: 'Username or password is incorrect!',
            status: false
          });
        }
      })
    } else {
      res.status(400).json({
        errorMessage: 'Add proper parameter first!',
        status: false
      });
    }
  } catch (e) {
    res.status(400).json({
      errorMessage: 'Something went wrong!',
      status: false
    });
  }
});

/* register api */
router.post("/register", (req, res) => {
  try {
    let {username, password} = req.body

    if (username && password) {

      User.find({ username: username }, async (err, data) => {

        if (!data || data.length === 0) {

          let hash = bcrypt.hashSync(password, saltRounds)

          let User = new user({
            username: username,
            password: hash
          });

          User.save((err, data) => {
            if (err) {
              res.status(400).json({
                errorMessage: err,
                status: false
              });
            } else {
              res.status(200).json({
                status: true,
                title: 'Erfolgreich registriert.'
              });
            }
          });

        } else {
          res.status(400).json({
            errorMessage: `Der Benutzername ${req.body.username} existiert bereits.`,
            status: false
          });
        }

      });

    } else {
      res.status(400).json({
        errorMessage: 'Bitte gib den Benutzernamen und ein Passwort an.',
        status: false
      });
    }
  } catch (e) {
    res.status(400).json({
      errorMessage: 'Leider ist ein Fehler aufgetreten!',
      status: false
    });
  }
});

module.exports = router;