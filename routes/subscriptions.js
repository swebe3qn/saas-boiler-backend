var express = require('express');
var router = express.Router();
const jwt = require('jsonwebtoken');
const { returnError } = require('../controllers/response');
const { getUserData } = require('../controllers/user');
const Organization = require('../models/organization');
const User = require('../models/user');
const stripe = require('stripe')(process.env.STRIPE_API_KEY)
const bodyParser = require('body-parser');

router.get('/', async (req,res) => {
  let user = await stripe.customers.retrieve('cus_NBzo7ALMpeBBXr', {expand: ['subscriptions']})

  return res.send(user)
})

router.post("/first-subscription", async (req, res) => {
  try {
    let user = await getUserData(req.headers.authorization)
    if (!user || !user.stripe_id) return returnError(res, 'Fehler beim Abrufen der Benutzerdaten.')

    let stripe_customer_id = user.stripe_id

    let {seats, plan, orgId} = req.body

    if (!orgId) return returnError(res, 'Fehlerhafte Daten übermittelt.')
    else if (!plan) return returnError(res, 'Bitte wähle ein Abo.')
    else if (!seats) return returnError(res, 'Bitte gib an, wieviele Nutzer du benötigst.')

    if (stripe_customer_id) {
      var stripe_customer = await stripe.customers.retrieve(stripe_customer_id, {expand: ['subscriptions']})
      
      if (stripe_customer) {

        let org = await Organization.findOne({_id: orgId, owner: user._id})
        if (!org) return returnError(res, 'Fehler beim Abrufen der Projektdaten.')
        if (org.subscription && org.subscription.subId) return returnError(res, 'Du hast für dieses Projekt bereits ein Abo abgeschlossen.')

        let priceId;

        if (plan === 'startup_monthly') priceId = 'price_1MidfFLtmx0uIjXAChc6WYyC'
        if (plan === 'startup_yearly') priceId = 'price_1Midf3Ltmx0uIjXA8NmgSkml'
        if (plan === 'business_monthly') priceId = 'price_1MeFyELtmx0uIjXArKT2fEH7'
        if (plan === 'business_yearly') priceId = 'price_1MeFyELtmx0uIjXAPnrx52rw'

        if (!priceId || isNaN(seats)) throw 'Ungültige Daten angegeben.'

        const session = await stripe.checkout.sessions.create({
          customer: stripe_customer.id,
          line_items: [
            {
              price: priceId,
              quantity: seats,
            },
          ],
          mode: 'subscription',
          success_url: `${process.env.FRONTEND_URL}/konto`,
          cancel_url: `${process.env.FRONTEND_URL}/konto`,
          automatic_tax: {enabled: true},
          tax_id_collection: {enabled: true},
          customer_update: {name: 'auto', address: 'auto'},
          payment_method_collection: 'if_required',
          allow_promotion_codes: true
        });

        if (session.id) {
          let subscription = {session: session.id}
          await Organization.findOneAndUpdate({_id: orgId}, {subscription})
        }

        return res.status(200).json({
          success: true, 
          session_url: session.url
        })
      }
    }

    throw 'Ungültige Daten angegeben.'
  } catch (e) {
    console.log(e)
    return returnError(res, e.raw?.message?.startsWith('No such coupon') ? 'Gutscheincode ungültig.' : 'Fehler beim Erstellen des Checkouts.')
  }
});

router.get("/create-portal-session/:orgId/:type", async (req, res) => {
  try {
    let {orgId, type} = req.params

    if (!orgId || (type !== 'update' && type !== 'cancel' && type !== 'reactivate')) return returnError(res, 'Fehlerhafte Daten übermittelt.')

    let user = await getUserData(req.headers.authorization)
    if (!user || !user.stripe_id) return returnError(res, 'Fehler beim Abrufen der Benutzerdaten.')

    let stripe_customer_id = user.stripe_id

    if (stripe_customer_id) {
      var stripe_customer = await stripe.customers.retrieve(stripe_customer_id, {expand: ['subscriptions']})
      
      if (stripe_customer) {
        let org = await Organization.findOne({_id: orgId, owner: user._id})
        if (!org) return returnError(res, 'Fehler beim Abrufen der Projektdaten.')

        if (!org.subscription || !org.subscription.subId) throw 'Du musst zuerst einen Plan buchen, bevor du das Nutzerportal aufrufen kannst.'

        const session = await stripe.billingPortal.sessions.create({
          customer: stripe_customer.id,
          return_url: `${process.env.FRONTEND_URL}/konto`,
        });
    
        return res.status(200).json({
          success: true, 
          session_url: session.url + `/subscriptions/${org.subscription.subId}/${type}`
        })
      }
    }

    throw 'Ungültige Daten angegeben.'
  } catch (e) {
    console.log(e)
    res.status(400).json({
      message: e || 'Fehler!',
      status: false
    });
  }
});

router.post('/stripe_webhooks', bodyParser.raw({type: 'application/json'}), async (req, res) => {
  const event = req.body;
  let data;

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      data = event.data.object;

      let org = await Organization.findOne({'subscription.session': data.id})
      
      if (org && data.subscription) {
        let subscription = {subId: data.subscription}
        await Organization.findOneAndUpdate({_id: org._id}, {subscription})
      }

      break;
    case 'customer.subscription.updated':
      data = event.data.object
      break;
    // ... handle other event type
    // default:
    //   console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  res.json({received: true});
});

module.exports = router;