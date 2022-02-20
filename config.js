const crypto = require('crypto');

// Optionally define environment variables by placing a .env file in the root of the project directory.
// For details:
// https://github.com/motdotla/dotenv#usage
require('dotenv').config();

let config = {
	lnurl: {
		host: process.env.NOTHING_TO_FEAR_HOST || 'localhost',
		port: parseInt(process.env.NOTHING_TO_FEAR_PORT || 3000),
		url: process.env.NOTHING_TO_FEAR_URL || null,
		endpoint: process.env.NOTHING_TO_FEAR_ENDPOINT || '/u',
		lightning: JSON.parse(process.env.NOTHING_TO_FEAR_LIGHTNING || '{"backend":"dummy","config":{}}'),
		store: JSON.parse(process.env.NOTHING_TO_FEAR_STORE || '{"backend":"memory","config":{}}'),
	},
	web: {
		host: process.env.NOTHING_TO_FEAR_WEB_HOST || 'localhost',
		port: parseInt(process.env.NOTHING_TO_FEAR_WEB_PORT || 8080),
		url: process.env.NOTHING_TO_FEAR_WEB_URL || null,
		session: JSON.parse(process.env.NOTHING_TO_FEAR_WEB_SESSION || '{"secret":"","resave":true,"saveUninitialized":false,"proxy":false,"cookie":{"httpOnly":true,"expires":false,"path":"/","sameSite":true,"secure":false}}'),
		headExtraHtml: process.env.NOTHING_TO_FEAR_WEB_HEAD_EXTRA_HTML || null,
	},
};

if (!config.lnurl.url) {
	const { endpoint, host, port } = config.lnurl;
	config.lnurl.url = `http://${host}:${port}`;
}

if (!config.web.session) {
	config.web.session = {};
}

if (!config.web.session.secret) {
	config.web.session.secret = crypto.randomBytes(32).toString('hex');
}

module.exports = config;
