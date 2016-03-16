/*
 *
 * zy.media.js
 * HTML5 <video> and <audio> native player
 *
 * Copyright 2015-2016, iReader FE(掌阅书城研发--前端组)
 * License: MIT
 * 
 */
var zyMedia = {};

// Default config
zyMedia.config = {
	// Overrides the type specified, for dynamic instantiation
	type: '',
	// Set media title
	mediaTitle: '',
	// Force native controls
	nativeControls: false,
	// Autoplay
	autoplay: false,
	// Preload
	preload: 'auto',
	// Video width
	videoWidth: '100%',
	// Video height
	videoHeight: 'auto',
	// Aspect ration 16:9
	aspectRation: (16 / 9),
	// Audio width
	audioWidth: '100%',
	// Audio height
	audioHeight: 44,
	// Rewind to beginning when media ends
	autoRewind: true,
	// Time format to use. Default 1 for 'mm:ss', 2 for 'm:s'
	timeFormat: 1,
	// Forces the hour marker (##:00:00)
	alwaysShowHours: false,
	// Hide controls when playing and mouse is not over the video
	alwaysShowControls: false,
	// Display the video control
	hideVideoControlsOnLoad: false,
	// Show fullscreen button
	enableFullscreen: true,
	// When this player starts, it will pause other players
	pauseOtherPlayers: true,
	duration: 0,
	timeAndDurationSeparator: '<span>/</span>',
	success: null,
	error: function() {}
};


// Get time format
zyMedia.timeFormat = function(time, options) {
	// Video's duration is Infinity in GiONEE(金立) device
	if (!isFinite(time) || time < 0) {
		time = 0;
	}
	// Get hours
	var _time = options.alwaysShowHours ? [0] : [];
	if (Math.floor(time / 3600) % 24) {
		_time.push(Math.floor(time / 3600) % 24)
	}
	// Get minutes
	_time.push(Math.floor(time / 60) % 60);
	// Get seconds
	_time.push(Math.floor(time % 60));

	_time = _time.join(':');
	// Fill '0'
	if (options.timeFormat == 1) {
		_time = _time.replace(/(:|^)([0-9])(?=:|$)/g, '$10$2')
	}

	return _time;

};


// Feature detection
(function() {
	var t = zyMedia.features = {};
	var ua = window.navigator.userAgent.toLowerCase();
	var v = document.createElement('video');

	// Detect browsers
	t.isiPhone = /iphone/i.test(ua);
	t.isiOS = t.isiPhone || /ipad/i.test(ua);
	t.isAndroid = /android/i.test(ua);
	t.isBustedAndroid = /android 2\.[12]/i.test(ua);
	t.isChrome = /chrome/i.test(ua);
	t.isChromium = /chromium/i.test(ua);
	t.hasTouch = 'ontouchstart' in window;

	t.supportsMediaTag = typeof v.canPlayType !== 'undefined' || t.isBustedAndroid;

	// Vendor for no controls bar
	t.isVendor = /baidu/i.test(ua);

	// Vendor and app for fullscreen button
	t.isVendorFullscreen = /micromessenger|weibo/i.test(ua);

	// Vendor for autoplay be disable, iOS device and 昂达
	t.isVendorAutoplay = /v819mini/i.test(ua) || t.isiOS;

	// iOS
	t.hasSemiNativeFullScreen = typeof v.webkitEnterFullscreen !== 'undefined';
	// W3C
	t.hasNativeFullscreen = typeof v.requestFullscreen !== 'undefined';
	// Webkit/firefox/IE11+
	t.hasWebkitNativeFullScreen = typeof v.webkitRequestFullScreen !== 'undefined';
	t.hasMozNativeFullScreen = typeof v.mozRequestFullScreen !== 'undefined';
	t.hasMsNativeFullScreen = typeof v.msRequestFullscreen !== 'undefined';
	t.hasTrueNativeFullScreen = t.hasWebkitNativeFullScreen || t.hasMozNativeFullScreen || t.hasMsNativeFullScreen;
	t.nativeFullScreenEnabled = t.hasTrueNativeFullScreen;

	// Enabled?
	if (t.hasMozNativeFullScreen) {
		t.nativeFullScreenEnabled = document.mozFullScreenEnabled
	} else if (t.hasMsNativeFullScreen) {
		t.nativeFullScreenEnabled = document.msFullscreenEnabled
	}

	if (t.isChrome) {
		t.hasSemiNativeFullScreen = false
	}

	if (t.hasTrueNativeFullScreen) {
		t.fullScreenEventName = '';

		if (t.hasWebkitNativeFullScreen) {
			t.fullScreenEventName = 'webkitfullscreenchange'
		} else if (t.hasMozNativeFullScreen) {
			t.fullScreenEventName = 'mozfullscreenchange'
		}

		t.isFullScreen = function() {
			if (t.hasMozNativeFullScreen) {
				return document.mozFullScreen
			} else if (t.hasWebkitNativeFullScreen) {
				return document.webkitIsFullScreen
			}
		}

		t.requestFullScreen = function(el) {
			if (t.hasWebkitNativeFullScreen) {
				el.webkitRequestFullScreen()
			} else if (t.hasMozNativeFullScreen) {
				el.mozRequestFullScreen()
			}
		}

		t.cancelFullScreen = function() {
			if (t.hasWebkitNativeFullScreen) {
				document.webkitCancelFullScreen()
			} else if (t.hasMozNativeFullScreen) {
				document.mozCancelFullScreen()
			}
		}
	}

	// OS X 10.5 can't do this even if it says it can
	if (t.hasSemiNativeFullScreen && /mac os x 10_5/i.test(ua)) {
		t.hasNativeFullScreen = false;
		t.hasSemiNativeFullScreen = false;
	}

})();



/*
 * Determines if a browser supports the <video> or <audio> element
 * and returns either the native element or error
 */
zyMedia.mediaShim = {

	create: function(media, option) {
		var tagName = media.tagName.toLowerCase();
		var isMediaTag = tagName === 'audio' || tagName === 'video';
		var src = isMediaTag ? media.getAttribute('src') : media.getAttribute('href');
		var playback;
		// Clean up src attributes
		src = (typeof src == 'undefined' || src === null || src == '') ? null : src;
		// Test for HTML5
		playback = this.determinePlayback(media, option, zyMedia.features.supportsMediaTag, isMediaTag, src);
		playback.url = (playback.url !== null) ? playback.url : '';

		if (playback.method == 'native') {
			// Second fix for android
			if (zyMedia.features.isBustedAndroid) {
				media.src = playback.url;
				media.addEventListener('click', function() {
					media.play()
				}, false);
			}
			// Add methods to native HTMLMediaElement
			this.updateNative(playback, option);
		} else {
			alert('不支持HTML5' + (tagName == 'video' ? '视' : '音') + '频');
			return this
		}
	},

	determinePlayback: function(media, options, supportsMediaTag, isMediaTag, src) {
		var mediaFiles = [];
		var i;
		var n;
		var result = {
			method: '',
			url: '',
			mediaPlayer: media,
			isVideo: media.tagName.toLowerCase() === 'video'
		};
		var dummy;

		// STEP 1: Get URL and type from <video src> or <source src>

		// Supplied type overrides <video type> and <source type>
		if (typeof options.type != 'undefined' && options.type !== '') {
			// Accept either string or array of types
			if (typeof options.type == 'string') {
				mediaFiles.push({
					type: options.type,
					url: src
				});
			} else {
				for (i = 0; i < options.type.length; i++) {
					mediaFiles.push({
						type: options.type[i],
						url: src
					});
				}
			}

			// Test for src attribute first
		} else if (src !== null) {
			mediaFiles.push({
				type: this.formatType(src, media.getAttribute('type')),
				url: src
			});

			// Test for <source> elements
		} else {
			for (i = 0; i < media.childNodes.length; i++) {
				n = media.childNodes[i];

				if (n.nodeType == 1 && n.tagName.toLowerCase() == 'source') {
					src = n.getAttribute('src');
					var _media = n.getAttribute('media');

					if (!_media || !window.matchMedia || (window.matchMedia && window.matchMedia(_media).matches)) {
						mediaFiles.push({
							type: this.formatType(src, n.getAttribute('type')),
							url: src
						});
					}
				}
			}
		}

		// Check for audio types
		if (!isMediaTag && mediaFiles.length > 0 && mediaFiles[0].url !== null && this.getTypeFromFile(mediaFiles[0].url).indexOf('audio') > -1) {
			result.isVideo = false
		}


		// STEP 2: Test for playback method

		// For Android which sadly doesn't implement the canPlayType function (always returns '')
		if (zyMedia.features.isBustedAndroid) {
			media.canPlayType = function(type) {
				return /video\/(mp4|m4v)/i.test(type) ? 'maybe' : ''
			};
		}

		// For Chromium to specify natively supported video codecs (i.e. WebM and Theora) 
		if (zyMedia.features.isChromium) {
			media.canPlayType = function(type) {
				return /video\/(webm|ogv|ogg)/i.test(type) ? 'maybe' : ''
			};
		}

		// Test for native playback first
		if (supportsMediaTag) {
			if (!isMediaTag) {
				// Create a real HTML5 Media Element 
				dummy = document.createElement(result.isVideo ? 'video' : 'audio');
				media.parentNode.insertBefore(dummy, media);
				media.style.display = 'none';

				// Use this one from now on
				result.mediaPlayer = media = dummy;
			}

			for (i = 0; i < mediaFiles.length; i++) {
				// Normal check
				if (mediaFiles[i].type == "video/m3u8" || media.canPlayType(mediaFiles[i].type).replace(/no/, '') !== ''
					// For Mac/Safari 5.0.3 which answers '' to canPlayType('audio/mp3') but 'maybe' to canPlayType('audio/mpeg')
					|| media.canPlayType(mediaFiles[i].type.replace(/mp3/, 'mpeg')).replace(/no/, '') !== ''
					// For m4a supported by detecting mp4 support
					|| media.canPlayType(mediaFiles[i].type.replace(/m4a/, 'mp4')).replace(/no/, '') !== '') {
					result.method = 'native';
					result.url = mediaFiles[i].url;
					break;
				}
			}

			if (result.method === 'native') {
				if (result.url !== null) {
					media.src = result.url;
				}
				// Cache the native result
				return result;
			}
		}

		// What if there's nothing to play? just grab the first available
		if (result.method === '' && mediaFiles.length > 0) {
			result.url = mediaFiles[0].url;
		}

		return result;
	},

	formatType: function(url, type) {
		// If no type is supplied, fake it with the extension
		if (url && !type) {
			return this.getTypeFromFile(url);
		} else {
			// Only return the mime part of the type in case the attribute contains the codec
			// see http://www.whatwg.org/specs/web-apps/current-work/multipage/video.html#the-source-element
			// `video/mp4; codecs="avc1.42E01E, mp4a.40.2"` becomes `video/mp4`
			if (type && ~type.indexOf(';')) {
				return type.substr(0, type.indexOf(';'));
			} else {
				return type;
			}
		}
	},

	getTypeFromFile: function(url) {
		url = url.split('?')[0];
		var ext = url.substring(url.lastIndexOf('.') + 1).toLowerCase();
		var av = /(mp4|m4v|ogg|ogv|m3u8|webm|webmv|wmv|mpeg|mov)/gi.test(ext) ? 'video/' : 'audio/';
		return this.getTypeFromExtension(ext, av);
	},

	getTypeFromExtension: function(ext, av) {
		av = av || '';

		switch (ext) {
			case 'mp4':
			case 'm4v':
			case 'm4a':
				return av + 'mp4';
			case 'webm':
			case 'webma':
			case 'webmv':
				return av + 'webm';
			case 'ogg':
			case 'oga':
			case 'ogv':
				return av + 'ogg';
			case 'm3u8':
				return 'application/x-mpegurl';
			case 'ts':
				return av + 'mp2t';
			default:
				return av + ext;
		}
	},

	updateNative: function(playback, option) {
		var _mediaElement = playback.mediaPlayer;

		_mediaElement.isFullScreen = false;
		_mediaElement.setCurrentTime = function(time) {
			this.currentTime = time;
		}

		// Fire shim success code
		option.shimSuccess(_mediaElement);
	}
};


(function() {

	zyMedia.mpIndex = 0;
	zyMedia.players = {};

	// Wraps a MediaElement object in player controls
	zyMedia.MediaPlayer = function(media, option) {
		var t = this;
		var i;

		// Enforce object, even without 'new' (via John Resig)
		if (!(t instanceof zyMedia.MediaPlayer)) {
			return new zyMedia.MediaPlayer(media, option);
		}

		if (!media) {
			return
		}

		t.$media = $(media);
		t.media = media;

		// Check for existing player
		if (typeof t.media.player != 'undefined') {
			return t.media.player
		}

		t.options = {};
		// Extend options
		for (i in zyMedia.config) {
			t.options[i] = zyMedia.config[i]
		}

		for (i in option) {
			t.options[i] = option[i];
		}
		// Data-config has highest priority
		var config = t.$media.data('config');
		for (i in config) {
			t.options[i] = config[i]
		}
		// Autoplay be disabled
		if (t.options.autoplay) {
			t.options.autoplay = !zyMedia.features.isVendorAutoplay;
		}

		// Unique ID
		t.id = 'mp_' + zyMedia.mpIndex++;
		// Add to player array (for focus events)
		zyMedia.players[t.id] = t;

		t.init();

		return t;
	};

	// Actual player
	zyMedia.MediaPlayer.prototype = {

		hasFocus: false,
		controlsAreVisible: true,

		init: function() {
			var t = this;
			t.isVideo = t.media.tagName.toLowerCase() === 'video';

			if (!t.isVideo) {
				t.options.alwaysShowControls = true
			}

			// Use native controls in iOS, and Android
			if (zyMedia.features.isiOS && (t.options.nativeControls || zyMedia.features.isVendor)) {
				// Add controls and stop
				t.$media.attr('controls', 'controls');

			} else if (zyMedia.features.isAndroid && (t.options.nativeControls || zyMedia.features.isVendor)) {
				t.$media.attr('controls', 'controls');
			} else {
				// Create mediaShim shim
				t.options.shimSuccess = function(media) {
					t.meReady(media)
				};

				zyMedia.mediaShim.create(t.media, t.options)
			}
		},

		showControls: function() {
			var t = this;

			if (t.controlsAreVisible)
				return;

			t.controls.css('bottom', '0');
			if (t.options.mediaTitle) {
				t.title.css('top', '0')
			}

			// Any additional controls people might add and want to hide
			t.controlsAreVisible = true;
		},

		hideControls: function() {
			var t = this;
			if (!t.controlsAreVisible || t.options.alwaysShowControls)
				return;

			t.controls.css('bottom', '-45px');
			if (t.options.mediaTitle) {
				t.title.css('top', '-35px');
			}
			// Hide others
			t.controlsAreVisible = false
		},

		controlsTimer: null,

		startControlsTimer: function(timeout) {
			var t = this;
			timeout = timeout || 1500;
			t.killControlsTimer();

			t.controlsTimer = setTimeout(function() {
				t.hideControls();
				t.killControlsTimer();
			}, timeout);
		},

		killControlsTimer: function() {
			var t = this;

			if (t.controlsTimer !== null) {
				clearTimeout(t.controlsTimer);
				delete t.controlsTimer;
				t.controlsTimer = null;
			}
		},

		// Sets up all controls and events
		meReady: function(media) {
			var t = this;
			// Make sure it can't create itself again
			if (t.created) {
				return;
			} else {
				t.created = true;
			}
			// Build container
			t.container = t.$media.parent();
			// Preset container's height on aspectRation
			if (t.isVideo) {
				t.container.css('height', t.container.width() / t.options.aspectRation);
			} else {
				t.container.css('height', t.options.audioHeight);
			}
			t.container.html('<div class="zy_wrap"></div>' +
					'<div class="zy_controls"></div>')
				.addClass(t.media.className)
				.attr('id', t.id)
				.focus(function(e) {
					if (!t.controlsAreVisible) {
						t.showControls();
					}
				});

			if (t.options.mediaTitle) {
				t.title = $('<div class="zy_title">' + t.options.mediaTitle + '</div>').appendTo(t.container)
			}

			t.container.find('.zy_wrap').append(t.$media);
			t.$media.attr('preload', t.options.preload);
			// Needs to be assigned here, after iOS remap
			t.media.player = t;
			t.controls = t.container.find('.zy_controls');

			if (t.isVideo) {
				t.width = t.options.videoWidth;
				t.height = t.options.videoHeight;

				if (t.width == '100%' && t.height == 'auto') {
					t.enableAutoSize = true
				}
				t.setPlayerSize(t.width, t.height)
			}

			t.buildmain(t, t.controls, t.media);

			// Add features
			var features = ['playpause', 'current', 'progress', 'duration'];
			if (t.options.enableFullscreen && !zyMedia.features.isVendorFullscreen) {
				features.push('fullscreen')
			}
			for (var i in features) {
				feature = features[i];
				if (t['build' + feature]) {
					try {
						t['build' + feature](t, t.controls, t.media);
					} catch (exp) {}
				}
			}

			// Controls fade
			if (t.isVideo) {
				if (zyMedia.features.hasTouch) {
					t.media.addEventListener('touchstart', function() {
						// Toggle controls
						if (t.controlsAreVisible) {
							t.hideControls();
						} else {
							t.showControls();
							// Controls bar auto hide after 3s
							if (!t.media.paused && !t.options.alwaysShowControls) {
								t.startControlsTimer(3000)
							}
						}
					}, false);
				} else {
					// Click to play/pause
					t.media.addEventListener('click', function() {
						if (t.media.paused) {
							t.play();
						} else {
							t.pause();
						}
					}, false);

					// Show/hide controls
					t.container
						.on('mouseenter', function() {
							if (!t.options.alwaysShowControls) {
								t.killControlsTimer();
								t.showControls();
								t.startControlsTimer(2500);
							}
						})
						.on('mousemove', function() {
							if (!t.controlsAreVisible) {
								t.showControls();
							}
							if (!t.options.alwaysShowControls) {
								t.startControlsTimer(2500);
							}
						})
						.on('mouseleave', function() {
							if (!t.media.paused && !t.options.alwaysShowControls) {
								t.startControlsTimer(1000);
							}
						});
				}

				if (t.options.hideVideoControlsOnLoad) {
					t.hideControls();
				}

				t.media.addEventListener('loadedmetadata', function(e) {
					if (t.enableAutoSize) {
						// For more properly videoWidth or videoHeight of HM 1SW(小米), QQ browser is 0
						setTimeout(function() {
							if (!isNaN(t.media.videoHeight)) {
								t.setPlayerSize();
							}
						}, 50)
					}
				}, false);

				// FOCUS: when a video starts playing, it takes focus from other players
				media.addEventListener('play', function() {
					var p;
					for (var i in zyMedia.players) {
						p = zyMedia.players[i];
						if (p.id != t.id && t.options.pauseOtherPlayers && !p.paused && !p.ended) {
							p.pause();
						}
						p.hasFocus = false;
					}

					t.hasFocus = true;
				}, false);

			}

			// Adjust controls when orientation change, 500ms for Sumsung tablet
			window.addEventListener('orientationchange', function() {
				setTimeout(function() {
					t.setPlayerSize();
				}, 500)
			});

			// Ended for all
			t.media.addEventListener('ended', function(e) {
				if (t.options.autoRewind) {
					try {
						t.media.setCurrentTime(0);
						// Fixing an Android stock browser bug, where "seeked" isn't fired correctly after ending the video and jumping to the beginning
						setTimeout(function() {
							$(t.container).find('.dec_loading').hide();
						}, 20);
					} catch (exp) {}
				}

				t.media.pause();

				if (t.setProgressRail) {
					t.setProgressRail();
				}

				if (t.setCurrentRail) {
					t.setCurrentRail();
				}

				if (!t.options.alwaysShowControls) {
					t.showControls();
				}
			}, false);

			t.media.addEventListener('loadedmetadata', function(e) {
				if (t.updateDuration) {
					t.updateDuration();
				}

				if (t.updateCurrent) {
					t.updateCurrent();
				}
			}, false);

			// Force autoplay for HTML5
			if (t.options.autoplay) {
				t.media.isUserClick = false;
				t.play();
			}

			if (typeof t.options.success == 'function') {
				t.options.success(t.media);
			}
		},

		handleError: function(e) {
			var t = this;

			if (t.controls) {
				t.controls.css('bottom', '-45px');
			}

			if (t.options.error) {
				t.options.error(e);
			}
		},

		setPlayerSize: function(width, height) {
			var t = this;
			var W = t.container.width();
			// Container width at most
			if (width > W) {
				t.width = W
			}

			// Set height for video
			if (t.isVideo && t.enableAutoSize) {
				var nativeWidth = t.media.videoWidth;
				var nativeHeight = t.media.videoHeight;

				// Uniform scale
				if (nativeWidth && nativeHeight) {
					if (Math.abs(t.options.aspectRation - nativeWidth / nativeHeight) < .1) {
						t.options.aspectRation = nativeWidth / nativeHeight
					}
				}

				t.height = parseInt(W / t.options.aspectRation, 10)
			}

			t.container.width(t.width);
			t.container.height(t.height);
			t.$media.height(t.height)
		},

		buildmain: function(player, controls, media) {
			var t = this;

			if (!player.isVideo)
				return;

			var loading = $('<div class="dec_loading"></div>')
				.hide() // Start out hidden
				.appendTo(player.container);
			var error = $('<div class="dec_error">播放异常</div>')
				.hide() // Start out hidden
				.appendTo(player.container);
			// This needs to come last so it's on top
			var bigPlay = $();
			if (!zyMedia.features.isiPhone) {
				bigPlay = $('<div class="dec_play"></div>')
					.appendTo(player.container)
					.on('click', function() {
						// For some device trigger 'play' event 
						media.isUserClick = true;
						if (media.paused) {
							media.play();
							// Controls bar auto hide after 3s
							if (!t.media.paused && !t.options.alwaysShowControls) {
								t.startControlsTimer(3000)
							}
						}
					});
			}

			// Show/hide big play button
			media.addEventListener('play', function() {
				if (media.isUserClick) {
					bigPlay.hide();
					loading.show();
					controls.find('.zy_time_buffering').hide();
					error.hide()
				}
			}, false);

			media.addEventListener('playing', function() {
				bigPlay.hide();
				loading.hide();
				controls.find('.zy_time_buffering').hide();
				error.hide();
			}, false);

			media.addEventListener('seeking', function() {
				loading.show();
				bigPlay.hide();
				controls.find('.zy_time_buffering').show();
			}, false);

			media.addEventListener('seeked', function() {
				loading.hide();
				controls.find('.zy_time_buffering').hide();
			}, false);

			media.addEventListener('pause', function() {
				if (!zyMedia.features.isiPhone) {
					bigPlay.show();
				}
			}, false);

			media.addEventListener('waiting', function() {
				loading.show();
				bigPlay.hide();
				controls.find('.zy_time_buffering').show();
			}, false);

			// Don't listen to 'loadeddata' and 'canplay', 
			// some Android device can't fire 'canplay' or irregular working when use 'createEvent' to trigger 'canplay' (读者i800)

			// Error handling
			media.addEventListener('error', function(e) {
				t.handleError(e);
				loading.hide();
				bigPlay.show();
				media.pause();
				error.show();
				controls.find('.zy_time_buffering').hide();
			}, false);

		},

		play: function() {
			this.load();
			this.media.play();
		},
		pause: function() {
			try {
				this.media.pause();
			} catch (exp) {}
		},
		load: function() {
			if (!this.isLoaded) {
				this.media.load();
			}

			this.isLoaded = true;
		},
		setCurrentTime: function(time) {
			this.media.currentTime = time;
		},
		getCurrentTime: function() {
			return this.media.currentTime;
		},
		remove: function() {
			var t = this;
			var feature;
			t.container.prev('.zy_offscreen').remove();

			// Invoke features cleanup
			for (var i in t.options.features) {
				feature = t.options.features[i];
				if (t['clean' + feature]) {
					try {
						t['clean' + feature](t);
					} catch (exp) {}
				}
			}

			// Grab video and put it back in place
			if (!t.isDynamic) {
				t.$media.prop('controls', true);
				// Detach events from the video
				t.$media.clone().insertBefore(t.container).show();
				t.$media.remove();
			} else {
				t.$media.insertBefore(t.container);
			}

			// Remove the player from the zy.players object so that pauseOtherPlayers doesn't blow up.
			delete zy.players[t.id];

			t.container.remove();

			t.globalUnbind();
			delete t.media.player;
		}
	};


	var rwindow = /^((after|before)print|(before)?unload|hashchange|message|o(ff|n)line|page(hide|show)|popstate|storage)\b/;

	function splitEvents(events, id) {
		// Add player ID as an event namespace so it's easier to unbind them all later
		var ret = {
			d: [],
			w: []
		};
		$.each((events || '').split(' '), function(k, v) {
			var eventname = v + '.' + id;
			if (eventname.indexOf('.') === 0) {
				ret.d.push(eventname);
				ret.w.push(eventname);
			} else {
				ret[rwindow.test(v) ? 'w' : 'd'].push(eventname);
			}
		});
		ret.d = ret.d.join(' ');
		ret.w = ret.w.join(' ');
		return ret;
	}

	zyMedia.MediaPlayer.prototype.globalBind = function(events, data, callback) {
		events = splitEvents(events, this.id);
		if (events.d) $(document).on(events.d, data, callback);
		if (events.w) $(window).on(events.w, data, callback);
	};

	zyMedia.MediaPlayer.prototype.globalUnbind = function(events, callback) {
		events = splitEvents(events, this.id);
		if (events.d) $(document).off(events.d, callback);
		if (events.w) $(window).off(events.w, callback);
	};


	$.fn.mediaplayer = function(options) {
		this.each(function() {
			new zyMedia.MediaPlayer(this, options);
		});
		return this;
	};


	$.extend(zyMedia.MediaPlayer.prototype, {
		// PLAY/pause button
		buildplaypause: function(player, controls, media) {
			var t = this;
			var play =
				$('<div class="zy_playpause_button zy_play" ></div>')
				.appendTo(controls)
				.click(function(e) {
					e.preventDefault();
					media.isUserClick = true;
					if (media.paused) {
						media.play();
						// Controls bar auto hide after 3s
						if (!t.media.paused && !t.options.alwaysShowControls) {
							t.startControlsTimer(3000)
						}
					} else {
						media.pause();
					}
					return false;
				});

			function togglePlayPause(which) {
				if (media.isUserClick || t.options.autoplay) {
					if ('play' === which) {
						play.removeClass('zy_play').addClass('zy_pause')
					} else {
						play.removeClass('zy_pause').addClass('zy_play')
					}
				}
			};

			media.addEventListener('play', function() {
				togglePlayPause('play')
			}, false);

			media.addEventListener('playing', function() {
				togglePlayPause('play')
			}, false);

			media.addEventListener('pause', function() {
				togglePlayPause('pse')
			}, false);

			media.addEventListener('paused', function() {
				togglePlayPause('pse')
			}, false);
		},


		// Progress/loaded bar
		buildprogress: function(player, controls, media) {
			$('<div class="zy_time_rail">' +
					'<span class="zy_time_total zy_time_slider">' +
					'<span class="zy_time_buffering"></span>' +
					'<span class="zy_time_loaded"></span>' +
					'<span class="zy_time_current"></span>' +
					'<span class="zy_time_handle"></span>' +
					'</span>' +
					'</div>')
				.insertBefore(controls.find('.zy_time'));
			controls.find('.zy_time_buffering').hide();

			var t = this;
			var total = controls.find('.zy_time_total');
			var loaded = controls.find('.zy_time_loaded');
			var current = controls.find('.zy_time_current');
			var handle = controls.find('.zy_time_handle');
			var slider = controls.find('.zy_time_slider');
			var handleMouseMove = function(e) {
				var offset = total.offset(),
					width = total.width(),
					percentage = 0,
					newTime = 0,
					pos = 0,
					x;

				// Mouse or touch position relative to the object
				if (e.originalEvent && e.originalEvent.changedTouches) {
					x = e.originalEvent.changedTouches[0].pageX;
				} else if (e.changedTouches) {
					x = e.changedTouches[0].pageX;
				} else {
					x = e.pageX;
				}

				if (media.duration) {
					if (x < offset.left) {
						x = offset.left;
					} else if (x > width + offset.left) {
						x = width + offset.left;
					}

					pos = x - offset.left;
					percentage = (pos / width);
					newTime = (percentage <= 0.02) ? 0 : percentage * media.duration;

					// Seek to where the mouse is
					if (mouseIsDown && newTime !== media.currentTime) {
						media.setCurrentTime(newTime);
					}
				}
			};
			var mouseIsDown = false;
			var mouseIsOver = false;
			var startedPaused = false;

			// Store for later use
			t.loaded = loaded;
			t.total = total;
			t.current = current;
			t.handle = handle;

			// Handle clicks
			total
				.on('mousedown touchstart', function(e) {
					// Only handle left clicks or touch
					if (e.which === 1 || e.which === 0) {
						mouseIsDown = true;
						handleMouseMove(e);
						t.globalBind('mousemove.dur touchmove.dur', function(e) {
							handleMouseMove(e);
						});
						t.globalBind('mouseup.dur touchend.dur', function(e) {
							mouseIsDown = false;
							t.globalUnbind('.dur');
						});
					}
				})
				.on('mouseenter', function(e) {
					mouseIsOver = true;
					t.globalBind('mousemove.dur', function(e) {
						handleMouseMove(e);
					});
				})
				.on('mouseleave', function(e) {
					mouseIsOver = false;
					if (!mouseIsDown) {
						t.globalUnbind('.dur');
					}
				});

			// Loading
			media.addEventListener('progress', function(e) {
				player.setProgressRail(e);
				player.setCurrentRail(e);
			}, false);

			// Current time
			media.addEventListener('timeupdate', function(e) {
				player.setProgressRail(e);
				player.setCurrentRail(e);
			}, false);

		},

		setProgressRail: function(e) {
			var t = this;
			var el = (e !== undefined) ? e.target : t.media;
			var percent = null;

			// Newest HTML5 spec has buffered array (FF4, Webkit)
			if (el && el.buffered && el.buffered.length > 0 && el.buffered.end && el.duration) {
				// Account for a real array with multiple values - always read the end of the last buffer
				percent = el.buffered.end(el.buffered.length - 1) / el.duration;
			}
			// Some browsers (e.g., FF3.6 and Safari 5) cannot calculate el.bufferered.end()
			// to be anything other than 0. If the byte count is available we use this instead.
			// Browsers that support the else if do not seem to have the bufferedBytes value and should skip to there.
			else if (el && el.bytesTotal !== undefined && el.bytesTotal > 0 && el.bufferedBytes !== undefined) {
				percent = el.bufferedBytes / el.bytesTotal;
			}
			// Firefox 3 with an Ogg file seems to go this way
			else if (e && e.lengthComputable && e.total !== 0) {
				percent = e.loaded / e.total;
			}

			// Finally update the progress bar
			if (percent !== null) {
				percent = Math.min(1, Math.max(0, percent));
				t.loaded.width(t.total.width() * percent);
				// Adjust progress bar when pause change from playing (魅族)
				t.media.addEventListener('pause', function() {
					setTimeout(function() {
						t.loaded.width(t.total.width() * percent);
						t.setCurrentRail()
					}, 300)
				});
			}
		},

		setCurrentRail: function() {
			var t = this;

			if (t.media.currentTime !== undefined && t.media.duration) {
				// Update bar and handle
				var newWidth = Math.round(t.total.width() * t.media.currentTime / t.media.duration);
				var handlePos = newWidth - Math.round(t.handle.width() / 2);
				t.current.width(newWidth);
				t.handle.css('left', handlePos);
			}

		},


		// Current and duration 00:00 / 00:00
		buildcurrent: function(player, controls, media) {
			var t = this;

			$('<div class="zy_time">' +
					'<span class="zy_currenttime">' +
					zyMedia.timeFormat(0, player.options) +
					'</span>' +
					'</div>')
				.appendTo(controls);

			t.currenttime = t.controls.find('.zy_currenttime');

			media.addEventListener('timeupdate', function() {
				player.updateCurrent()
			}, false);
		},

		buildduration: function(player, controls, media) {
			var t = this;

			if (controls.children().last().find('.zy_currenttime').length > 0) {
				$(t.options.timeAndDurationSeparator +
						'<span class="zy_duration">' +
						zyMedia.timeFormat(t.options.duration, t.options) +
						'</span>')
					.appendTo(controls.find('.zy_time'));
			} else {
				// Add class to current time
				controls.find('.zy_currenttime').parent().addClass('zy_currenttime_container');

				$('<div class="zy_time zy_duration_container">' +
						'<span class="zy_duration">' +
						zyMedia.timeFormat(t.options.duration, t.options) +
						'</span>' +
						'</div>')
					.appendTo(controls);
			}

			t.durationD = t.controls.find('.zy_duration');

			//4Hz ~ 66Hz, no longer than 250ms
			media.addEventListener('timeupdate', function() {
				player.updateDuration()
			}, false);
		},

		updateCurrent: function() {
			var t = this;
			t.currenttime.html(zyMedia.timeFormat(t.media.currentTime, t.options));
		},

		updateDuration: function() {
			var t = this;
			// Duration is 1 in (读者) device
			if (t.options.duration > 1 || t.media.duration > 1) {
				t.durationD.html(zyMedia.timeFormat(t.options.duration > 1 ? t.options.duration : t.media.duration, t.options));
			}
		},


		// Fullscreen
		isFullScreen: false,
		buildfullscreen: function(player, controls, media) {

			if (!player.isVideo)
				return;

			// Native events
			if (zyMedia.features.hasTrueNativeFullScreen) {
				// Chrome doesn't alays fire this in an iframe
				var func = function(e) {
					if (player.isFullScreen) {
						if (!zyMedia.features.isFullScreen()) {
							// When a user presses ESC
							// make sure to put the player back into place
							player.exitFullScreen();
						}
					}
				};

				player.globalBind(zyMedia.features.fullScreenEventName, func);
			}

			player.fullscreenBtn = $('<div class="zy_fullscreen_button"></div>').appendTo(controls);

			player.fullscreenBtn.click(function() {
				if ((zyMedia.features.hasTrueNativeFullScreen && zyMedia.features.isFullScreen()) || player.isFullScreen) {
					player.exitFullScreen();
				} else {
					player.enterFullScreen();
				}
			});

			this.normalHeight = 0;
			this.normalWidth = 0;
		},

		cleanfullscreen: function(player) {
			player.exitFullScreen();
		},

		containerSizeTimeout: null,

		enterFullScreen: function() {
			var t = this;

			// Store sizing
			t.normalHeight = t.container.height();
			t.normalWidth = t.container.width();
			// Set it to not show scroll bars so 100% will work
			$(document.documentElement).addClass('zy_fullscreen');

			// Attempt to do true fullscreen (Safari 5.1 and Firefox Nightly only for now)
			if (zyMedia.features.hasTrueNativeFullScreen) {
				zyMedia.features.requestFullScreen(t.container[0]);
			} else if (zyMedia.features.hasSemiNativeFullScreen) {
				t.media.webkitEnterFullscreen();
				return;
			}

			// Make full size
			t.container.width('100%').height('100%');

			// Only needed for safari 5.1 native full screen, can cause display issues elsewhere
			// Actually, it seems to be needed for IE8, too
			t.containerSizeTimeout = setTimeout(function() {
				t.container.css({
					width: '100%',
					height: '100%'
				});
			}, 500);

			t.$media.width('100%').height('100%');

			t.fullscreenBtn.removeClass('zy_fullscreen').addClass('zy_unfullscreen')

			t.isFullScreen = true
		},

		exitFullScreen: function() {
			var t = this;
			// Prevent container from attempting to stretch a second time
			clearTimeout(t.containerSizeTimeout);

			// Come out of native fullscreen
			if (zyMedia.features.hasTrueNativeFullScreen && (zyMedia.features.isFullScreen() || t.isFullScreen)) {
				zyMedia.features.cancelFullScreen();
			}

			// Restore scroll bars to document
			$(document.documentElement).removeClass('zy_fullscreen');

			t.container.width(t.normalWidth).height(t.normalHeight);

			t.$media.width(t.normalWidth).height(t.normalHeight);
			t.fullscreenBtn.removeClass('zy_unfullscreen').addClass('zy_fullscreen');
			t.isFullScreen = false
		}
	});

})();