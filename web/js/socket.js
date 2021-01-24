var app = app || {};

app.Socket = (function() {

	var Socket = function(options) {
		this.options = _.defaults(options || {}, this.defaultOptions);
		this.socket = null;
		this.open();
	};

	Socket.prototype.defaultOptions = {
		debug: true,
		host: location.host,
		encrypted: location.protocol === 'https:',
		open: {
			retry: {
				interval: 5000,
				times: ((86400 * 7) / 5) * 1000,// retry for up to 1 week
			},
		},
		autoReconnect: true,
	};

	Socket.prototype.isConnected = function() {
		if (this.socket) {
			return this.socket.readyState === WebSocket.OPEN;
		}
		return false;
	};

	Socket.prototype.open = function(done) {
		this.log('Socket.open', this.options);
		done = done || _.noop;
		var log = _.bind(this.log, this);
		var onConnect = _.bind(this.onConnect, this);
		var tryConnect = _.bind(this.tryConnect, this);
		async.retry(this.options.open.retry, tryConnect, function(error) {
			if (error) {
				log('Socket.open: Failed', error);
				done(error);
			} else {
				log('Socket.open: Success');
				onConnect();
				done();
			}
		});
	};

	Socket.prototype.reconnect = function() {
		this.open();
	};

	Socket.prototype.tryConnect = function(done) {
		this.log('Socket.tryConnect');
		this.socket = this.createSocket();
		var log = _.bind(this.log, this);
		var onClose = _.bind(this.onClose, this);
		var onMessage = _.bind(this.onMessage, this);
		this.socket.onopen = function() {
			this.onmessage = function(message) {
				log('Socket: Message received', message);
				onMessage(message);
			};
			this.onclose = function() {
				log('Socket: Connection closed');
				onClose();
			};
			done();
		};
		this.socket.onerror = function(error) {
			done(error);
		};
	};

	Socket.prototype.createSocket = function() {
		var socket;
		var protocol = this.options.encrypted ? 'wss://' : 'ws://';
		var uri = protocol + this.options.host;
		socket = new WebSocket(uri);
		return socket;
	};

	Socket.prototype.onConnect = function() {
		if (this.options.onConnect) {
			this.options.onConnect();
		}
	};

	Socket.prototype.onMessage = function(message) {
		if (this.options.onMessage) {
			this.options.onMessage(message);
		}
	};

	Socket.prototype.onClose = function() {
		if (this.options.onClose) {
			this.options.onClose();
		}
		if (this.options.autoReconnect) {
			this.reconnect();
		}
	};

	Socket.prototype.log = function() {
		if (this.options.debug) {
			console.log.apply(console, arguments);
		}
	};

	return Socket;

})();
