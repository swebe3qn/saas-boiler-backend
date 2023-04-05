var mongoose = require('mongoose');
var Schema = mongoose.Schema;

userSchema = new Schema({
	auth_id: {
		type: String,
		required: true,
		trim: true,
    unique: true
	},
	stripe_id: {
		type: String,
		required: true,
		trim: true,
    unique: true
	},
	email: {
		type: String,
		required: true,
		trim: true,
    unique: true
	},
	name: {
		type: String,
		trim: true
	},
}, {
	timestamps: true
});

const User = mongoose.model('user', userSchema);

module.exports = User;