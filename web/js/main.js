var app = app || {};

$(function() {

	var blinkEye = function() {
		$('#mrprism').addClass('blinking');
		_.delay(function() {
			$('#mrprism').removeClass('blinking');
		}, 100);
	};

	var blinkVideo = function() {
		$('.video-cover').addClass('visible');
		_.delay(function() {
			$('.video-cover').removeClass('visible');
		}, 100);
	};

	var blink = function() {
		if (!sleeping) {
			blinkEye();
			blinkVideo();
		}
	};

	var blinkTimeout;
	var getBlinkDelayTime = function() {
		return Math.floor(Math.random() * 6000) + 1500;
	};
	var doBlink = function() {
		blink();
		blinkTimeout = _.delay(doBlink, getBlinkDelayTime());
	};
	var startBlinking = function() {
		clearTimeout(blinkTimeout);
		blinkTimeout = _.delay(doBlink, getBlinkDelayTime());
	};
	var stopBlinking = function() {
		clearTimeout(blinkTimeout);
	};

	startBlinking();

	var fadeVolumeAudioPlayer = function(audioEl, targetVolume, done) {
		targetVolume = Math.min(100, Math.max(0, Math.round(targetVolume)));
		var increment = 20;
		var currentVolume;
		async.until(function(next) {
			currentVolume = Math.round(audioEl.volume * 100);
			next(null, currentVolume == targetVolume);
		}, function(next) {
			var newVolume = currentVolume;
			if (currentVolume < targetVolume) {
				newVolume += increment;
			} else {
				newVolume -= increment;
			}
			audioEl.volume = Math.min(100, Math.max(0, newVolume)) / 100;
			_.delay(next, 100);
		}, done || _.noop);
	};

	var fadeOutAudioPlayer = function(audioEl, done) {
		fadeVolumeAudioPlayer(audioEl, 0, done);
	};

	var fadeInAudioPlayer = function(audioEl, done) {
		fadeVolumeAudioPlayer(audioEl, 100, done);
	};

	var changeAudioTrack = function(trackName) {
		var $audio = $('audio');
		if ($audio[0]) {
			fadeOutAudioPlayer($audio[0], function() {
				$audio[0].pause();
				_.each({
					ogg: 'audio/ogg',
					mp3: 'audio/mpeg',
				}, function(type, extension) {
					$source = $audio.find('source[type="' + type + '"]');
					if ($source[0]) {
						$source[0].src = 'audio/music/' + trackName + '.' + extension;
					}
				});
				$audio[0].load();
				$audio[0].oncanplaythrough = $audio[0].play();
				fadeInAudioPlayer($audio[0]);
			});
		}
	};

	try {
		// Initialize websocket connection.
		var ws = app.ws = (function() {
			var protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
			var url = protocol + '//' + location.host;
			return new WebSocket(url);
		})();
		ws.onerror = function(error) {
			console.log('WebSocket ERROR', error);
		};
		ws.onopen = function() {
			console.log('WebSocket connection established');
		};
		ws.onclose = function() {
			console.log('WebSocket connection closed');
			ws = app.ws = null;
		};
		ws.onmessage = function(message) {
			try {
				console.log('WebSocket data received:', message.data);
				var messageData = JSON.parse(message.data);
				var eventName = messageData.event || null;
				if (!eventName) return;
				var tag = messageData.tag || null;
				var method = messageData.data.method || null;
				if (!tag) return;
				if (!method) return;
				if (
					tag === 'payRequest' &&
					method === 'action' &&
					eventName === 'request:processed'
				) {
					sleepTime();
				}
			} catch (error) {
				console.log(error);
			}
		};
	} catch (error) {
		console.log(error);
	}

	var sleeping = false;
	var maxSleepTime = 3 * 60 * 10000;
	var sleepTime = function() {
		if (!sleeping) {
			console.log('Go to sleep, Mr. Prism.');
			stopBlinking();
			$('html').removeClass('awake').addClass('falling-asleep');
			_.delay(function() {
				$('html').removeClass('falling-asleep');
				var video = document.querySelector("#watch video.webcam");
				video.srcObject.getTracks().forEach(function(track) {
					track.stop();
				});
				changeAudioTrack('lionel_richie_all_night_long');
				playDreamVideo();
			}, 1500);
			_.delay(wakeyTime, maxSleepTime);
			sleeping = true;
		}
	};

	var wakeyTime = function() {
		if (sleeping) {
			console.log('Time to wake up, Mr. Prism.');
			$('html').removeClass('falling-asleep').addClass('waking-up');
			_.delay(function() {
				$('html').removeClass('waking-up').addClass('awake');
				initializeWebCamVideoStream();
				changeAudioTrack('a_healthy_dystopia');
				playDreamVideo();
				startBlinking();
			}, 300);
			sleeping = false;
		}
	};
	app.sleepTime = sleepTime;
	app.wakeyTime = wakeyTime;

	var playDreamVideo = function() {
		var $video = $('#video-dream');
		if ($video[0]) {

		}
	};

	$.get('/lnurls')
		.done(function(lnurls) {
			if (lnurls.payRequest) {
				return renderQrCode(lnurls.payRequest);
			}
			$.post('/lnurl', {
				tag: 'payRequest',
				minSendable: 100000,
				maxSendable: 100000,
				metadata: '[["text/plain","Nothing to Fear: 5 minutes of privacy"]]',
			})
				.done(function(encoded) {
					renderQrCode(encoded);
				})
				.fail(function(error) {
					console.log('Failed to create new LNURL', error);
				});
		})
		.fail(function(error) {
			console.log('Failed to get current session LNURLs', error);
		});

	var renderQrCode = function(encoded) {
		var $qrcode = $('#pay .qrcode');
		var data = 'LIGHTNING:' + encoded.toUpperCase();
		app.utils.renderQrCode($qrcode, data, function(error) {
			if (error) {
				console.log('Failed to render QR code', error);
			} else {
				$qrcode.addClass('loaded');
				$qrcode.attr('data-encoded', encoded);
			}
		});
	};

	var resizeQrCodeElements = function() {
		var maxSizes = [];
		$qrcodes = $('.qrcode');
		$qrcodes.each(function() {
			var $qrcode = $(this);
			var $parent = $qrcode.parent();
			var constraints = [
				$parent.innerWidth() * .8,
				$(window).height() * .8,
			];
			if ($(window).width() > 1024) {
				var siblingsHeight = 0;
				$qrcode.siblings().each(function() {
					siblingsHeight += $(this).outerHeight();
				});
				constraints.push(($(window).height() * .8) - siblingsHeight);
			}
			maxSizes.push(Math.min.apply(Math, constraints));
		});
		var maxSize = Math.min.apply(Math, maxSizes);
		$qrcodes.width(maxSize).height(maxSize);
	};

	var rerenderQrCodes = function() {
		$('.qrcode').each(function() {
			var $qrcode = $(this);
			var data = $qrcode.attr('data-encoded');
			if (data) {
				app.utils.renderQrCode($qrcode, data);
			}
		});
	};

	$(window).on('resize', _.debounce(function() {
		resizeQrCodeElements();
		rerenderQrCodes();
	}, 150));

	var initializeWebCamVideoStream = function() {
		var video = document.querySelector("#watch video.webcam");
		if (navigator.mediaDevices.getUserMedia) {
			navigator.mediaDevices.getUserMedia({ video: true })
			.then(function(stream) {
				video.srcObject = stream;
			})
			.catch(function(error) {
				console.log('Failed to capture device video stream', error);
			});
		}
	};

	resizeQrCodeElements();
	initializeWebCamVideoStream();

});
