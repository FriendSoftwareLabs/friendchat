/*©agpl*************************************************************************
*                                                                              *
* This file is part of FRIEND UNIFYING PLATFORM.                               *
*                                                                              *
* This program is free software: you can redistribute it and/or modify         *
* it under the terms of the GNU Affero General Public License as published by  *
* the Free Software Foundation, either version 3 of the License, or            *
* (at your option) any later version.                                          *
*                                                                              *
* This program is distributed in the hope that it will be useful,              *
* but WITHOUT ANY WARRANTY; without even the implied warranty of               *
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the                 *
* GNU Affero General Public License for more details.                          *
*                                                                              *
* You should have received a copy of the GNU Affero General Public License     *
* along with this program.  If not, see <http://www.gnu.org/licenses/>.        *
*                                                                              *
*****************************************************************************©*/

'use strict';
window.library = window.library || {};
window.friendUP = window.friendUP || {};
window.hello = window.hello || {};

library.rtc = library.rtc || {};

// Initchecks
(function( ns, undefined ) {
	ns.InitChecks = function( view ) {
		if ( !( this instanceof ns.InitChecks ))
			return new ns.InitChecks( conf );
		
		const self = this;
		library.component.EventEmitter.call( self );
		
		self.view = view;
		//self.onsourceselect = conf.onsourceselect;
		//self.ondone = conf.ondone;
		
		self.hasError = false;
		self.canContinue = true;
		self.checksDone = null;
		self.isDone = false;
		
		self.init();
	}
	
	ns.InitChecks.prototype =
		Object.create( library.component.EventEmitter.prototype );
	
	// Public
	
	ns.InitChecks.prototype.checkBrowser = function( callback ) {
		const self = this;
		new library.rtc.BrowserCheck( checkBack );
		function checkBack( res ) {
			self.ui.updateBrowserCheck( res );
			checkErrors( res );
			self.setCheckDone( 'browser' );
			
			function checkErrors( res ) {
				var bErr = res.support.type;
				var success = true;
				var isCrit = false;
				
				// 
				if ( 'error' === res.secure.type ) {
					success = false;
					isCrit = true;
				}
				
				// check browser
				if ( 'success' !== bErr ) {
					success = false;
					isCrit = 'error' === bErr;
				}
				
				// check capabilities
				const capKeys = Object.keys( res.capabilities );
				const hasCapErr = capKeys.some( failed );
				function failed( key ) { return !res.capabilities[ key ]; }
				if ( hasCapErr ) {
					success = false;
					isCrit = true;
				}
				
				// report back
				if ( !success ) {
					self.setHasError( isCrit );
					callback( isCrit, res.browser );
				}
				else {
					callback( null, res.browser );
				}
			}
		}
	}
	
	ns.InitChecks.prototype.checkSignal = function( conn, type ) {
		const self = this;
		if ( 'host' === type )
			self.ui.showHostSignal();
		
		var type = type + '-signal';
		self.startingCheck( type );
		var uptd = {
			desc : conn.url,
		};
		updateUi( uptd );
		var localState = {
			open : conn.onopen,
			close : conn.onclose,
		};
		conn.onopen = onopen;
		conn.onclose = onclose;
		localState.checkTimeout = window.setTimeout( resultTimeout, 20000 );
		
		function onopen() {
			restoreHandlers();
			cancelResultTimeout();
			if ( self.isDone )
				return;
			
			var success = {
				type : 'success',
				message : '',
			};
			updateUi( success );
			self.setCheckDone( type );
			conn.onopen.apply( this, arguments );
		}
		
		function onclose( errMsg ) {
			errMsg = errMsg || 'connection error';
			restoreHandlers();
			cancelResultTimeout();
			if ( self.isDone )
				return;
			
			var err = {
				type : 'error',
				message : errMsg,
			}
			updateUi( err );
			self.setHasError( true );
			self.setCheckDone( type );
			conn.onclose.apply( this, arguments );
		}
		
		function resultTimeout() {
			localState.checkTimeout = null;
			conn.close();
			onclose( 'connection timeout' );
		}
		
		function cancelResultTimeout() {
			if ( !localState.checkTimeout ) {
				console.log( 'no localState.checkTimeout?????', localState );
				return;
			}
			
			window.clearTimeout( localState.checkTimeout );
			localState.checkTimeout = null;
		}
		
		function restoreHandlers() {
			if ( !localState.open )
				return;
			
			conn.onopen = localState.open;
			conn.onclose = localState.close;
			
			delete localState.open;
			delete localState.close;
		}
		
		function updateUi( uptd ) {
			if ( 'host-signal' === type )
				self.ui.updateHostSignal(  uptd );
			if ( 'room-signal' === type )
				self.ui.updateRoomSignal( uptd );
		}
	}
	
	ns.InitChecks.prototype.checkICE = function( conf ) {
		const self = this;
		self.startingCheck( 'ice-servers' );
		self.turnPass = false;
		conf.forEach( addToView );
		new library.rtc.ICECheck( conf, stepBack, doneBack );
		
		function addToView( server ) {
			if ( self.isDone )
				return;
			
			var state = {
				type : 'add',
				server : server,
			};
			self.ui.updateICEServer( state );
		}
		
		function stepBack( result ) {
			if ( self.isDone )
				return;
			
			var isTURN = checkIsTURN( result.server );
			if ( isTURN && !result.err  )
				self.turnPass = true;
			
			var state = {
				type    : result.err ? 'error' : 'success',
				server  : result.server,
				message : result.err || '',
			}
			
			self.ui.updateICEServer( state );
			
			function checkIsTURN( server ) {
				var url = server.urls[ 0 ];
				var match = url.match( /^turn:/);
				return !!match;
			}
		}
		
		function doneBack() {
			if ( !self.turnPass )
				self.setHasError();
			
			self.setCheckDone( 'ice-servers' );
		}
	}
	
	ns.InitChecks.prototype.checkAudioDevices = function( mediaStream, preferedDevices ) {
		const self = this;
		self.startingCheck( 'audio-input' );
		const tracks = mediaStream.getAudioTracks();
		if ( !tracks.length ) {
			console.log( 'no audio sources available, passing' );
			setError( 'ERR_NO_DEVICES_FOUND' );
			self.setCheckDone( 'audio-input' );
			return;
		}
		
		const dev = tracks[ 0 ];
		const deviceLabel = dev.label ? dev.label : dev.labelExtra;
		self.ui.updateAudioInput( { desc : deviceLabel } );
		new library.rtc.AudioInputDetect( mediaStream )
			.then( checkBack )
			.catch( checkErr );
		
		function checkBack( hasInput ) {
			if ( self.isDone )
				return;
			
			if ( !hasInput )
				setError( 'ERR_NO_INPUT' );
			else {
				const state = {
					type : 'success',
				};
				self.ui.updateAudioInput( state );
			}
			
			self.setCheckDone( 'audio-input' );
		}
		
		function checkErr( err ) {
			if ( self.isDone )
				return;
			
			setError( err );
			self.setCheckDone( 'audio-input' );
		}
		
		function setError( err ) {
			const state = {
				type : 'error',
				err  : err,
			};
			self.ui.updateAudioInput( state );
			self.setHasError();
		}
	}
	
	ns.InitChecks.prototype.checkVideoDevices = function( mediaStream, preferedDevices ) {
		const self = this;
		self.setCheckDone( 'video-input' );
	}
	
	ns.InitChecks.prototype.checkDeviceAccess = function( permissions, callback ) {
		const self = this;
		getDevices( check );
		function getDevices( callback ) {
			const sources = new library.rtc.MediaDevices();
			sources.getByType()
				.then( ok )
				.catch( error );
				
			function ok( devices ) {
				callback( null, devices );
			}
			
			function error( err ) {
				console.log( 'getDevices - err', err );
				callback( err, null );
			}
		}
		
		function check( err, devices ) {
			if ( err ) {
				done( 'ERR_ENUMERATE_DEVICES_FAILED', permissions, devices );
				return;
			}
			
			// user has unchecked both audio and video. usecase: screensharing
			if ( !permissions.audio && !permissions.video ) {
				done( null, permissions, devices );
				return;
			}
			
			const audioIds = Object.keys( devices.audioinput );
			const videoIds = Object.keys( devices.videoinput );
			let deviceErr = checkHasDevices( audioIds, videoIds );
			if ( deviceErr ) {
				done( deviceErr, permissions, devices );
				return;
			}
			
			let blockedErr = checkIsBlocked( audioIds, videoIds );
			if ( blockedErr ) {
				askForDeviceAccess( askBack );
				return;
			}
			
			done( null, permissions, devices );
			return;
			
			function askBack( err ) {
				if ( !err ) {
					getDevices( devicesBack );
					return;
				}
				
				let label = err.name;
				let ERR = 'ERR_GUM_' + label;
				if ( 'NotAllowedError' === label )
					ERR = 'ERR_GUM_NOT_ALLOWED';
				
				if ( 'NoMediaError' === label )
					ERR = 'ERR_GUM_NO_MEDIA';
				
				done( ERR, permissions, devices );
				
				function devicesBack( err, devices ) {
					if ( err )
						done( err, permissions, devices );
					else
						done( null, permissions, devices );
				}
			}
			
			done( null, permissions, devices );
			
			function checkHasDevices( a, v ) {
				let ERR = 'ERR_NO_DEVICES_FOUND';
				let ok = true;
				if ( onlyAudio()) {
					if ( !a.length )
						return ERR;
				}
				
				if ( onlyVideo()) {
					if ( !v.length )
						return ERR;
				}
				
				if ( !a.length && !v.length )
					return ERR;
				
				// has permissions for both ( default )
				// if theres no video device
				// fallback to one or the other
				if ( !v.length )
					permissions.video = false;
				
				if ( !a.length )
					permissions.audio = false;
				
				return null;
			}
			
			function checkIsBlocked( a, v ) {
				let aDev = a[ 0 ];
				let vDev = v[ 0 ];
				let ERR = 'ERR_DEVICES_BLOCKED';
				if ( onlyAudio()) {
					if ( "" === aDev )
						return ERR;
				}
				
				if ( onlyVideo()) {
					if ( "" === vDev )
						return ERR;
				}
				
				// if both are blocked, ask for device access ( probably first time use )
				if ( "" === aDev && "" === vDev )
					return ERR;
				
				// if only video devices are blocked
				// fall back to one or the other
				if ( "" === vDev )
					permissions.video = false;
				
				if ( "" === aDev )
					permissions.audio = false;
				
				return null;
			}
			
			function onlyAudio() {
				return !permissions.video && permissions.audio;
			}
			
			function onlyVideo() {
				return !permissions.audio && permissions.video;
			}
			
			function askForDeviceAccess( callback ) {
				window.navigator.mediaDevices.getUserMedia( permissions )
					.then( gumBack )
					.catch( gumError );
					
				function gumBack( mediaStream ) {
					close ( mediaStream );
					callback( null, true );
				}
				
				function gumError( err ) {
					console.log( 'gumError', err );
					callback( err, null );
				}
				
				function close( media ) {
					let tracks = media.getTracks();
					tracks.forEach( end );
					function end( track ) {
						media.removeTrack( track );
						track.stop();
					}
				}
				
			} // askPermission
			
		} // check
		
		function done( err, permissions, devices ) {
			if ( err )
				self.setHasError( true );
			
			const state = {
				err         : err,
				permissions : permissions,
				devices     : devices,
			};
			
			self.ui.updateDevicesCheck( state );
			self.setCheckDone( 'devices' );
			if ( err )
				callback( err, null, devices );
			else
				callback( null, permissions, devices );
		}
		
		function error( err ) {
			callback( err, null, devices );
		}
	}
	
	ns.InitChecks.prototype.checkSourceReady = function( hasMedia, mediaErr ) {
		const self = this;
		let ready = hasMedia;
		let msg = 'Ready';
		if ( !ready )
			msg = View.i18n('i18n_media_not_available');
		const state = {
			type    : ready ? 'success' : 'error',
			message : msg,
		};
		
		if ( mediaErr ) {
			ready = false;
			console.log( 'mediaErr', mediaErr );
			state.message = state.message || 'Media Error';
			try {
				state.err = JSON.stringify( mediaErr.err, null, 2 );
			} catch( e ) {
				state.err = mediaErr.err;
			}
			
			try {
				state.constraints = JSON.stringify( mediaErr.constraints, null, 2 );
			} catch( e ) {
				state.constraints = '';
			}
		}
		
		self.ui.updateSelfieCheck( state );
		if ( !ready )
			self.setHasError( true );
		
		self.setCheckDone( 'source-check' );
		return ready;
	}
	
	ns.InitChecks.prototype.passCheck = function( check ) {
		const self = this;
		self.setCheckDone( check );
	}
	
	ns.InitChecks.prototype.close = function() {
		const self = this;
		self.ui.close();
		self.isDone = true;
		
		delete self.view;
		delete self.ui;
		self.release();
	}
	
	// Private
	
	ns.InitChecks.prototype.init = function() {
		const self = this;
		self.checksDone = {
			'source-check' : false,
			'ice-servers'  : false,
			'audio-input'  : false,
			'video-input'  : false,
			'devices'      : false,
		};
		
		const conf = {
			onclose        : onclose,
			oncontinue     : oncontinue,
			onsourceselect : onsource,
		};
		self.ui = self.view.addInitChecks( conf );
		self.ui.show();
		
		function onclose() {
			self.done( true );
		}
		
		function oncontinue() {
			self.done();
		}
		
		function onsource() {
			self.emit( 'source-select', true );
		}
	}
	
	ns.InitChecks.prototype.setHasError = function( critical ) {
		const self = this;
		self.hasError = true;
		
		if ( critical  )
			self.canContinue = false;
		
		self.ui.showErrorHandling( self.canContinue );
	}
	
	ns.InitChecks.prototype.startingCheck = function( id ) {
		const self = this;
		self.checksDone[ id ] = false;
	}
	
	ns.InitChecks.prototype.setCheckDone = function( id ) {
		const self = this;
		if ( null == self.checksDone[ id ])
			return;
		
		self.checksDone[ id ] = true;
		if ( !isDone() )
			return;
		
		if ( self.hasError )
			return;
		
		self.done();
		
		function isDone() {
			var ids = Object.keys( self.checksDone );
			return ids.every( done );
			
			function done( id ) {
				return self.checksDone[ id ];
			}
		}
		
	}
	
	ns.InitChecks.prototype.done = function( forceClose ) {
		const self = this;
		if ( self.isDone )
			return;
		
		self.isDone = true;
		self.emit( 'done', forceClose );
		//self.ondone( forceClose );
	}
	
})( library.rtc );

// ICECheck
(function( ns, undefined ) {
	ns.ICECheck = function( conf, stepBack, doneBack ) {
		if ( !( this instanceof ns.ICECheck ))
			return new ns.ICECheck( conf );
		
		const self = this;
		self.conf = conf;
		self.stepBack = stepBack;
		self.doneBack = doneBack;
		
		self.timeoutMS = 1000 * 20; // 20 sec
		
		self.init();
	}
	
	ns.ICECheck.prototype.init = function() {
		const self = this;
		self.checks = 0;
		self.turnSuccess = false;
		self.conf.forEach( check );
		
		function check( server ) {
			self.checkServer( server, checkBack );
			function checkBack( res ) {
				if ( res && res.ret )
					return;
				
				self.checks++;
				var err = res.err;
				var ret = {
					err : err || null,
					server : server,
				};
				
				if ( self.stepBack )
					self.stepBack( ret );
				
				if ( 'turn' === res.srv )
					self.turnSuccess = true;
				
				checkDone();
			}
		}
		
		function checkDone() {
			if ( self.isDone )
				return;
			
			if ( self.checks === self.conf.length || self.turnSuccess )
				self.done();
		}
	}
	
	ns.ICECheck.prototype.checkServer = function( server, checkBack ) {
		const self = this;
		if ( !server || !server.urls || !server.urls[ 0 ] ) {
			console.log( 'ICECheck - checkServer, not a thing', server );
			checkBack({
				err : 'ERR_INVALID_SERVER',
			});
			return;
		}
		
		let host = server.urls[ 0 ];
		let match = host.match( /^(stun|turn):/i );
		if ( !match ) {
			console.log( 'ICECheck - checkServer, invalid host string', host );
			checkBack({
				err : 'ERR_INVALID_HOST_STRING',
			});
			return;
		}
		
		const srvType = match[ 1 ];
		var conf = {
			iceServers : [ server ],
		};
		new window.Promise( checkTheICE )
			.then( result )
			.catch( result );
		
		function checkTheICE( resolve, reject ) {
			var returned = false;
			var timeout = window.setTimeout( checkTimedOut, self.timeoutMS );
			window.rtcConf = conf;
			var test = new window.RTCPeerConnection( conf );
			test.onicecandidate = onICE;
			test.createDataChannel( 'test' );
			test.createOffer()
				.then( offerCreated )
				.catch( offerFailed );
			
			function offerCreated( offer ) {
				test.setLocalDescription( offer );
			}
			
			function offerFailed( err ) {
				error( 'offer failed' );
			}
			
			function onICE( e ) {
				if ( !e.candidate || !e.candidate.candidate )
					return;
				
				let sdp = e.candidate.candidate;
				let tm = sdp.match( /typ\s([a-z]+)\s/i );
				if ( !tm )
					return;
				
				let typ = tm[ 1 ];
				
				// 'typ host' is localhost
				if ( 'host' === typ )
					return;
				
				if (( 'turn' === srvType ) && ( 'relay' !== typ ))
					return;
				
				if ( 'stun' === srvType && 'srflx' !== typ )
					return;
				
				success( srvType );
			}
			
			function checkTimedOut() {
				error( 'ERR_HOST_TIMEOUT' );
			}
			
			function success( srvType ) {
				var res = {
					ret  : returned,
					err  : null,
					srv : srvType,
				};
				resolve( res );
				clear();
			}
			
			function error( err ) {
				var res = {
					ret : returned,
					err : err,
				};
				reject( res );
				clear();
			}
			
			function clear() {
				returned = true;
				try {
					test.close();
				} catch( e ) {
					console.log( 'test.close exep', e );
				}
				if ( timeout )
					window.clearTimeout( timeout );
				timeout = null;
			}
		}
		
		function result( res ) { checkBack( res ); }
		//function pass( res ) { checkBack( res ); }
		//function fail( res ) { checkBack( res ); }
	}
	
	ns.ICECheck.prototype.done = function() {
		const self = this;
		var doneBack = self.doneBack;
		self.isDone = true;
		delete self.conf;
		delete self.stepBack;
		delete self.doneBack;
		doneBack();
	}
	
})( library.rtc );

// Browser check
(function( ns, undefined ) {
	ns.BrowserCheck = function( onResult ) {
		if ( !( this instanceof ns.BrowserCheck ))
			return new ns.BrowserCheck();
		
		const self = this;
		self.onresult = onResult;
		self.isSecure = false;
		self.browser = null;
		self.version = null;
		self.isMobile = false;
		self.isVR = false;
		self.is = {};
		self.capabilities = {
			webRTC   : null,
			audioAPI : null,
		};
		self.init();
	}
	
	// Public
	
	// Private
	
	ns.BrowserCheck.prototype.supportMap = {
		'ie'      : 'error',
		'edge'    : 'error',
		'opera'   : 'warning',
		'safari'  : 'warning',
		'firefox' : 'success',
		'chrome'  : 'success',
		'blink'   : 'success',
		'samsung' : 'success',
		'android' : 'warning',
		'iphone'  : 'warning',
		'unknown' : 'warning',
	}
	
	ns.BrowserCheck.prototype.supportString = {
		'error'   : 'unsupported',
		'warning' : 'experimental support',
		'success' : 'full support',
	}
	
	ns.BrowserCheck.prototype.init = function() {
		const self = this;
		self.checkSecure();
		self.checkMobile();
		if ( self.isMobile )
			self.mangleMobile();
		else
			self.identifyDesktopBrowser();
		
		self.checkVR();
		self.checkCapabilities();
		self.done();
	}
	
	ns.BrowserCheck.prototype.mangleMobile = function() {
		const self = this;
		var uaId = self.getApprovedUAId();
		if ( uaId )
			self.is[ uaId ] = true;
		else
			self.is[ self.isMobile ] = true;
	}
	
	ns.BrowserCheck.prototype.identifyDesktopBrowser = function() {
		const self = this;
		let is = self.is || {};
		// IE
		is[ 'ie' ] = !!document.documentMode; // old ie
		is[ 'edge' ] = !is[ 'ie ' ] && !!window.StyleMedia; // new ie. They both fail, lol
		
		// OPERA
		is[ 'opera' ] = ( !!window.opr && !!window.opr.addons )
			|| window.opera
			|| navigator.userAgent.indexOf( ' OPR/' ) >= 0;
		
		// SAFARI
		is[ 'safari' ] = /constructor/i.test(window.HTMLElement) 
			|| (function (p)
				{ return p.toString() === "[object SafariRemoteNotification]"; })(!window['safari'] 
				|| (typeof safari !== 'undefined' && safari.pushNotification)) 
			|| /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
		
		// FIREFOX
		is[ 'firefox' ] = !!window.InstallTrigger;
		
		// CHROME
		is[ 'chrome' ] = !!window.chrome;
		is[ 'blink' ] = ( is[ 'chrome' ] || is[ 'opera' ] ) && !!window.CSS;
		/*
		if ( is[ 'blink' ]) {
			is[ 'chrome' ] = false;
			is[ 'opera' ] = false;
		}
		*/
		
		self.is = is;
	}
	
	ns.BrowserCheck.prototype.checkSecure = function() {
		const self = this;
		const url = window.document.URL;
		if ( !url )
			return;
		
		let isHttps = url.match( /^https/i );
		if ( isHttps )
			self.isSecure = true;
	}
	
	ns.BrowserCheck.prototype.checkCapabilities = function() {
		const self = this;
		var cap = {};
		cap[ 'webAudio' ] = !!window.AudioContext;
		cap[ 'webRTC' ] = !!window.RTCPeerConnection;
		cap[ 'mediaDevices' ] = !!window.navigator.mediaDevices;
		if ( cap[ 'mediaDevices' ]) {
			cap[ 'getUserMedia' ] = !!window.navigator.mediaDevices.getUserMedia;
			cap[ 'enumerateDevices' ] = !!window.navigator.mediaDevices.enumerateDevices;
		}
		
		self.cap = cap;
	}
	
	ns.BrowserCheck.prototype.checkMobile = function() {
		const self = this;
		const tokens = [
			'Android',
			'webOS',
			'iPhone',
			'iPad',
			'iPod',
			'BlackBerry',
			'IEMobile',
			'Opera Mini',
			'Mobile',
			'mobile',
			'CriOS',
		];
		const rxStr = tokens.join( '|' );
		const rx = new RegExp( rxStr, '' );
		const match = navigator.userAgent.match( rx );
		if ( match )
			self.isMobile = match[ 0 ];
		
		return self.isMobile;
	}
	
	ns.BrowserCheck.prototype.getApprovedUAId = function() {
		const self = this;
		var tokens = [
			'Chrome',
			'Samsung',
			'iPhone',
		];
		var rxStr = tokens.join( '|' );
		var rx = new RegExp( rxStr, 'i' );
		var match = navigator.userAgent.match( rx );
		if ( match )
			return match[ 0 ];
		
		return '';
	}
	
	ns.BrowserCheck.prototype.checkVR = function() {
		const self = this;
		var match = navigator.userAgent.match( /VR/ );
		if ( match )
			self.isVR = true;
	}
	
	ns.BrowserCheck.prototype.done = function() {
		const self = this;
		let browser = getBrowser();
		let supType = self.supportMap[ browser.toLowerCase() ] || 'error';
		
		if ( self.isMobile ) {
			browser += ' ' + self.isMobile;
		}
		
		if ( self.isVR ) {
			browser += ' VR';
			if ( 'success' === supType )
				supType = 'warning';
		}
		
		var supString = self.supportString[ supType ];
		var support = {
			type    : supType,
			message : supString,
		};
		
		const secure = {
			type    : self.isSecure ? '' : 'error',
			desc    : 'Secure connection',
			message : 'ERR_HTTPS_REQUIRED',
		};
		
		var res = {
			secure       : secure,
			browser      : browser,
			support      : support,
			capabilities : self.cap,
		};
		var cb = self.onresult;
		self.close();
		cb( res );
		
		function getBrowser() {
			for ( var browser in self.is )
				if ( !!self.is[ browser ])
					return browser;
				
			return 'unknown';
		}
	}
	
	ns.BrowserCheck.prototype.close = function() {
		const self = this;
		delete self.onresult;
	}
	
	
})( library.rtc );
