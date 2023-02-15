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

//SourceSelect
(function( ns, undefined ) {
	ns.SourceSelect = function( conf ) {
		const self = this;
		self.view = conf.view;
		self.onselect = conf.onselect;
		self.permissions = conf.permissions;
		
		self.init();
	}
	
	// pub
	
	ns.SourceSelect.prototype.show = function( currentDevices ) {
		const self = this;
		self.ui.show();
		self.ui.showDevices( currentDevices );
	}
	
	ns.SourceSelect.prototype.showGUMError = function( data ) {
		const self = this;
		self.ui.show();
		self.ui.showGetUserMediaError( data );
	}
	
	ns.SourceSelect.prototype.getSelected = function() {
		const self = this;
		return self.ui.getSelected();
	}
	
	ns.SourceSelect.prototype.close = function() {
		const self = this;
		self.ui.close();
		delete self.ui;
		delete self.permissions;
		delete self.onselect;
		delete self.onclose;
	}
	
	// priv
	
	ns.SourceSelect.prototype.init = function() {
		const self = this;
		const uiConf = {
			permissions : self.permissions,
			onselect    : onselect,
		};
		self.ui = self.view.addSettings( uiConf );
		//self.ui.show();
		
		function onselect( devices ) {
			self.onselect( devices );
		}
	}
	
})( library.rtc );


// Media Sources
( function( ns, undefined ) {
	ns.MediaDevices = function() {
		if ( !( this instanceof ns.MediaDevices ))
			return new ns.MediaDevices();
		
		const self = this;
		self.init();
	}
	
	// Public
	
	/*
	[ device, .. ]
	*/
	ns.MediaDevices.prototype.get = function() {
		const self = this;
		return self.enumerate();
	}
	
	/*
	{
		audioinput  : { deviceId : device, }
		audiooutput : { deviceId : device, }
		videoinput  : { deviceId : device, }
		
		!important : in case of no permission / blocked devices, only one device will
		be returned for audio and video each. This is because they all have the same 
		label; "".
		!! IMPORTANT : Changed labels to deviceId for keys!
	}
	*/
	ns.MediaDevices.prototype.getByType = function() {
		const self = this;
		return self.enumerate( parseToType );
		
		function parseToType( arr ) {
			const devices = {
				audioinput  : {},
				audiooutput : {},
				videoinput  : {},
			};
			
			let audioNum = 1;
			let videoNum = 1;
			
			arr.forEach( sort );
			return devices;
			
			function sort( dev ) {
				const kind = dev.kind;
				if ( !devices[ kind ]) {
					console.log( 'unknown device kind found', dev );
					return;
				}
				
				setLabelExtra( kind, dev );
				devices[ kind ][ dev.deviceId ] = dev;
				
				function setLabelExtra( kind, dev ) {
					let labelExtra = '';
					if( 'audioinput' === kind )
						labelExtra = 'Audio input ' + audioNum++;
					
					if( 'videoinput' === kind )
						labelExtra = 'Video input ' + videoNum++;
					
					dev.labelExtra = labelExtra;
				}
			}
		}
	}
	
	// Private
	
	// parser optional
	// without parser, default output
	// [ device, ]
	ns.MediaDevices.prototype.enumerate = function( parser ) {
		var self =this;
		return new window.Promise( function( resolve, reject ) {
			navigator.mediaDevices.enumerateDevices()
				.then( foundDevices )
				.catch( enumError );
				
			function foundDevices( arr ) {
				let res = null;
				if ( parser )
					res = parser( arr );
				else
					res = arr;
				
				resolve( res );
			}
			
			function enumError( err ) {
				console.log( 'MediaDevices.enumerate failed', err );
				reject( err );
			}
		});
	}
	
	
	ns.MediaDevices.prototype.init = function() {
		const self = this;
		//console.log( 'media sources init' );
	}
	
})( library.rtc );


// Is speaking
(function( ns, undefined ) {
	ns.IsSpeaking = function( source, onSpeaking ) {
		const self = this;
		self.source = source;
		self.onSpeaking = onSpeaking;
		
		self.isSpeaking = false
		self.speakingLimit = 16
		self.speakingTicks = 5
		self.notSpeakingLimit = 5
		self.notSpeakingTicks = 20
		self.notSpeakingWait = 1000 * 2
		self.notSpeakingTimeout = null
		
		self.init()
	}
	
	// Public
	
	ns.IsSpeaking.prototype.setSource = function( source ) {
		const self = this;
		if ( self.source )
			self.releaseSource();
		
		self.source = source;
		self.bindSource();
	}
	
	ns.IsSpeaking.prototype.setIsSpeaker = function( isSpeaker ) {
		const self = this;
		self.isSpeaking = !!isSpeaker;
	}
	
	ns.IsSpeaking.prototype.getIsSpeaker = function() {
		const self = this;
		return self.isSpeaking;
	}
	
	ns.IsSpeaking.prototype.close = function() {
		const self = this;
		self.releaseSource();
		
		delete self.onSpeaking;
	}
	
	// Pivate
	
	ns.IsSpeaking.prototype.init = function() {
		const self = this;
		self.bindSource();
	}
	
	ns.IsSpeaking.prototype.bindSource = function() {
		const self = this;
		if ( !self.source )
			return;
		
		self.onVId = self.source.on( 'volume', onVolume );
		
		function onVolume( current, overTime ) {
			self.handleVolume( current, overTime );
		}
	}
	
	ns.IsSpeaking.prototype.handleVolume = function( current, overTime ) {
		const self = this;
		if ( isOverLimit( current ) && ( !self.isSpeaking || self.notSpeakingTimeout )) {
			checkIsSpeaking( overTime );
			return;
		}
		
		if ( isUnderLimit( current ) && self.isSpeaking )
			checkIsNotSpeaking( overTime );
		
		function checkIsSpeaking( overTime ) {
			let req = self.speakingTicks;
			let len = overTime.length -1;
			if ( req > len )
				req = len;
			// check history for values over limit
			for( ; req-- ; ) {
				let val = overTime[ len - req ];
				if ( val < self.speakingLimit )
					return;
			}
			
			clearNotSpeaking();
			if ( self.isSpeaking )
				return;
			
			self.onSpeaking( true );
		}
		
		function checkIsNotSpeaking( overTime ) {
			let req = self.notSpeakingTicks;
			let len = overTime.length -1;
			if ( req > len )
				req = len;
			
			for ( ; req-- ; ) {
				let val = overTime[ len - req ];
				if ( val > self.notSpeakingLimit )
					return;
			}
			
			emitNotSpeaking();
		}
		
		function emitNotSpeaking() {
			if ( null != self.notSpeakingTimeout )
				return;
			
			self.notSpeakingTimeout = window.setTimeout( emit, self.notSpeakingWait );
			function emit() {
				if ( null == self.notSpeakingTimeout )
					return;
				
				self.notSpeakingTimeout = null;
				self.onSpeaking( false );
			}
		}
		
		function clearNotSpeaking() {
			if ( null == self.notSpeakingTimeout )
				return;
			
			window.clearTimeout( self.notSpeakingTimeout );
			self.notSpeakingTimeout = null;
		}
		
		function isOverLimit( volume ) {
			return volume > self.speakingLimit;
		}
		
		function isUnderLimit( volume ) {
			return volume < self.notSpeakingLimit;
		}
	}
	
	ns.IsSpeaking.prototype.releaseSource = function() {
		const self = this;
		if ( self.source )
			self.source.release( self.onVId );
		
		delete self.source;
	}
	
})( library.rtc );

// Volume
(function( ns, undefined ) {
	ns.Volume = function( mediaStream ) {
		const self = this;
		library.component.EventEmitter.call( self );
		self.stream = mediaStream;
		
		self.actx = null;
		self.volume = 0;
		self.volumeAverage = 0;
		self.timeBuffer = null;
		
		self.volumeHistory = new Array( 2 );
		self.volumeHistory.fill( 0 );
		
		self.averageOverTime = new Array( 30 );
		self.averageOverTime.fill( 0 );
		
		self.init();
	}
	
	ns.Volume.prototype =
		Object.create( library.component.EventEmitter.prototype );
	
	// Public
	
	ns.Volume.prototype.start = function() {
		const self = this;
		if ( self.loop )
			return;
		
		self.loop = true;
		self.animFrame = window.requestAnimationFrame( update );
		function update() {
			if ( !self.loop )
				return;
			
			self.analyser.getByteTimeDomainData( self.timeBuffer );
			setBuffer();
			setVolume();
			self.animFrame = window.requestAnimationFrame( update );
			
			function setBuffer() {
				setTimeout( emitBuffer, 0 );
				function emitBuffer() {
					self.emit( 'buffer', self.timeBuffer, self.volumeHistory );
				}
			}
			
			function setVolume() {
				let max = 0;
				let buf = self.timeBuffer;
				//console.log( 'buf', buf );
				// find max
				let i = ( buf.length );
				for( ; i-- ; ) {
					let val = buf[ i ];
					val = Math.abs( val - 128 );
					if ( max < val )
						max = val;
				}
				
				//
				updateAverageVolume( max );
				self.volume = max;
				setTimeout( emitVolume, 0 );
				
				function emitVolume() {
					//console.log( 'vavg', self.volumeAverage );
					self.emit( 'volume', self.volumeAverage, self.averageOverTime );
				}
			}
			
			function updateAverageVolume( current ) {
				let vh = self.volumeHistory.slice( 1 );
				vh.push( current );
				let total = 0;
				
				// sum
				let i = vh.length;
				for( ; i-- ; )
					total += vh[ i ];
				
				// round up
				const avg = ( total * 1.0 ) / vh.length;
				//console.log( 'avg', avg );
				// 
				self.volumeAverage = Math.ceil( avg );
				self.averageOverTime = self.averageOverTime.slice( 1 );
				self.averageOverTime.push( self.volumeAverage );
			}
		}
	}
	
	ns.Volume.prototype.stop = function() {
		const self = this;
		self.loop = false;
		if ( !self.animFrame )
			return;
		
		window.cancelAnimationFrame( self.animFrame );
		self.animFrame = null;
	}
	
	ns.Volume.prototype.eventRelease = ns.Volume.prototype.release;
	ns.Volume.prototype.release = function( eventId ) {
		const self = this;
		if ( self.actx )
			self.actx.close();
		
		if ( self.source )
			self.source.disconnect();
		
		delete self.actx;
		delete self.source;
		self.eventRelease( eventId );
	}
	
	ns.Volume.prototype.close = function() {
		const self = this;
		self.stop();
		self.release();
		
		delete self.analyser;
		delete self.stream;
		
		self.closeEventEmitter();
	}
	
	// Private
	
	ns.Volume.prototype.init = function() {
		const self = this;
		self.actx = new window.AudioContext();
		self.source = self.actx.createMediaStreamSource( self.stream );
		self.analyser = self.actx.createAnalyser();
		self.analyser.fftSize = 2048;
		self.analyser.minDecibels = -1000;
		const bufLen = self.analyser.frequencyBinCount;
		self.timeBuffer = new Uint8Array( bufLen );
		
		self.source.connect( self.analyser );
		/*
		console.log( 'analyser', {
			fftSize     : self.analyser.fftSize,
			minDecibels : self.analyser.minDecibels,
		});
		*/
		
		self.start();
	}
	
})( library.rtc );


// AudioInputDetect
/*
	CONSTRUCTOR RETURNS A PROMISE
*/
(function( ns, undefined ) {
	ns.AudioInputDetect = function( mediaStream ) {
		const self = this;
		self.mediaStream = mediaStream;
		
		self.maxTryTime = 1000 * 10;
		self.checking = true;
		
		return self.check();
	}
	
	// Pricate
	
	ns.AudioInputDetect.prototype.check = function() {
		const self = this;
		return new Promise(( resolve, reject ) => {
			if ( !self.mediaStream ) {
				reject( 'No stream, mate..' );
				return;
			}
			
			var aTracks = self.mediaStream.getAudioTracks();
			if ( !aTracks || !aTracks.length ) {
				reject( 'No audio track found in stream' );
				return;
			}
			
			new window.Promise( detectAudio )
				.then( resolve )
				.catch( reject );
		});
		
		function detectAudio( resolve, reject ) {
			if ( !window.AudioContext ) {
				console.log( 'AudioInputDetect - no window.AudioContext, returning',
					window.AudioContext );
				reject( 'ERR_NO_AUDIOCONTEXT' );
				return;
			}
			
			self.volume = new library.rtc.Volume( self.mediaStream );
			self.volume.on( 'volume', check );
			
			//self.interval = window.setInterval( check, self.sampleInterval );
			self.timeout = window.setTimeout( timeoutHit, self.maxTryTime );
			
			function check( max, avg ) {
				if ( !self.checking )
					return;
				
				if ( 0 == max )
					return;
				
				clear();
				resolve( true );
				
			}
			
			function timeoutHit() {
				if ( null == self.timeout )
					return;
				
				clear();
				resolve( false );
			}
			
			function clear() {
				delete self.checking;
				
				if ( self.volume ) {
					self.volume.release();
					self.volume.close();
					delete self.volume;
				}
				
				if ( null != self.timeout )
					window.clearTimeout( self.timeout );
				
				delete self.actx;
				delete self.mediaStream;
				delete self.interval;
				delete self.timeout;
			}
		}
	}
	
})( library.rtc );


/* screenShare
 // deprecated, in favor of using browser api
*/
(function( ns, undefined ) {
	ns.ScreenShare = function() {
		const self = this;
		self.requests = {};
		
		self.init();
	}
	
	ns.ScreenShare.prototype.getSourceId = function() {
		const self = this;
		return new Promise(( resolve, reject ) => {
			const getSource = {
				type : 'getSource',
				data : {
					sources : [ 'screen', 'window' ],
				},
			};
			self.sendToExt( getSource, sourceBack );
			function sourceBack( res ) {
				resolve( res );
			}
		});
	}
	
	ns.ScreenShare.prototype.connect = function() {
		const self = this;
		return new Promise(( resolve, reject ) => {
			self.connectCallback = connectBack;
			self.initInterval = window.setInterval( sendInit, 1500 );
			function sendInit() {
				if ( !self.initInterval )
					return;
				
				self.sendInit();
			}
			
			function connectBack( err, res ) {
				if ( self.initInterval ) {
					window.clearInterval( self.initInterval );
					delete self.initInterval;
				} else
					return;
				
				if ( err )
					reject( err );
				else
					resolve( res );
			}
		});
	}
	
	ns.ScreenShare.prototype.checkIsAvailable = function() {
		const self = this;
		return new Promise(( resolve, reject ) => {
			const checkAvailable = {
				type : 'ready',
			};
			self.sendToExt( checkAvailable, checkBack );
			self.availableTimeout = setTimeout( checkTimeout, 2000 );
			function checkBack( res ) {
				if ( !self.availableTimeout )
					return;
				
				clearTimeout( self.availableTimeout );
				delete self.availableTimeout;
				
				resolve( res );
			}
			
			function checkTimeout() {
				console.log( 'no reply from ext' );
				delete self.availableTimeout;
				resolve( false );
			}
		});
	}
	
	// private
	
	ns.ScreenShare.prototype.init = function() {
		const self = this;
		if ( !View ) {
			console.log( 'ScreenShare.init - no window.View, aborting' );
			return;
		}
		
		View.on( 'screen-share-extension', extEvent );
		function extEvent( e ) { self.handleExtEvent( e ); }
		
		self.sendInit();
	}
	
	ns.ScreenShare.prototype.sendInit = function() {
		const self = this;
		const init = {
			type : 'init',
			data : {
				origin        : View.parentOrigin,
				type          : 'view',
				method        : 'sendmessage',
				applicationId : View.applicationId,
				viewId        : View.id,
				data          : {
					type : 'screen-share-extension',
					data : {},
				},
			},
		};
		self.sendToExt( init, initBack );
		function initBack( res ) {
			if ( !self.connectCallback )
				return;
			
			self.connectCallback( null, true );
			delete self.connectCallback;
		}
	}
	
	ns.ScreenShare.prototype.handleExtEvent = function( res ) {
		const self = this;
		if ( !res )
			return;
		
		const handler = self.requests[ res.type ];
		if ( !handler ){
			console.log( 'ShareScreen.handleExtEvent - no handler for', res );
			return;
		}
		
		handler( res.data );
		
	}
	
	ns.ScreenShare.prototype.sendToExt = function( event, callback ) {
		const self = this;
		const reqId = friendUP.tool.uid( 'ext-req' );
		self.requests[ reqId ] = callback;
		const req = {
			type : reqId,
			data : event,
		};
		const extMsg = {
			type : 'robotunicorns',
			data : req,
		};
		window.parent.postMessage( extMsg, '*' );
	}
	
})( library.rtc );


// SESSION
(function( ns, undefined ) {
	ns.Session = function(
		type,
		isHost,
		signal,
		media,
		rtcConf,
		opts,
		peerName,
		browser
	) {
		const self = this;
		library.component.EventEmitter.call( self );
		
		opts = opts || {}
		self.type = type
		self.id = 'webrtc-' + self.type
		self.isHost = isHost || false
		self.signal = signal
		self.media = media
		self.rtc = rtcConf
		self.useDefaultCodec = opts.useDefaultCodec
		self.modifySDP = opts.modifySDP || null
		self.peerId = opts.peerId || null
		self.bundlePolicy = opts.bundlePolicy || null
		self.peerName = peerName || ''
		self.browser = browser || 'chrome'
		
		// peer connection, holder of streams
		self.conn = null
		self.state = 'nominal'
		self.senders = {}
		self.waiters = {
			add    : {},
			remove : {},
		};
		self.remoteTracks = {}
		//self.useOnTrack = false;
		//self.useOnStream = false;
		
		self.iceCandidates = []
		self.negotiationWaiting = false
		self.negotiationTimeout = null
		self.negotiationTimer = 1000 * 10
		self.denyNegotiation = false
		
		self.iceTimeoutMs = 1000 * 6
		
		self.statsCache = {}
		
		// data channels
		self.channels = {}
		
		// rtc specific logging ( automatic host / client prefix )
		self.spam = true
		
		self.log( 'Session', type )
		
		self.init()
	}
	
	ns.Session.prototype = Object.create( library.component.EventEmitter.prototype );
	
	// Public
	
	ns.Session.prototype.addTrack = function( kind ) {
		const self = this;
		const track = self.getSourceTrack( kind );
		if ( !self.checkReady()) {
			self.queueAdd( kind );
			return;
		}
		
		if ( !track )
			return 'ERR_NO_SOURCE_TRACK';
		
		if ( !self.conn )
			return 'ERR_NO_CONN';
		
		if ( self.senders[ kind ])
			return self.replaceTrack( kind );
		
		self.log( 'addTrack', track );
		const sender = self.conn.addTrack( track );
		self.senders[ kind ] = sender;
	}
	
	ns.Session.prototype.replaceTrack = function( kind ) {
		const self = this;
		if ( !self.checkReady()) {
			self.queueAdd( kind );
			return;
		}
		
		const track = self.getSourceTrack( kind );
		self.log( 'Session.replaceTrack', track );
		if ( !track )
			return 'ERR_NO_SOURCE_TRACK';
		
		if ( !self.conn )
			return 'ERR_NO_CONN';
		
		let sender = self.senders[ kind ];
		self.log( 'Session.replaceTrack - things', {
			track  : track,
			kind   : kind,
			sender : sender,
			ss     : self.senders,
		});
		if ( !sender )
			return 'ERR_NO_SENDER_OF_KIND';
		
		sender.replaceTrack( track )
			.then( ok )
			.catch( fail );
		
		function ok( e ) {
			self.log( 'Session.replaceTrack - ok', e );
		}
		
		function fail( err ) {
			self.log( 'Session.replaceTrack - fail', err );
		}
	}
	
	ns.Session.prototype.renegotiateTrack = function( kind ) {
		const self = this;
		self.log( 'Session.renegotiateTrack', kind );
		if ( !self.checkReady()) {
			self.queueRenegotiate( kind );
			return;
		}
		
		self.queueAdd( kind );
		self.removeTrack( kind );
		
		/*
		//self.addTrack( track );
		window.setTimeout( reAdd, 1000 );
		
		function reAdd() {
			self.log( 'reAdd' );
			self.addTrack( track );
		}
		*/
	}
	
	ns.Session.prototype.removeTrack = function( kind ) {
		const self = this;
		if ( !self.checkReady()) {
			self.queueRemove( kind );
			return;
		}
		
		if ( !self.conn )
			return 'ERR_NO_CONN';
		
		const sender = self.senders[ kind ];
		if ( !sender ) {
			self.log( 'removeTrack - no sender' );
			self.checkWaiters();
			return;
		}
		
		self.log( 'removeTrack', sender );
		self.conn.removeTrack( sender );
		delete self.senders[ kind ];
	}
	
	ns.Session.prototype.addStream = function( stream ) {
		const self = this;
		self.log( 'addStream', {
			stream : stream,
			conn   : self.conn, 
		});
		
		if ( !self.conn ) {
			self.log( 'addStream - OMG NO CONN DUDE; CHILL', {
				conn   : self.conn,
				stream : stream,
			});
			return;
		}
		
		self.switchingTracks = true;
		if ( !self.conn.addTrack ) {
			legacyAddStream( stream );
			done();
			return;
		}
		
		if ( self.senders.length )
			self.removeTracks();
		
		const tracks = stream.getTracks();
		self.log( 'addStream - tracks', { type : self.type, tracks : tracks });
		tracks.forEach( add );
		self.log( 'senders after adding tracks', self.senders );
		done();
		
		function add( track ) {
			const sender = self.conn.addTrack( track, stream );
			const params = sender.getParameters();
			self.senders.push( sender );
		}
		
		function legacyAddStream( stream ) {
			self.log( 'Session.legacyAddStream', stream );
			const localStreams = self.conn.getLocalStreams();
			if ( localStreams && localStreams.length ) {
				self.log( 'legacyAddStream - hasStream', {
					conn : self.conn,
					localStreams : localStreams,
				});
				localStreams.forEach( remove );
				function remove( stream ) {
					self.conn.removeStream( stream );
				}
			}
			
			self.conn.addStream( stream );
		}
		
		function done() {
			self.log( 'tracks update done, unlocking negotiation', 
				self.negotiationIsNeeded );
			
			self.switchingTracks = false;
			if ( self.negotiationIsNeeded )
				self.tryNegotiation();
		}
	}
	
	ns.Session.prototype.createDataChannel = function( deviceId, opts ) {
		const self = this;
		self.log( 'Session.createDataChannel' );
		if ( !deviceId )
			throw new Error( 'rtc.createDataChannel - no device id' );
		
		self.log( 'createDataChannel', deviceId );
		const conn = self.conn.createDataChannel( deviceId, opts );
		const channel = self.setDataChannel( conn );
		return channel;
	}
	
	ns.Session.prototype.closeDataChannel = function( deviceId ) {
		const self = this;
		const channel = self.channels[ deviceId ];
		self.log( 'closeDataChannel', deviceId );
		delete self.channels[ deviceId ];
		if ( !channel )
			return;
		
		channel.close();
	}
	
	ns.Session.prototype.getStats = function() {
		const self = this
		return new Promise(( ook, eek ) => {
			if ( null == self.conn ) {
				eek( 'ERR_NO_CONN' )
				return
			}
			
			/*
			if ( 'nominal' != self.state ) {
				eek( 'ERR_INVALID_STATE' )
				return
			}
			*/
			
			self.conn.getStats()
				.then( ook )
				.catch( eek )
			
		})
	}
	
	ns.Session.prototype.negotiate = function() {
		const self = this;
		self.log( 'negotiate' );
		self.tryNegotiation();
	}
	
	ns.Session.prototype.getRTCState = function() {
		const self = this;
		const state = {
			signal : self.conn ? self.conn.signalingState : '',
		};
		return state;
	}
	
	ns.Session.prototype.setDefaultCodec = function( useDefault ) {
		const self = this;
		self.log( 'setDefaultCodec', {
			use  : useDefault,
			curr : self.useDefaultCodec,
		});
		if ( !!useDefault === self.useDefaultCodec )
			return;
		
		self.useDefaultCodec = !!useDefault;
		if ( !self.senders.video )
			return;
		
		self.renegotiateTrack( 'video' );
	}
	
	ns.Session.prototype.close = function() {
		const self = this;
		self.log( 'session.close' );
		if ( null != self.negotiationNeededWaiting )
			window.clearTimeout( self.negotiationNeededWaiting )
		
		if ( null != self.iceTimeout )
			window.clearTimeout( self.iceTimeout )
		
		delete self.negotiationNeededWaiting;
		
		closeStats();
		self.removeTracks();
		self.setState( 'closed' );
		self.release(); // event listeners
		closeDataChannels();
		closeRTC();
		closeSignal();
		self.closeEventEmitter();
		
		delete self.media;
		delete self.modifySDP;
		delete self.rtc;
		delete self.type;
		delete self.isHost;
		
		function closeDataChannels() {
			for ( let deviceId in self.channels )
				self.closeDataChannel( deviceId );
		}
		
		function closeRTC() {
			if ( !self.conn )
				return;
			
			if ( 'closed' !== self.conn.signalingState )
				self.conn.close();
			
			self.clearConn();
			delete self.conn;
		}
		
		function closeSignal() {
			if ( !self.signal )
				return;
			
			self.signal.close();
			
			delete self.signal;
		}
		
		function closeStats() {
			if ( !self.stats )
				return;
			
			self.stats.close();
			delete self.stats;
		}
		
	}
	
	// Private
	
	ns.Session.prototype.stateTypeMap = {
		'routing'             : 'routing',
		'nominal'             : 'nominal',
		'host-negotiation'    : 'connecting',
		'client-negotiation'  : 'connecting',
		'negotiation-waiting' : 'waiting',
		'ICE-gathering'       : 'connecting',
		'ICE-checking'        : 'connecting',
		'ICE-disconnected'    : 'waiting',
		'ICE-failed'          : 'error',
		'closed'              : 'closed',
		'derp'                : 'error', // something lol'd
	};
	
	ns.Session.prototype.init = function() {
		const self = this;
		self.log( 'init - isHost', self.isHost );
		self.signal = new library.component.EventNode(
			self.id,
			self.signal,
			eventSink
		);
		
		self.signal.on( 'sdp', sdpReceived );
		self.signal.on( 'candidate', iceCandidateReceived );
		self.signal.on( 'negotiate', handleNegotiate );
		
		function sdpReceived( e ) { self.sdpReceived( e ); }
		function iceCandidateReceived( e ) { self.iceCandidateReceived( e ); }
		function handleNegotiate( e ) { self.handleNegotiate( e ); }
		
		function eventSink( type, data ) {
			self.log( 'unhandled signal event', {
				type : type,
				data : data,
			});
		}
		
		let peerConf = {
			iceServers   : self.rtc.ICE,
			sdpSemantics : 'unified-plan',
		};
		
		if ( self.peerId )
			peerConf.peerIdentity = self.peerId;
		
		if ( self.bundlePolicy )
			peerConf.bundlePolicy = self.bundlePolicy;
		
		window.rtcConf = peerConf;
		
		self.log( 'PeerConnection conf', peerConf );
		self.conn = new window.RTCPeerConnection( peerConf );
		self.conn.onconnectionstatechange = connStateChange;
		self.conn.ontrack = onTrack;
		self.conn.ondatachannel = dataChannel;
		self.conn.onicecandidate = iceCandidate;
		self.conn.oniceconnectionstatechange = iceConnectionChange;
		self.conn.onicegatheringstatechange = iceGatheringChange;
		self.conn.identityresult = identityResult;
		self.conn.onidpassertionerror = idpAssertionError;
		self.conn.onidpvalidationerror = idpValidationError;
		self.conn.onnegotiationneeded = negotiationNeeded;
		self.conn.onpeeridentity = peerIdentity;
		self.conn.onremovestream = streamRemoved;
		self.conn.onsignalingstatechange = signalStateChange;
		
		function connStateChange( e ) { self.connectionStateChange( e ); }
		function onTrack( e ) { self.trackAdded( e ); }
		function dataChannel( e ) { self.dataChannelAdded( e ); }
		function iceCandidate( e ) { self.iceCandidate( e ); }
		function iceConnectionChange( e ) { self.iceConnectionStateChange( e ); }
		function iceGatheringChange( e ) { self.iceGatheringStateChange( e ); }
		function identityResult( e ) { self.log( 'NYI - identityResult event', e ); }
		function idpAssertionError( e ) { self.log( 'NYI - idpAssertionError', e ); }
		function idpValidationError( e ) { self.log( 'NYI - idpValidationError', e ); }
		function negotiationNeeded( e ) { self.negotiationNeeded( e ); }
		function peerIdentity( e ) { self.log( 'NYI - peerIdentity event', e ); }
		function streamRemoved( e ) { self.streamRemoved( e ); }
		function signalStateChange( e ) { self.signalStateChange( e ); }
	}
	
	ns.Session.prototype.getSourceTrack = function( kind ) {
		const self = this;
		let track = null;
		if ( 'audio' === kind )
			track = self.media.getAudioTracks()[ 0 ];
		if ( 'video' === kind )
			track = self.media.getVideoTracks()[ 0 ];
		
		return track || null;
	}
	
	ns.Session.prototype.renegotiate = function() {
		const self = this;
		//return;
		self.log( 'Session.renegotiate - isHost', self.isHost );
		self.tryNegotiation();
	}
	
	ns.Session.prototype.connectionStateChange = function( e ) {
		const self = this;
		self.log( 'connectionStateChange', e );
		self.setState();
	}
	
	ns.Session.prototype.iceCandidate = function( e ) {
		const self = this;
		const cand = e.candidate;
		if ( self.iceTimeout )
			window.clearTimeout( self.iceTimeout );
		
		if ( self.iceComplete )
			return;
		
		const msg = {
			type : 'candidate',
			data : cand,
		};
		self.log( 'sending ice candidate', msg );
		self.signal.send( msg );
		
		if ( null == cand ) {
			self.iceComplete = true;
			return;
		}
		
		self.iceTimeout = window.setTimeout( sendNull, self.iceTimeoutMs );
		function sendNull() {
			self.log( 'iceTiemout hit, sending null' );
			let msg = {
				type : 'candidate',
				data : null,
			};
			self.signal.send( msg );
			self.iceComplete = true;
		}
	}
	
	ns.Session.prototype.iceConnectionStateChange = function( e ) {
		const self = this;
		self.log( 'iceConnectionStateChange', {
			iceConnState   : self.conn.iceConnectionState,
			iceGatherState : self.conn.iceGatheringState,
		});
		self.setState();
	}
	
	ns.Session.prototype.iceGatheringStateChange = function( e ) {
		const self = this;
		self.log( 'iceGatheringState', self.conn.iceGatheringState );
		self.setState();
	}
	
	ns.Session.prototype.negotiationNeeded = function( e ) {
		const self = this;
		self.log( 'negotiationNeeded', self.conn.signalingState );
		self.negotiationIsNeeded = true;
		if ( self.negotiationNeededWaiting )
			return;
		
		self.negotiationNeededWaiting = window.setTimeout( tryNegotiation, 250 );
		function tryNegotiation() {
			self.negotiationNeededWaiting = null;
			if ( !self.conn ) {
				self.log( 'negotiationNeeded - no conn, abort' );
				return;
			}
			
			self.tryNegotiation();
		}
	}
	
	ns.Session.prototype.tryNegotiation = function() {
		const self = this;
		self.log( 'tryNegotiation' );
		if ( self.switchingTracks ) {
			self.log( 'tryNegotiation - switcingTracks' );
			self.negotiationIsNeeded = true;
			return;
		}
		
		self.negotiationIsNeeded = false;
		self.setState( 'negotiation-waiting' );
		if ( self.conn.signalingState !== 'stable' ) {
			self.log( 'tryNego - not stable', self.connSignalingState );
			self.negotiationWaiting = true;
			return;
		}
		
		if ( !self.isHost ) {
			self.log( 'tryNego - not host' );
			self.requestNegotiation();
			return;
		}
		
		if ( self.negotiationTimeout ) {
			self.log( 'tryNego - negotiationTimeout' );
			return;
		}
		
		self.createOffer();
	}
	
	ns.Session.prototype.requestNegotiation = function() {
		const self = this;
		if ( self.negotiationDeniedTimeout ) {
			self.log( 'requestNegotiation - cancel, on denied timeout' );
			return;
		}
		
		var req = {
			type : 'negotiate',
			data : 'request',
		};
		self.log( 'requestNegotiation' );
		if ( !self.signal )
			return;
		
		self.signal.send( req );
	}
	
	ns.Session.prototype.negotiationAccepted = function() {
		const self = this;
		self.log( 'negotiation accepted, creating offer' );
		self.createOffer();
	}
	
	ns.Session.prototype.negotiationDenied = function() {
		const self = this;
		self.log( 'negotiation denied - retrying in a bit' );
		if ( self.negotiationDeniedTimeout ) {
			self.log( 'negotiationDenied - on timeout, abort' );
			return;
		}
		
		self.negotiationDeniedTimeout = window.setTimeout( retryNeg, 3000 );
		function retryNeg() {
			self.negotiationDeniedTimeout = null;
			self.requestNegotiation();
		}
	}
	
	ns.Session.prototype.createOffer = function() {
		const self = this;
		self.log( 'createOffer', self.conn.signalingState );
		self.negotiationWaiting = false;
		
		if ( self.isHost ) {
			self.denyNegotiation = true;
			self.setState( 'host-negotiation' );
		} else
			self.setState( 'client-negotiation' );
		
		self.conn.createOffer()
			.then( offerReady )
			.catch( offErr );
		function offerReady( offer ) {
			let sdp = null;
			if ( self.modifySDP )
				sdp = self.modifySDP( offer );
			else
				sdp = offer;
			
			self.setLocalDescription( sdp );
		}
		
		function offErr( err ) {
			self.log( 'createOfferErr', err );
		}
	}
	
	ns.Session.prototype.setLocalDescription = function( desc ) {
		const self = this;
		self.log( 'setLocalDescription - useDefaultCodec?', self.useDefaultCodec );
		if ( !self.useDefaultCodec ) {
			try {
				self.reorderCodecs( desc );
			} catch( ex ) {
				self.log( 'ex', ex );
			}
		}
		
		self.logSDP( desc, 'local' );
		self.conn.setLocalDescription( desc )
			.then( sendDesc )
			.catch( setLDErr );
		function sendDesc() {
			self.log( 'local description set', self.conn.signalingState );
			self.sendDescription();
		}
		function setLDErr( err ) {
			self.log( 'error setting local description', err );
		}
	}
	
	ns.Session.prototype.reorderCodecs = function( desc ) {
		const self = this;
		const lines = desc.sdp.split( '\n' );
		const mVideoRX = RegExp( 'm=video[^A-Z]+(\\s[\\/A-Z]+\\s)([\\s0-9]+)', '' );
		const codecRX = RegExp( 'a=rtpmap:([0-9]+)\\s(.*)\\/' );
		let mVideo = null;
		let mVideoLine = null;
		let mVideoProtocol = null;
		let mVideoCodecs = null;
		const codecIds = [];
		lines.some( findMVideo );
		findCodec( 'H264', lines );
		findCodec( 'VP9', lines );
		
		self.log( 'reorderCodecs, the things', {
			mVideo         : mVideo,
			mVideoLine     : mVideoLine,
			mVideoProtocol : mVideoProtocol,
			mVideoCodecs   : mVideoCodecs,
			codecIds       : codecIds,
		});
		
		if ( !codecIds.length ) {
			self.log( 'Session.reordercodec - no relevant codecs found' );
			return 
		}
		
		mVideoCodecs = reorder( mVideoCodecs, codecIds );
		const pre = mVideo.split( mVideoProtocol )[ 0 ];
		mVideo = [ pre, mVideoProtocol, mVideoCodecs ].join( '' );
		lines[ mVideoLine ] = mVideo;
		desc.sdp = lines.join( '\n' );
		
		function findMVideo( line, index ) {
			if ( !line )
				return false;
			
			const match = line.match( mVideoRX );
			if ( null == match )
				return false;
			
			mVideo = line;
			mVideoLine = index;
			mVideoProtocol = match[ 1 ];
			mVideoCodecs = match[ 2 ];
			return true;
		}
		
		function findCodec( str, lines ) {
			lines.forEach( line => {
				if ( !line )
					return;
				
				const match = line.match( codecRX );
				if ( !match )
					return;
				
				const codec = match[ 2 ];
				if ( str !== codec.toUpperCase())
					return;
				
				const codecId = match[ 1 ];
				codecIds.push( codecId );
			});
		}
		
		function reorder( current, toFront ) {
			let cIds = current.split( ' ' );
			cIds = cIds.filter( cId => {
				return !toFront.some( fId => fId === cId );
			});
			
			const reordered = toFront.concat( cIds );
			return reordered.join( ' ' );
		}
		
	}
	
	ns.Session.prototype.toggleSDPActivePassive = function( sdpObj ) {
		const self = this;
		self.log( 'toggleSDPActivePassive', sdpObj );
		var sdp = sdpObj.sdp;
		var match = sdp.match( /(a=setup:(active))|(a=setup:(passive))/ );
		self.log( 'active:passive', match );
		if ( match[ 2 ]) // active matched
			sdp = replace( sdp, 'active', 'passive' );
		else
			sdp = replace( sdp, 'passive', 'active' );
		
		sdpObj.sdp = sdp;
		return sdpObj;
		
		function replace( sdp, replace, withThis ) {
			var base = 'a=setup:';
			replace = base + replace;
			withThis = base + withThis;
			self.log( 'replaceing', { r : replace, w : withThis });
			return sdp.replace( replace, withThis );
		}
	}
	
	ns.Session.prototype.logSDP = function( sdp, side ) {
		const self = this;
		if ( 'local' !== side  ) {
			var localSdp = self.conn.localDescription;
			if ( localSdp && !!localSdp.type )
				self.logSDP( localSdp, 'local' );
		}
		
		if ( !sdp || !sdp.sdp )
			return;
		
		/*
		var match = sdp.sdp.match( /a=setup:.*    / );
		var asetup = '';
		if ( match )
			asetup = match[ 0 ];
		*/
		
		let tracks = getTracks( sdp.sdp );
		self.log( 'SDP', { 
			'side'         : side,
			'signal state' : self.conn.signalingState,
			//'a=setup:'     : asetup,
			'sdp'          : sdp.sdp,
			'type'         : sdp.type,
			'tracks'       : tracks,
		});
		
		function getTracks( sdp ) {
			const tracks = [];
			const aM = sdp.match( /(.*m=audio.*)/ );
			const vM = sdp.match( /(.*m=video.*)/ );
			if ( aM )
				tracks.push( aM[ 0 ]);
			if ( vM )
				tracks.push( vM[ 0 ]);
			
			return tracks;
		}
	}
	
	ns.Session.prototype.sendDescription = function() {
		const self = this;
		self.log( 'sendDescription', self.conn.signalingState );
		if ( self.inOfferProcess ) {
			self.log( 'inOfferProcess.true - not sending SDP', self.conn.signalingState );
			return;
		}
		
		if ( 'have-local-offer' === self.conn.signalingState )
			self.inOfferProcess = true;
		
		const desc = {
			type : 'sdp',
			data : self.conn.localDescription,
		};
		self.log( 'sendDescription - sending', desc );
		self.signal.send( desc );
	}
	
	ns.Session.prototype.sdpReceived = function( sdp ) {
		const self = this;
		self.log( 'sdpReceived', sdp );
		if ( sdp.type === 'offer' ) {
			self.handleRemoteOffer( sdp );
			return;
		}
		
		if (( sdp.type === 'answer' ) || ( sdp.type === 'pranswer' )) {
			self.handleRemoteAnswer( sdp );
			return;
		}
		
		self.log( 'unhandled sdp type', sdp );
	}
	
	ns.Session.prototype.handleRemoteOffer = function( sdp ) {
		const self = this;
		self.logSDP( sdp, 'remote offer' );
		if (
			!(( self.conn.signalingState === 'stable' )
			|| ( self.conn.signalingState === 'have-remote-offer' ))
		) {
			self.log( 'handleRemoteOffer - signaling not in a receptive state',
				{ t : sdp.type, s : self.conn.signalingState });
			return;
			
			// possibly do rollback here when ( if ) its supported by the browser
		}
		
		var remoteOffer = new window.RTCSessionDescription( sdp );
		self.conn.setRemoteDescription( remoteOffer )
			.then( createAnswer )
			.catch( err );
			
		function createAnswer() {
			self.log( 'remote offer set', remoteOffer );
			if ( self.negotiationTimeout ) {
				self.log( 'clear neg timeout' );
				window.clearTimeout( self.negotiationTimeout );
				self.negotiationTimeout = null;
			}
			
			self.emitRouting();
			self.createAnswer();
		}
		
		function err( e ) {
			self.log( 'remoteOffer err', e );
			self.emit( 'error', e );
		}
	}
	
	ns.Session.prototype.handleRemoteAnswer = function( sdp ) {
		const self = this;
		const state = self.conn.signalingState;
		self.logSDP( sdp, 'remote answer' );
		if (
			!(( state === 'have-local-offer' )
			|| ( state === 'have-remote-pranswer'))
		) {
			self.log( 'handleRemoteAnswer - signaling not in a receptive state',
				{ t : sdp.type, s : self.conn.signalingState });
			return;
			
			// possibly do rollback here when its supported by the browser
		}
		
		self.inOfferProcess = false;
		const remoteAnswer = new window.RTCSessionDescription( sdp );
		self.conn.setRemoteDescription( remoteAnswer )
			.then( yep )
			.catch( nope );
		
		function yep( res ) {
			self.log( 'handleRemoteAnswer - remote answer set', res );
			self.emitRouting();
			if ( self.isHost )
				self.denyNegotiation = false;
			
		}
		
		function nope( err ) {
			self.log( 'error setting remote SDP answer: ', err );
			const errTest = 'DOMException: Failed to set remote answer sdp:'
			+ ' Failed to push down transport description:'
			+ ' Failed to set ssl role for the channel.';
			
			if ( errTest === err ) {
				sdp = self.toggleSDPActivePassive( sdp );
				self.handleRemoteAnswer( sdp );
			} else {
				self.emit( 'error', err );
			}
		}
	}
	
	ns.Session.prototype.rollbackSignalingState = function() {
		const self = this;
		const opt = {
			type : 'rollback',
			sdp : null,
		};
		
		const rollback = new window.RTCSessionDescription();
		rollback.type = 'rollback';
		self.conn.setLocalDescription( rollback )
			.then( goodie )
			.catch( oopsie );
		
		function goodie() {
			self.log( 'rollback done' );
		}
		
		function oopsie( err ) {
			self.log( 'trollback failed', err );
		}
	}
	
	ns.Session.prototype.createAnswer = function() {
		const self = this;
		self.log( 'createAnwer' );
		self.conn.createAnswer()
			.then( success )
			.catch( err );
		
		function success( reply ) {
			self.log( 'answer created', reply );
			let sdp = null;
			if ( self.modifySDP )
				sdp = self.modifySDP( reply );
			else
				sdp = reply;
			
			self.setLocalDescription( sdp );
		}
		
		function err(  e ) {
			self.log( 'create answer err', e );
		}
	}
	
	ns.Session.prototype.iceCandidateReceived = function( candidate ) {
		const self = this;
		self.log( 'iceCandidateReceived', candidate );
		if ( !candidate ) {
			self.log( 'iceCandidateReceived - null candidate'
			 + '- other side is done sending', candidate );
			return;
		}
		const ICECandidate = new window.RTCIceCandidate( candidate );
		self.conn.addIceCandidate( ICECandidate )
			.then( iceCandidateAdded )
			.catch( addIceCandidateErr );
		
		function iceCandidateAdded() {
			//self.log( 'iceCandidateAdded' );
		}
		
		function addIceCandidateErr( err ) {
			self.log( 'add ice candidate err', err );
		}
	}
	
	ns.Session.prototype.handleNegotiate = function( data ) {
		const self = this;
		self.log( 'handleNegotiate', data );
		if ( data === 'request' ) {
			self.answerNegotiation();
			return;
		}
		
		if ( data === 'accept' ) {
			self.negotiationAccepted();
			return;
		}
		
		if ( data === 'deny' ) {
			self.negotiationDenied();
			return;
		}
		
		self.log( 'unknown negotiation event', data );
	}
	
	ns.Session.prototype.answerNegotiation = function() {
		const self = this;
		if ( allowNegotiation() )
			accept();
		else
			deny();
		
		function accept() {
			self.log( 'accept client negotiation', {
				timeout : self.negotiationTimeout,
				timer   : self.negotiationTimer
			});
			
			self.setState( 'client-negotiation' );
			self.negotiationTimeout = window.setTimeout( clear, self.negotiationTimer );
			send( 'accept' );
			function clear() {
				self.negotiationTimeout = null;
				self.log( 'negotiation timeout cleared', self.negotiationTimeout );
				self.setState();
			}
		}
		
		function deny() {
			self.log( 'deny client negotiation' );
			send( 'deny' );
		}
		
		function send( answer ) {
			var res = {
				type : 'negotiate',
				data : answer,
			};
			self.signal.send( res );
		}
		
		function allowNegotiation() {
			self.log( 'allowNegotiation', {
				state   : self.conn.signalingState,
				timeout : self.negotiationTimeout,
				deny    : self.denyNegotiation,
				timer   : self.negotiationTimer,
			});
			return (( self.conn.signalingState === 'stable' ) &&
				!self.negotiationTimeout &&
				!self.denyNegotiation );
		}
	}
	
	ns.Session.prototype.trackAdded = function( data ) {
		const self = this;
		self.log( 'trackAdded', data );
		/*
		if ( self.useOnStream )
			return;
		*/
		const track = data.track;
		if ( self.stats )
			self.stats.trackAdded( track );
		
		//self.useOnTrack = true;
		self.log( 'emitTrack', { type : self.type, track : track });
		const tId = track.id;
		const type = track.kind;
		self.remoteTracks[ type ] = tId;
		self.emit( 'track-add', track );
		track.onended = onEnded;
		track.addEventListener( 'ended', onEnded );
		
		function onEnded( e ) {
			self.log( 'track ended', {
				track : track,
				e     : e,
			});
			self.handleTrackEnded( e, track );
			
		}
	}
	
	ns.Session.prototype.handleTrackEnded = function( e, track ) {
		const self = this;
		self.log( 'handleTrackEnded', {
			e : e,
			t : track,
		});
		if ( self.stats )
			self.stats.trackRemoved( track );
		
		const type = track.kind;
		self.emit( 'track-remove', type );
	}
	
	ns.Session.prototype.emitStream = function( stream ) {
		const self = this;
		self.log( 'emitStream', stream );
		self.emit( 'stream', stream );
	}
	
	ns.Session.prototype.emitRouting = function() {
		const self = this;
		const routing = self.getRouting();
		self.emitState( 'routing', routing );
	}
	
	ns.Session.prototype.getRouting = function() {
		const self = this;
		if ( !self.conn || !self.conn.localDescription )
			return 'no conn';
		
		const sdp = self.conn.localDescription.sdp;
		if ( !sdp || !sdp.length ) {
			self.log( 'sdp not set?', self.conn.localDescription );
			return 'no SDP';
		}
		
		const parts = sdp.split( '\n' );
		const cLine = parts.find( isCLine );
		const conns = getConns( parts );
		const connType = getConnectionType( cLine, conns );
		return connType;
		
		function isCLine( part ) {
			return 0 === part.indexOf( 'c=' );
		}
		
		function getConns( parts ) {
			const connMap = {};
			parts.some( isNewConnOpt );
			return connMap;
			
			function isNewConnOpt( line ) {
				if( 0 !== line.indexOf( 'a=candidate' ))
					return false;
				
				let parts = line.split( ' ' );
				let ip = parts.find( IP );
				if ( connMap[ ip ])
					return true;
				
				let proto = parts.find( TCPOrUDP );
				let type = getType( parts );
				connMap[ ip ] = {
					protocol : proto,
					ip       : ip,
					type     : type,
				};
				
				return false;
				
				function TCPOrUDP( part ) {
					return (( 'udp' === part ) || ( 'tcp' === part ));
				}
				
				function IP( part ) {
					let rx = [
						'(([\\da-f]{1,4}:){7}[\\da-f]{1,4})', //           1:2:3:4:5:6:7:8  
						'(([\\da-f]{1,4}:){1,7}:)', //                     1::                              1:2:3:4:5:6:7::
						'(([\\da-f]{1,4}:){1,6}:[\\da-f]{1,4})', //        1::8                             1:2:3:4:5:6::8
						'(([\\da-f]{1,4}:){1,5}(:[\\da-f]{1,4}){1,2})', // 1::7:8           1:2:3:4:5::7:8  1:2:3:4:5::8
						'(([\\da-f]{1,4}:){1,4}(:[\\da-f]{1,4}){1,3})', // 1::6:7:8         1:2:3:4::6:7:8  1:2:3:4::8
						'(([\\da-f]{1,4}:){1,3}(:[\\da-f]{1,4}){1,4})', // 1::5:6:7:8       1:2:3::5:6:7:8  1:2:3::8
						'(([\\da-f]{1,4}:){1,2}(:[\\da-f]{1,4}){1,5})', // 1::4:5:6:7:8     1:2::4:5:6:7:8  1:2::8
						'([\\da-f]{1,4}:(:[\\da-f]{1,4}){1,6})', //        1::3:4:5:6:7:8                   1::8
						'(:(:[\\da-f]{1,4}){1,7})', //                     ::2:3:4:5:6:7:8                  ::8
					];
					rx = '^' + rx.join( '|' ) + '$';
					const ipv6rx = RegExp( rx, 'i' );
					let ip = IPv4( part ) || IPv6( part ) || false;
					if ( !ip )
						return ip;
					
					return String( ip.trim());
					
					function IPv4( part ) {
						const match = part.match( /^(\d{1,3}\.){3}\d{1,3}$/ );
						if ( match )
							return match.input;
						
						return false;
					}
					
					function IPv6( part ) {
						const match = part.match( ipv6rx );
						if ( match )
							return match[ 0 ];
						
						return false;
					}
				}
				
				function getType( parts ) {
					let typIdx = parts.indexOf( 'typ' );
					if ( -1 === typIdx )
						return null;
					
					let type = parts[ typIdx + 1 ];
					if ( 'host' === type )
						return 'peer-to-peer';
					if ( 'relay' === type )
						return 'TURN relay';
					
					return type || null;
				}
			}
		}
		
		function getConnectionType( cLine, conns ) {
			const ip = findIP( cLine );
			const conn = conns[ ip ];
			if ( '0.0.0.0' === ip )
				return 'passive';
			
			if ( !conn )
				return 'local peer-to-peer';
			
			return conn.type + ' / ' + conn.protocol;
			
			function findIP( cLine ) {
				let parts = cLine.split( ' ' );
				return String( parts[ 2 ].trim());
			}
		}
	}
	
	ns.Session.prototype.streamRemoved = function( stream ) {
		const self = this;
		self.log( 'streamRemoved', stream );
		var local = self.conn.getLocalStreams();
		var remote = self.conn.getRemoteStreams();
		self.log( 'streamRemoved', {
			s : stream,
			l : local,
			r : remote,
		});
	}
	
	ns.Session.prototype.noStream = function() {
		const self = this;
		self.log( 'conn.noStream' );
		self.emit( 'nostream' );
	}
	
	ns.Session.prototype.dataChannelAdded = function( e ) {
		const self = this;
		self.log( 'datachannelAdded', e );
		const conn = e.channel;
		const channel = self.setDataChannel( conn );
		self.emit( 'datachannel', channel );
	}
	
	ns.Session.prototype.setDataChannel = function( conn ) {
		const self = this;
		self.log( 'setDataChannel', conn );
		const channel = new library.rtc.DataChannel( conn, onClose, eventSink );
		self.channels[ conn.deviceId ] = channel;
		return channel;
		
		function onClose( e ) {
			self.log( 'datachannel closed', conn.deviceId );
			delete self.channels[ conn.deviceId ];
		}
		
		function eventSink() {
			self.log( 'datachannel eventsink', arguments );
		}
	}
	
	ns.Session.prototype.signalStateChange = function( e ) {
		const self = this;
		self.log( 'signalStateChange', self.conn.signalingState );
		self.setState();
		if ( 'stable' !== self.conn.signalingState ) {
			return;
		}
		
		if ( self.negotiationWaiting )
			self.tryNegotiation();
	}
	
	ns.Session.prototype.getState = function() {
		const self = this;
		const iceConn = nominalize( self.conn.iceConnectionState, 'ICE' );
		const iceGather = nominalize( self.conn.iceGatheringState, 'ICE' );
		const signal = nominalize( self.conn.signalingState, 'conn' );
		
		self.log( 'getState', {
			iceConn   : self.conn.iceConnectionState,
			iceGather : self.conn.iceGatheringState,
			signal    : self.conn.signalingState,
		});
		
		if ( 'nominal' !== iceConn )
			return iceConn;
		
		if ( 'nominal' !== iceGather )
			return iceGather;
		
		return signal;
		
		function nominalize( state, prefix ) {
			if (( 'stable' === state )
				|| ( 'connected' === state )
				|| ( 'complete' === state )
				|| ( 'completed' === state )
			) return 'nominal';
			
			if ( prefix )
				return prefix + '-' + state;
			
			return state;
		}
	}
	
	ns.Session.prototype.setState = function( state, data ) {
		const self = this;
		self.log( 'setState', state );
		if ( !self.conn )
			state = 'closed';
		
		if ( !state )
			state = self.getState();
		
		let type = self.stateTypeMap[ state ];
		if ( !type ) {
			self.log( 'setState - no type found for', { s : state, valid : self.stateTypeMap });
			type = 'waiting';
		}
		
		if (   self.negotiationWaiting 
			|| self.negotiationIsNeeded
			|| self.negotiationTimeout
			|| self.negotiationDeniedTimeout ) {
			type = 'waiting';
		}
		
		if ( self.state === type )
			return;
		
		self.state = type;
		
		self.emitState( type, data );
		if ( 'nominal' === self.state )
			self.checkWaiters();
		//self.emit( 'state', stateEvent );
	}
	
	ns.Session.prototype.emitState = function( type, data ) {
		const self = this;
		data = data || null;
		const stateEvent = {
			type : type,
			data : {
				state : type,
				data : data,
			},
		};
		
		self.emit( 'state', stateEvent );
	}
	
	ns.Session.prototype.checkReady = function() {
		const self = this;
		const isReady = ( 'nominal' === self.state );
		self.log( 'checkReady', isReady );
		return isReady;
	}
	
	ns.Session.prototype.checkWaiters = function() {
		const self = this;
		self.log( 'checkWaiters', {
			state   : self.state,
			waiters : self.waiters,
		});
		
		const rm = self.waiters.remove;
		if ( rm.audio || rm.video ) {
			if ( rm.audio ) {
				rm.audio = false;
				self.removeTrack( 'audio' );
			}
			if ( rm.video ) {
				rm.video = false;
				self.removeTrack( 'video' );
			}
			
			return;
		}
		
		const add = self.waiters.add;
		if ( add.audio ) {
			add.audio = false;
			self.addTrack( 'audio' );
		}
		if ( add.video ) {
			add.video = false;
			self.addTrack( 'video' );
		}
	}
	
	ns.Session.prototype.queueAdd = function( kind ) {
		const self = this;
		self.log( 'sess.queueAdd', kind );
		self.waiters.add[ kind ] = true;
	}
	
	ns.Session.prototype.queueRenegotiate = function( kind ) {
		const self = this;
		self.log( 'queueRenegottiate', kind  );
		self.queueRemove( kind );
		self.queueAdd( kind );
	}
	
	ns.Session.prototype.queueRemove = function( kind ) {
		const self = this;
		self.log( 'Sess.queueRemove', kind );
		self.waiters.remove[ kind ] = true;
	}
	
	ns.Session.prototype.removeTracks = function() {
		const self = this;
		self.log( 'removeTracks', self.senders );
		const ids = Object.keys( self.senders );
		ids.forEach( remove );
		self.senders = {};
		function remove( sId ) {
			const sender = self.senders[ sId ];
			self.log( 'removeing tracks', sender );
			self.conn.removeTrack( sender );
		}
	}
	
	ns.Session.prototype.clearConn = function() {
		const self = this;
		if ( !self.conn )
			return;
		
		self.conn.onconnectionstatechange = null;
		self.conn.ontrack = null;
		self.conn.ondatachannel = null;
		self.conn.onicecandidate = null;
		self.conn.oniceconnectionstatechange = null;
		self.conn.onicegatheringstatechange = null;
		self.conn.identityresult = null;
		self.conn.onidpassertionerror = null;
		self.conn.onidpvalidationerror = null;
		self.conn.onnegotiationneeded = null;
		self.conn.onpeeridentity = null;
		self.conn.onremovestream = null;
		self.conn.onsignalingstatechange = null;
	}
	
	ns.Session.prototype.log = function( string, value ) {
		const self = this;
		if ( !self.spam )
			return;
		
		if ( self.peerName )
			string = self.peerName + ': ' + string;
		
		if ( self.isHost )
			string = 'rtc.host : ' + string;
		else
			string = 'rtc.client : ' + string;
		
		const time = new window.Date();
		let sec = time.getSeconds();
		let ms = time.getMilliseconds();
		sec = pad( sec, 2 );
		ms = pad( ms, 3 );
		string = ':' + sec + '.' + ms + ' ' + string;
		console.log( string, value );
		
		function pad( str, len ) {
			str = str.toString();
			len = len || 2;
			const pd = 3 - str.length;
			if ( !pd )
				return str;
			
			const arr = new Array( pd );
			arr.push( str );
			return arr.join( '0' );
		}
	}
	
	ns.Session.prototype.err = function( source, e ) {
		const self = this;
		console.log( source, {
			error : e,
			host : self.isHost.toString(),
		});
	}
	
})( library.rtc );

(function( ns, undefined ) {
	ns.DataChannel = function(
		conn,
		onClose,
		eventSink
	) {
		const self = this;
		self.id = conn.deviceId;
		self.conn = conn;
		self.onclose = onClose;
		
		library.component.EventEmitter.call( self, eventSink );
		
		self.isOpen = false;
		self.eventQueue = [];
		
		self.init();
	}
	
	ns.DataChannel.prototype = Object.create( library.component.EventEmitter.prototype );
	
	// Public
	
	ns.DataChannel.prototype.send = function( event ) {
		const self = this;
		const wrap = {
			type : 'event',
			data : event,
		};
		self.sendOnChannel( wrap );
	}
	
	ns.DataChannel.prototype.close = function() {
		const self = this;
		self.unbind();
		self.closeEventEmitter();
		if ( self.conn ) {
			try {
				self.conn.close();
			} catch( e ) {
				console.log( 'dataChannel.close exep', e );
			}
		}
		
		delete self.conn;
		delete self.onclose;
	}
	
	// Private
	
	ns.DataChannel.prototype.init = function() {
		const self = this;
		self.conn.onopen = onOpen;
		self.conn.onerror = onError;
		self.conn.onmessage = onMessage;
		self.conn.onclose = onClose;
		
		function onOpen( e ) {
			self.isOpen = true;
			self.eventQueue.forEach( send )
			function send( event ) {
				self.sendOnChannel( event );
			}
		}
		
		function onError( e ) { console.log( 'DataChannel.onError', e ); }
		function onMessage( e ) { self.handleMessage( e ); }
		function onClose( e ) {
			self.isOpen = false;
			
			let onclose = self.onclose;
			delete self.onclose;
			self.close();
			
			if ( !onclose )
				return;
			onclose( Date.now( ));
		}
	}
	
	ns.DataChannel.prototype.unbind = function() {
		const self = this;
		if ( !self.conn )
			return;
		
		self.conn.onopen = null;
		self.conn.onerror = null;
		self.conn.onmessage = null;
		self.conn.onclose = null;
	}
	
	ns.DataChannel.prototype.handleMessage = function( e ) {
		const self = this;
		const event = friendUP.tool.objectify( e.data );
		if ( !event )
			return;
		
		const type = event.type;
		const data = event.data;
		if ( 'event' === type )
			self.emit( data.type, data.data );
		else
			console.log( 'unknown datachannel message', event );
	}
	
	ns.DataChannel.prototype.sendOnChannel = function( event ) {
		const self = this;
		if ( !self.isOpen ){
			console.log( 'DataChannel.send - not open' );
			self.eventQueue.push( event );
			return;
		}
		
		if ( !self.conn ) {
			console.log( 'DataChannel.send - no conn' );
			return; // closed
		}
		
		if ( 'open' !== self.conn.readyState ) {
			console.log( 'DataChannel.send - invalid readystate', self.conn.readyState );
			self.eventQueue.push( event );
			return;
		}
		
		const str = friendUP.tool.stringify( event );
		self.conn.send( str );
	}
	
})( library.rtc );

(function( ns, undefined ) {
	ns.RTCStats = function( browser, label ) {
		const self = this
		self.browser = browser
		self.label = label
		
		self.rtcConn = null
		self.baseRate = 1000
		self.extendedRate = 1000 * 4
		self.extendedChecked = false
		self.statsCache = {}
		
		library.component.EventEmitter.call( self )
		
		self.spam = true
		
		self.init()
	}
	
	ns.RTCStats.prototype = Object.create( library.component.EventEmitter.prototype )
	
	// Public
	
	ns.RTCStats.prototype.setRate = function( rate ) {
		const self = this
		if ( null == rate )
			self.baseRate = 1000
		else
			self.baseRate = rate
		
		self.setPollers()
	}
	
	ns.RTCStats.prototype.resume = function() {
		
	}
	
	ns.RTCStats.prototype.stop = function() {
		const self = this
		self.log( 'stop' )
		self.clearPollers()
	}
	
	ns.RTCStats.prototype.trackAdded = function( track ) {
		const self = this;
		self.log( 'trackAdded', track )
		const id = track.id
		const k = track.kind
		if ( 'audio' == k ) {
			self.aId = null
			self.aDiscover = track
		}
		if ( 'video' == k ) {
			self.vId = null
			self.vDiscover = track
		}
		
		self.discoverTrack( id )
	}
	
	ns.RTCStats.prototype.trackRemoved = function( type ) {
		const self = this;
		self.log( 'trackRemoved', type )
		if ( 'audio' == type ) {
			self.aId = null
			self.aDiscover = null
		}
		
		if ( 'video' == type ) {
			self.vId = null
			self.vDiscover = null
		}
	}
	
	ns.RTCStats.prototype.updateSource = function( webRTCSession ) {
		const self = this;
		self.log( 'updateSource', webRTCSession )
		if ( null == webRTCSession ) {
			self.rtcConn = null;
			self.stop();
			return;
		}
		
		self.rtcConn = webRTCSession;
		self.setPollers();
	}
	
	ns.RTCStats.prototype.updateState = function( state ) {
		const self = this;
		self.state = state;
	}
	
	ns.RTCStats.prototype.close = function() {
		const self = this;
		self.clearPollers();
		self.closeEventEmitter();
		delete self.browser;
		delete self.rtcConn;
	}
	
	// Private
	
	ns.RTCStats.prototype.init = function() {
		const self = this;
	}
	
	ns.RTCStats.prototype.log = function( ...args ) {
		const self = this
		if ( !self.spam )
			return
		
		let desc = args.shift()
		desc = 'RTCStats > ' + desc
		if ( null != self.label )
			desc = self.label + ' ' + desc
		
		//self.spam.log( desc, ...args )
		console.log( desc, ...args )
	}
	
	ns.RTCStats.prototype.setPollers = function() {
		const self = this;
		self.log( 'setPollers' )
		self.clearPollers();
		
		self.baseInterval = window.setInterval( getStats, self.baseRate );
		function getStats() {
			self.getStats();
		}
		
		self.extendedInterval = window.setInterval( checkExt, self.extendedRate );
		function checkExt() {
			self.extendedChecked = false;
		}
	}
	
	ns.RTCStats.prototype.clearPollers = function() {
		const self = this;
		if ( null == self.baseInterval && null == self.extendedInterval )
			return
		
		self.log( 'clearPollers' )
		if ( null != self.baseInterval ) {
			window.clearInterval( self.baseInterval )
			delete self.baseInterval
		}
		
		if ( null != self.extendedInterval ) {
			window.clearInterval( self.extendedInterval )
			delete self.extendedInterval
		}
	}
	
	ns.RTCStats.prototype.getStats = async function() {
		const self = this;
		if ( !self.rtcConn )
			return;
		
		let raw = null
		try {
			raw = await self.rtcConn.getStats()
		} catch( ex ) {
			self.log( 'getStats ex', ex )
			self.emitError( 'ERR_INVALID_STATE' )
		}
		
		self.raw = raw
		self.emitBase()
		if ( self.extendedChecked )
			return
		
		self.emitExtended()
	}
	
	ns.RTCStats.prototype.emitError = function( err ) {
		const self = this
		self.emit( 'error', { 
			error : err,
		})
	}
	
	ns.RTCStats.prototype.emitBase = function() {
		const self = this;
		if ( null == self.raw )
			return;
		
		let tracks = null
		let vT = null;
		let aT = null;
		if ( null == self.aId ) {
			if ( self.aDiscover )
				aT = self.discoverTrack( self.aDiscover.id );
		}
		else {
			aT = get( self.aId )
		}
		
		if ( null == self.vId ) {
			if ( self.vDiscover )
				vT = self.discoverTrack( self.vDiscover.id );
		}
		else
			vT = get( self.vId )
		
		let audio = null;
		let video = null;
		
		self.log( 'emitbase sources', {
			tracks : tracks,
			aId : self.aId,
			aT  : aT,
			vId : self.vId,
			vT  : vT,
		})
		
		if ( null != aT ) {
			audio = {
				level : aT.audioLevel,
			};
		}
		
		if ( null != vT ) {
			video = {
				height : vT.frameHeight,
				width  : vT.frameWidth,
			};
		}
		const base = {
			audio : audio,
			video : video,
		};
		
		/*
		if ( null == audio && null == video ) {
			self.log( 'emitBase nulls', {
				aId    : self.aId,
				aDisc  : self.aDiscover,
				vId    : self.vId,
				vDisc  : self.vDiscover,
				//tracks : self.raw.filter( item => item.type == 'track' ),
			})
		} else
			self.log( 'emitBase', base )
		*/
		
		self.emit( 'base', base )
		
		function get( tId ) {
			if ( null == tracks ) {
				tracks = []
				self.raw.forEach( item => {
					if ( 'track' != item.type )
						return null
					
					if ( !item.remoteSource )
						return null
				
					tracks.push( item )
				})
			}
			let track = null
			tracks.some( t => {
				if ( tId != t.trackIdentifier )
					return false
				
				track = t
				return true
			})
			
			return track
		}
	}
	
	ns.RTCStats.prototype.discoverTrack = function( id ) {
		const self = this;
		self.log( 'discoverTrack', id, ( null != self.raw ))
		if ( null == self.raw )
			return
		
		let track = null
		let type = null
		const tracks = []
		self.raw.forEach( t => {
			if ( 'track' != t.type )
				return;
			
			tracks.push( t )
			if ( !t.remoteSource )
				return;
			
			const tId = t.trackIdentifier
			if ( tId != id )
				return
			
			track = t
			type = t.kind
		})
		
		if ( !track ) {
			self.log( 'discoverTrack - no track found for', {
				id     : id,
				tracks : tracks,
			})
			return null
		}
		
		if ( 'audio' == type ) {
			self.aId = track.trackIdentifier || track.id
			self.aDiscover = null
		}
		
		if ( 'video' == type ) {
			self.vId = track.trackIdentifier || track.id
			self.vDiscover = null
		}
		
		self.log( 'discoverTrack - track', track )
		return track
	}
	
	ns.RTCStats.prototype.emitExtended = function() {
		const self = this;
		if ( !self.raw )
			return
		
		self.log( 'emitExtended - look for', {
			a : self.aId,
			v : self.vId,
			aD : self.aDiscover,
			vD : self.aDiscover,
		})
		
		self.extendedChecked = true
		const stats = self.raw
		const byType = {}
		const byId = {}
		stats.forEach( item => { 
			const type = item.type
			const id = item.id
			let tId = null
			if ( 'track' == type )
				tId = item.trackIdentifier
			
			if ( null == byType[ type ])
				byType[ type ] = []
			
			byType[ type ].push( item )
			
			if ( null != id )
				byId[ id ] = item
			if ( null != tId )
				byId[ tId ] = item
		})
		
		self.log( 'byId', byId )
		self.log( 'byType', byType )
		const res = {};
		const inn = byType[ 'inbound-rtp' ]
		const out = byType[ 'outbound-rtp' ]
		let multiAudio = false
		let WHNotSet = false
		let aT = false
		
		res.inbound = buildInnieStats( inn, byId );
		
		/*
		if ( !aT ) {
			self.log( 'no audio track found' )
		}
		*/
		
		if ( multiAudio ) {
			self.log( 'multiple audio tracks found' )
			self.emitError( 'ERR_MULTI_TRACKS' )
			return
		}
		
		if ( WHNotSet ) {
			self.log( 'width / height not set yet' )
			self.emitError( 'ERR_WIDTH_HEIGHT_MISSING' )
			return
		}
		
		res.transport = buildTransport( byType, byId );
		res.raw = {
			byId   : byId,
			byType : byType,
		};
		done( res );
		
		function buildInnieStats( rtps, things ) {
			if ( !rtps || !things ) {
				self.log( 'innie undef')
				return null
			}
			
			if ( !rtps.length ) {
				self.log( 'rtps empty' )
				return null
			}
			
			const res = {}
			rtps.some( rtp => {
				const id = rtp.trackIdentifier || rtp.trackId
				const track = things[ id ]
				self.log( 'rtp', {
					rtp    : rtp,
					track  : track,
					jrtp   : JSON.stringify( rtp ), 
					jtrack : JSON.stringify( track ),
				})
				
				if ( !track ) {
					self.log( 'no track found for rtp', JSON.stringify( rtp ))
					return false
				}
				
				if ( !track.remoteSource ) {
					self.log( 'track is not remote source', JSON.stringify( track ))
					return false
				}
				
				self.log( 'innie rtp', rtp )
				const tId = track.trackIdentifier
				const kind = track.kind
				const cache = self.statsCache[ kind ]
				if ( cache && cache.id !== tId ) {
					self.log( 'innie - stale track in cache, nulling', [ cache, track ])
					self.statsCache[ kind ] = null
				}
				
				self.log( 'innie', {
					kind  : kind,
					rtp   : rtp,
					track : track,
				})
				
				const type = rtp.mediaType
				const codec = things[ rtp.codecId ]
				rtp.track = track
				rtp.codec = codec
				if ( 'audio' == type ) {
					if ( null == self.aId )
						return false
					
					if ( true == aT ) {
						multiAudio = true
						return true
					}
					
					aT = true
					setAudioDeltas( rtp )
				}
				
				if ( 'video' == type ) {
					if ( null == self.vId )
						return false
					
					if ( null == rtp.frameHeight || null == rtp.frameWidth ) {
						WHNotSet = true
						return true
					}
					setVideoDeltas( rtp )
				}
				
				self.log( 'setting RTP', [ type, rtp ])
				res[ type ] = rtp
				
				return false
			})
			
			return res
			
			function setAudioDeltas( a ) {
				const c = self.statsCache.audio;
				const t = a.track;
				if ( c ) {
					t.audioEnergy = t.totalAudioEnergy * 10000;
					t.volumeLevel = +( t.audioLevel * 100 ).toFixed( 2 );
					const time = a.timestamp;
					const bps = getRate( c.time, time, c.bytesReceived, a.bytesReceived );
					const pps = getRate( c.time, time, c.packetsReceived, a.packetsReceived );
					const lps = getRate( c.time, time, c.packetsLost, a.packetsLost );
					const eps = getRate( c.time, time, c.audioEnergy, t.audioEnergy );
					a.byteRate = bps;
					a.packetRate = pps;
					a.packetLoss = lps;
					t.energyRate = eps;
				}
				
				self.statsCache.audio = {
					id              : t.trackIdentifier,
					time            : a.timestamp,
					bytesReceived   : a.bytesReceived,
					packetsReceived : a.packetsReceived,
					packetsLost     : a.packetsLost,
					audioEnergy     : t.audioEnergy,
				};
			}
			
			function setVideoDeltas( v ) {
				const c = self.statsCache.video
				const t = v.track
				if ( c ) {
					const time = v.timestamp
					const bps = getRate( c.time, time, c.bytesReceived  , v.bytesReceived )
					const pps = getRate( c.time, time, c.packetsReceived, v.packetsReceived )
					const lps = getRate( c.time, time, c.packetsLost    , v.packetsLost )
					const fps = getRate( c.time, time, c.framesRx       , v.framesReceived, 2 )
					v.byteRate = bps
					v.packetRate = pps
					v.packetLoss = lps
					v.fps = fps
					
				}
				
				self.statsCache.video = {
					id              : t.trackIdentifier,
					time            : v.timestamp,
					bytesReceived   : v.bytesReceived,
					packetsReceived : v.packetsReceived,
					packetsLost     : v.packetsLost,
					framesRx        : v.framesReceived,
				}
			}
		}
		
		function buildTransport( byType, byId ) {
			if ( !byType.transport )
				return null;
			
			const t = byType.transport[ 0 ]
			const p = byId[ t.selectedCandidatePairId ]
			const local = byId[ p.localCandidateId ]
			const remote = byId[ p.remoteCandidateId ]
			t.pair = p
			t.local = local
			t.remote = remote
			const c = self.statsCache.transport
			if ( c ) {
				const time = t.timestamp;
				const sent = t.bytesSent;
				const recv = t.bytesReceived;
				t.sendRate = getRate( c.time, time, c.sent, sent );
				t.receiveRate = getRate( c.time, time, c.recv, recv );
				t.ping = Math.round(( p.totalRoundTripTime / p.responsesReceived ) * 1000 )
			}
			
			self.statsCache.transport = {
				id   : t.id,
				sent : t.bytesSent,
				recv : t.bytesReceived,
				time : t.timestamp,
			};
			
			return t;
		}
		
		function getRate( t1, t2, b1, b2, dec=4 ) {
			if ( null == t1
				|| null == t2
				|| null == b1
				|| null == b2
			) {
				return null
			}
			
			const dt = t2 - t1
			const db = b2 - b1
			
			// things per second
			const scale = 1000.0 / dt
			const tps = +( 1.0 * db * scale ).toFixed( dec )
			
			/*
			self.log( 'rate', {
				t1 : t1,
				t2 : t2,
				b1 : b1,
				b2 : b2,
				dt : dt,
				db : db,
				scale : scale,
				tps : tps,
			});
			*/
			
			//self.log( 'tps', tps )
			return tps
		}
		
		function done( res ) {
			const event = {
				type : 'stats',
				data : res,
			};
			
			self.emit( 'extended', event )
		}
	}
	
})( library.rtc );


// media
(function( ns, undefined ) {
	ns.Media = function(
			permissions,
			preferedDevices,
			quality,
			deviceSource,
			logId
	) {
		const self = this;
		library.component.EventEmitter.call( self );
		self.permissions = permissions;
		self.preferedDevices = preferedDevices || {};
		self.devices = deviceSource;
		if ( !self.devices )
			throw new Error( 'Media - no device source' );
		
		self.mediaConf = {}
		self.currentDevices = {}
		self.lastAvailable = null
		self.isScreenSharing = false
		self.setupRunning = false
		self.recycle = false
		self.giveUp = false
		
		self.logId = logId
		self.spam = true
		
		self.init( quality )
	}
	
	ns.Media.prototype = Object.create( library.component.EventEmitter.prototype );
	
	// Public
	
	ns.Media.prototype.close = function() {
		const self = this;
		self.clear();
		self.closeEventEmitter();
		
		delete self.permissions;
		delete self.preferedDevices;
		delete self.lastAvailable;
		delete self.quality;
		delete self.deviceSource;
	}
	
	// permissions and preferedDevices are optional
	ns.Media.prototype.create = function( preferedDevices ) {
		const self = this;
		self.updatePreferedDevices( preferedDevices );
		let send = self.permissions.send;
		if ( !send || ( !send.audio && !send.video )) {
			self.updateMedia();
			return;
		}
		
		self.devices.getByType()
			.then( devsBack )
			.catch( deviceError );
		
		function devsBack( available ) {
			const kinds = {};
			self.lastAvailable = available;
			setupConf( available );
		}
		
		function deviceError( err ) {
			self.logErr( 'Media.create - deviceError', err );
			self.emitError( 'ERR_GET_DEVICES' );
		}
		
		function setupConf( availableDevices ) {
			const send = self.permissions.send;
			let conf = {
				audio : !!send.audio,
				video : !!send.video,
			}
			
			let current = null
			if ( self.media ) {
				current = self.media.getTracks()
				current.forEach( t => {
					const ts = t.getSettings();
					const type = t.kind
					if ( false == conf[ type ])
						return
					
					if ( self.shareVTrackId && 'video' == type ) {
						delete conf[ type ]
						return
					}
					
					const devType = type + 'input'
					const pref = self.preferedDevices[ devType ]
					
					if ( null == pref ) {
						delete conf[ type ]
						return
					}
					
					if ( ts.deviceId === pref.deviceId )
						delete conf[ type ]
				})
			}
			
			// add quality constraints
			if ( conf.audio )
				conf.audio = {}
			if ( conf.video )
				conf.video = {}
			
			// add device preferences
			conf = self.setDevice( 'audio', availableDevices, conf )
			conf = self.setDevice( 'video', availableDevices, conf )
			
			self.log( 'create conf', conf )
			if ( !conf.audio && !conf.video ) {
				self.updateMedia()
				return
			}
			
			self.getUserMedia( conf )
				.then( mediaBack )
				.catch( mediaError )
			
			async function mediaBack( media ) {
				try {
					await self.constrainTracks( media )
				} catch( ex ) {
					self.log( 'apply contstraints ex', ex )
				}
				
				self.setCurrentDevices( media )
				self.updateMedia( media )
			}
			
			function mediaError( err ) {
				self.logErr( 'Media.create - mediaError', err )
				self.emitError( 'ERR_MEDIA_FAILED' )
			}
		}
	}
	
	ns.Media.prototype.shareScreen = async function( preferedDevices ) {
		const self = this;
		self.updatePreferedDevices( preferedDevices )
		if ( self.shareVTrackId )
			return true
		
		const shareMedia = new window.MediaStream()
		const shareConf = self.mediaConf.share
		const dConf = {
			audio : false,
			video : true,
			/*
			video : {
				frameRate : shareConf.frameRate,
			},
			*/
		}
		
		self.log( 'shareConf', shareConf );
		let dMedia = null;
		try {
			dMedia = await window.navigator.mediaDevices.getDisplayMedia( dConf, true )
		} catch( ex ) {
			self.log( 'getDisplayMedia failed', ex )
			self.currentConf = null
			return false
		}
		
		const track = dMedia.getVideoTracks()[ 0 ]
		self.shareVTrackId = track.id
		shareMedia.addTrack( track )
		
		// done if there already is a audio track
		if ( !needAudio()) {
			try {
				await self.constrainTracks( shareMedia )
			} catch( cex ) {
				self.log( 'shareScreen - apply constraints ex', cex )
			}
			
			self.updateMedia( shareMedia )
			return true
		}
		
		// add audio track
		self.log( 'shareScreen - add audio' )
		let devs = null
		try {
			devs = await self.devices.getByType()
		} catch( ex ) {
			self.log( 'Media.shareScreen - addAudio devsFail', err )
			self.emitError( 'ERR_GET_DEVICES' )
			return false
		}
		
		let aConf = {
			audio : {},
			video : false,
		}
		aConf = self.setDevice( 'audio', available, aConf )
		self.clearMedia()
		
		let aMedia = null
		try {
			aMedia = await self.getUserMedia( aConf )
		} catch( ex ) {
			self.log( 'shareScreen - addAudio media fail', err );
			self.emitError( 'ERR_MEDIA_FAILED' )
			return false
		}
		
		let tracks = media.getAudioTracks()
		shareMedia.addTrack( tracks[ 0 ])
		try {
			await self.constrainTracks( shareMedia )
		} catch( cex ) {
			self.log( 'shareScreen apply contraints with audio ex', cex )
		}
		
		self.updateMedia( shareMedia )
		
		return true
		
		function needAudio() {
			const send = self.permissions.send
			if ( !send.audio )
				return false
			
			if ( !self.media )
				return true
			
			const aT = self.media.getAudioTracks()[ 0 ]
			if ( !aT )
				return true
			else
				return false
		}
	}
	
	ns.Media.prototype.unshareScreen = function() {
		const self = this
		if ( self.shareVTrackId ) {
			self.removeTrack( 'video' )
			self.shareVTrackId = null
		}
		
		if ( self.shareATrackId ) {
			self.log( 'unshareScreen - screen audio track found, NYI' )
		}
	}
	
	ns.Media.prototype.getCurrentDevices = function() {
		const self = this
		return self.currentDevices
	}
	
	ns.Media.prototype.getOpusConf = function() {
		const self = this;
		const args = self.opusQualityMap[ self.currentQuality ];
		if ( !args )
			return null
		
		const conf = {}
		self.opusQualityKeys.forEach( setInConf )
		return conf
		
		function setInConf( key, index ) {
			const value = args[ index ]
			if ( null == value )
				return
			
			conf[ key ] = value
		}
	}
	
	ns.Media.prototype.setQuality = function( quality ) {
		const self = this;
		return new Promise(( resolve, reject ) => {
			// defaults
			quality = quality || {};
			quality.level = quality.level || 'normal';
			quality.scale = quality.scale || 1;
			
			// sameness check
			self.quality = self.quality || {};
			if (( self.quality.level === quality.level ) &&
				( self.quality.scale === quality.scale )
			) {
				resolve( null );
				return;
			}
			
			self.quality.level = quality.level;
			self.quality.scale = quality.scale;
			self.setVideoQuality()
			self.setShareQuality()
			self.constrainTracks()
				.then( constrainOk )
				.catch( constrainFail );
			
			function constrainOk() {
				resolve( self.quality );
			}
			
			function constrainFail( err ) {
				self.logErr( 'Media.setQuality - constrainFail', err );
				reject( self.quality );
			}
		});
	}
	
	ns.Media.prototype.clear = function() {
		const self = this;
		self.clearMedia();
		self.emit( 'media', null );
		
	}
	
	// Private
	
	ns.Media.prototype.init = function( quality ) {
		const self = this;
		self.media = new window.MediaStream();
		// lowest quality first or things will break
		self.videoQualityKeys = [ 'width', 'height', 'frameRate' ];
		self.videoQualityMap = {
			'pixel'   : [ 128, 96, 4 ],
			'low'     : [ 320, 240, 4 ],
			'medium'  : [ 640, 480, 12 ],
			'normal'  : [ 960, 720, 24 ],
			'high'    : [ 1280, 960, 60 ],
		};
		
		self.opusQualityKeys = [ 'maxcodecaudiobandwidth', 'maxaveragebitrate', 'usedtx' ];
		self.opusQualityMap = {
			'low'     : [ '24000', '16', null ],
			'medium'  : [ '48000', '32', null ],
			'normal'  : [ '48000', '32', null ],
			'high'    : [ '48000', '32', null ],
		};
		
		self.shareQualityKeys = [ 'frameRate' ];
		self.shareQualityMap = {
			'pixel'   : [ 2 ],
			'low'     : [ 2 ],
			'medium'  : [ 4 ],
			'normal'  : [ 8 ],
			'high'    : [ 24 ],
		};
		
		self.mediaConf.audio = {
			"echoCancellation" : true,
		};
		
		self.setQuality( quality )
			.then( ok => {})
			.catch( err => {});
	}
	
	ns.Media.prototype.emitError = function( err ) {
		const self = this;
		self.emit( 'error', err );
	}
	
	ns.Media.prototype.setVideoQuality = function() {
		const self = this;
		const level = self.quality.level;
		const scale = self.quality.scale;
		const arr = self.videoQualityMap[ level ];
		const defaults = self.videoQualityMap[ 'normal' ];
		if ( !arr ) {
			self.logErr( 'setVideoQuality - invalid level or missing in map', {
				level     : level,
				available : self.videoQualityMap,
			});
			self.mediaConf.video = true;
			return;
		}
		
		const video = {};
		self.videoQualityKeys.forEach( add );
		self.mediaConf.video = video;
		
		function add( key, index ) {
			const value = arr[ index ];
			const def = defaults[ index ];
			if ( 'frameRate' === key ) {
				/*
				video.frameRate = {
					ideal : value || def,
				}
				*/
				video.frameRate = value || def
			}
			
			if ( 'width' === key ) {
				/*
				video.width = {
					ideal : value || def,
				}
				*/
				video.width = value || def
			}
			
			if ( 'height' === key ) {
				/*
				video.height = {
					ideal : value || def,
				}
				*/
				video.height = value || def
			}
		}
	}
	
	ns.Media.prototype.setShareQuality = function() {
		const self = this;
		const level = self.quality.level;
		let arr = self.shareQualityMap[ level ];
		if ( !arr )
			return;
		
		const share = {};
		self.shareQualityKeys.forEach(( key, index ) => {
			let value = arr[ index ];
			if ( null == value )
				value = 24;
			
			share[ key ] = value;
		});
		self.mediaConf.share = share;
		self.log( 'setShareQuality', self.mediaConf.share );
	}
	
	ns.Media.prototype.constrainTracks = function( tracks ) {
		const self = this
		self.log( 'constrainTracks', [ tracks, self.media ])
		return new Promise(( resolve, reject ) => {
			resolve( true )
			return
			
			if ( !self.media && !tracks ) {
				self.logErr( 'no media, lets reject', [ tracks, self.media ]);
				reject( 'ERR_NO_MEDIA' );
				return;
			}
			
			const media = tracks || self.media
			const vTracks = media.getVideoTracks()
			self.log( 'vTracks', vTracks )
			if ( !vTracks.length ) {
				self.log( 'no video tracks v0v' )
				resolve()
				return
			}
			
			setTimeout( doItLater, 1000 )
			async function doItLater() {
				const waiters = vTracks.map( constrain )
				self.log( 'doing it now', waiters )
				try {
					await Promise.all( waiters )
				} catch( ex ) {
					self.log( 'doing it failed', ex )
					reject( ex )
					return
				}
				
				resolve()
			}
			
		})
		
		function constrain( track ) {
			if ( self.shareVTrackId
				&& track.id === self.shareVTrackId
			) {
				return constrainScreenShare( track );
			} else
				return constrainUserMedia( track );
		}
		
		async function constrainScreenShare( track ) {
			return true
			
			const q = self.shareQualityMap[ self.quality.level ];
			const frameRate = q[ 0 ];
			const conf = {
			};
			
			conf.frameRate = {
				ideal : frameRate,
				max   : frameRate,
			};
			console.trace( 'constrainScreenShare', {
				t    : track,
				q    : q,
				qm   : self.shareQualityMap,
				ql   : self.quality.level,
				conf : conf,
			})
			
			try {
				await track.applyConstraints( conf )
			} catch( ex ) {
				throw 'ERR_CONSTRAIN_FAIL'
			}
			
			return true
		}
		
		async function constrainUserMedia( track ) {
			self.log( 'constrainUserMedia support', {
				track : track,
				capa  : !!track.getCapabilities,
				sett  : !!track.getSettings,
				cons  : !!track.applyConstraints,
			})
			if ( !track.getCapabilities ) {
				self.log( 'track does not support getCapabilities' )
				return true
			}
			
			const conf = buildConf( track )
			
			try {
				await track.applyConstraints( conf )
			} catch( ex ) {
				self.logErr( 'constrainTracks - failed to apply constraints', ex )
				throw ( 'ERR_CONSTRAIN_FAIL' )
			}
				
			self.log( 'constrainOk', {
				curr : track.getSettings(),
			})
			
			return true
			
			function buildConf( track ) {
				const sup = window.navigator.mediaDevices.getSupportedConstraints()
				const capa = track.getCapabilities()
				const curr = track.getSettings()
				const conf = JSON.parse( JSON.stringify( self.mediaConf.video ))
				self.log( 'buildConf things', {
					sup   : sup,
					capa  : capa,
					curr  : curr,
					conf  : conf,
				})
				
				delete conf[ 'frameRate' ]
				const cKeys = Object.keys( conf )
				cKeys.forEach( key => {
					const c = capa[ key ]
					self.log( 'checking', [ key, c, conf[ key ]] )
					if ( null == c )
						return
					
					if ( null != c.max ) {
						if ( c.max < conf[ key ])
							conf[ key ] = c.max
					}
					
					if ( null != c.min ) {
						if ( c.min > conf[ key ])
							conf[ key ] = c.min
					}
				})
				
				self.log( 'constrained constraints', conf )
				return conf
			}
		}
	}
	
	ns.Media.prototype.updatePreferedDevices = function( prefDev ) {
		const self = this;
		if ( null == prefDev )
			return;
		
		if ( prefDev.audioinput )
			self.preferedDevices.audioinput = prefDev.audioinput;
		
		if ( prefDev.videoinput )
			self.preferedDevices.videoinput = prefDev.videoinput;
		
	}
	
	ns.Media.prototype.setDevice = function( type, available, conf ) {
		const self = this;
		self.log( 'setDevice', [ type, available, conf ])
		if ( !conf[ type ]) {
			self.log( 'setDevice, type not set', conf[ type ])
			return conf;
		}
		
		const deviceType = type + 'input';
		let device = self.preferedDevices[ deviceType ];
		self.log( 'pref device', device )
		if ( !device ) {
			device = self.currentDevices[ deviceType ];
			self.log( 'curr deivce', device )
		}
		
		self.log( 'setDevice - device', [ type, device ])
		if ( !device ) {
			conf[ type ] = true
			return conf
		}
		
		const avaOfType = available[ deviceType ];
		let prefDev = null;
		const devIds = Object.keys( avaOfType );
		self.log( 'ava of type ids', devIds )
		devIds.forEach( id => {
			const dev = avaOfType[ id ];
			if ( device.deviceId === dev.deviceId ) {
				prefDev = dev;
				return;
			}
			
			if ( device.label === dev.label ) {
				prefDev = dev;
				return;
			}
			
			if ( device.labelExtra === dev.labelExtra ) {
				prefDev = dev;
				return;
			}
		});
		
		self.log( 'prefDev', prefDev )
		if ( !prefDev ) {
			conf[ type ] = true
			return conf
		}
		
		if ( 'boolean' === typeof( conf[ type ]))
			conf[ type ] = {};
		
		conf[ type ].deviceId = prefDev.deviceId;
		self.log( 'setDevice - set', [ type, conf ])
		return conf;
	}
	
	ns.Media.prototype.getUserMedia = function( conf, noFallback ) {
		const self = this;
		return new Promise(( resolve, reject ) => {
			if ( !conf.audio && !conf.video ) {
				reject( 'ERR_NO_MEDIA_REQUESTED' );
				return;
			}
			
			if ( !self.checkConfHasChange( conf ))
				return;
			
			self.currentConf = conf;
			window.navigator.mediaDevices.getUserMedia( conf )
				.then( success )
				.catch( failure );
			
			function success( media ) { mediaCreated( media ); }
			function failure( err ) { mediaFailed( err, conf ); }
			
			function mediaFailed( err, conf ) {
				self.logErr( 'mediaFailed', {
					err        : err,
					conf       : conf,
					noFallBack : noFallback,
					giveUp     : self.giveUp,
				});
				
				const errData = {
					code : 'ERR_MEDIA_FAILED',
					err  : err,
					conf : conf,
				};
				
				self.emit( 'media-error', errData );
				if ( self.giveUp || noFallback ) {
					self.simpleConf = null;
					self.giveUp = false;
					self.currentConf = null;
					reject( errData );
					return;
				} else
					retrySimple()
						.then( success )
						.catch( failure );
			}
			
			function mediaCreated( media ) {
				self.log( 'getUserMedia - mediaCreated', media )
				self.simpleConf = null;
				self.giveUp = false;
				self.currentConf = null;
				resolve( media );
			}
			
			function retrySimple() {
				// try audio + video, but no special conf
				if ( !self.simpleConf )
					return firstTry();
				
				self.simpleConf.video = false;
				self.giveUp = true;
				return tryNow();
				
				function firstTry() {
					self.simpleConf = {
						audio : !!conf.audio,
						video : !!conf.video,
					};
					
					if ( !self.simpleConf.video )
						self.giveUp = true;
					
					return tryNow();
				}
				
				function tryNow() {
					return window.navigator.mediaDevices.getUserMedia( self.simpleConf );
				}
			}
		});
	}
	
	ns.Media.prototype.checkConfHasChange = function( fresh ) {
		const self = this;
		if ( null == self.currentConf )
			return true;
		
		const curr = self.currentConf;
		// add things here lol
		return false;
	}
	
	ns.Media.prototype.getScreenMedia = async function() {
		const self = this;
	}
	
	ns.Media.prototype.setCurrentDevices = function( media ) {
		const self = this;
		const aT = media.getAudioTracks()[ 0 ];
		const vT = media.getVideoTracks()[ 0 ];
		if ( aT ) {
			const aTS = aT.getSettings();
			self.currentDevices.audioinput = {
				deviceId : aTS.deviceId,
				label    : aT.label,
			};
		}
		
		if ( vT ) {
			const vTS = vT.getSettings();
			self.currentDevices.videoinput = {
				deviceId : vTS.deviceId,
				label    : vT.label,
			};
		}
	}
	
	ns.Media.prototype.updateMedia = function( fresh ) {
		const self = this;
		const send = self.permissions.send;
		const currT = self.media.getTracks();
		let freshT = [];
		if ( fresh )
			freshT = fresh.getTracks();
		
		currT.forEach( t => {
			const kind = t.kind;
			if ( !send[ kind ])
				self.removeTrack( kind );
		});
		
		freshT.forEach( t => {
			self.addTrack( t );
		});
		
		window.setTimeout( update, 1 );
		function update() {
			self.emit( 'media', self.media );
		}
	}
	
	ns.Media.prototype.clearMedia = function() {
		const self = this;
		if ( !self.media )
			return;
		
		self.removeTrack( 'audio' );
		self.removeTrack( 'video' );
		/*
		let tracks = self.media.getTracks();
		tracks.forEach( track => {
			track.stop();
			self.releaseTrack( track );
			self.media.removeTrack( track );
		});
		*/
		self.media = null;
	}
	
	ns.Media.prototype.addTrack = function( track ) {
		const self = this;
		const kind = track.kind;
		const curr = self.media.getTracks();
		curr.forEach( currTrack => {
			if ( kind != currTrack.kind )
				return;
			
			self.removeTrack( kind );
		});
		self.media.addTrack( track );
		self.bindTrack( track );
	}
	
	ns.Media.prototype.removeTrack = function( kind ) {
		const self = this;
		let track = null;
		if ( 'audio' == kind )
			track = self.media.getAudioTracks()[ 0 ];
		if ( 'video' == kind )
			track = self.media.getVideoTracks()[ 0 ];
		
		if ( !track )
			return;
		
		self.releaseTrack( track );
		self.media.removeTrack( track );
	}
	
	ns.Media.prototype.bindTracks = function() {
		const self = this;
		if ( !self.media )
			return;
		
		const tracks = self.media.getTracks();
		tracks.forEach( track => {
			self.bindTrack( track );
		});
	}
	
	ns.Media.prototype.bindTrack = function( track ) {
		const self = this;
		track.onended = onEnded;
		
		function onEnded() {
			track.onended = null;
			const tId = track.id;
			const kind = track.kind;
			self.emit( 'track-ended', {
				id    : tId,
				kind  : kind,
				label : track.label  || track.labelExtra,
			});
		}
	}
	
	ns.Media.prototype.releaseTrack = function( track ) {
		const self = this;
		const tId = track.id;
		if ( self.shareVTrackId && ( tId === self.shareVTrackId ))
			self.shareVTrackId = null;
		
		track.onended = null;
		try {
			track.stop();
		} catch( e ) {}
	}
	
	ns.Media.prototype.log = function( ...args ) {
		const self = this
		if ( !self.spam )
			return
		
		let pre = self.logId + 'rtc.Media ' + args.shift()
		console.log( pre, ...args )
	}
	
	ns.Media.prototype.logErr = function( ...args ) {
		const self = this
		let pre = 'ERR rtc.Media ' + args.shift()
		console.trace( pre, ...args )
	}
	
})( library.rtc );
