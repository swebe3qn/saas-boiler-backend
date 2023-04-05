var express = require("express");
var app = express();
var cors = require('cors');
  bodyParser = require('body-parser'),
  path = require('path');
var mongoose = require("mongoose");
mongoose.connect("mongodb+srv://user:Agr4uhZmkIxotPz1@wartifytest.xm7776w.mongodb.net/test?retryWrites=true&w=majority");
require("./utils/firebaseAdmin");

require('dotenv').config()

app.use(cors());
app.use(express.static('uploads'));
app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: false
}));

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  console.log(err);
  res.status(err.status || 500);
  res.send(err);
});

app.use('/api', require('./routes/subscriptions'));
app.use('/api/organization', require('./routes/organization'));
app.use('/api/user', require('./routes/user'));

app.get("/", (req, res) => {
  res.status(200).json({
    status: 'Running',
    ts: Date.now(),
  });
});

app.listen(2000, () => {
  console.log("Server is Runing On port 2000");
});
