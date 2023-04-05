const nodemailer = require('nodemailer')
const validator = require('validator')

let transporter = nodemailer.createTransport({
  host: "smtp.zoho.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASS,
  }
})

exports.sendEmail = (email, subject, body) => {
  return new Promise((resolve, reject) => { 
    if (!email || !validator.isEmail(email)) return reject('Bitte gib eine gültige Emailadresse an.')
    else if (!subject || !body) return reject('Bitte gib Betreff und Inhalt der Email an.')

    transporter.verify(function (error, success) {
      if (error) return reject() 

      var mailOptions = {
        from: process.env.EMAIL,
        to: email,
        subject: subject,
        text: body
      };

      transporter.sendMail(mailOptions, function(error){
        if (error) return reject() 
          
        return resolve()
      });
    });
  })
}