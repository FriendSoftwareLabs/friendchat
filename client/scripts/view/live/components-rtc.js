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
		if ( !( this instanceof ns.SourceSelect ))
			return new ns.SourceSelect( conf );
		
		const self = this;
		self.view = conf.view;
		self.onselect = conf.onselect;
		self.selfie = conf.selfie;
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
		var uiConf = {
			permissions : self.permissions,
			onselect : onselect,
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
	[ device, ]
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
		
		self.isSpeaking = false;
		self.speakingLimit = 20;
		self.speakingTicks = 5;
		self.notSpeakingLimit = 5;
		self.notSpeakingTicks = 30;
		self.notSpeakingWait = 1000 * 2;
		self.notSpeakingTimeout = null;
		self.init();
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
		
		self.volumeHistory = new Array( 10 );
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
				
				// find max
				let i = ( buf.length );
				for( ; i-- ; ) {
					let val = buf[ i ];
					val = Math.abs( val - 128 );
					if ( max < val )
						max = val;
				}
				
				updateAverageVolume( max );
				self.volume = max;
				setTimeout( emitVolume, 0 );
				
				function emitVolume() {
					self.emit( 'volume', self.volumeAverage, self.averageOverTime );
				}
			}
			
			function updateAverageVolume( current ) {
				let vh = self.volumeHistory;
				vh.shift();
				vh.push( current );
				let total = 0;
				
				// sum
				let i = vh.length;
				for( ; i-- ; )
					total += vh[ i ];
				
				const avg = ( total * 1.0 ) / vh.length;
				self.volumeAverage = Math.ceil( avg );
				self.averageOverTime.shift();
				self.averageOverTime.push( self.volumeAverage );
				//self.votIndex++;
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
		self.loop = false;
		self.release();
		
		delete self.analyser;
		delete self.stream;
	}
	
	// Private
	
	ns.Volume.prototype.init = function() {
		const self = this;
		self.actx = new window.AudioContext();
		self.source = self.actx.createMediaStreamSource( self.stream );
		self.analyser = self.actx.createAnalyser();
		self.analyser.fftSize = 1024;
		self.analyser.minDecibels = -200;
		const bufLen = self.analyser.frequencyBinCount;
		self.timeBuffer = new Uint8Array( bufLen );
		
		self.source.connect( self.analyser );
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
		self.maxTryTime = 5000 * 3;
		self.sampleInterval = 100;
		
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
			
			self.actx = new window.AudioContext();
			const source = self.actx.createMediaStreamSource( self.mediaStream );
			const analyser =  self.actx.createAnalyser();
			source.connect( analyser );
			analyser.fftSize = 64;
			analyser.minDecibels = -200;
			const buffLen = analyser.frequencyBinCount;
			
			self.interval = window.setInterval( check, self.sampleInterval );
			self.timeout = window.setTimeout( timeoutHit, self.maxTryTime );
			
			function check() {
				if ( null == self.interval )
					return;
				
				const sample =  new Uint8Array( buffLen );
				analyser.getByteTimeDomainData( sample );
				if ( !sample || !sample.length ) {
					//resolve();
					return;
				}
				
				const baseline = sample[ 0 ];
				let hasInput = false;
				if ( !sample.some ) { // f.e. older chrome and samsung internet
									  // does not have .some here
					hasInput = window.Array.prototype.some.call( sample, notFlat );
				}
				else {
					hasInput = sample.some( notFlat );
				}
				
				if ( !hasInput ){
					return;
				}
				
				clear();
				resolve( true );
				
				function notFlat( value ) {
					return !!( baseline !== value );
				}
			}
			
			function timeoutHit() {
				if ( null == self.timeout )
					return;
				
				clear();
				resolve( false );
			}
			
			function clear() {
				if ( null != self.actx ) {
					try {
						self.actx.close();
					} catch( ex ) {}
				}
				
				if ( null != self.interval )
					window.clearInterval( self.interval );
				
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
		peerName
	) {
		const self = this;
		library.component.EventEmitter.call( self );
		
		opts = opts || {};
		self.type = type;
		self.id = 'webrtc-' + self.type;
		self.isHost = isHost || false;
		self.signal = signal;
		self.media = media;
		self.rtc = rtcConf;
		self.useDefaultCodec = opts.useDefaultCodec;
		self.modifySDP = opts.modifySDP || null;
		self.peerId = opts.peerId || null;
		self.bundlePolicy = opts.bundlePolicy || null;
		self.peerName = peerName || '';
		self.log( 'Session', type );
		
		// peer connection, holder of streams
		self.conn = null;
		self.state = 'nominal';
		self.senders = {};
		self.waiters = {
			add    : {},
			remove : {},
		};
		self.remoteTracks = {};
		//self.useOnTrack = false;
		//self.useOnStream = false;
		
		self.iceCandidates = [];
		self.negotiationWaiting = false;
		self.negotiationTimeout = null;
		self.negotiationTimer = 1000 * 10;
		self.denyNegotiation = false;
		
		self.iceTimeoutMs = 1000 * 6;
		
		self.statsRate = 1000 * 2;
		self.statsInterval = null;
		self.statsCache = {};
		
		// data channels
		self.channels = {};
		
		// rtc specific logging ( automatic host / client prefix )
		self.spam = false;
		
		self.init();
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
			self.log( 'Session.removeTrack - no sender' );
			self.checkWaiters();
			return;
		}
		
		self.log( 'Session.removeTrack', sender );
		self.conn.removeTrack( sender );
		delete self.senders[ kind ];
	}
	
	ns.Session.prototype.addStream = function( stream ) {
		const self = this;
		self.log( 'Session.addStream', {
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
		
		var tracks = stream.getTracks();
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
		console.trace( 'Session.createDataChannel' );
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
	
	/* accepts:
		'fast'
		undefined
	*/
	ns.Session.prototype.setStatsRate = function( rate ) {
		const self = this;
		if ( 'fast' === rate )
			self.statsRate = 250;
		else
			self.statsRate = 1000 * 2;
	}
	
	ns.Session.prototype.setDefaultCodec = function( useDefault ) {
		const self = this;
		self.log( 'setDefaultCodec', {
			use : useDefault,
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
		if ( self.negotiationNeededWaiting )
			window.clearTimeout( self.negotiationNeededWaiting );
		
		delete self.negotiationNeededWaiting;
		
		self.stopStats();
		self.removeTracks();
		self.setState( 'closed' );
		self.release(); // event listeners
		closeDataChannels();
		closeRTC();
		closeSignal();
		
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
			
			self.signal.release();
			self.signal.close();
			
			delete self.signal;
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
		self.conn.onaddstream = streamAdded;
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
		
		self.startStats();
		
		function connStateChange( e ) { self.connectionStateChange( e ); }
		function streamAdded( e ) { self.streamAdded( e ); }
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
	
	ns.Session.prototype.startStats = function() {
		const self = this;
		if ( !self.conn.getStats ) {
			self.log( 'Session - getStats not supported' );
			return;
		}
		
		self.statsInterval = window.setInterval( emitStats, self.statsRate );
		function emitStats() {
			self.emitStats();
		}
	}
	
	ns.Session.prototype.emitStats = function() {
		const self = this;
		if ( !self.conn ) {
			done( 'ERR_NO_CONN' );
			return;
		}
		
		if ( 'nominal' !== self.state ) {
			self.log( 'Session.emitStats - not ready', self.state );
			return;
		}
		
		self.conn.getStats()
			.then( success )
			.catch( error );
		
		function success( stats ) {
			const byType = {};
			const byId = {};
			stats.forEach( item => { 
				const type = item.type;
				const id = item.id;
				if ( !byType[ type ])
					byType[ type ] = [];
				
				byType[ type ].push( item );
				byId[ id ] = item;
			});
			/*
			self.log( 'stats', {
				byType : byType,
				byId   : byId,
			});
			*/
			const res = {};
			const inn = byType[ 'inbound-rtp' ];
			const out = byType[ 'outbound-rtp' ];
			res.inbound = buildInnieStats( inn, byId );
			//res.outbound = buildOutieStats( out, byId );
			res.transport = buildTransport( byType, byId );
			res.raw = {
				byId   : byId,
				byType : byType,
			};
			done( null, res );
		}
		
		function buildInnieStats( rtps, things ) {
			if ( !rtps || !things )
				return null;
			
			const res = {};
			rtps.forEach( rtp => {
				const id = rtp.id;
				const track = things[ rtp.trackId ];
				if ( !track )
					return;
				
				const trackId = track.trackIdentifier;
				const kind = track.kind;
				if ( self.remoteTracks[ kind ] !== trackId )
					return;
				
				const cache = self.statsCache[ kind ];
				if ( cache && cache.id !== trackId ) {
					self.statsCache[ kind ] = null;
					return;
				}
				
				/*
				self.log( 'innie', {
					rtp   : rtp,
					track : track,
				});
				*/
				const type = rtp.mediaType;
				const codec = things[ rtp.codecId ];
				rtp.track = track;
				rtp.codec = codec;
				if ( 'audio' == type )
					setAudioDeltas( rtp );
				if ( 'video' == type )
					setVideoDeltas( rtp );
				
				res[ type ] = rtp;
			});
			return res;
			
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
				const c = self.statsCache.video;
				const t = v.track;
				if ( c ) {
					const time = v.timestamp;
					const bps = getRate( c.time, time, c.bytesReceived, v.bytesReceived );
					const pps = getRate( c.time, time, c.packetsReceived, v.packetsReceived );
					const lps = getRate( c.time, time, c.packetsLost, v.packetsLost );
					v.byteRate = bps;
					v.packetRate = pps;
					v.packetLoss = lps;
				}
				
				self.statsCache.video = {
					id              : t.id,
					time            : v.timestamp,
					bytesReceived   : v.bytesReceived,
					packetsReceived : v.packetsReceived,
					packetsLost     : v.packetsLost,
				};
			}
		}
		
		function buildTransport( byType, byId ) {
			const t = byType.transport[ 0 ];
			const p = byId[ t.selectedCandidatePairId ];
			const local = byId[ p.localCandidateId ];
			const remote = byId[ p.remoteCandidateId ];
			t.pair = p;
			t.local = local;
			t.remote = remote;
			const c = self.statsCache.transport;
			if ( c ) {
				const time = t.timestamp;
				const sent = t.bytesSent;
				const recv = t.bytesReceived;
				t.sendRate = getRate( c.time, time, c.sent, sent );
				t.receiveRate = getRate( c.time, time, c.recv, recv );
				t.ping = Math.round(( p.totalRoundTripTime / p.responsesReceived ) * 1000 );
			}
			
			self.statsCache.transport = {
				id   : t.id,
				sent : t.bytesSent,
				recv : t.bytesReceived,
				time : t.timestamp,
			};
			
			return t;
		}
		
		function getRate( t1, t2, b1, b2 ) {
			if ( null == t1
				|| null == t2
				|| null == b1
				|| null == b2
			) {
				return null;
			}
			
			const dt = t2 - t1;
			const db = b2 - b1;
			
			// things per second
			const scale = 1000.0 / dt;
			const tps = +( 1.0 * db * scale ).toFixed( 4 );
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
			//self.log( 'tps', tps );
			return tps;
		}
		
		function error( err ) {
			self.log( 'error', err );
			let str = null;
			try {
				str = err.message;
			} catch( e ) {}
			done( 'ERR_STATS_FAILED', str || err );
		}
		
		function done( err , res ) {
			if ( err ) {
				emitError( err, res );
				return;
			}
			
			//self.log( 'stats', res );
			const event = {
				type : 'stats',
				data : res,
			};
			self.emit( 'stats', event );
		}
		
		function emitError( type, data ) {
			const err = {
				type : 'error',
				data : {
					type : type,
					data : data,
				},
			};
			self.emit( 'stats', err );
		}
	}
	
	ns.Session.prototype.stopStats = function() {
		const self = this;
		if ( null == self.statsInterval )
			return;
		
		window.clearInterval( self.statsInterval );
		self.statsInterval = null;
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
		
		var msg = {
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
		
		/*
		self.log( 'the things', {
			mVideo : mVideo,
			mVideoLine : mVideoLine,
			mVideoProtocol : mVideoProtocol,
			mVideoCodecs : mVideoCodecs,
			codecIds : codecIds,
		});
		*/
		
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
		
		var desc = {
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
			var errTest = 'DOMException: Failed to set remote answer sdp:'
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
		var opt = {
			type : 'rollback',
			sdp : null,
		};
		
		var rollback = new window.RTCSessionDescription();
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
			self.log( 'iceCandidateReceived - null candidate\
			 - other side is done sending', candidate );
			return;
		}
		var ICECandidate = new window.RTCIceCandidate( candidate );
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
				timer : self.negotiationTimer
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
			send( 'deny');
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
				state : self.conn.signalingState,
				timeout : self.negotiationTimeout,
				deny : self.denyNegotiation,
				timer : self.negotiationTimer,
			});
			return (( self.conn.signalingState === 'stable' ) &&
				!self.negotiationTimeout &&
				!self.denyNegotiation );
		}
	}
	
	ns.Session.prototype.trackAdded = function( data ) {
		const self = this;
		self.log( 'trackAdded', data );
		self.log( 'trackAdded', data );
		/*
		if ( self.useOnStream )
			return;
		*/
		const track = data.track;
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
			self.emit( 'track-remove', type );
		}
	}
	
	ns.Session.prototype.streamAdded = function( e ) {
		const self = this;
		self.log( 'streamAdded - deprecated', e );
				
		/*
		self.log( 'streamAdded', e );
		if ( self.useOnTrack )
			return;
		
		const stream = e.stream;
		if ( self.useOnStream ) {
			self.emitStream( stream );
			return;
		}
		
		// lets wait and see if onTrack fires, its preferable to use that
		self.waitForTrack = setTimeout( checkIfTrackFired, 200 );
		function checkIfTrackFired() {
			// yep
			self.log( 'checkIfTrackFired', self.useOnTrack );
			if ( self.useOnTrack ) {
				delete self.waitForTrack;
				return;
			}
			
			// nope
			self.useOnStream = true;
			self.emitStream( stream );
		}
		*/
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
		self.conn.onaddstream = null;
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


// media
(function( ns, undefined ) {
	ns.Media = function(
			permissions,
			preferedDevices,
			quality,
			deviceSource
	) {
		const self = this;
		library.component.EventEmitter.call( self );
		self.permissions = permissions || {
			audio : true,
			video : true,
		};
		self.preferedDevices = preferedDevices || {};
		self.devices = deviceSource;
		if ( !self.devices )
			throw new Error( 'Media - no device source' );
		
		self.mediaConf = {};
		self.currentDevices = {};
		self.lastAvailable = null;
		self.isScreenSharing = false;
		self.setupRunning = false;
		self.recycle = false;
		self.giveUp = false;
		
		self.init( quality );
	}
	
	ns.Media.prototype = Object.create( library.component.EventEmitter.prototype );
	
	// Public
	
	ns.Media.prototype.close = function() {
		const self = this;
		self.clear();
		
		delete self.permissions;
		delete self.preferedDevices;
		delete self.lastAvailable;
		delete self.quality;
		delete self.deviceSource;
	}
	
	// permissions and preferedDevices are optional
	ns.Media.prototype.create = function( permissions, preferedDevices ) {
		const self = this;
		if ( null != permissions )
			self.permissions = permissions;
		
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
			console.log( 'Media.create - deviceError', err );
			self.emitError( 'ERR_GET_DEVICES' );
		}
		
		function setupConf( availableDevices ) {
			const send = self.permissions.send;
			let conf = {
				audio : !!send.audio,
				video : !!send.video,
			};
			
			let current = null;
			if ( self.media ) {
				current = self.media.getTracks();
				current.forEach( t => {
					const ts = t.getSettings();
					const type = t.kind;
					if ( !conf[ type ])
						return;
					
					if ( self.shareVTrackId && 'video' == type ) {
						delete conf[ type ];
						return;
					}
					
					const devType = type + 'input';
					const pref = self.preferedDevices[ devType ];
					console.log( 'pref', {
						pref : pref,
						pd  : self.preferedDevices,
					});
					
					if ( null == pref ) {
						delete conf[ type ];
						return;
					}
					
					if ( ts.deviceId === pref.deviceId )
						delete conf[ type ];
				});
			}
			
			// add quality constraints
			if ( conf.audio )
				conf.audio = self.mediaConf.audio || {};
			if ( conf.video )
				conf.video = self.mediaConf.video || {};
			
			// add device preferences
			conf = self.setDevice( 'audio', availableDevices, conf );
			conf = self.setDevice( 'video', availableDevices, conf );
			
			if ( !conf.audio && !conf.video ) {
				self.updateMedia();
				return;
			}
			
			self.getMedia( conf )
				.then( mediaBack )
				.catch( mediaError );
			
			function mediaBack( media ) {
				self.setCurrentDevices( media );
				self.updateMedia( media );
			}
			
			function mediaError( err ) {
				console.log( 'Media.create - mediaError', err );
				self.emitError( 'ERR_MEDIA_FAILED' );
			}
		}
	}
	
	ns.Media.prototype.shareScreen = function( screenId ) {
		const self = this;
		const shareMedia = new window.MediaStream();
		getScreen( screenId );
		
		function getScreen( screenId ) {
			const shareConf = self.mediaConf.share || {};
			const mandatory = {
				chromeMediaSource   : 'desktop',
				chromeMediaSourceId : screenId,
			};
			if ( shareConf.frameRate )
				mandatory.maxFrameRate = shareConf.frameRate;
			
			const conf = {
				audio : false,
				video : {
					mandatory : mandatory,
				},
			};
			self.getMedia( conf, true )
				.then( screenBack )
				.catch( screenFail );
			
			function screenBack( media ) {
				const track = media.getVideoTracks()[ 0 ];
				//self.shareSourceId = screenId;
				self.shareVTrackId = track.id;
				shareMedia.addTrack( track );
				addAudio();
			}
			
			function screenFail( err ) {
				console.log( 'Media.shareScreen - share track failed', err );
			}
		}
		
		function addAudio() {
			if ( !needAudio()) {
				self.updateMedia( shareMedia );
				return;
			}
			
			self.devices.getByType()
				.then( devsBack )
				.catch( devsFail );
			
			function devsFail( err ) {
				console.log( 'Media.shareScreen - addAudio devsFail', err );
				self.emitError( 'ERR_GET_DEVICES' );
			}
			
			function devsBack( available ) {
				let conf = {
					audio : self.mediaConf.audio || {},
					video : false,
				};
				conf = self.setDevice( 'audio', available, conf );
				
				self.clearMedia();
				self.getMedia( conf )
					.then( audioBack )
					.catch( audioFail );
				
				function audioBack( media ) {
					let tracks = media.getAudioTracks();
					shareMedia.addTrack( tracks[ 0 ]);
					self.updateMedia( shareMedia );
				}
				
				function audioFail( err ) {
					console.log( 'Media.shareScreen - addAudio media fail', err );
					self.emitError( 'ERR_MEDIA_FAILED' );
				}
			}
		}
		
		function needAudio() {
			const send = self.permissions.send;
			if ( !send.audio )
				return false;
			
			if ( !self.media )
				return true;
			
			const aT = self.media.getAudioTracks()[ 0 ];
			if ( !aT )
				return true;
			else
				return false;
		}
	}
	
	ns.Media.prototype.unshareScreen = function() {
		const self = this;
		console.log( 'unshareScreen', self.shareVTrackId );
		if ( self.shareVTrackId ) {
			self.removeTrack( 'video' );
			self.shareVTrackId = null;
		}
		
		if ( self.shareATrackId ) {
			console.log( 'huehuehue' );
		}
	}
	
	ns.Media.prototype.getCurrentDevices = function() {
		const self = this;
		return self.currentDevices;
	}
	
	ns.Media.prototype.getOpusConf = function() {
		const self = this;
		var args = self.opusQualityMap[ self.currentQuality ];
		if ( !args )
			return null;
		
		var conf = {};
		self.opusQualityKeys.forEach( setInConf );
		return conf;
		
		function setInConf( key, index ) {
			var value = args[ index ];
			if ( null == value )
				return;
			
			conf[ key ] = value;
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
			self.setVideoQuality();
			self.setShareQuality();
			self.reconstrainTracks()
				.then( constrainOk )
				.catch( constrainFail );
			
			function constrainOk() {
				resolve( self.quality );
			}
			
			function constrainFail( err ) {
				console.log( 'Media.setQuality - constrainFail', err );
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
			'low'     : [ 256, 144, 4 ],
			'medium'  : [ 640, 480, 24 ],
			'normal'  : [ 1280, 720, 30 ],
			'default' : [ 1920, 1080, 60 ],
		};
		
		self.opusQualityKeys = [ 'maxcodecaudiobandwidth', 'maxaveragebitrate', 'usedtx' ];
		self.opusQualityMap = {
			'low'     : [ '24000', '16', null ],
			'medium'  : [ '48000', '32', null ],
			'normal'  : [ '48000', '32', null ],
			'default' : [ '48000', '32', null ],
		};
		
		self.shareQualityKeys = [ 'frameRate' ];
		self.shareQualityMap = {
			'low'     : [ 1 ],
			'medium'  : [ 5 ],
			'normal'  : [ 30 ],
			'default' : [ 60 ],
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
		const defaults = self.videoQualityMap[ 'default' ];
		if ( !arr ) {
			console.log( 'setVideoQuality - invalid level or missing in map', {
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
				video.frameRate = {
					ideal : value || def,
					max   : value || def,
				};
			}
			
			if ( 'width' === key ) {
				video.width = {
					ideal : value || def,
				}
			}
			
			if ( 'height' === key ) {
				video.height = {
					ideal : value || def,
				}
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
				value = 60;
			
			share[ key ] = value;
		});
		self.mediaConf.share = share;
	}
	
	ns.Media.prototype.reconstrainTracks = function() {
		const self = this;
		return new Promise(( resolve, reject ) => {
			if ( !self.media ) {
				console.log( 'no media, lets reject' );
				reject( 'ERR_NO_MEDIA' );
				return;
			}
			
			const vTracks = self.media.getVideoTracks();
			Promise.all( vTracks.map( constrain ))
				.then( resolve )
				.catch( reject );
		});
		
		function constrain( track ) {
			if ( self.shareVTrackId
				&& track.id === self.shareVTrackId
			) {
				return constrainScreenShare( track );
			} else
				return constrainUserMedia( track );
		}
		
		function constrainScreenShare( track ) {
			const q = self.shareQualityMap[ self.quality.level ];
			const frameRate = q[ 0 ] || 120;
			const conf = {
			};
			
			conf.frameRate = {
				ideal : frameRate,
				max   : frameRate,
			};
			return track.applyConstraints( conf );
		}
		
		function constrainUserMedia( track ) {
			const conf = self.mediaConf.video;
			return track.applyConstraints( conf );
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
		if ( !conf[ type ])
			return conf;
		
		const deviceType = type + 'input';
		let device = self.preferedDevices[ deviceType ];
		if ( !device )
			device = self.currentDevices[ deviceType ];
		
		if ( !device )
			return conf;
		
		let aDev = available[ deviceType ][ device.deviceId ];
		if ( !aDev )
			return conf;
		
		if ( 'boolean' === typeof( conf[ type ]))
			conf[ type ] = {};
		
		conf[ type ].deviceId = aDev.deviceId;
		return conf;
	}
	
	ns.Media.prototype.getMedia = function( conf, noFallback ) {
		const self = this;
		return new Promise(( resolve, reject ) => {
			window.navigator.mediaDevices.getUserMedia( conf )
				.then( success )
				.catch( failure );
			
			function success( media ) { mediaCreated( media, conf ); }
			function failure( err ) { mediaFailed( err, conf ); }
			
			function mediaFailed( err, conf ) {
				console.log( 'mediaFailed', {
					err  : err,
					conf : conf,
				});
				
				const errData = {
					code : 'ERR_MEDIA_FAILED',
					err  : err,
					conf : conf,
				};
				
				self.emit( 'mediafailed', errData );
				if ( self.giveUp || noFallback )
					reject( errData );
				else
					retrySimple();
			}
			
			function mediaCreated( media, conf ) {
				self.simpleConf = false;
				self.giveUp = false;
				resolve( media );
			}
		});
		
		function retrySimple() {
			// try audio + video, but no special conf
			if ( !self.simpleConf ) {
				let send = self.permissions.send;
				self.simpleConf = {
					audio : !!conf.audio,
					video : !!conf.video,
				};
				
				self.getMedia( self.simpleConf );
				return;
			}
			
			// try only audio, set giveUp so we dont try
			// again if it still fails.
			if ( self.simpleConf.video ) {
				self.simpleConf.video = false;
				self.giveUp = true;
				self.getMedia( self.simpleConf );
			}
		}
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
		
		self.emit( 'media', self.media );
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
			self.emit( 'track-ended', {
				id    : track.id,
				kind  : track.kind,
				label : track.label  || track.labelExtra,
			});
		}
	}
	
	ns.Media.prototype.releaseTrack = function( track ) {
		const self = this;
		track.onended = null;
		try {
			track.stop();
		} catch( e ) {}
	}
	
})( library.rtc );
