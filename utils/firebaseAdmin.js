
var admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert(require("../wartify-9f052-firebase-adminsdk-243h6-fede3ec0f2.json"))
});

module.exports = admin
