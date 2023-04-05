const axios = require('axios')
const jwt = require('jsonwebtoken')
const { returnError } = require('./response')
const stripe = require('stripe')(process.env.STRIPE_API_KEY)
const { getAuth } = require('firebase-admin/auth')
const User = require('../models/user')

exports.getUserData = (accessToken) => {
  return new Promise(async (resolve, reject) => {
    if (!accessToken) return resolve()

    let user
    try { user = await getAuth().verifyIdToken(accessToken.split(' ')[1]) } catch(e) { }
    if (!user) return resolve()

    try { user = await User.findOne({auth_id: user.sub}) } catch(e) { }
    if (!user || !user._id) return resolve()

    let stripeData
    try { if (user.stripe_id) stripeData = await stripe.customers.retrieve(user.stripe_id, {expand: ['subscriptions']}) } catch(e) {console.log(e)}
    if (stripeData?.subscriptions?.data) user.subscriptions = stripeData.subscriptions?.data
    else user.subscriptions = []

    user.sub = user.auth_id

    return resolve(user) 
  })
}

exports.isAuthenticated = (req,res,next) => {
  let {authorization} = req.headers

  if (!authorization || !authorization.includes('Bearer ') || authorization.split(' ').length !== 2) return returnError(res, 'Keine Berchetigung')

  return next()
}

exports.hasOrgAccess = (userId, orgId) => {
  // TODO
}