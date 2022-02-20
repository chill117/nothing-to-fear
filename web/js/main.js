var app = app || {};
app.config = app.config || {};

$(function() {

	app.config.payAmount = 10;// sats
	app.config.sleepDuration = 2 * 60 * 1000;// milliseconds

	var blink = function() {
		if (!sleeping) {
			$('html').addClass('blinking');
			_.delay(function() {
				$('html').removeClass('blinking');
			}, 100);
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
		var increment = 10;
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
			}stopCyclingMusic
			audioEl.volume = Math.min(100, Math.max(0, newVolume)) / 100;
			_.delay(next, 35);
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

	var musicTracks = [
		'a_healthy_dystopia',
		'home_sweet_homeland',
	];
	var cycleIntervalTime = 2 * 60 * 1000;
	var trackNumber = 0;
	var cycleMusicTimeout;
	var doCycleMusic = function() {
		if (!sleeping) {
			trackNumber++;
			if (_.isUndefined(musicTracks[trackNumber])) {
				trackNumber = 0;
			}
			changeAudioTrack(musicTracks[trackNumber]);
			cycleMusicTimeout = _.delay(doCycleMusic, cycleIntervalTime);
		}
	};
	var startCyclingMusic = function() {
		clearTimeout(cycleMusicTimeout);
		cycleMusicTimeout = _.delay(doCycleMusic, cycleIntervalTime);
	};
	var stopCyclingMusic = function() {
		clearTimeout(cycleMusicTimeout);
	};
	startCyclingMusic();

	var sleeping = false;
	var sleepTime = function() {
		if (!sleeping) {
			console.log('Go to sleep, Mr. Prism.');
			stopBlinking();
			$('html').removeClass('awake').addClass('falling-asleep');
			stopCyclingMusic();
			changeAudioTrack('lionel_richie_all_night_long');
			_.delay(function() {
				$('html').removeClass('falling-asleep').addClass('asleep');
				var video = document.querySelector('#watch video.webcam');
				if (video && video.srcObject) {
					video.srcObject.getTracks().forEach(function(track) {
						track.stop();
					});
				}
			}, 1500);
			_.delay(wakeyTime, app.config.sleepDuration);
			sleeping = true;
		}
	};

	var wakeyTime = function() {
		if (sleeping) {
			console.log('Time to wake up, Mr. Prism.');
			$('html').removeClass('falling-asleep').removeClass('asleep').addClass('waking-up');
			_.delay(function() {
				$('html').removeClass('waking-up').addClass('awake');
				initializeWebCamVideoStream();
				changeAudioTrack(musicTracks[trackNumber]);
				startBlinking();
				startCyclingMusic();
			}, 300);
			sleeping = false;
		}
	};
	app.sleepTime = sleepTime;
	app.wakeyTime = wakeyTime;

	var getLnurlPay = function(done) {
		done = done || _.noop;
		async.retry({
			interval: 5000,
			times: ((86400 * 7) / 5) * 1000,// retry for up to 1 week
		}, function(next) {
			$.get('/lnurls')
				.done(function(lnurls) {
					if (lnurls.payRequest) {
						return next(null, lnurls.payRequest)
					}
					var msats = app.config.payAmount * 1000;
					$.post('/lnurl', {
						tag: 'payRequest',
						minSendable: msats,
						maxSendable: msats,
						metadata: '[["text/plain","Nothing to Fear: Pay for your privacy"]]',
					})
						.done(function(encoded) {
							next(null, encoded);
						})
						.fail(next);
				})
				.fail(next);
		}, function(error, encoded) {
			if (error) return done(error);
			done(null, encoded);
		});
	};

	var refreshLnurlPayQrCode = function(done) {
		done = done || _.noop;
		getLnurlPay(function(error, encoded) {
			if (error) {
				done(error);
			} else {
				renderQrCode(encoded);
				done();
			}
		});
	};

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
		if (video && navigator.mediaDevices.getUserMedia) {
			navigator.mediaDevices.getUserMedia({ video: true })
			.then(function(stream) {
				video.srcObject = stream;
			})
			.catch(function(error) {
				console.log('Failed to capture device video stream', error);
			});
		}
	};

	app.socket = new app.Socket({
		autoReconnect: false,
		onClose: function() {
			refreshLnurlPayQrCode(function(error) {
				if (!error) {
					app.socket.reconnect();
				}
			});
		},
		onMessage: function(message) {
			try {
				if (message.data === 'paying') {
					sleepTime();
				}
			} catch (error) {
				console.log(error);
			}
		}
	});

	resizeQrCodeElements();
	refreshLnurlPayQrCode();
	initializeWebCamVideoStream();

});
