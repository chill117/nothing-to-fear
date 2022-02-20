const _ = require('underscore');
const bodyParser = require('body-parser');
const express = require('express');
const Handlebars = require('express-handlebars');
const http = require('http');
const lnurl = require('lnurl');
const { createHash, HttpError } = require('lnurl/lib');
const path = require('path');
const pkg = require('./package.json');
const session = require('express-session');
const WebSocket = require('ws');

/*
	For a list of possible options, see:
	https://github.com/chill117/lnurl-node#options-for-createserver-method
*/
const config = require('./config');
const lnurlServer = lnurl.createServer(config.lnurl);

lnurlServer.once('listening', function() {
	const { host, port, protocol } = lnurlServer.options;
	console.log(`Lnurl server listening at ${protocol}://${host}:${port}`);
});

const webApp = express();

const viewsDir = path.join(__dirname, 'views');

const hbs = Handlebars.create({
	defaultLayout: 'main',
	extname: '.html',
	partialsDir: [
		path.join(viewsDir, 'partials'),
	],
});

webApp.engine('.html', hbs.engine);
webApp.set('view engine', '.html');
webApp.set('views', viewsDir);
webApp.enable('view cache');

// Define custom render method on response object:
webApp.use(function(req, res, next) {
	const render = res.render.bind(res);
	res.render = function(filePath, context) {
		const baseUrl = config.web.url;
		context = _.defaults(context || {}, {
			baseUrl,
			canonicalUrl: baseUrl + req.url,
			headExtraHtml: config.web.headExtraHtml || null,
			layout: 'main',
			template: filePath,
			version: pkg.version,
		});
		// Do NOT use a callback with render here.
		// For details, see:
		// https://expressjs.com/en/4x/api.html#res.render
		render(filePath, context);
	};
	next();
});

// Sessions middleware - to separate requests by session and provide real-time updates.
const sessionParser = session(config.web.session);
webApp.use(sessionParser);

// Parse application/x-www-form-urlencoded:
webApp.use(bodyParser.urlencoded({ extended: false }));

// Expose the public/ directory via HTTP server:
webApp.use(express.static('public'));

const tagParams = {
	channelRequest: ['localAmt', 'pushAmt'],
	withdrawRequest: ['minWithdrawable', 'maxWithdrawable', 'defaultDescription'],
	payRequest: ['minSendable', 'maxSendable', 'metadata'],
	login: [],
};

webApp.use('*', function(req, res, next) {
	req.session.lnurls = req.session.lnurls || {};
	next();
});

let map = {
	session: new Map(),
	ws: new Map(),
};

webApp.get('/lnurls', function(req, res, next) {
	const lnurls = _.mapObject(req.session.lnurls, function(item) {
		return item.encoded;
	});
	res.json(lnurls);
});

webApp.post('/lnurl',
	function(req, res, next) {
		if (!req.body.tag) {
			return next(new HttpError('Missing required field: "tag"', 400));
		}
		const { tag } = req.body;
		if (!lnurlServer.hasSubProtocol(req.body.tag)) {
			return next(new HttpError(`Unsupported tag: "${tag}"`, 400));
		}
		next();
	},
	function(req, res, next) {
		const { tag } = req.body;
		const lastLnurl = req.session.lnurls[tag] || null;
		if (!lastLnurl) return next();
		const { hash } = lastLnurl;
		map.session.delete(hash);
		lnurlServer.markUsedUrl(hash).then(function() {
			next();
		}).catch(next);
	},
	function(req, res, next) {
		const { tag } = req.body;
		const params = _.pick(req.body, tagParams[tag]);
		lnurlServer.generateNewUrl(tag, params, { uses: 0 }).then(result => {
			const { encoded, secret, url } = result;
			const hash = createHash(secret);
			req.session.lnurls[tag] = { encoded, hash };
			map.session.set(hash, req.session);
			console.log('created lnurl', { hash, session: req.session.id });
			res.send(encoded);
		}).catch(next);
	}
);

webApp.get('/', function(req, res, next) {
	res.render('index');
});

webApp.use('*', function(req, res, next) {
	next(new HttpError('Not Found', 404));
});

webApp.use(function(error, req, res, next) {
	if (!error.status) {
		console.error(error);
		error = new Error('Unexpected error');
		error.status = 500;
	}
	res.status(error.status).send(error.message);
});

webApp.server = http.createServer(webApp);
webApp.wss = new WebSocket.Server({ clientTracking: true, noServer: true });

const pingInterval = setInterval(function() {
	console.log(webApp.wss.clients.size, 'client(s) connected');
	webApp.wss.clients.forEach(function(ws) {
		if (ws.isAlive === false) return ws.terminate();
		ws.isAlive = false;
		ws.ping(_.noop);
	});
}, 20 * 1000);

webApp.wss.on('close', function() {
	clearInterval(pingInterval);
});

webApp.server.on('upgrade', function(req, socket, head) {
	sessionParser(req, {}, function() {
		if (!req.session.id) {
			socket.destroy();
			return;
		}
		webApp.wss.handleUpgrade(req, socket, head, function(ws) {
			webApp.wss.emit('connection', ws, req);
		});
	});
});

webApp.wss.on('connection', function(ws, req) {
	map.ws.set(req.session.id, ws);
	ws.isAlive = true;
	ws.on('pong', function() {
		ws.isAlive = true;
	});
	ws.on('close', function() {
		map.ws.delete(req.session.id);
	});
});

webApp.server.listen(config.web.port, config.web.host, function() {
	const { host, port } = config.web;
	console.log(`Web server listening at http://${host}:${port}`);
});

lnurlServer.on('payRequest:action:processed', function(event) {
	const { secret, params, result } = event;
	const { id, invoice } = result;
	// `id` - non-standard reference ID for the new invoice, can be NULL if none provided
	// `invoice` - bolt11 invoice
	const hash = createHash(secret);
	const session = map.session.get(hash);
	if (session) {
		const ws = map.ws.get(session.id);
		if (ws) {
			ws.send('paying');
		}
	}
});

process.on('uncaughtException', (error, origin) => {
	console.error(error);
});

process.on('beforeExit', (code) => {
	try {
		webApp.server.close();
		lnurlServer.close();
		mockLightningBackend.close();
	} catch (error) {
		console.error(error);
	}
	process.exit(code);
});
