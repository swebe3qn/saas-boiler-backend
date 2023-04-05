let jwt = require('jsonwebtoken')
const stripe = require('stripe')(process.env.STRIPE_API_KEY)

let excludedPaths = [
  '/login',
  '/register',
  '/'
]

exports.canCreateOrg = (req, res, next) => {
  if (excludedPaths.includes(req.path)) return next()

  req.user = {username: null, verified: false}
  const bearerHeader = req.headers['authorization']

  if (typeof bearerHeader !== 'undefined') {
    const bearerToken = bearerHeader.split(' ')[1]

    jwt.verify(bearerToken, process.env.PRIVATE_KEY, function (err, data) {
      if (!(err && typeof data === 'undefined')) {
        req.user = {username: data.username, verified: true} // or req.user = data
      }
    })
  }

  if (req.user.verified) return next()

  else return res.status(403).json({
    errorMessage: 'Unauthorized!',
    status: false
  });
}

exports.getStripeData = (org) => {
  return new Promise(async (resolve, reject) => {
    if (org.subscription?.subId) {
      const subscription = await stripe.subscriptions.retrieve(org.subscription.subId);

      if (subscription) org.subscription.status = subscription.status
      if (subscription.current_period_end) org.subscription.current_period_end = subscription.current_period_end
      org.subscription.cancel_at_period_end = subscription.cancel_at_period_end || false
      org.subscription.quantity = subscription.quantity || 0
      org.subscription.product = subscription.plan?.product || undefined
    }

    return resolve(org) 
  })
}

// TODO: prevent actions from not active organizations