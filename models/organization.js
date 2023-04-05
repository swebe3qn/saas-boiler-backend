var mongoose = require('mongoose');
var Schema = mongoose.Schema;

const subscriptionSchema = new Schema({
	subId: String,
	session: String,
	cancel_at_period_end: Boolean,
	current_period_end: Number,
	quantity: Number,
	status: String,
	product: String,
},{
	timestamps: true
})

const inviteSchema = new Schema({
	token: {
		type: String,
		required: true,
		trim: true,
	},
	expiresAt: {
		type: String,
		required: true,
		trim: true
	},
	type: {
		type: String,
		enum: ['member', 'requester'],
		required: true
	}
},
{
	timestamps: true
});

const memberSchema = new Schema({
	user: {
		type: Schema.Types.ObjectId,
		ref: 'user',
		required: true,
	},
	role: {
		type: String,
		required: true,
		enum: ['owner', 'member', 'requester']
	},
	// TODO: implement user rights
	rights: {
		type: [String],
		required: true,
		default: []
	},
	joinedAt: {
		type: String,
		required: true,
		trim: true
	}
}, {
	timestamps: true
});

orgSchema = new Schema( {
	owner: {
		type: Schema.Types.ObjectId,
		ref: 'user',
		required: true,
	},
	name: {
		type: String,
		required: true,
		trim: true,
    maxlength: 50
	},
	invites: {
		type: [inviteSchema],
		required: true,
		default: []
	},
	members: {
		type: [memberSchema],
		required: true,
		default: []
	},
	requesters: {
		type: [memberSchema],
		required: true,
		default: []
	},
	subscription: {
		type: subscriptionSchema
	}
}, {
	timestamps: true,
});

const Organization = mongoose.model('organization', orgSchema);

module.exports = Organization;