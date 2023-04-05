const { Router } = require('express');
const { returnError } = require('../controllers/response');
const { getUserData, isAuthenticated } = require('../controllers/user');
const Organization = require('../models/organization');
const router = Router()
const validator = require('validator')
const { v4: uuidv4 } = require('uuid');
const { sendEmail } = require('../controllers/email');
const { getStripeData } = require('../controllers/organization');

const inviteSubject = 'Du wurdest zu einem Projekt auf Wartify.com eingeladen'

router.get('/', isAuthenticated, async (req, res, next) => {
  let user = await getUserData(req.headers.authorization)
  if (!user) return returnError(res, 'Fehler beim Abrufen der Benutzerdaten.')

  Organization.find({$or: [{'members.user': user._id}, {'requesters.user': user._id}]}).populate('owner members.user requesters.user checklists').exec(async (err, orgs) => {
    if (err) return returnError(res, 'Fehler beim Abrufen deiner Projekte.')

    if (orgs.length >= 1) {
      for (let [i, org] of orgs.entries()) {
        if (org.members?.filter(m => m.user._id.toString() === user._id.toString())[0]?.role !== 'owner') {
          orgs[i] = {
            _id: org._id,
            name: org.name,
            subscription: orgs.subscription
          }
        }

        if (org.requesters?.filter(m => m.user._id.toString() === user._id.toString())[0]?.role !== 'owner') {
          orgs[i] = {
            _id: org._id,
            name: org.name,
            subscription: orgs.subscription
          }
        }

        orgs[i] = await getStripeData(org)
      }

      orgs = orgs.sort((a, b) => {
        if (a.owner && !b.owner) return -1
        if (b.owner && !a.owner) return 1
        return 0
      })
    }

    return res.status(200).json({
      success: true,
      message: '',
      data: orgs || [],
    })
  })
});

router.post('/create', async (req, res, next) => {
  let {name} = req.body  

  if (!name) return returnError(res, 'Bitte gib einen Namen an.')
  else if (name.length > 50) return returnError(res, 'Der Name darf maximal 50 Zeichen lang sein.')

  let user = await getUserData(req.headers.authorization)
  if (!user) return returnError(res, 'Fehler beim Abrufen der Benutzerdaten.')
  
  Organization.create({
    name, 
    owner: user._id,
    members: [
      {user: user._id, role: 'owner', joinedAt: Date.now()}
    ]
  }, (err, organization) => {
    if (err) return returnError(res, 'Fehler während dem Erstellen des Projektes.')

    return res.status(200).json({
      success: true,
      organization
    })
  })
})

router.put('/:id', async (req, res, next) => {
  let {name, enablePortal} = req.body  
  let {id} = req.params

  if (!name) return returnError(res, 'Bitte gib einen Namen an.')
  else if (name.length > 50) return returnError(res, 'Der Name darf maximal 50 Zeichen lang sein.')
  else if (!id) return returnError(res, 'Fehlerhafte Daten übermittelt.')

  let user = await getUserData(req.headers.authorization)
  if (!user) return returnError(res, 'Fehler beim Abrufen der Benutzerdaten.')

  let org = await Organization.findOne({owner: user._id, _id: id})
  if (!org) return returnError(res, 'Projekt nicht gefunden.')

  org = await getStripeData(org)

  enablePortal = enablePortal === 'true' && org.subscription && org.subscription.product === 'prod_NP46HBIBXtJTHH' ? true : false
  
  Organization.findByIdAndUpdate(id, {name, enablePortal}, (err, organization) => {
    if (err) return returnErr(res, 'Fehler während dem Aktualisieren des Projektes.')

    return res.status(200).json({
      success: true,
      organization
    })
  })
})

router.delete('/:id', async (req, res, next) => { 
  let {id} = req.params

  if (!id) return returnError(res, 'Fehlerhafte Daten übermittelt.')

  let user = await getUserData(req.headers.authorization)
  if (!user) return returnError(res, 'Fehler beim Abrufen der Benutzerdaten.')

  let org = await Organization.findOne({owner: user._id, _id: id})
  if (!org) return returnError(res, 'Nicht berechtigt.')

  org = await getStripeData(org)
  if (org.subscription?.status === 'active') return returnError(res, 'Du kannst das Projekt nicht löschen während es aktiv ist. Bitte kündige zuerst dein Abonomment.')
  
  Organization.findByIdAndDelete(id, (err) => {
    if (err) return returnErr(res, 'Fehler während dem Löschen des Projektes.')

    // TODO: delete all data of org (machines, notifications, comments, ....)

    return res.status(200).json({
      success: true,
    })
  })
})

router.post('/:id/leave', async (req, res, next) => { 
  let {id} = req.params

  if (!id) return returnError(res, 'Fehlerhafte Daten übermittelt.')

  let user = await getUserData(req.headers.authorization)
  if (!user) return returnError(res, 'Fehler beim Abrufen der Benutzerdaten.')

  let org = await Organization.findOne({_id: id})
  if (!org) return returnError(res, 'Nicht berechtigt.')

  if (org.owner.toString() === user._id.toString()) return returnError(res, 'Du kannst dein eigenes Projekt nicht verlassen.')

  let {members, requesters} = org

  members = members.filter(m => m.user.toString() !== user._id.toString())
  requesters = requesters.filter(m => m.user.toString() !== user._id.toString())
  
  Organization.findByIdAndUpdate(id, {members, requesters}, (err) => {
    if (err) return returnErr(res, 'Fehler während dem Verlassen des Projektes.')

    return res.status(200).json({
      success: true,
    })
  })
})

router.put('/:id/remove-member', async (req, res, next) => {
  let {member} = req.body  
  let {id} = req.params

  if (!id || !member) return returnError(res, 'Fehlerhafte Daten übermittelt.')

  let user = await getUserData(req.headers.authorization)
  if (!user) return returnError(res, 'Fehler beim Abrufen der Benutzerdaten.')

  let org = await Organization.findOne({owner: user._id, _id: id})
  if (!org) return returnError(res, 'Projekt nicht gefunden.')

  let {members, requesters} = org

  if (members.filter(m => m._id.toString() === member.toString())[0]?.role === 'owner') return returnError(res, 'Du kannst dich selbst nicht entfernen.')

  if (members && members.length >= 1) members = members.filter(m => m.role === 'owner' || m._id.toString() !== member.toString())
  if (requesters && requesters.length >= 1) requesters = requesters.filter(m => m.role === 'owner' || m._id.toString() !== member.toString())

  if (!members) members = []
  if (!requesters) requesters = []
  
  Organization.findByIdAndUpdate(id, {members, requesters}, (err, organization) => {
    if (err) return returnErr(res, 'Fehler während dem Aktualisieren der Daten.')

    return res.status(200).json({
      success: true,
      organization
    })
  })
})

router.put('/:id/invite', async (req, res, next) => {
  let {email, type} = req.body  
  let {id} = req.params

  if (!id || !type) return returnError(res, 'Fehlerhafte Daten übermittelt.')
  else if (!email || !validator.isEmail(email)) return returnError(res, 'Bitte gib eine gültige Emailadresse an.')

  let user = await getUserData(req.headers.authorization)
  if (!user) return returnError(res, 'Fehler beim Abrufen der Benutzerdaten.')

  if (email.toLowerCase() === user.email.toLowerCase()) return returnError(res, 'Du kannst dich nicht selbst einladen.')

  let org = await Organization.findOne({owner: user._id, _id: id})
  if (!org) return returnError(res, 'Keine Berechtigung.')

  org = await getStripeData(org)

  if (!org.subscription || org.subscription.status !== 'active') return returnError(res, 'Bitte schließe zuerst ein aktives Abo für dieses Projekt ab.')

  if (type === 'member' && org.members.length >= (org.subscription.quantity || 0)) return returnError(res, 'Bitte buche mehr Nutzer für dieses Projekt, bevor du weitere Teammitglieder einlädst.')

  let {invites} = org
  if (!invites) invites = []

  let token = uuidv4()

  invites.push({
    token,
    expiresAt: (Number(new Date()) + 1000 * 60 * 60 * 24).toString(), // 24 hours
    type
  })

  let inviteBody = `Hallo!
  
  Du wurdest zu einem Projekt von Wartify eingeladen. Bitte klicke auf den nachfolgenden Link, um die Einladung anzunehmen.

  ${process.env.FRONTEND_URL}/konto?invite=${token}

  Wenn du keine Einladung erwartest, kannst du diese Email ignorieren.
  
  Das Wartify-Team`

  sendEmail(email, inviteSubject, inviteBody)
  .then(() => {
    Organization.findByIdAndUpdate(id, {invites}, (err, organization) => {
      if (err) return returnErr(res, 'Fehler während dem Senden der Einladung.')
  
      return res.status(200).json({
        success: true,
        message: ''
      })
    })
  })
  .catch(err => {
    return returnErr(res, 'Fehler während dem Senden der Einladung.')
  })
})

router.post('/accept', async (req, res, next) => {
  let {token} = req.body  

  if (!token) return returnError(res, 'Fehlerhafte Daten übermittelt.')

  let user = await getUserData(req.headers.authorization)
  if (!user) return returnError(res, 'Fehler beim Abrufen der Benutzerdaten.')

  let org = await Organization.findOne({'invites.token': token})
  if (!org) return returnError(res, 'Einladung ungültig.')

  org = await getStripeData(org)

  let invite = org.invites.filter(inv => inv.token === token)[0]

  if (!invite || Number(invite.expiresAt) < Number(Date.now())) return returnError(res, 'Die Einladung ist abgelaufen.')

  if (invite.type === 'member') {
    if (org.members && org.members.filter(m => m.user.toString() === user._id.toString()).length >= 1) return returnError(res, 'Du bist diesem Projekt bereits beigetreten.')
    else if (org.members && org.members.length >= (org.subscription?.quantity || 0)) return returnError(res, 'Das Projekt, dem du beitreten möchtest, hat nicht genügend freie Plätze. Bitte setze den Eigentümer in Kenntnis darüber.')
  } else if (invite.type === 'requester') {
    if (org.requesters && org.requesters.filter(m => m.user.toString() === user._id.toString()).length >= 1) return returnError(res, 'Du bist diesem Projekt bereits beigetreten.')
  } else {
    return returnError(res, 'Fehlerhafte Daten übermittelt.')
  }

  let {invites, members, requesters} = org
  if (!invites) invites = []

  invites = invites.filter(inv => inv.token !== token)

  let data = {invites}

  if (invite.type === 'member') {
    if (!members) members = []

    members.push({
      user: user._id, 
      role: 'member', 
      joinedAt: Date.now()
    })

    if (requesters?.length >= 1) data.requesters = requesters.filter(u => u.user._id.toString() !== user._id.toString())

    data.members = members
  } else if (invite.type === 'requester') {
    if (!requesters) requesters = []

    requesters.push({
      user: user._id, 
      role: 'requester', 
      joinedAt: Date.now()
    })

    if (members?.length >= 1) data.members = members.filter(u => u.user._id.toString() !== user._id.toString())

    data.requesters = requesters
  }

  Organization.findByIdAndUpdate(org._id, data, (err, organization) => {
    if (err) return returnErr(res, 'Fehler während dem Senden der Einladung.')

    return res.status(200).json({
      success: true,
      message: ''
    })
  })
})

module.exports = router