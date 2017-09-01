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
var library = window.library || {};
var friendUP = window.friendUP || {};
var hello = window.hello || {};

library.rtc = library.rtc || {};

/* webRTC adblock - adapterjs unfuck

Adblock Plus will wrap the RTCPeerConnection and set the properties of 
pcConfig to writable:false. Adapter.js does not make a check for that,
and will throw when it tries to rewrite these.

So here we wrap adpater.js' wrap before adblock does its wrap. So we
can unfuck the fuck.

Atleast we should be pretty safe against any unwanted pregnancies.

*/
(function wrapTheWrapBeforeTheOtherWrap() {
	//console.log( 'wrapTheWrapBeforeTheOtherWrap', window.RTCPeerConnection );
	const origRTCPeerConn = window.RTCPeerConnection;
	window.RTCPeerConnection = function( pcConfig, pcConstraints ) {
		var prop = Object.getOwnPropertyDescriptor( pcConfig, 'iceServers' );
		//console.log( 'unfuck.checkProp', prop );
		return new origRTCPeerConn( pcConfig, pcConstraints );
	}
	
	window.RTCPeerConnection.prototype = origRTCPeerConn.prototype;
	/*
	
	Adblock will not interfere as long as generateCertificate is not defined..
	
	Object.defineProperty( window.RTCPeerConnection, 'generateCertificate', {
		get : function() {
			return origRTCPeerConn.generateCertificate;
		}
	});
	*/
	//console.log( 'genCert?', window.RTCPeerConnection.generateCertificate );
	
})();

// RTC
// data-model-in-view side of the session
// holds all the actual peer objects and connections
(function( ns, undefined ) {
	ns.RTC = function( conn, view, conf, onclose, onready ) {
		if ( !( this instanceof ns.RTC ))
			return new ns.RTC( conn, view, conf, onclose, onready );
		
		var self = this;
		self.conn = conn || null;
		self.view = view;
		self.userId = conf.userId;
		self.rtcConf = conf.rtcConf;
		self.isGuest = conf.isGuest;
		self.peerList = conf.peerList;
		self.identities = conf.identities || {};
		self.quality = conf.rtcConf.quality || null;
		self.permissions = conf.rtcConf.permissions;
		self.constraints = conf.rtcConf.constraints;
		self.preferedDevices = conf.preferedDevices;
		self.onclose = onclose;
		self.onready = onready;
		
		self.peers = {};
		self.selfie = null;
		self.joined = false;
		
		self.init();
	}
	
	ns.RTC.prototype.init = function() {
		var self = this;
		if ( self.quality )
			self.view.currentQuality = self.quality.level;
		
		// menu
		self.bindMenu();
		
		// source select ui
		var sourceConf = {
			view     : self.view,
			onselect : sourcesSelected,
		};
		self.sourceSelect = new library.rtc.SourceSelect( sourceConf );
		function sourcesSelected( selected ) {
			if ( !selected )
				return;
			
			if ( !self.selfie )
				return;
			
			self.selfie.setMediaSources( selected );
		}
		
		// ui
		self.chat = self.view.addChat( self.userId, self.identities, self.conn );
		self.share = self.view.addShare( self.conn );
		
		// do init checks
		var initConf = {
			view           : self.view,
			onsourceselect : showSourceSelect,
			ondone         : allChecksDone,
		};
		self.initChecks = new library.rtc.InitChecks( initConf );
		self.initChecks.checkICE( self.rtcConf.ICE );
		self.initChecks.checkBrowser( browserBack );
		function browserBack( canContinue ) {
			if ( !canContinue ) {
				self.goLive( false );
				return;
			}
			
			self.createSelfie( selfieReady );
		}
		
		function allChecksDone( close ) {
			if ( close  ) {
				self.close();
				return;
			}
			
			closeInit();
		}
		
		function showSourceSelect() {
			closeInit();
			self.showSourceSelect();
		}
		
		function closeInit() {
			self.initChecks.close();
			delete self.initChecks;
			done();
		}
		
		function selfieReady( err ) {
			const ready = self.initChecks.checkSelfieReady( self.selfie, err );
			if ( !ready )
				return;
			
			var selfStream = self.selfie.getStream();
			self.initChecks.checkAudioInput( selfStream );
		}
		
		function done() {
			if ( self.isAdmin )
				self.setupAdmin();
			
			self.goLive( true );
		}
	}
	
	ns.RTC.prototype.goLive = function( ready ) {
		const self = this;
		self.bindConn();
		self.connectPeers();
		const onready = self.onready;
		delete self.onready;
		if ( onready )
			onready( null );
	}
	
	ns.RTC.prototype.bindConn = function() {
		var self = this;
		self.conn.on( 'ping'       , ping );
		self.conn.on( 'identity'   , identity );
		self.conn.on( 'identities' , identities );
		self.conn.on( 'nested-app' , nestedApp );
		self.conn.on( 'quality'    , quality );
		self.conn.on( 'join'       , join );
		self.conn.on( 'leave'      , leave );
		self.conn.on( 'close'      , close );
		
		function roomConf(   e ) { self.initialize(       e ); }
		function identity(   e ) { self.handleIdentity(   e ); }
		function identities( e ) { self.handleIdentities( e ); }
		function nestedApp(  e ) { self.handleNestedApp(  e ); }
		function quality(    e ) { self.handleQuality(    e ); }
		function ping(       e ) { self.handlePing(       e ); }
		function join(       e ) { self.handlePeerJoin(   e ); }
		function leave(      e ) { self.handlePeerLeft(   e ); }
		function close(      e ) { self.handleClosed(     e ); }
	}
	
	ns.RTC.prototype.connectPeers = function() {
		var self = this;
		self.peerList.forEach( connect );
		
		function connect( peerId ) {
			if ( peerId === self.userId )
				return;
			
			var conf = {
				peerId : peerId,
				doInit : true,
			};
			self.createPeer( conf );
		}
	}
	
	ns.RTC.prototype.bindMenu = function() {
		var self = this;
		self.menu = self.view.addMenu();
		self.menu.on( 'source-select' , sourceSelect );
		self.menu.on( 'restart'       , restart );
		
		if ( self.isGuest ) {
			self.menu.disable( 'share' );
		}
		
		function sourceSelect( s ) { self.showSourceSelect(); }
		function restart( s ) { self.restartStream(); }
	}
	
	ns.RTC.prototype.handleAppEvent = function( event ) {
		var self = this;
		console.log( 'rtc.handleAppEvent - NYI', event );
		return;
		
		self.broadcast( event );
	}
	
	ns.RTC.prototype.saveSetting = function( setting, value ) {
		var self = this;
		var save = {
			setting : setting,
			value   : value,
		};
		var setting = {
			type : 'setting',
			data : save,
		};
		self.conn.send( setting );
	}
	
	ns.RTC.prototype.handlePing = function( timestamp ) {
		const self = this;
		const pong = {
			type : 'pong',
			data : timestamp,
		};
		self.conn.send( pong );
	}
	
	ns.RTC.prototype.handleIdentity = function( conf ) {
		const self = this;
		self.identities[ conf.userId ] = conf.identity;
		self.updatePeerIdentity( conf.userId, conf.identity );
	}
	
	ns.RTC.prototype.handleIdentities = function( identities ) {
		const self = this;
		//self.identities = identities;
		for ( let idKey in identities ) {
			const id = identities[ idKey ];
			self.identities[ idKey ] = id;
			self.updatePeerIdentity( idKey, id );
		}
	}
	
	ns.RTC.prototype.handleQuality = function( quality ) {
		const self = this;
		if ( !self.selfie )
			return;
		
		self.selfie.setRoomQuality( quality );
		
	}
	
	ns.RTC.prototype.handlePeerJoin = function( peer ) {
		const self = this;
		peer.doInit = false;
		self.createPeer( peer );
	}
	
	ns.RTC.prototype.handlePeerLeft = function( peer ) {
		const self = this;
		const peerId = peer.peerId;
		self.closePeer( peerId );
	}
	
	ns.RTC.prototype.handleClosed = function() {
		const self = this;
		self.close();
	}
	
	ns.RTC.prototype.addClient = function( client ) {
		var self = this;
		self.getInvite( client.clientId );
	}
	
	ns.RTC.prototype.handleNestedApp = function( app ) {
		var self = this;
		self.view.addNestedApp( app );
		self.broadcast({
			type : 'nestedapp',
			data : app,
		});
	}
	
	ns.RTC.prototype.showSourceSelect = function() {
		var self = this;
		var devices = null;
		if ( self.selfie )
			devices = self.selfie.currentDevices;
		
		self.sourceSelect.show( devices );
	}
	
	ns.RTC.prototype.restartStream = function() {
		var self = this;
		var pids = Object.keys( self.peers );
		console.log( 'restartStream', pids );
		
		// stop peers
		pids.forEach( stop );
		// get new media
		self.selfie.setupStream( streamReady );
		function streamReady() {
			// restart peers
			pids.forEach( restart );
		}
		
		function stop( pid ) {
			var peer = self.peers[ pid ];
			peer.stop();
		}
		
		function restart( pid ) {
			var peer = self.peers[ pid ];
			peer.restart();
		}
	}
	
	ns.RTC.prototype.setupAdmin = function() {
		var self = this;
		console.log( 'setupAdmin', self );
		return;
		
		self.menu.enable( 'settings' );
		self.menu.on( 'settings', settings );
		self.settings = self.view.addSettings( onsave );
		
		function settings( s ) {
			if ( self.isAdmin && self.settings )
				self.settings.show();
		}
		
		function onsave( setting, value ) {
			self.saveSetting( setting, value );
		}
	}
	
	ns.RTC.prototype.syncPeers = function( peers ) {
		var self = this;
		checkRemoved( peers );
		checkJoined( peers );
		
		function checkRemoved( peers ) {
			var localPids = Object.keys( self.peers );
			var serverPids = peers.map( getId );
			var removed = localPids.filter( notInPeers );
			removed.forEach( remove );
			function remove( pid ) {
				self.removePeer( pid );
			}
			
			function notInPeers( pid ) {
				var index = serverPids.indexOf( pid );
				return !!( -1 === index );
			}
			
			function getId( peer ) { return peer.peerId; }
		}
		
		function checkJoined( peers ) {
			var joined = peers.filter( notFound );
			joined.forEach( add );
			
			function notFound( peer ) {
				var pid = peer.peerId;
				return !self.peers[ pid ];
			}
			
			function add( peer ) { /* add a peer */ }
		}
	}
	
	ns.RTC.prototype.reconnectPeers = function() {
		var self = this;
		console.log( 'RTC.reconnectPeers' );
		for( var pid in self.peers ) {
			var peer = self.peers[ pid ];
			peer.checkFailed();
		}
	}
	
	ns.RTC.prototype.createPeer = function( data ) {
		var self = this;
		const pid = data.peerId;
		var peer = self.peers[ pid ];
		if ( peer ) {
			console.log( 'createPeer - already exists', self.peers );
			peer.close();
			delete self.peers[ pid ];
			self.view.removePeer( pid );
		}
		
		if ( null == data.doInit )
			data.doInit = false;
		
		var identity = self.identities[ data.peerId ];
		if ( !identity )
			identity = {
				name   : '---',
				avatar : ''
			}
		
		var peer = new library.rtc.Peer({
			id       : data.peerId,
			identity : identity,
			doInit   : data.doInit,
			signal   : self.conn,
			rtcConf  : self.rtcConf,
			selfie   : self.selfie,
			onremove : signalRemovePeer,
			closeCmd : closeCmd,
		});
		
		peer.on( 'nestedapp' , nestedApp );
		
		function nestedApp( e ) { self.view.addNestedApp( e ); }
		
		self.peers[ peer.id ] = peer;
		self.view.addPeer( peer );
		
		function signalRemovePeer() { self.signalRemovePeer( data.peerId ); }
		function closeCmd() { self.closePeer( data.peerId ); }
	}
	
	ns.RTC.prototype.updatePeerIdentity = function( peerId, identity ) {
		const self = this;
		console.log( 'updateIdentity', {
			pid : peerId,
			id : identity,
		});
		
		if ( peerId === self.userId && self.selfie ) {
			self.selfie.updateIdentity( identity );
			return;
		}
		
		const peer = self.peers[ peerId ];
		if ( !peer )
			return;
		
		peer.updateIdentity( identity );
	}
	
	ns.RTC.prototype.signalRemovePeer = function( peerId ) {
		var self = this;
		self.roomSignal.send({
			type : 'remove',
			data : {
				peerId : peerId,
			}
		});
	}
	
	ns.RTC.prototype.removePeer = function( pid ) {
		var self = this;
		var peer = self.peers[ pid ];
		if ( !peer && ( pid === self.userId )) { // yuo got removed, close
			self.close();
			return;
		}
		
		if ( !peer )
			return;
		
		self.closePeer( peer.id );
	}
	
	ns.RTC.prototype.peerLeft = function( pid ) {
		var self = this;
		var peer = self.peers[ pid ];
		if ( !peer ) {
			return;
		}
		
		self.closePeer( peer.id );
	}
	
	ns.RTC.prototype.closePeer = function( peerId ) {
		var self = this;
		console.log( 'closePeer', {
			pid : peerId,
			peers : self.peers,
		});
		
		var peer = self.peers[ peerId ];
		if ( !peer ) {
			console.log( 'RTC.closePeer - no peer for id', peerId );
			return;
		}
		
		delete self.peers[ peerId ];
		self.view.removePeer( peerId );
		peer.close();
	}
	
	ns.RTC.prototype.createSelfie = function( createBack ) {
		var self = this;
		var identity = self.identities[ self.userId ];
		if ( !identity )
			identity = {
				name   : '---',
				avatar : '',
			};
		
		var selfie = new library.rtc.Selfie({
			conn            : self.conn,
			view            : self.view,
			menu            : self.menu,
			identity        : identity,
			permissions     : self.permissions,
			quality         : self.quality,
			preferedDevices : self.preferedDevices,
			isAdmin         : self.isAdmin,
			onleave         : onLeave,
		}, done );
		
		function onLeave() {
			self.leave();
		}
		
		function done( err, res ) {
			createBack( err );
		}
		
		self.selfie = selfie;
		self.view.addPeer( selfie );
		self.selfie.on( 'error'        , error );
		self.selfie.on( 'mute'         , broadcastMute );
		self.selfie.on( 'blind'        , broadcastBlind );
		self.selfie.on( 'screenmode'   , broadcastScreenMode );
		self.selfie.on( 'reflow'       , handleReflow );
		self.selfie.on( 'quality'      , setQuality );
		
		function error( e ) { self.handleSelfieError( e ); }
		function broadcastMute( isMuted ) { broadcast( 'mute', isMuted ); }
		function broadcastBlind( isBlinded ) { broadcast( 'blind', isBlinded ); }
		function broadcastScreenMode( mode ) { broadcast( 'screenmode', mode ); }
		function broadcast( type, data ) {
			self.broadcast({
				type : type,
				data : data,
			});
		}
		
		function handleReflow() {
			self.view.reflowPeers();
		}
		
		function setQuality( level ) {
			var quality = {
				type : 'quality',
				data : level,
			};
			self.conn.send( quality );
		}
	}
	
	ns.RTC.prototype.broadcast = function( event ) {
		var self = this;
		const pids = Object.keys( self.peers );
		pids.forEach( send );
		function send( toPid ) {
			const peer = self.peers[ toPid ];
			if ( !peer )
				return;
			
			peer.send( event );
		}
	}
	
	ns.RTC.prototype.leave = function() {
		var self = this;
		console.log( 'rtc.leave' );
		self.close();
	}
	
	ns.RTC.prototype.close = function() {
		var self = this;
		console.log( 'rtc.close' );
		var peerIds = Object.keys( self.peers );
		peerIds.forEach( callClose );
		function callClose( peerId ) {
			self.closePeer( peerId );
		}
		
		delete self.conf;
		delete self.conn;
		delete self.view;
		delete self.sourceSelect;
		delete self.menu;
		
		var onclose = self.onclose;
		delete self.onclose;
		if ( onclose )
			onclose();
	}
	
})( library.rtc );

// SELFIE
(function( ns, undefined ) {
	ns.Selfie = function( conf, callback ) {
		if ( !( this instanceof ns.Selfie ))
			return new ns.Selfie( conf, done );
		
		library.component.EventEmitter.call( this );
		
		var self = this;
		console.log( 'Selfie', conf );
		self.id = 'selfie';
		self.conn = conf.conn;
		self.view = conf.view;
		self.menu = conf.menu;
		self.identity = conf.identity;
		self.permissions = conf.permissions;
		self.preferedDevices = conf.preferedDevices;
		self.streamQuality = conf.quality || {
			level : 'medium',
			scale : 1,
		};
		self.isAdmin = conf.isAdmin;
		self.stream = null;
		self.onleave = conf.onleave;
		self.doneBack = callback;
		
		self.currentDevices = {};
		self.isBlind = false;
		self.isMute = false;
		
		self.isChrome = null;
		self.isFirefox = null;
		
		self.localStreamQuality = null;
		self.currentQuality = null;
		
		self.init();
	}
	
	ns.Selfie.prototype = Object.create( library.component.EventEmitter.prototype );
	
	// Public
	
	ns.Selfie.prototype.updateIdentity = function( identity ) {
		const self = this;
		self.emit( 'identity', identity );
	}
	
	ns.Selfie.prototype.close = function() {
		var self = this;
		self.release(); // component.EventEmitter, component/common.js
		if ( self.stream )
			self.clearStream();
		
		if ( self.shareMedia )
			self.clearShareMedia();
		
		delete self.stream;
		delete self.shareMedia;
		delete self.view;
		delete self.extConn;
		delete self.menu;
		delete self.onleave;
		delete self.doneBack;
		delete self.conn;
	}
	
	// Private
	
	ns.Selfie.prototype.init =function() {
		var self = this;
		self.supported = navigator.mediaDevices.getSupportedConstraints();
		console.log( 'supported', self.supported );
		
		//
		self.extConn = self.view.addExtConnPane( onExtConnShare );
		function onExtConnShare( e ) {
			console.log( 'onExtConnShare', e );
			self.extConn.close();
			self.toggleShareScreen();
		}
		
		self.screenShare = new library.rtc.ScreenShare();
		self.screenShare.checkIsAvailable( shareCheckBack );
		function shareCheckBack( err, isAvailable ) {
			if ( err || !isAvailable ) {
				console.log( 'shareCheckBack - screen share not available', {
					err       : err,
					available : isAvailable });
				
				self.toggleMenuScreenShareInstall( true );
				return;
			}
			
			console.log( 'shareCheckBack - sharing available', isAvailable );
			
		}
		
		//
		self.isSpeaking = new library.rtc.IsSpeaking();
		self.isChrome = !!( !!window.chrome && !!window.chrome.webstore );
		self.isFirefox = !!window.InstallTrigger;
		
		// lowest quality first or things will break
		self.videoQualityKeys = [ 'width', 'height', 'frameRate' ];
		self.videoQualityMap = {
			'low'     : [ 64, 64, 4 ],
			'medium'  : [ 480, 480, 24 ],
			'normal'  : [ 720, 720, 24 ],
			'default' : [ null, null, null ],
		};
		
		self.opusQualityKeys = [ 'maxcodecaudiobandwidth', 'maxaveragebitrate', 'usedtx' ];
		self.opusQualityMap = {
			'low'     : [ '24000', '16', null ],
			'medium'  : [ '48000', '32', null ],
			'normal'  : [ '48000', '32', null ],
			'default' : [ '48000', '32', null ],
		};
		
		self.sources = new library.rtc.MediaDevices();
		if ( self.preferedDevices )
			tryPreferedDevices();
		else
			setupSelfie();
		
		function tryPreferedDevices() {
			self.sources.getByType()
				.then( check )
				.catch( error );
				
			function check( available ) {
				console.log( 'available', available );
				let pref = self.preferedDevices;
				let prefAudio = available.audioinput[ pref.audioinput ];
				let prefVideo = available.videoinput[ pref.videoinput ];
				if ( prefAudio )
					self.currentDevices.audioinput = pref.audioinput;
				
				if ( prefVideo )
					self.currentDevices.videoinput = pref.videoinput;
				
				delete self.preferedDevices;
				console.log( 'currentDevices', self.currentDevices );
				setupSelfie();
			}
			
			function error( err ) {
				console.log( 'RTC.Selfie.tryPreferedDevices - sources error', err );
			}
		}
		
		function setupSelfie() {
			console.log( 'setupSelfie' );
			self.mediaConf = {
				audio : self.permissions.audio,
				video : self.permissions.video,
			};
			self.applyStreamQuality();
			self.setupStream( streamBack );
			function streamBack( err, res ) {
				if ( !self.doneBack )
					return;
				
				var doneBack = self.doneBack;
				delete self.doneBack;
				doneBack( err, res );
			}
			
			self.bindMenu();
		}
	}
	
	ns.Selfie.prototype.bindMenu = function() {
		var self = this;
		self.menu.on( 'mute'     , mute );
		self.menu.on( 'blind'    , blind );
		self.menu.on( 'q-default', qualityDefault );
		self.menu.on( 'q-medium' , qualityMedium );
		self.menu.on( 'q-low'    , qualityLow );
		self.menu.on( 'leave'    , leave );
		self.menu.on( 'screen-mode', screenMode );
		self.menu.on( 'toggle-screen-share', screenShare );
		self.menu.on( 'screen-share-ext', screenExtInstall );
		
		function mute( e ) { self.toggleMute(); }
		function blind( e ) { self.toggleBlind(); }
		function qualityDefault( e ) { self.handleQuality( 'normal' ); }
		function qualityMedium( e ) { self.handleQuality( 'medium' ); }
		function qualityLow( e ) { self.handleQuality( 'low' ); }
		function leave( e ) { self.leave(); }
		function screenMode( e ) { self.toggleScreenMode(); }
		function screenShare( e ) { self.toggleShareScreen(); }
		function screenExtInstall( e ) { self.openScreenExtInstall( e ); }
	}
	
	ns.Selfie.prototype.showError = function( errMsg ) {
		var self = this;
		self.emit( 'error', errMsg );
	}
	
	ns.Selfie.prototype.toggleMenuScreenShareInstall = function( showInstall ) {
		const self = this;
		if ( showInstall ) {
			self.menu.disable( 'toggle-screen-share' );
			self.menu.enable( 'screen-share-ext' );
		} else {
			self.menu.disable( 'screen-share-ext' );
			self.menu.enable( 'toggle-screen-share' );
		}
	}
	
	ns.Selfie.prototype.openScreenExtInstall = function() {
		const self = this;
		console.log( 'openScreenExtInstall' );
		window.open( 'https://chrome.google.com/webstore/detail/friend-screen-share/\
			ipakdgondpoahmhclacfgekboimhgpap' );
		
		self.extConn.show();
		self.screenShare.connect( connBack );
		function connBack( err, res ) {
			console.log( 'selfie.screenShare.connBack', {
				err : err,
				res : res,
			});
			if ( err ) {
				self.close();
				return;
			}
			
			self.extConn.setConnected( true );
			self.toggleMenuScreenShareInstall( false );
		}
	}
	
	ns.Selfie.prototype.toggleShareScreen = function() {
		const self = this;
		console.log( 'toggleShareScreen', self.chromeSourceId );
		if ( self.chromeSourceId )
			unshare();
		else
			share();
		
		function unshare() {
			revert();
			self.setupStream();
		}
		
		function revert() {
			self.chromeSourceId = null;
			self.chromeSourceOpts = null;
			self.menu.setState( 'toggle-screen-share', false );
			self.isScreenSharing = false;
			self.toggleScreenMode( 'cover' );
		}
		
		function share() {
			self.screenShare.getSourceId( getBack );
			function getBack( res ) {
				if ( !res || !res.sid )
					return;
				
				self.chromeSourceId = res.sid;
				self.chromeSourceOpts = res.opts;
				var screenMedia = null;
				var audioMedia = null;
				getScreenMedia( screenBack );
				function screenBack( err, res ) {
					if ( err ) {
						failed( err );
						return;
					}
					
					screenMedia = res;
					getAudioTrack( audioBack );
				}
				
				function audioBack ( err, res ) {
					if ( err ) {
						failed( err );
						return;
					}
					
					audioMedia = res;
					const media = combineMedia( screenMedia, audioMedia );
					self.menu.setState( 'toggle-screen-share', true );
					self.toggleScreenMode( 'contain' );
					self.isScreenSharing = true;
					self.setStream( media );
					self.bindShareTracks( screenMedia );
				}
			}
			
			function getScreenMedia( callback ) {
				console.log( 'found chromeSourceId', self.chromeSourceId );
				const conf = {
					audio : false,
				};
				
				conf.video = {
					mandatory : {
						chromeMediaSource : 'desktop',
						//maxWidth  : screen.width,
						//maxHeight : screen.height,
						chromeMediaSourceId : self.chromeSourceId,
					}
				}
				getMedia( conf )
					.then( screenOk )
					.catch( err );
					
				function screenOk( res ) {
					callback( null, res );
				}
				
				function err( e ) {
					console.log( 'screen failed', e );
					callback( e, null );
				}
			}
			
			function getAudioTrack( callback ) {
				const conf = {
					video : false,
					audio : {
						echoCancellation : true,
					},
				};
				getMedia( conf )
					.then( audioOk )
					.catch( err );
				
				function audioOk( media ) {
					callback( null, media );
				}
				
				function err( e ) {
					console.log( 'audio failed', e );
					callback( e, null );
				}
			}
			
			function getMedia( conf ) {
				return window.navigator.mediaDevices.getUserMedia( conf );
			}
			
			function combineMedia( screen, audio ) {
				let sT = screen.getTracks();
				let aT = audio.getTracks();
				const media = new MediaStream();
				media.addTrack( sT[ 0 ] );
				media.addTrack( aT[ 0 ] );
				return media;
			}
			
			function failed( e ) {
				console.log( 'screen share - something failed, revert', e );
				revert();
			}
		}
	}
	
	ns.Selfie.prototype.bindShareTracks = function( media ) {
		const self = this;
		self.shareMedia = media;
		const tracks = media.getTracks();
		tracks.forEach( bindOnEnded );
		
		function bindOnEnded( track ) {
			track.onended = onEnded;
			function onEnded( e ) {
				track.onended = null;
				if ( !self.shareMedia )
					return;
				
				self.shareMedia.removeTrack( track );
				checkMediaEmpty();
			}
		}
		
		function checkMediaEmpty() {
			if ( !self.shareMedia )
				return;
			
			let tracks = self.shareMedia.getTracks();
			if ( tracks.length )
				return;
			
			self.clearShareMedia();
			
			// no tracks, lets close share thingie, maybe
			if ( self.chromeSourceId )
				self.toggleShareScreen();
		}
	}
	
	ns.Selfie.prototype.clearShareMedia = function() {
		const self = this;
		console.log( 'clearShareMedia', self.shareMedia );
		if ( !self.shareMedia )
			return;
		
		let tracks = self.shareMedia.getTracks();
		tracks.forEach( stop );
		delete self.shareMedia;
		
		function stop( track ) {
			self.shareMedia.removeTrack( track );
			track.onended = null;
			track.stop();
		}
	}
	
	ns.Selfie.prototype.setMediaSources = function( devices ) {
		var self = this;
		if ( typeof( devices.audioinput ) === 'boolean' )
			self.permissions.audio = false;
		else
			self.permissions.audio = true;
		
		if ( typeof( devices.videoinput ) === 'boolean' )
			self.permissions.video = false;
		else
			self.permissions.video = true;
		
		self.currentDevices = devices;
		self.setupStream( streamBack );
		function streamBack( err, res ) {
			console.log( 'setMediaSources - streamBack', {
				err : err,
				res : res,
			});
			if ( err )
				return;
			
			self.savePreferedDevices();
		}
	}
	
	ns.Selfie.prototype.savePreferedDevices = function() {
		const self = this;
		console.log( 'savePreferedDevices', self.currentDevices );
		const pref = {
			type : 'prefered-devices',
			data : self.currentDevices,
		};
		self.conn.send( pref );
	}
	
	ns.Selfie.prototype.buildVideoQualityConf = function( level ) {
		const self = this;
		const scale = self.streamQuality.scale || 1;
		self.currentQuality = self.currentQuality || {};
		self.currentQuality.scale = scale;
		var arr = self.videoQualityMap[ level ];
		if ( !arr ) {
			console.log( 'buildVideoQualityConf - invalid level or missing in map', {
				level     : level,
				available : self.videoQualityMap,
			});
			return null;
		}
		
		var conf = {};
		self.videoQualityKeys.forEach( add );
		function add( key, index ) {
			var value = arr[ index ];
			console.log( 'add', {
				k : key,
				i : index,
				v : value,
				a : arr,
			});
			
			if ( 'frameRate' !== key )
				value = value * scale;
			
			conf[ key ] = value;
		}
		
		console.log( 'buildVideoQualityConf', conf );
		return conf;
	}
	
	ns.Selfie.prototype.handleQuality = function( level ) {
		var self = this;
		self.changeStreamQuality( level );
	}
	
	ns.Selfie.prototype.changeStreamQuality = function( level ) {
		var self = this;
		/*
		if ( !self.isAdmin )
			return;
		*/
		
		if ( !level )
			level = 'medium';
		
		self.emit( 'quality', level );
	}
	
	ns.Selfie.prototype.setRoomQuality = function( quality ) {
		var self = this;
		self.streamQuality = quality;
		var level = self.applyStreamQuality();
		if ( !level )
			return;
		
		if ( self.isScreenSharing ) {
			console.log( 'is screen sharing, dont reinit stream' );
			return;
		}
		
		self.setupStream();
		self.emit( 'room-quality', level ); // updating ui
	}
	
	ns.Selfie.prototype.applyStreamQuality = function() {
		const self = this;
		self.streamQuality.level = self.streamQuality.level || 'medium';
		self.streamQuality.scale = self.streamQuality.scale || 1;
		
		self.currentQuality = self.currentQuality || {};
		console.log( 'applyStreamQuality', {
			q : self.streamQuality,
			c : self.currentQuality,
		});
		if (( self.currentQuality.level === self.streamQuality.level ) &&
			( self.currentQuality.scale === self.streamQuality.scale )
		) {
			return null;
		}
		
		const level = self.streamQuality.level;
		self.currentQuality.level = level;
		console.log( 'currentQuality', self.currentQuality );
		const conf = self.buildVideoQualityConf( level );
		if ( !conf )
			return null;
		
		self.applyVideoConstraints( conf );
		return level;
	}
	
	ns.Selfie.prototype.getLowestQualityLevel = function( a, b ) {
		var self = this;
		// convention : lowest quality first
		var level = null;
		var levels = Object.keys( self.videoQualityMap );
		var aI = levels.indexOf( a );
		var bI = levels.indexOf( b );
		
		// undefined level
		if (( -1 === aI ) ||  ( -1 === bI ))
			throw new Error( 'selfie.getLowestQualityLevel - undefined level: '
				+ a + ' / ' + b );
		
		if ( aI > bI ) // b quality is lower
			level = b;
		else
			level = a;
		
		return level;
	}
	
	ns.Selfie.prototype.getVideoMandatory = function() {
		var self = this;
		if ( 'object' !== typeof( self.mediaConf.video ))
			self.mediaConf.video = {};
		
		var conf = self.mediaConf.video;
		conf.mandatory = conf.mandatory || {}
		return conf.mandatory;
	}
	
	ns.Selfie.prototype.applyVideoConstraints = function( conf ) {
		var self = this;
		if ( !conf ) {
			console.log( 'applyVideoConstraints - conf not defined', conf );
			return;
		}
		
		if ( 'object' !== typeof( self.mediaConf.video ))
			self.mediaConf.video = {};
		
		const video = self.mediaConf.video;
		const keys = Object.keys( conf );
		keys.forEach( set );
		function set( key  ) {
			let value = conf[ key ];
			if ( null == value )
				delete video[ key ];
			else
				video[ key ] = value;
		}
	}
	
	ns.Selfie.prototype.applyAudioQualityConstraints = function( bitrate ) {
		var self = this;
	}
	
	ns.Selfie.prototype.getOpusConf = function() {
		var self = this;
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
	
	ns.Selfie.prototype.setupStream = function( callback ) {
		var self = this;
		console.log( 'setupStream', self.streamSetupRunning );
		if ( self.streamSetupRunning ) {
			self.recycleStream = true;
			return;
		}
		
		self.streamSetupRunning = true;
		if ( self.stream )
			self.clearStream();
		
		self.audio = self.permissions.audio;
		self.video = self.permissions.video;
		
		self.mediaConf.audio = {
			"echoCancellation" : true,
		};
		
		self.sources.getByType()
			.then( init )
			.catch( devicesError );
		
		function devicesError( err ) {
			console.log( 'updating devices failed', err );
		}
		
		function init( availableDevices ) {
			var conf = {
				audio : false,
				video : false,
			};
			
			// add constraints
			if ( self.audio )
				conf[ "audio" ] = self.mediaConf.audio;
			if ( self.video )
				conf[ "video" ] = self.mediaConf.video;
			
			// specify aduio device
			if ( self.audio && self.currentDevices.audioinput )
				setDevice( 'audio', self.currentDevices.audioinput );
			
			// specify video device
			if ( self.video && self.currentDevices.videoinput )
				setDevice( 'video', self.currentDevices.videoinput );
			
			getMedia( conf );
			
			function setDevice( type, label ) {
				console.log( 'setupStream - setDevice', {
					type   : type,
					label  : label,
					screen : self.chromeSourceId,
				});
				
				var sourceType = type + 'input';
				var device = availableDevices[ sourceType ][ label ];
				if ( !device ) {
					console.log( 'device not found for label', {
						sourceType : sourceType,
						label : label,
						available : availableDevices });
					return;
				}
				
				if ( 'boolean' === typeof( conf[ type ] ))
					conf[ type ] = {
					};
				
				conf[ type ].deviceId = device.deviceId;
				console.log( 'setupStream - setDevice - conf', conf );
			}
		}
		
		function getMedia( conf ) {
			console.log( 'setupStream - getUserMedia - conf', conf );
			window.navigator.mediaDevices.getUserMedia( conf )
				.then( success )
				.catch( error );
				
			function success( media ) { mediaCreated( media, conf ); }
			function error( err ) { mediaFailed( err, conf ); }
		}
		
		function mediaCreated( media, constraints ) {
			console.log( 'setupStream - mediaCreated', {
				m  : media,
				c  : constraints,
				ts : media.getTracks(),
			});
			
			var audioTracks = media.getAudioTracks();
			var videoTracks = media.getVideoTracks();
			if ( audioTracks.length ) {
				updateDevice( audioTracks[ 0 ], 'audioinput' );
			}
			else {
				self.currentDevices.audioinput = null;
				self.audio = false;
			}
			
			if ( videoTracks.length )
				updateDevice( videoTracks[ 0 ], 'videoinput' );
			else {
				self.currentDevices.videoinput = null;
				self.video = false;
			}
			
			self.emit( 'currentdevices', self.currentDevices );
			self.lastGoodConstraints = constraints;
			self.setStream( media, constraints );
			done( null, media );
			
			function updateDevice( track, type ) {
				self.currentDevices[ type ] = track.label;
			}
		}
		
		function mediaFailed( err, constraints ) {
			self.clearStream();
			var errData = {
				err : err,
				constraints : constraints,
			};
			console.log( 'mediafailed', errData );
			self.emit( 'mediafailed', errData );
			
			if ( self.lastGoodConstraints )
				retryLastGood();
			else
				done( errData, null );
		}
		
		function retryLastGood() {
			const conf = self.lastGoodConstraints;
			console.log( 'retryLastGood', conf );
			self.lastGoodConstraints = null;
			getMedia( conf );
		}
		
		function done( err, res ) {
			console.log( 'setupStream - done', {
				rs : self.recycleStream,
				sr : self.streamSetupRunning,
				err : err,
				res : res,
			});
			if ( self.recycleStream ) {
				setTimeout( recycle, 1 );
				return;
			}
			
			self.streamSetupRunning = false;
			if ( callback )
				callback( err, res );
			
			function recycle() {
				console.log( 'setupStream - done - recycle' );
				self.recycleStream = false;
				self.streamSetupRunning = false;
				self.setupStream( callback );
			}
		}
	}
	
	ns.Selfie.prototype.setStream = function( stream, constraints ) {
		var self = this;
		console.log( 'setStream', {
			s : stream,
			ts : stream.getTracks(),
		});
		if ( self.stream )
			self.clearStream();
		
		self.stream = stream;
		//self.isSpeaking.set( stream );
		
		if ( self.isMute ) {
			console.log( 'setStream - toggleMute', self.isMute );
			self.toggleMute( true );
		}
		
		if ( self.isBlind ) {
			console.log( 'setStream - toggleBlind', self.isBlind );
			self.toggleBlind( true );
		}
		
		var vTrack = self.getVideoTrack();
		var aTrack = self.getAudioTrack();
		
		console.log( 'emit selfie', stream );
		self.emit( 'selfie', stream );
		self.emit( 'video', !!vTrack );
		self.emit( 'audio', !!aTrack );
	}
	
	ns.Selfie.prototype.getStream = function() {
		var self = this;
		console.log( 'selfie.getStream', self.stream );
		return self.stream;
	}
	
	ns.Selfie.prototype.clearStream = function() {
		var self = this;
		if ( !self.stream )
			return;
		
		console.log( 'clearStream', self.stream );
		var tracks = self.stream.getTracks();
		tracks.forEach( stop );
		self.stream = null;
		self.emit( 'stream', null );
		
		function stop( track ) {
			self.stream.removeTrack( track );
			track.stop();
		}
	}
	
	/*
	ns.Selfie.prototype.getMeta = function() {
		var self = this;
		return {
			name : self.name,
			avatar : self.avatar,
		};
	}
	*/
	
	ns.Selfie.prototype.showQueuePosition = function( data ) {
		var self = this;
		self.emit( 'queue', data );
	}
	
	ns.Selfie.prototype.shareRoom = function() {
		var self = this;
		self.emit( 'share' );
	}
	
	ns.Selfie.prototype.emitReflow = function() {
		var self = this;
		self.emit( 'reflow' );
	}
	
	ns.Selfie.prototype.toggleScreenMode = function( mode ) {
		const self = this;
		if ( !self.screenMode || 'cover' === self.screenMode )
			self.screenMode = 'contain';
		else
			self.screenMode = 'cover';
		
		if ( mode )
			self.screenMode = mode;
		
		const isCover = ( 'contain' === self.screenMode );
		self.menu.setState( 'screen-mode', isCover );
		self.emit( 'screenmode', self.screenMode );
	}
	
	ns.Selfie.prototype.toggleMute = function( force ) {
		var self = this;
		var audio = self.getAudioTrack();
		if ( !audio )
			return;
		
		if ( force === !audio.enabled )
			return;
		
		if ( typeof( force ) !== 'undefined' )
			audio.enabled = !force;
		else
			audio.enabled = !audio.enabled;
		
		self.isMute = !audio.enabled;
		self.emit( 'mute', self.isMute );
		return self.isMute;
	}
	
	ns.Selfie.prototype.toggleBlind = function( force ) {
		var self = this;
		var video = self.getVideoTrack();
		if ( !video ) {
			console.log( 'selfie.toggleBlind - no video track' );
			return;
		}
		
		if ( force === !video.enabled )
			return;
		
		if ( typeof( force ) !== 'undefined' )
			video.enabled = !force;
		else
			video.enabled = !video.enabled;
		
		self.isBlind = !video.enabled;
		self.emit( 'blind', self.isBlind );
		return self.isBlind;
	}
	
	ns.Selfie.prototype.getAudioTrack = function() {
		var self = this;
		if ( self.stream )
			return self.stream.getAudioTracks()[ 0 ];
		else
			return null;
	}
	
	ns.Selfie.prototype.getVideoTrack = function() {
		var self = this;
		if ( self.stream )
			return self.stream.getVideoTracks()[ 0 ];
		else
			return null;
	}
	
	ns.Selfie.prototype.leave = function() {
		var self = this;
		self.onleave();
	}
	
})( library.rtc );


// PEER
(function( ns, undefined ) {
	ns.Peer = function( conf ) {
		if ( !( this instanceof ns.Peer ))
			return new ns.Peer( conf );
		
		library.component.EventEmitter.call( this );
		
		var self = this;
		self.conf = conf;
		self.id = conf.id;
		self.identity = conf.identity;
		self.rtcConf = conf.rtcConf;
		self.onremove = conf.onremove; // when the remote peer initiates a close, call this
		self.closeCmd = conf.closeCmd; // closing from this end ( ui click f.ex. )
		self.selfie = conf.selfie;
		self.signal = null;
		
		self.alphaSession = null;
		self.alpha = null;
		self.sessions = {};
		self.tracks = {};
		self.stream = null;
		
		self.isVideo = false;
		self.isAudio = false;
		
		self.isBlind = false;
		self.isMute = false;
		
		self.metaInterval = null;
		self.syncInterval = null;
		self.syncStamp = null;
		self.doInit = null;
		
		self.pingInterval = null;
		self.pingStep = 1000 * 3;
		self.pingTimeout = 1000 * 10;
		self.pingTimeouts = {};
		self.pongs = [];
		
		self.init( conf.signal );
	}
	
	ns.Peer.prototype = Object.create( library.component.EventEmitter.prototype );
	
	// Public
	
	// send an event to the other peer
	// primary transport is the alpha data channel
	// secondary transport is through the signaling server ( slower )
	ns.Peer.prototype.send = function( event ) {
		const self = this;
		if ( self.alpha )
			self.alpha.send( event );
		else
			self.signal.send( event );
	}
	
	ns.Peer.prototype.updateIdentity = function( identity ) {
		const self = this;
		self.emit( 'identity', identity );
	}
	
	ns.Peer.prototype.checkFailed = function() {
		var self = this;
		console.log( 'Peer.checkReconnect', self.sessions );
		if ( hasFailed( self.alphaSession )) {
			self.restart();
			return;
		}
		
		const sids = Object.keys( self.sessions );
		const needsRestart = sids.some( checkFail );
		if ( needsRestart )
			self.restart();
		
		function checkFail( sid ) {
			let session = self.session[ sid ];
			return hasFailed( session );
		}
		
		function hasFailed( session ) {
			var rtcState = session.conn.iceConnectionState;
			console.log( 'hasFailed', { sid : sid , state : rtcState });
			if ( 'failed' === rtcState )
				return true;
			return false;
		}
	}
	
	ns.Peer.prototype.restart = function() {
		const self = this;
		console.log( 'Peer.restart', self.stopped );
		sendRestart();
		self.doRestart();
		
		function sendRestart() {
			let restart = {
				type : 'restart',
			};
			self.signal.send( restart );
		}
	}
	
	ns.Peer.prototype.stop = function() {
		const self = this;
		console.log( 'Peer.stop', self.stopped );
		if ( self.stopped )
			return;
		
		self.stopped = true;
		sendStop();
		self.doStop();
		
		function sendStop() {
			let stop = {
				type : 'stop',
			};
			self.signal.send( stop );
		}
	}
	
	// Private
	
	ns.Peer.prototype.init = function( parentSignal ) {
		const self = this;
		
		// websocket / signal server path
		self.signal = new library.component.EventNode(
			self.id,
			parentSignal,
			eventSink
		);
		
		function eventSink( type, event ) {
			console.log( 'Peer.eventsink', {
				t : type,
				e : event,
			});
		}
		
		self.signal.on( 'sync'        , sync );
		self.signal.on( 'sync-accept' , syncAccept );
		self.signal.on( 'restart'     , restart );
		self.signal.on( 'stop'        , stop );
		self.signal.on( 'alpha-ready' , alphaReady );
		self.signal.on( 'open'        , open );
		
		function sync( e ) { self.handleSync( e ); }
		function syncAccept( e ) { self.handleSyncAccept( e ); }
		function restart( e ) { self.doRestart(); }
		function stop( e ) { self.doStop(); }
		function alphaReady( e ) { self.handleAlphaReady( e ); }
		function open( e ) { self.handleOpen( e ); }
		
		self.bindSignalChannel( self.signal );
		
		// selfie
		self.streamHandlerId = self.selfie.on( 'selfie', handleStream );
		function handleStream( e ) { self.handleSelfieStream( e ); }
		
		self.startSync();
	}
	
	// peer sync
	
	ns.Peer.prototype.startSync = function() {
		const self = this;
		const now = self.syncStamp || Date.now();
		console.log( 'startSync', now );
		self.syncStamp = now;
		const sync = {
			type : 'sync',
			data : now,
		};
		
		self.signal.send( sync );
		self.syncInterval = setInterval( sendSync, 2000 );
		function sendSync() {
			if ( !self.syncInterval )
				return;
			
			console.log( 'sending sync', sync.data );
			self.signal.send( sync );
		}
	}
	
	ns.Peer.prototype.handleSync = function( remoteStamp ) {
		const self = this;
		console.log( 'handleSync', {
			remote : remoteStamp,
			doInit : self.doInit,
		});
		// sync has already been set, ignore
		if ( null != self.doInit )
			return;
		
		// invalid remote stamp, drop
		if ( null == remoteStamp ) {
			console.log( 'nullstamp, wut?', remoteStamp );
			return;
		}
		
		// same stamp, reroll
		if ( self.syncStamp === remoteStamp ) {
			self.stopSync();
			const delay = ( Math.floor( Math.random * 20 ) + 1 ); // we dont want a 0ms delay
			console.log( 'handleSync - equal, reroll', delay );
			setTimeout( restart, delay );
			function restart() {
				self.startSync();
			}
			
			return;
		}
		
		self.acceptSync( remoteStamp );
	}
	
	ns.Peer.prototype.acceptSync = function( remoteStamp ) {
		const self = this;
		console.log( 'acceptSync', {
			local  : self.syncStamp,
			remote : remoteStamp,
			doInit : self.doInit,
		});
		
		if ( null == self.syncStamp )
			self.syncStamp = Date.now();
		
		const accept = {
			type : 'sync-accept',
			data : [
				self.syncStamp,
				remoteStamp,
			],
		};
		self.signal.send( accept );
		
		// comapre, lowest stamp will be it
		if ( null == self.doInit )
			self.setDoInit( self.syncStamp, remoteStamp );
	}
	
	ns.Peer.prototype.handleSyncAccept = function( stamps ) {
		const self = this;
		console.log( 'syncAccept',{
			s : stamps,
			t : self.syncStamp,
		});
		if ( !self.syncStamp )
			return;
		
		const remote = ( stamps[0] === self.syncStamp ) ? stamps[ 1 ] : stamps[ 0 ];
		self.setDoInit( self.syncStamp, remote );
	}
	
	ns.Peer.prototype.stopSync = function() {
		const self = this;
		self.syncStamp = null;
		if ( null == self.syncInterval )
			return;
		
		clearInterval( self.syncInterval );
		self.syncInterval = null;
	}
	
	ns.Peer.prototype.setDoInit = function( localStamp, remoteStamp ) {
		const self = this;
		if ( localStamp < remoteStamp )
			self.doInit = true;
		else
			self.doInit = false;
		
		console.log( 'doInit', self.doInit );
		self.stopSync();
		if ( !self.doInit )
			self.sendOpen();
		
		//self.setupAlphaSession();
	}
	
	// data, "alpha", channel setup
	
	ns.Peer.prototype.setupAlphaSession = function() {
		const self = this;
		console.log( 'setupAlphaChannel', self );
		self.alphaSession = new library.rtc.Session({
			type      : 'alpha',
			doInit    : self.doInit,
			rtc       : self.rtcConf,
			signal    : self.signal,
		});
		
		self.alphaSession.on( 'state', stateChange );
		self.alphaSession.on( 'error', error );
		self.alphaSession.once( 'datachannel', alphaChannel );
		
		function stateChange( e ) { console.log( 'alphaSession state change', e ); }
		function error( e ) { console.log( 'alphaError', e ); }
		function alphaChannel( e ) { self.bindAlphaChannel( e ); }
		
		if ( self.doInit ) {
			if ( self.remoteAlphaReady )
				self.startAlpha();
		} else
			self.signal.send({
				type : 'alpha-ready',
				data : true,
			});
	}
	
	ns.Peer.prototype.handleAlphaReady = function( isReady ) {
		const self = this;
		console.log( 'handleAlphaReady', isReady );
		if ( self.alphaSession )
			self.startAlpha();
		else
			self.remoteAlphaReady = isReady;
	}
	
	ns.Peer.prototype.startAlpha = function() {
		const self = this;
		console.log( 'startAlpha', self );
		if ( !self.doInit )
			return;
		
		const conn = self.alphaSession.createDataChannel( 'alpha' );
		self.alpha = new library.rtc.DataChannel(
			'alpha',
			conn,
			onOpen,
			onClose,
			alphaSink
		);
		
		function onOpen( time ) {
			console.log( 'dataOpen', time );
			self.stopped = false;
			self.startPing();
			self.sendMeta();
		}
		
		function onClose( time ) {
			console.log( 'dataClosed', time );
			self.resetAlpha();
		}
		
		function alphaSink( type, data ) {
			console.log( 'alphaSink', {
				t : type,
				d : data,
			});
		}
		
		self.bindSignalChannel( self.alpha );
	}
	
	ns.Peer.prototype.bindSignalChannel = function( conn ) {
		const self = this;
		console.log( 'bindSignalChannel', conn );
		
		conn.on( 'blind'       , blind );
		conn.on( 'mute'        , mute );
		conn.on( 'screenmode'  , screenMode );
		conn.on( 'meta'        , meta );
		conn.on( 'constraints' , handleConstraints );
		conn.on( 'nostream'    , peerNoStream );
		conn.on( 'nestedapp'   , nestedApp );
		conn.on( 'recycle'     , recycle );
		conn.on( 'reconnect'   , reconnect );
		conn.on( 'leave'       , leave );
		conn.on( 'close'       , closed );
		conn.on( 'ping'        , ping );
		conn.on( 'pong'        , pong );
		
		function blind( e ) { self.setRemoteBlind( e ); }
		function mute( e ) { self.setRemoteMute( e ); }
		function screenMode( e ) { self.setScreenMode( e ); }
		function meta( e ) { self.handleMeta( e ); }
		function handleConstraints( e ) { self.handleRemoteConstraints( e ); }
		function peerNoStream( e ) { self.handleNoStream(); }
		function nestedApp( e ) { self.emit( 'nestedapp', e ); }
		function recycle( e ) { self.handleRecycle( e ); }
		function reconnect( e ) { self.handleReconnect( e ); }
		function leave( e ) { console.log( 'peer left?' ); }
		function closed( e ) { self.closeCmd(); }
		function ping( e ) { self.handlePing( e ); }
		function pong( e ) { self.handlePong( e ); }
	}
	
	ns.Peer.prototype.resetAlpha = function() {
		const self = this;
		console.log( 'resetAlpha', self );
		self.closeAlpha();
		self.setupAlphaSession();
	}
	
	ns.Peer.prototype.closeAlpha = function() {
		const self = this;
		console.log( 'closeAlpha' );
		self.stopPing();
		if ( self.alpha )
			self.alpha.close();
		
		if ( self.alphaSession )
			self.alphaSession.close();
		
		delete self.alpha;
		delete self.alphaSession;
	}
	
	// stream setup
	
	ns.Peer.prototype.createSession = function( type ) {
		const self = this;
		if ( !type )
			type = 'stream';
		
		if ( self.sessions[ type ])
			self.closeSession( type );
		
		var session = new library.rtc.Session({
			type      : type,
			doInit    : self.doInit,
			rtc       : self.rtcConf,
			signal    : self.signal,
			modifySDP : modSDP,
		});
		self.sessions[ type ] = session;
		
		session.on( 'stream'   , streamAdded );
		session.on( 'track'    , trackAdded );
		session.on( 'nostream' , sendNoStream );
		session.on( 'state'    , stateChange );
		session.on( 'stats'    , statsUpdate );
		session.on( 'error'    , sessionError );
		
		function streamAdded( e ) { self.streamAdded( e, type ); }
		function trackAdded( e ) { self.trackAdded( e, type ); }
		function trackRemoved( e ) { self.trackRemoved( e, type ); }
		function sendNoStream( e ) { self.sendNoStream( type ); }
		function stateChange( e ) { self.handleSessionStateChange( e, type ); }
		function statsUpdate( e ) { self.handleStatsUpdate( e, type ); }
		function sessionError( e ) { self.handleSessionError( e, type ); }
		function modSDP( e ) { return self.modifySDP( e, type ); }
	}
	
	//
	
	ns.Peer.prototype.sendOpen = function() {
		const self = this;
		console.log( 'sendOpen' );
		const open = {
			type : 'open',
		};
		self.signal.send( open );
	}
	
	ns.Peer.prototype.handleOpen = function( e ) {
		const self = this;
		console.log( 'handleOpen', e );
		self.startPing();
		self.sendMeta();
	}
	
	ns.Peer.prototype.startPing = function() {
		const self = this;
		if ( self.pingInterval )
			self.stopPing();
		
		self.pingInterval = setInterval( sendPing, self.pingStep );
		function sendPing() {
			if ( null == self.pingInterval )
				return;
			
			self.sendPing();
		}
	}
	
	ns.Peer.prototype.sendPing = function() {
		const self = this;
		const stamp = Date.now();
		const ping = {
			type : 'ping',
			data : stamp,
		};
		
		self.send( ping );
		self.pingTimeouts[ stamp ] = setTimeout( timeout, self.pingTimeout );
		function timeout() {
			const timer = self.pingTimeouts[ stamp ];
			if ( null == timer )
				return;
			
			delete self.pingTimeouts[ stamp ];
			self.setConnectionTimeout();
		}
	}
	
	ns.Peer.prototype.handlePing = function( stamp ) {
		const self = this;
		const pong = {
			type : 'pong',
			data : stamp,
		};
		self.send( pong );
	}
	
	ns.Peer.prototype.handlePong = function( stamp ) {
		const self = this;
		const now = Date.now();
		const timer = self.pingTimeouts[ stamp ];
		if ( null == timer )
			return; // it has already timed out
		
		clearTimeout( timer );
		delete self.pingTimeouts[ stamp ];
		
		stamp = parseInt( stamp, 10 );
		const pingTime = now - stamp;
		self.emitRTCPing( pingTime );
	}
	
	ns.Peer.prototype.stopPing = function( ) {
		const self = this;
		console.log( 'alpha.stopPing' );
		if ( self.pingInterval )
			clearInterval( self.pingInterval );
		
		self.pingInterval = null;
		
		if ( null == self.pingTimeouts )
			return;
		
		const timeouts = Object.keys( self.pingTimeouts );
		timeouts.forEach( clear );
		self.pingTimeouts = {};
		function clear( stamp ) {
			if ( !stamp )
				return;
			
			const timer = self.pingTimeouts[ stamp ];
			delete self.pingTimeouts[ timer ];
			clearTimeout( timer );
		}
	}
	
	ns.Peer.prototype.setConnectionTimeout = function() {
		const self = this;
		console.log( 'connection timeout' );
		self.emitRTCPing( null );
		self.restart();
	}
	
	ns.Peer.prototype.emitRTCPing = function( pingTime ) {
		const self = this;
		const rtcPing = {
			type : 'rtc',
			data : {
				type : 'ping',
				data : pingTime,
			},
		};
		self.emit( 'state', rtcPing );
	}
	
	ns.Peer.prototype.handleReconnect = function( sid ) {
		var self = this;
		console.log( 'Peer.handleReconnect', sid );
		self.showSelfie( null, sid );
	}
	
	ns.Peer.prototype.handleRecycle = function( sid ) {
		var self = this;
		console.log( 'Peer.handleRecycle', self.doInit );
		self.closeSession( sid );
		self.createSession( sid );
		if ( self.doInit )
			self.showSelfie( null, sid );
		else
			sendReconnect( sid );
		
		function sendReconnect( sid ) {
			var msg = {
				type : 'reconnect',
				data : sid,
			};
			self.send( msg );
		}
	}
	
	ns.Peer.prototype.doRestart = function() {
		var self = this;
		console.log( 'Peer.doRetart' );
		self.doStop();
		self.sendMeta();
	}
	
	ns.Peer.prototype.doStop = function( sid ) {
		var self = this;
		console.log( 'Peer.doStop', sid );
		self.closeAllSessions();
		self.closeAlpha();
	}
	
	ns.Peer.prototype.closeAllSessions = function() {
		var self = this;
		console.log( 'closeAllSessions' );
		self.metaSyncDone = false;
		for ( var sid in self.sessions )
			self.closeSession( sid );
	}
	
	ns.Peer.prototype.closeSession = function( sid ) {
		var self = this;
		console.log( 'Peer.closeSession', sid );
		var sess = self.sessions[ sid ];
		delete self.sessions[ sid ];
		sess.close();
	}
	
	ns.Peer.prototype.handleQualityUpdate = function( e ) {
		var self = this;
		console.log( 'handleQualityUpdate', e );
		if ( !self.sessions ) {
			console.log( 'peer.handleQualityUpdate - theres no sessions', {
				sessions : self.sessions,
			});
			return;
		}
		
		for ( var id in self.sessions )
			self.sessions[ id ].renegotiate();
	}
	
	ns.Peer.prototype.modifySDP = function( SDPObj, type ) {
		var self = this;
		if ( 'video' === type )
			return SDPObj;
		
		if ( 'normal' === self.selfie.currentQuality )
			return SDPObj;
		
		var opusConf = self.selfie.getOpusConf();
		if ( !opusConf )
			return SDPObj;
		
		var str = SDPObj.sdp;
		var lines = str.split( '\r\n' );
		lines = modOpus( lines, opusConf );
		
		SDPObj.sdp = lines.join( '\r\n' );
		return SDPObj;
		
		function modOpus( lines, conf ) {
			var opusIndex = getIndex( lines );
			if ( -1 === opusIndex ) {
				console.log( 'could not find opus in line', lines );
				return lines;
			}
			
			var mediaId = getMediaId( lines[ opusIndex ]);
			var fmtpIndex = checkForFMTP( lines, mediaId );
			var fmtpKV = conf;
			var fmtpLine = null;
			if ( -1 === fmtpIndex ) {
				fmtpLine = buildFmtpLine( lines, fmtpKV, mediaId );
				lines.splice( opusIndex + 1, 0, fmtpLine );
			}
			else {
				fmtpLine = buildFmtpLine( lines, fmtpKV, mediaId, fmtpIndex );
				lines[ fmtpIndex ] = fmtpLine;
			}
			
			return lines;
			
			function getIndex( lines ) {
				var opi = -1;
				lines.some( findOpus );
				return opi;
				
				function findOpus( line, index ) {
					inLine = line.indexOf( 'opus/48000' );
					if ( -1 !== inLine ) {
						opi = index;
						return true;
					}
					
					return false;
				}
			}
			
			function getMediaId( str ) {
				var match = str.match( /rtpmap:([\d]+)\s/ )
				if ( !match )
					return false;
				
				return match[ 1 ];
			}
			
			function checkForFMTP( lines, mId ) {
				var str = 'fmtp:' + mId;
				var rx = new RegExp( str );
				var fmtpIndex = -1;
				lines.some( match );
				return fmtpIndex;
				
				function match( line, index ) {
					var match = line.match( rx );
					if ( match ) {
						fmtpIndex = index;
						return true;
					}
					
					return false;
				}
			}
			
			function buildFmtpLine( lines, fmtpKV, mediaId, index ) {
				var line = '';
				if ( null != index )
					line = lines[ index ] + ';';
				else
					line = 'a=fmtp:' + mediaId + ' ';
				
				var keys = Object.keys( fmtpKV );
				keys.forEach( add );
				return line;
				
				function add( key ) {
					var value = fmtpKV[ key ];
					line += key + '=' + value + ';';
				}
			}
		}
	}
	
	ns.Peer.prototype.handleSignalPing = function( pingTime ) {
		var self = this;
		console.log( 'handleSignalPing',  pingTime );
		if (( 0 === pingTime ) || ( null === pingTime ))
			setTimeoutState();
		
		if ( -1 === pingTime )
			setErrorState();
		
		var ping = {
			type : 'ping',
			data : pingTime,
		};
		sendSignal( ping );
		
		function setTimeoutState() {
			var timeout = {
				type : 'timeout',
			};
			sendSignal( timeout );
		}
		
		function setErrorState() {
			var error = {
				type : 'error',
			};
			sendSignal( error );
		}
		
		function sendSignal( event ) {
			var state = {
				type : 'signal',
				data : event,
			};
			self.emit( 'state', state );
		}
	}
	
	ns.Peer.prototype.setRemoteBlind = function( isBlinded ) {
		var self = this;
		self.remoteBlind = !!isBlinded;
		self.emit( 'blinded', self.remoteBlind );
		self.emitStreamState();
	}
	
	ns.Peer.prototype.setRemoteMute = function( isMuted ) {
		var self = this;
		self.remoteMute = !!isMuted;
		self.emit( 'muted', self.remoteMute );
		self.emitStreamState();
	}
	
	ns.Peer.prototype.setScreenMode = function( mode ) {
		const self = this;
		console.log( 'setScreenMode', mode );
		self.screenMode = mode;
		self.emit( 'screenmode' );
	}
	
	ns.Peer.prototype.handleSelfieStream = function( stream ) {
		var self = this;
		console.log( 'Peer.handleSelfieStream', stream );
		self.showSelfie( stream );
	}
	
	ns.Peer.prototype.showSelfie = function( stream, sessionType ) {
		var self = this;
		if ( !stream ) {
			stream = self.selfie.getStream();
			console.log( 'Peer.showSelfie - no stream passed, getStream()', stream );
		}
		
		if ( !stream ) {
			console.log( 'Peer.showSelfie - still no stream - send no stream' );
			self.sendNoStream( sessionType );
			return;
		}
		
		console.log( 'Peer.showSelfie - adding stream', stream );
		self.addStream( stream );
		/*
		if ( self.isChromePair )
			self.addStream( stream );
		else
			self.addTracks( stream, sessionType );
		*/
	}
	
	ns.Peer.prototype.addStream  =function( stream ) {
		var self = this;
		var sess = self.sessions[ 'stream' ];
		if ( !sess ) {
			console.log( 'Peer.addStream - no session', self.sessions );
			return;
		}
		
		console.log( 'Peer.addStream', stream );
		sess.addStream( stream );
	}
	
	ns.Peer.prototype.addTracks = function( stream, sessionType ) {
		var self = this;
		var tracks = stream.getTracks();
		console.log( 'Peer.addTracks', { s : stream, t : tracks });
		tracks.forEach( addToSession );
		function addToSession( track ) {
			var type = track.kind;
			// if session type is defined, thats the only track thats to be refreshed
			if ( sessionType && ( sessionType !== type ))
				return;
			
			var session = self.sessions[ type ];
			if ( !session ) {
				console.log( 'peer.addTracks - no session for type',
					{ t : type, s : self.sessions });
				return;
			}
			
			if ( self.selfie.isFirefox ) {
				console.log( 'firefoxaddtracks', track );
				session.addStream( stream ); // .addStream will extract the correct track
			} else {
				console.log( 'chromeaddtracks', track );
				var fakeStream = new window.MediaStream();
				fakeStream.addTrack( track );
				session.addStream( fakeStream );
			}
		}
	}
	
	ns.Peer.prototype.setConstraint = function( constraints ) {
		var self = this;
		self.send({
			type : 'constraints',
			data : constraints,
		});
	}
	
	ns.Peer.prototype.handleRemoteConstraints = function( data ) {
		var self = this;
		console.log( 'handleRemoteConstraints', data );
		self.constraints = data;
	}
	
	ns.Peer.prototype.handleNoStream = function() {
		var self = this;
		console.log( 'handleNoStream', self.doInit );
		if ( !self.doInit )
			self.showSelfie();
		
		self.emit( 'nostream' );
	}
	
	ns.Peer.prototype.sendNoStream = function( sessionId ) {
		var self = this;
		console.log( 'sendNoStream', sessionId );
		self.send({
			type : 'nostream',
			data : sessionId,
		});
	}
	
	ns.Peer.prototype.streamAdded = function( stream ) {
		var self = this;
		console.log( 'Peer.streamAdded - legacy event', stream );
		self.stream = stream;
		var tracks = self.stream.getTracks();
		self.isAudio = false;
		self.isVideo = false;
		tracks.forEach( checkType );
		self.toggleBlind( self.isBlind );
		self.toggleMute( self.isMute );
		var conf = {
			isVideo : self.isVideo,
			isAudio : self.isAudio,
			stream : stream,
		};
		
		self.emit( 'legacy-stream', conf );
		self.emitStreamState( 'nominal' );
		
		function checkType( track ) {
			var type = track.kind;
			if ( 'audio' === type )
				self.isAudio = true;
			if ( 'video' === type )
				self.isVideo = true;
		}
	}
	
	ns.Peer.prototype.trackAdded = function( track ) {
		var self = this;
		if ( !self.stream ) {
			console.log( 'Peer.trackAdded - no MediaStream, emitting "media"' );
			self.stream = new window.MediaStream();
			self.emit( 'media', self.stream );
		}
		
		console.log( 'Peer.trackAdded', { ms : self.stream, tr : track });
		self.emitStreamState( 'nominal' );
		var type = track.kind;
		if ( 'video' === type )
			addVideo( track );
		if ( 'audio' === type )
			addAudio( track );
		
		function addVideo( track ) {
			self.emit( 'track', 'video', track );
			self.toggleBlind( self.isBlind );
			self.isVideo = true;
			self.emit( 'video', self.isVideo );
		}
		
		function addAudio( track ) {
			self.emit( 'track', 'audio', track );
			self.toggleMute( self.isMute );
			self.isAudio = true;
			self.emit( 'audio', self.isAudio );
		}
	}
	
	ns.Peer.prototype.trackRemoved = function( track, sessionId ) {
		var self = this;
		console.log( 'Peer.trackRemoved', {
			track : track,
			sid   : sessionId,
		});
		
		const type = track.kind;
		self.emit( 'track', type, null );
	}
	
	ns.Peer.prototype.sendMeta = function() {
		var self = this;
		if ( !self.selfie ) {
			console.log( 'sendMeta - no selfie, no send', self );
			return;
		}
		
		var meta = {
			isChrome  : self.selfie.isChrome,
			isFirefox : self.selfie.isFirefox,
			state     : {
				isMuted    : self.selfie.isMute,
				isBlinded  : self.selfie.isBlind,
				screenMode : self.selfie.screenMode,
			},
		};
		console.log( 'sendMeta', meta );
		self.send({
			type : 'meta',
			data : meta,
		});
	}
	
	ns.Peer.prototype.handleMeta = function( meta ) {
		var self = this;
		console.log( 'handleMeta', {
			meta : meta,
			doInit : self.doInit,
		});
		if ( !self.doInit )
			self.sendMeta();
		
		self.updateMeta( meta );
		var signalState = {
			type : 'signal',
			data : {
				type : 'nominal',
			},
		};
		self.emit( 'state', signalState );
		self.initializeSessions();
	}
	
	ns.Peer.prototype.updateMeta = function( remote ) {
		var self = this;
		console.log( 'updateMeta', remote );
		if ( remote.state )
			updateState( remote.state );
		
		// if one peer is chrome and another is firefox, chrome will always be 'it'
		if ( self.selfie.isFirefox && remote.isChrome )
			self.doInit = false;
		
		if ( self.selfie.isChrom && remote.isFirefox )
			self.doInit = true;
		
		//self.isChromePair = ( !remote.isFirefox && !self.selfie.isFirefox );
		self.emit( 'meta', remote );
		
		function updateState( state ) {
			if ( null != state.isMuted )
				self.setRemoteMute( state.isMuted );
			
			if ( null != state.isBlinded )
				self.setRemoteBlind( state.isBlinded );
			
			if ( null != state.screenMode )
				self.setScreenMode( state.screenMode );
		}
	}
	
	ns.Peer.prototype.initializeSessions = function() {
		var self = this;
		console.log( 'initializeSessions', self.isChromePair );
		
		self.createSession( 'stream' );
		
		/* let try simple for now
		if ( self.isChromePair )
			self.createSession( 'stream' );
		else {
			self.createSession( 'audio' );
			self.createSession( 'video' );
		}
		*/
		
		self.showSelfie();
	}
	
	ns.Peer.prototype.bindStream = function( stream ) {
		var self = this;
		console.log( 'Peer.bindStream', stream );
		if ( self.stream )
			self.releaseStream();
		
		var time = Date.now();
		stream.times = time;
		var readyState = stream.readyState ? stream.readyState.toString() : 'no u';
		self.stream = stream;
		self.stream.onactive = onActive;
		self.stream.oninactive = onInactive;
		self.stream.onaddtrack = onAddTrack;
		self.stream.onremovetrack = onRemoveTrack;
		
		if ( stream.getConstraints )
			console.log( 'stream.getConstraints', stream.getConstraints() );
		
		var at = self.getAudioTrack();
		var vt = self.getVideoTrack();
		self.bindTrack( at );
		self.bindTrack( vt );
		
		
		function onActive( e ) {
			console.log( 'stream - onActive', { e : e, s : stream });
		}
		
		function onInactive( e ) {
			console.log( 'stream - onInactive', { e : e, s : stream });
		}
		
		function onAddTrack( e ) {
			console.log( 'stream - onAddTrack', { e : e, s : stream });
		}
		
		function onRemoveTrack( e ) {
			console.log( 'stream - onRemoveTrack', { e : e, s : stream });
		}
	}
	
	ns.Peer.prototype.releaseStream = function() {
		var self = this;
		console.log( 'Peer.releaseStream' );
		var stream = self.stream;
		delete self.stream;
		
		if ( !stream )
			return;
		
		stream.onactive = null;
		stream.oninactive = null;
		stream.onaddtrack = null;
		stream.onremovetrack = null;
		stream.onended = null;
		
		var tracks = stream.getTracks();
		if ( tracks.length )
			tracks.forEach( release );
		function release( track ) { self.releaseTrack( track ); }
		
		self.emitStreamState( 'released' );
	}
	
	ns.Peer.prototype.bindTrack = function( track ) {
		var self = this;
		if ( !track )
			return;
		
		var readyState = track.readyState ? track.readyState.toString() : 'no u, track edition';
		var kind = track.kind;
		track.onmute = onMute;
		track.onunmute = onUnMute;
		track.onended = onEnded;
		
		if ( track.getConstraints )
			console.log( 'track.getConstraints', track.getConstraints() );
		
		function onMute( e ) { console.log( kind + '-track, onMute', e ); }
		function onUnMute( e ) { console.log( kind + '-track, onUnMute', e ); }
		function onEnded( e ) {
			console.log( kind + '-track, onEnded', e );
			self.emitStreamState();
		}
	}
	
	ns.Peer.prototype.releaseTrack = function( track ) {
		var self = this;
		if ( !track )
			return;
		
		track.onmute = null;
		track.onunmute = null;
		track.onended = null;
		if ( track.stop )
			track.stop();
	}
	
	ns.Peer.prototype.handleSessionStateChange = function( event ) {
		var self = this;
		//console.log( 'rtc.handlseSessionStateChange', event );
		if ( 'error' === event.type )
			self.handleSessionError( event );
		
		var rtcState = {
			type : 'rtc',
			data : event,
		};
		
		self.emit( 'state', rtcState );
	}
	
	ns.Peer.prototype.handleSessionError = function( event ) {
		var self = this;
		console.log( 'handleSessionError', event );
		self.restart();
	}
	
	ns.Peer.prototype.toggleMute = function( force ) {
		var self = this;
		var audio = self.getAudioTrack();
		if ( !audio )
			return;
		
		if ( force === !audio.enabled )
			return;
		
		if ( null != force )
			audio.enabled = !force;
		else
			audio.enabled = !audio.enabled;
		
		self.isMute = !audio.enabled;
		self.emit( 'mute', self.isMute );
	}
	
	ns.Peer.prototype.toggleBlind = function( force ) {
		var self = this;
		var video = self.getVideoTrack();
		if ( !video )
			return;
		
		if ( force === !video.enabled )
			return;
		
		if ( null != force )
			video.enabled = !force;
		else
			video.enabled = !video.enabled;
		
		self.isBlind = !video.enabled;
		self.emit( 'blind', self.isBlind );
	}
	
	ns.Peer.prototype.getAudioTrack = function() {
		var self = this;
		//var streams = self.session.conn.getRemoteStreams()[ 0 ];
		if ( !self.stream ) {
			console.log( 'getAudioTrack - no stream???', self.stream );
			return null;
		}
		
		var tracks = self.stream.getAudioTracks();
		if ( !tracks.length )
			return null;
		return tracks[ 0 ];
	}
	
	ns.Peer.prototype.getVideoTrack = function() {
		var self = this;
		//var stream = self.session.conn.getRemoteStreams()[ 0 ];
		if ( !self.stream ) {
			console.log( 'getVideoTrack - no stream???', self.stream );
			return null;
		}
		
		var tracks = self.stream.getVideoTracks();
		if ( !tracks.length )
			return null;
		return tracks[ 0 ];
	}
	
	ns.Peer.prototype.emitStreamState = function( state ) {
		var self = this;
		if ( state )
			self.streamState = state;
		
		state = state || self.streamState;
		const tracks = getTracks();
		const constraints = getConstraints();
		
		var streamState = {
			type : 'stream',
			data : {
				type : state,
				tracks : tracks,
				constraints : constraints,
			}
		};
		
		self.emit( 'state', streamState );
		
		function getTracks() {
			const at = self.getAudioTrack();
			const vt = self.getVideoTrack();
			
			var atState = at ? at.readyState : 'unknown';
			var vtState = vt ? vt.readyState : 'unknown';
			
			if (( 'live' === atState ) && ( self.remoteMute ))
				atState = 'paused';
			
			if (( 'live' === vtState ) && ( self.remoteBlind ))
				vtState = 'paused';
			
			return {
				audio : atState,
				video : vtState,
			};
		}
		
		function getConstraints() {
			return self.constraints || null;
		}
	}
	
	ns.Peer.prototype.remove = function() {
		var self = this;
		self.onremove();
	}
	
	ns.Peer.prototype.close = function() {
		var self = this;
		self.stopPing();
		
		if ( self.metaInterval ) {
			window.clearInterval( self.metaInterval );
			self.metaInterval = null;
		}
		
		console.log( 'Peer.close' );
		self.stopSync();
		
		self.releaseStream();
		self.release(); // component.EventEmitter
		self.selfie.off( self.streamHandlerId );
		//self.selfie.off( self.qualityHandlerId );
		delete self.selfie;
		
		delete self.onremove;
		delete self.closeCmd;
		
		if ( self.signal )
			self.signal.close();
		if ( self.alpha )
			self.alpha.close();
		
		delete self.signal;
		delete self.alpha;
		
		if ( self.alphaSession )
			self.alphaSession.close();
		
		delete self.alphaSession;
		
		self.closeAllSessions();
	}
	
})( library.rtc );


// SESSION
(function( ns, undefined ) {
	ns.Session = function( conf ) {
		if( !( this instanceof ns.Session ))
			return new ns.Session( conf );
		
		library.component.EventEmitter.call( this );
		
		var self = this;
		self.type = conf.type;
		self.id = 'session-' + self.type;
		self.doInit = conf.doInit || false;
		self.rtc = conf.rtc;
		self.signal = conf.signal;
		self.modifySDP = conf.modifySDP || null;
		
		// peer connection, holder of streams
		self.conn = null;
		self.senders = [];
		self.useOnTrack = false;
		self.useOnStream = false;
		
		self.iceCandidates = [];
		self.negotiationWaiting = false;
		self.negotiationTimeout = null;
		self.negotiationTimer = 1000 * 10;
		self.denyNegotiation = false;
		
		// data channels
		self.channels = {};
		
		// rtc specific logging ( automatic host / client prefix )
		self.spam = false;
		
		self.init();
	}
	
	ns.Session.prototype = Object.create( library.component.EventEmitter.prototype );
	
	// Public
	
	ns.Session.prototype.addStream = function( stream ) {
		var self = this;
		console.log( 'Session.addStream', {
			stream : stream,
			conn : self.conn, 
		});
		
		if ( !self.conn ) {
			self.log( 'addStream - OMG NO CONN DUDE; CHILL',
				{ conn : self.conn, stream : stream });
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
			if (( track.kind !== self.type ) && ( 'stream' !== self.type )) {
				self.log( '.addStream - dropped track for *reasons*',
					{ t : self.type, k : track.kind });
				return;
			}
			
			var sender = self.conn.addTrack( track, stream );
			self.senders.push( sender );
		}
		
		function legacyAddStream( stream ) {
			self.log( 'Session.legacyAddStream', stream );
			var localStreams = self.conn.getLocalStreams();
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
	
	ns.Session.prototype.recycle = function() {
		var self = this;
		console.log( 'Session.recycle' );
	}
	
	// Private
	
	ns.Session.prototype.stateTypeMap = {
		'nominal'             : 'nominal',
		'host-negotiation'    : 'waiting',
		'client-negotiation'  : 'waiting',
		'negotiation-waiting' : 'waiting',
		'ICE-gathering'       : 'waiting',
		'ICE-checking'        : 'waiting',
		'ICE-disconnected'    : 'waiting',
		'ICE-failed'          : 'error',
		'closed'              : 'closed',
		'derp'                : 'error', // something lol'd
	};
	
	ns.Session.prototype.init = function() {
		var self = this;
		self.signal = new library.component.EventNode(
			self.id,
			self.signal,
			eventSink
		);
		
		self.signal.on( 'sdp', sdpReceived );
		self.signal.on( 'candidate', iceCandidateReceived );
		self.signal.on( 'negotiate', handleNegotiate );
		
		function sdpReceived( msg ) { self.sdpReceived( msg ); }
		function iceCandidateReceived( msg ) { self.iceCandidateReceived( msg ); }
		function handleNegotiate( msg ) { self.handleNegotiate( msg ); }
		
		function eventSink( type, data ) {
			self.log( 'unhandled signal event', {
				type : type,
				data : data,
			});
		}
		
		//let checkICEProp = Object.getOwnPropertyDescriptor( self.rtc, 'ICE' );
		//console.log( 'checkICEProp', checkICEProp );
		
		var peerConf = {
			iceServers         : self.rtc.ICE,
		};
		//iceServers : 'auto', // throws
		
		//let checkProp = Object.getOwnPropertyDescriptor( peerConf, 'iceServers' );
		//console.log( 'session.checkProp', checkProp );
		
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
		
		self.log( 'conn', self.conn );
		self.log( 'conn.addTrack', self.conn.addTrack );
		
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
		
		//self.startStatSpam();
	}
	
	ns.Session.prototype.renegotiate = function() {
		var self = this;
		//return;
		console.log( 'Session.renegotiate - doInit', self.doInit );
		self.tryNegotiation();
	}
	
	ns.Session.prototype.startStatSpam = function() {
		var self = this;
		if ( !self.spam )
			return;
		
		self.statInterval = window.setInterval( stats, 60000 );
		function stats() {
			if ( !self.conn ) {
				window.clearInterval( self.statInterval );
				return;
			}
			
			if ( !self.conn.getStats ) {
				console.log( 'rtc conn does not have .stats();')
				return;
			}
			
			self.conn.getStats()
				.then( success )
				.catch( error );
				
			function success( stats ) {
				console.log( 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' );
				var stats = stats.result();
				stats.forEach( showAndTell );
				function showAndTell( statItem ) {
					console.log( '------------------------', statItem );
					var names = statItem.names();
					names.forEach( showStat );
					function showStat( name ) {
						console.log( name, statItem.stat( name ));
					}
				}
			}
			function error( err ) { console.log( 'stats error', err ); }
		}
	}
	
	ns.Session.prototype.connectionStateChange = function( e ) {
		var self = this;
		self.log( 'connectionStateChange', e );
	}
	
	ns.Session.prototype.iceCandidate = function( e ) {
		var self = this;
		var msg = {
			type : 'candidate',
			data : e.candidate,
		};
		self.log( 'sending ice candidate', msg );
		self.signal.send( msg );
	}
	
	ns.Session.prototype.iceConnectionStateChange = function( e ) {
		var self = this;
		self.log( 'iceConnectionChange', e );
		self.log( 'iceConnectionState', self.conn.iceConnectionState );
		self.log( 'iceGatheringState', self.conn.iceGatheringState );
		self.setState();
	}
	
	ns.Session.prototype.iceGatheringStateChange = function( e ) {
		var self = this;
		self.log( 'iceGatheringStateChange', e );
		self.log( 'iceGatheringState', self.conn.iceGatheringState );
	}
	
	ns.Session.prototype.negotiationNeeded = function( e ) {
		var self = this;
		self.log( 'negotiation needed', self.conn.signalingState );
		self.tryNegotiation();
	}
	
	ns.Session.prototype.tryNegotiation = function() {
		var self = this;
		self.log( 'tryNegotiation - switching?', self.switchingTracks );
		if ( self.switchingTracks ) {
			self.negotiationIsNeeded = true;
			return;
		}
		
		self.negotiationIsNeeded = false;
		self.setState( 'negotiation-waiting' );
		if ( self.conn.signalingState !== 'stable' ) {
			self.negotiationWaiting = true;
			return;
		}
		
		if ( !self.doInit ) {
			self.requestNegotiation();
			return;
		}
		
		if ( self.negotiationTimeout ) {
			self.log( 'waiting for negotiation timeout' );
			return;
		}
		
		self.createOffer();
	}
	
	ns.Session.prototype.requestNegotiation = function() {
		var self = this;
		var req = {
			type : 'negotiate',
			data : 'request',
		};
		self.log( '.requestNegotiation', req );
		if ( !self.signal )
			return;
		
		self.signal.send( req );
	}
	
	ns.Session.prototype.negotiationAccepted = function() {
		var self = this;
		self.log( 'negotiation accepted, creating offer' );
		self.createOffer();
	}
	
	ns.Session.prototype.negotiationDenied = function() {
		var self = this;
		self.log( 'negotiation denied - retrying in a bit' );
		window.setTimeout( retryNeg, 3000 );
		function retryNeg() {
			self.requestNegotiation();
		}
	}
	
	ns.Session.prototype.createOffer = function() {
		var self = this;
		self.log( 'createOffer', self.conn.signalingState );
		self.negotiationWaiting = false;
		
		if ( self.doInit ) {
			self.denyNegotiation = true;
			self.setState( 'host-negotiation' );
		} else
			self.setState( 'client-negotiation' );
		
		self.conn.createOffer()
			.then( offerReady )
			.catch( offErr );
		function offerReady( offer ) {
			var sdp = null;
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
		var self = this;
		self.log( 'local SDP' );
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
	
	ns.Session.prototype.toggleSDPActivePassive = function( sdpObj ) {
		var self = this;
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
	
	ns.Session.prototype.logSDP = function( sdp, type ) {
		var self = this;
		if ( 'local' !== type  ) {
			var localSdp = self.conn.localDescription;
			if ( localSdp && !!localSdp.type )
				self.logSDP( localSdp, 'local' );
		}
		
		if ( !sdp || !sdp.sdp )
			return;
		
		var match = sdp.sdp.match( /a=setup:.*/ );
		var asetup = '';
		if ( match )
			asetup = match[ 0 ];
		
		self.log( 'SDP', { 
			'type'         : type,
			'signal state' : self.conn.signalingState,
			'a=setup:'     : asetup,
			'sdp'          : sdp,
		});
	}
	
	ns.Session.prototype.sendDescription = function() {
		var self = this;
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
		self.log( 'sendDescription', desc );
		self.signal.send( desc );
	}
	
	ns.Session.prototype.sdpReceived = function( sdp ) {
		var self = this;
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
		var self = this;
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
				
			self.createAnswer();
		}
		
		function err( e ) {
			console.log( 'remoteOffer err', e );
			self.log( 'remoteOffer err', e );
			self.emit( 'error', e );
		}
	}
	
	ns.Session.prototype.handleRemoteAnswer = function( sdp ) {
		var self = this;
		var state = self.conn.signalingState;
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
		var remoteAnswer = new window.RTCSessionDescription( sdp );
		self.conn.setRemoteDescription( remoteAnswer )
			.then( yep )
			.catch( nope );
			
		function yep( res ) {
			self.log( 'handleRemoteAnswer - remote answer set', res );
			if ( self.doInit )
				self.denyNegotiation = false;
		}
		
		function nope( err ) {
			self.log( 'error setting remote SDP answer: ', err );
			var errTest = 'DOMException: Failed to set remote answer sdp:'
			+ ' Failed to push down transport description:'
			+ ' Failed to set ssl role for the channel.';
			
			console.log( 'remoteAnswer error', err );
			if ( errTest === err ) {
				sdp = self.toggleSDPActivePassive( sdp );
				self.handleRemoteAnswer( sdp );
			} else {
				self.emit( 'error', err );
			}
			
		}
	}
	
	ns.Session.prototype.rollbackSignalingState = function() {
		var self = this;
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
			console.log( 'rollback done' );
		}
		
		function oopsie( err ) {
			console.log( 'trollback failed', err );
		}
	}
	
	ns.Session.prototype.createAnswer = function() {
		var self = this;
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
		var self = this;
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
		var self = this;
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
		var self = this;
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
		var self = this;
		self.log( 'trackAdded', data );
		if ( self.useOnStream )
			return;
		
		const track = data.track;
		self.useOnTrack = true;
		self.log( 'emitTrack', { type : self.type, track : track });
		self.emit( 'track', track );
	}
	
	ns.Session.prototype.streamAdded = function( e ) {
		var self = this;
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
	}
	
	ns.Session.prototype.emitStream = function( stream ) {
		const self = this;
		self.log( 'emitStream', stream );
		self.emit( 'stream', stream );
	}
	
	ns.Session.prototype.streamRemoved = function( stream ) {
		var self = this;
		var local = self.conn.getLocalStreams();
		var remote = self.conn.getRemoteStreams();
		self.log( 'streamRemoved', {
			s : stream,
			l : local,
			r : remote,
		});
	}
	
	ns.Session.prototype.noStream = function() {
		var self = this;
		self.log( 'conn.noStream' );
		self.emit( 'nostream' );
	}
	
	ns.Session.prototype.createDataChannel = function( label, opts ) {
		const self = this;
		if ( !label )
			throw new Error( 'rtc.createDataChannel - no label' );
		
		self.log( 'createDataChannel', label );
		const channel = self.conn.createDataChannel( label, opts );
		self.channels[ label ] = channel;
		return channel;
	}
	
	ns.Session.prototype.closeDataChannel = function( label ) {
		const self = this;
		self.log( 'closeDataChannel', label );
		const channel = self.channels[ label ];
		if ( !channel )
			return;
		
		delete self.channels[ label ];
		channel.close();
	}
	
	ns.Session.prototype.dataChannelAdded = function( e ) {
		var self = this;
		self.log( 'datachannelAdded', e );
		self.emit( 'datachannel', e.channel );
	}
	
	ns.Session.prototype.signalStateChange = function( e ) {
		var self = this;
		if ( 'stable' !== self.conn.signalingState )
			return;
		
		if ( self.negotiationWaiting )
			self.tryNegotiation();
		else
			self.setState();
	}
	
	ns.Session.prototype.getState = function() {
		var self = this;
		var iceConn = nominalize( self.conn.iceConnectionState, 'ICE' );
		var iceGather = nominalize( self.conn.iceGatheringState, 'ICE' );
		var signal = nominalize( self.conn.signalingState, 'conn' );
		
		self.log( 'getState', {
			iceConn : self.conn.iceConnectionState,
			iceGather : self.conn.iceGatheringState,
			signal : self.conn.signalingState,
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
		var self = this;
		if ( !self.conn )
			state = 'closed';
		
		if ( !state )
			state = self.getState();
		
		var type = self.stateTypeMap[ state ];
		if ( !type ) {
			self.log( 'setState - no type found for', { s : state, valid : self.stateTypeMap });
			type = 'waiting';
		}
		
		data = data || null;
		var stateEvent = {
			type : type,
			data : {
				state : state,
				data : data,
			},
		};
		
		self.emit( 'state', stateEvent );
	}
	
	ns.Session.prototype.removeTracks = function() {
		var self = this;
		self.senders.forEach( remove );
		self.senders = [];
		function remove( sender ) {
			self.log( 'removeing tracks', sender );
			self.conn.removeTrack( sender );
		}
	}
	
	ns.Session.prototype.close = function() {
		var self = this;
		self.log( '(rtc)session.close' );
		
		self.removeTracks();
		self.setState( 'closed' );
		self.release(); // event listeners
		closeDataChannels();
		closeRTC();
		closeSignal();
		
		delete self.modifySDP;
		delete self.rtc;
		delete self.type;
		delete self.doInit;
		
		function closeDataChannels() {
			for ( let label in self.channels )
				self.closeDataChannel( label );
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
			if ( self.signal )
				self.signal.close();
			
			delete self.signal;
		}
	}
	
	ns.Session.prototype.clearConn = function() {
		var self = this;
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
		var self = this;
		if ( !self.spam )
			return;
		
		if ( self.doInit )
			string = 'rtc.host : ' + string;
		else
			string = 'rtc.client : ' + string;
		
		var time = new window.Date();
		var sec = time.getSeconds();
		var ms = time.getMilliseconds();
		sec = pad( sec, 2 );
		ms = pad( ms, 3 );
		string = ':' + sec + '.' + ms + ' ' + string;
		console.log( string, value );
		
		function pad( str, len ) {
			str = str.toString();
			len = len || 2;
			var pd = 3 - str.length;
			if ( !pd )
				return str;
			
			var arr = new Array( pd );
			arr.push( str );
			return arr.join( '0' );
		}
	}
	
	ns.Session.prototype.err = function( source, e ) {
		var self = this;
		console.log( source, {
			error : e,
			host : self.doInit.toString(),
		});
	}
	
})( library.rtc );

(function( ns, undefined ) {
	ns.DataChannel = function(
		id,
		conn,
		onOpen,
		onClose,
		eventSink
	) {
		const self = this;
		self.id = id;
		self.conn = conn;
		self.onopen = onOpen;
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
		try {
			self.conn.close();
		} catch( e ) { console.log( 'dataChannel.close exep', e ); }
		
		self.unbind();
		self.closeEventEmitter();
		delete self.conn;
		delete self.onopen;
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
			console.log( 'DataChannel.onopen' );
			self.isOpen = true;
			self.eventQueue.forEach( send )
			if ( self.onopen )
				self.onopen( Date.now() );
			
			function send( event ) {
				self.sendOnChannel( event );
			}
		}
		function onError( e ) { console.log( 'datachannel.onError', e ); }
		function onMessage( e ) { self.handleMessage( e ); }
		function onClose( e ) {
			self.isOpen = false;
			self.emit( 'closed', self.conn );
			if ( self.onclose )
				self.onclose( Date.now() );
		}
	}
	
	ns.DataChannel.prototype.unbind = function() {
		const self = this;
		self.conn.onopen = null;
		self.conn.onerror = null;
		self.conn.onmessage = null;
		self.conn.onclose = null;
	}
	
	ns.DataChannel.prototype.handleMessage = function( e ) {
		const self = this;
		//console.log( 'DataChannel.handleMessage', e );
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
			self.eventQueue.push( event );
			return;
		}
		
		if ( !self.conn )
			return; // closed
		
		if ( 'open' !== self.conn.readyState ) {
			self.eventQueue.push( event );
			return;
		}
		
		const str = friendUP.tool.stringify( event );
		self.conn.send( str );
	}
	
})( library.rtc );

// Media Sources
( function( ns, undefined ) {
	ns.MediaDevices = function() {
		if ( !( this instanceof ns.MediaDevices ))
			return new ns.MediaDevices();
		
		var self = this;
		self.init();
	}
	
	ns.MediaDevices.prototype.init = function() {
		var self = this;
		//console.log( 'media sources init' );
	}
	
	/*
	[ device, ]
	*/
	ns.MediaDevices.prototype.get = function() {
		var self = this;
		return self.enumerate();
	}
	
	/*
	{
		audioinput : { label : device, }
		audiooutput : { label : device, }
		videoinput : { label : device, }
	}
	*/
	ns.MediaDevices.prototype.getByType = function() {
		var self = this;
		return self.enumerate( parseToType );
		
		function parseToType( arr ) {
			let devObj = {
				audioinput : {},
				audiooutput : {},
				videoinput : {},
			};
			
			arr.forEach( sort );
			return devObj;
			
			function sort( dev ) {
				if ( !devObj[ dev.kind ] ) {
					console.log( 'unknown device kind found', dev )
					return;
				}
				
				devObj[ dev.kind ][ dev.label ] = dev;
			}
		}
	}
	
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
})( library.rtc );


// Is speaking
(function( ns, undefined ) {
	ns.IsSpeaking = function( mediaStream ) {
		if ( !( this instanceof ns.IsSpeaking ))
			return new ns.IsSpeaking( mediaStream );
		
		var self = this;
		self.stream = mediaStream || null;
		
		self.actx = null;
		self.isSpeaking = false;
		
		self.init();
	}
	
	// Public
	
	ns.IsSpeaking.prototype.set = function( mediaStream ) {
		var self = this;
		console.log( 'IsSpeaking.set', mediaStream );
		if ( self.stream )
			delete self.stream;
		
		self.stream = mediaStream;
		self.bind();
	}
	
	ns.IsSpeaking.prototype.close = function() {
		var self = this;
		console.log( 'IsSpeaking.close' );
		self.release();
		delete self.actx;
		delete self.stream;
	}
	
	// Pivate
	
	ns.IsSpeaking.prototype.bind = function() {
		var self = this;
		console.log( 'IsSpeaking.bind - disabled' )
		
		//
		return;
		//
		
		if ( self.actx )
			self.release();
		
		self.actx = new window.AudioContext();
		var source = self.actx.createMediaStreamSource( self.stream );
		self.analyser = self.actx.createAnalyser();
		source.connect( self.analyser );
		self.analyser.fftSize = 128;
		var buffLen = self.analyser.frequencyBinCount;
		console.log( 'analyser', {
			a : self.analyser,
			bl : buffLen,
		});
		//startChecks();
		
		function startChecks() {
			if ( self.interval )
				window.clearInterval( self.interval );
			
			self.interval = window.setInterval( readout, 500 );
		}
		
		function readout() {
			var arr = new Uint8Array( buffLen );
			self.analyser.getByteTimeDomainData( arr );
			console.log( 'readout', arr );
		}
	}
	
	ns.IsSpeaking.prototype.release = function() {
		var self = this;
		self.actx.close();
	}
	
	ns.IsSpeaking.prototype.init = function() {
		var self = this;
		if ( self.stream )
			self.set( self.stream );
	}
	
})( library.rtc );

// Initchecks
(function( ns, undefined ) {
	ns.InitChecks = function( conf ) {
		if ( !( this instanceof ns.InitChecks ))
			return new ns.InitChecks( conf );
		
		var self = this;
		self.view = conf.view;
		self.onsourceselect = conf.onsourceselect;
		self.ondone = conf.ondone;
		
		self.hasError = false;
		self.canContinue = true;
		self.checksDone = null;
		self.isDone = false;
		
		self.init();
	}
	
	// Public
	
	ns.InitChecks.prototype.checkBrowser = function( callback ) {
		var self = this;
		new library.rtc.BrowserCheck( checkBack );
		function checkBack( res ) {
			self.ui.updateBrowserCheck( res );
			checkErrors( res );
			self.setCheckDone( 'browser' );
			
			function checkErrors( res ) {
				var bErr = res.support.type;
				var success = true;
				var isCrit = false;
				
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
				if ( !success )
					self.setHasError( isCrit );
				
				callback( !isCrit );
			}
		}
	}
	
	ns.InitChecks.prototype.checkSignal = function( conn, type ) {
		var self = this;
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
		var self = this;
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
	
	ns.InitChecks.prototype.checkAudioInput = function( mediaStream ) {
		var self = this;
		self.startingCheck( 'audio-input' );
		var tracks = mediaStream.getAudioTracks();
		if ( !tracks.length ) {
			console.log( 'no audio sources available, passing' );
			doneBack( null );
			return;
		}
		
		var deviceLabel = tracks[ 0 ].label;
		self.ui.updateAudioInput( { desc : deviceLabel } );
		new library.rtc.AudioInputDetect( mediaStream, doneBack );
		function doneBack( err ) {
			if ( self.isDone )
				return;
			
			//console.log( 'audioCheck - result', err );
			var state = {
				type : !!err ? 'error' : 'success',
				message : err || '',
			};
			self.ui.updateAudioInput( state );
			if ( err )
				self.setHasError();
			
			self.setCheckDone( 'audio-input' );
		}
	}
	
	ns.InitChecks.prototype.checkVideoInput = function( mediaStream ) {
		var self = this;
		console.log( 'checkVideoInput', mediaStream );
	}
	
	ns.InitChecks.prototype.checkSelfieReady = function( selfie, mediaErr ) {
		const self = this;
		console.log( 'checkSelfieReady', selfie );
		let ready = !!selfie.stream;
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
		
		self.setCheckDone( 'selfie-check' );
		return !!selfie.stream;
	}
	
	ns.InitChecks.prototype.close = function() {
		var self = this;
		self.ui.close();
		self.isDone = true;
		
		delete self.view;
		delete self.ui;
		delete self.ondone;
		delete self.onsourceselect;
	}
	
	// Private
	
	ns.InitChecks.prototype.init = function() {
		var self = this;
		self.checksDone = {
			//'room-signal' : false,
			'selfie-check' : false,
			'ice-servers'  : false,
			'audio-input'  : false,
		};
		
		var conf = {
			onclose        : onclose,
			oncontinue     : oncontinue,
			onsourceselect : self.onsourceselect,
		};
		self.ui = self.view.addUIPane( 'init-checks', conf );
		self.ui.show();
		
		function onclose() {
			self.done( true );
		}
		
		function oncontinue() {
			self.done();
		}
	}
	
	ns.InitChecks.prototype.setHasError = function( critical ) {
		var self = this;
		self.hasError = true;
		
		if ( critical  )
			self.canContinue = false;
		
		self.ui.showErrorHandling( self.canContinue );
	}
	
	ns.InitChecks.prototype.startingCheck = function( id ) {
		var self = this;
		self.checksDone[ id ] = false;
	}
	
	ns.InitChecks.prototype.setCheckDone = function( id ) {
		var self = this;
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
		var self = this;
		if ( self.isDone )
			return;
		
		self.isDone = true;
		self.ondone( forceClose );
	}
	
})( library.rtc );

// AudioInputDetect
(function( ns, undefined ) {
	ns.AudioInputDetect = function( mediaStream, callback ) {
		if ( !( this instanceof ns.AudioInputDetect ))
			return new ns.AudioInputDetect( mediaStream, callback );
		
		var self = this;
		self.mediaStream = mediaStream;
		self.callback = callback;
		
		self.timeout = 5000 * 3;
		self.step = 100;
		
		self.init();
	}
	
	ns.AudioInputDetect.prototype.init = function() {
		var self = this;
		if ( !self.mediaStream ) {
			self.done( 'No stream, mate..' );
			return;
		}
		
		var aTracks = self.mediaStream.getAudioTracks();
		if ( !aTracks || !aTracks.length ) {
			self.done( 'No audio track found' );
			return;
		}
		
		new window.Promise( detectAudio )
			.then( success )
			.catch( fail );
		
		function detectAudio( resolve, reject ) {
			if ( !window.AudioContext ) {
				console.log( 'AudioInputDetect - no window.AudioContext, returning',
					window.AudioContext );
				resolve();
				return;
			}
			
			self.actx = new window.AudioContext();
			var source = self.actx.createMediaStreamSource( self.mediaStream );
			var analyser=  self.actx.createAnalyser();
			source.connect( analyser );
			analyser.fftSize = 64;
			analyser.minDecibels = -200;
			var buffLen = analyser.frequencyBinCount;
			
			var interval = window.setInterval( check, self.step );
			var timeout = window.setTimeout( timeoutHit, self.timeout );
			
			function check() {
				if ( !interval )
					return;
				
				var sample =  new Uint8Array( buffLen );
				analyser.getByteTimeDomainData( sample );
				if ( !sample || !sample.length ) {
					resolve();
					return;
				}
				
				const baseline = sample[ 0 ];
				var hasInput = null;
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
				
				window.clearInterval( interval );
				window.clearTimeout( timeout );
				interval = null;
				timeout = null;
				resolve();
				
				function notFlat( value ) {
					return !!( baseline !== value );
				}
			}
			
			function timeoutHit() {
				if ( !timeout )
					return;
				
				if ( interval ) {
					clearInterval( interval );
					interval = null;
				}
				
				reject( 'No audio input detected' );
			}
		}
		
		function success() {
			self.done();
		}
		
		function fail( err ) {
			self.done( err );
		}
	}
	
	ns.AudioInputDetect.prototype.done = function( err ) {
		var self = this;
		if ( self.actx )
			self.actx.close();
		
		delete self.actx;
		
		if ( !self.callback )
			return;
		
		var callback = self.callback;
		delete self.callback;
		delete self.mediaStream;
		callback( err );
	}
	
})( library.rtc );

// ICECheck
(function( ns, undefined ) {
	ns.ICECheck = function( conf, stepBack, doneBack ) {
		if ( !( this instanceof ns.ICECheck ))
			return new ns.ICECheck( conf );
		
		var self = this;
		self.conf = conf;
		self.stepBack = stepBack;
		self.doneBack = doneBack;
		
		self.timeoutMS = 1000 * 20; // 20 sec
		
		self.init();
	}
	
	ns.ICECheck.prototype.init = function() {
		var self = this;
		self.checks = 0;
		self.conf.forEach( check );
		
		function check( server ) {
			self.checkServer( server, checkBack );
			function checkBack( res ) {
				if ( res.ret )
					return;
				
				self.checks++;
				var err = res.err;
				var ret = {
					err : err || null,
					server : server,
				};
				self.stepBack( ret );
				
				checkDone();
			}
		}
		
		function checkDone() {
			console.log( 'checkDone', { c : self.checks, l : self.conf.length })
			if ( self.checks === self.conf.length )
				self.done();
		}
	}
	
	ns.ICECheck.prototype.checkServer = function( server, checkBack ) {
		var self = this;
		var conf = {
			iceServers : [ server ],
		};
		new window.Promise( checkTheICE )
			.then( result )
			.catch( result );
		
		function checkTheICE( resolve, reject ) {
			var returned = false;
			var timeout = window.setTimeout( checkTimedOut, self.timeoutMS );
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
				
				var sdp = e.candidate.candidate;
				var typs = sdp.match( /typ\s[a-z]+\s/gi );
				if ( typs )
					console.log( 'ICE-check - typs', {
						s : server.urls[ 0 ],
						t : typs[ 0 ] });
				
				// fail on 'typ host'
				if ( -1 !== sdp.indexOf( 'typ host' ))
					return;
				
				success();
			}
			
			function checkTimedOut() {
				error( 'timeout' );
			}
			
			function success() {
				var res = {
					ret : returned,
					err : null,
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
					console.log( 'test.close exep, but we dont really care, lol', e );
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
		var self = this;
		var doneBack = self.doneBack;
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
		
		var self = this;
		self.onresult = onResult;
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
		'safari'  : 'error',
		'firefox' : 'warning',
		'chrome'  : 'success',
		'blink'   : 'success',
		'samsung' : 'success',
		'android' : 'warning',
	}
	
	ns.BrowserCheck.prototype.supportString = {
		'error'   : 'unsupported',
		'warning' : 'experimental support',
		'success' : 'full support',
	}
	
	ns.BrowserCheck.prototype.init = function() {
		var self = this;
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
		var self = this;
		var uaId = self.getApprovedUAId();
		if ( uaId )
			self.is[ uaId ] = true;
		else
			self.is[ self.isMobile ] = true;
	}
	
	ns.BrowserCheck.prototype.identifyDesktopBrowser = function() {
		var self = this;
		var is = self.is || {};
		is[ 'ie' ] = !!document.documentMode; // old ie
		is[ 'edge' ] = !is[ 'ie ' ] && !!window.StyleMedia; // new ie. They both fail, lol
		is[ 'opera' ] = ( !!window.opr && !!window.opr.addons )
			|| window.opera
			|| navigator.userAgent.indexOf( ' OPR/' ) >= 0;
		is[ 'safari' ] = Object.prototype.toString.call( window.HTMLElement )
			.indexOf( 'Constructor' ) > 0;
		is[ 'firefox' ] = !!window.InstallTrigger;
		is[ 'chrome' ] = !!window.chrome && !!window.chrome.webstore;
		is[ 'blink' ] = ( is[ 'chrome' ] || is[ 'opera' ] ) && !!window.CSS;
		if ( is[ 'blink' ]) {
			is[ 'chrome' ] = false;
			is[ 'opera' ] = false;
		}
		
		self.is = is;
	}
	
	ns.BrowserCheck.prototype.checkCapabilities = function() {
		var self = this;
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
		var self = this;
		var tokens = [
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
		var rxStr = tokens.join( '|' );
		var rx = new RegExp( rxStr, '' );
		var match = navigator.userAgent.match( rx );
		if ( match )
			self.isMobile = match[ 0 ];
	}
	
	ns.BrowserCheck.prototype.getApprovedUAId = function() {
		var self = this;
		var tokens = [
			'Chrome',
			'Samsung',
		];
		var rxStr = tokens.join( '|' );
		var rx = new RegExp( rxStr, 'i' );
		var match = navigator.userAgent.match( rx );
		if ( match )
			return match[ 0 ];
		
		return '';
	}
	
	ns.BrowserCheck.prototype.checkVR = function() {
		var self = this;
		var match = navigator.userAgent.match( /VR/ );
		if ( match )
			self.isVR = true;
	}
	
	ns.BrowserCheck.prototype.done = function() {
		var self = this;
		var browser = getBrowser();
		var supType = 'unknown' === browser
			? 'error'
			: ( self.supportMap[ browser.toLowerCase() ] || 'error' );
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
			type  : supType,
			message : supString,
		};
		
		var res = {
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
		var self = this;
		delete self.onresult;
	}
	
	
})( library.rtc );

//SourceSelect
(function( ns, undefined ) {
	ns.SourceSelect = function( conf ) {
		if ( !( this instanceof ns.SourceSelect ))
			return new ns.SourceSelect( conf );
		
		var self = this;
		self.view = conf.view;
		self.onselect = conf.onselect;
		self.selfie = conf.selfie;
		self.permissions = conf.permissions;
		
		self.init();
	}
	
	// pub
	
	ns.SourceSelect.prototype.show = function( currentDevices ) {
		var self = this;
		self.ui.show();
		self.ui.showDevices( currentDevices );
	}
	
	ns.SourceSelect.prototype.showGUMError = function( data ) {
		var self = this;
		self.ui.show();
		self.ui.showGetUserMediaError( data );
	}
	
	ns.SourceSelect.prototype.getSelected = function() {
		var self = this;
		return self.ui.getSelected();
	}
	
	ns.SourceSelect.prototype.close = function() {
		var self = this;
		self.ui.close();
		delete self.ui;
		delete self.permissions;
		delete self.onselect;
		delete self.onclose;
	}
	
	// priv
	
	ns.SourceSelect.prototype.init = function() {
		var self = this;
		var uiConf = {
			permissions : self.permissions,
			onselect : onselect,
		};
		self.ui = self.view.addUIPane( 'source-select', uiConf );
		//self.ui.show();
		
		function onselect( devices ) {
			self.onselect( devices );
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
	
	ns.ScreenShare.prototype.getSourceId = function( callback ) {
		const self = this;
		const getSource = {
			type : 'getSource'
		};
		self.sendToExt( getSource, sourceBack );
		function sourceBack( res ) {
			console.log( 'getSourceId - sourceBack', res );
			callback( res );
		}
	}
	
	ns.ScreenShare.prototype.connect = function( callback ) {
		const self = this;
		console.log( 'ScreenShare.connect' );
		self.connectCallback = callback;
		self.initInterval = setInterval( sendInit, 2000 );
		function sendInit() {
			if ( !self.initInterval )
				return;
			
			self.sendInit();
		}
	}
	
	ns.ScreenShare.prototype.checkIsAvailable = function( callback ) {
		const self = this;
		const checkAvailable = {
			type : 'ready',
		};
		self.sendToExt( checkAvailable, checkBack );
		self.availableTimeout = setTimeout( checkTimeout, 2000 );
		function checkBack( res ) {
			console.log( 'checkIsAvailable - checkBack', res );
			if ( !self.availableTimeout )
				return;
			
			clearTimeout( self.availableTimeout );
			delete self.availableTimeout;
			
			callback( null, res );
		}
		
		function checkTimeout() {
			console.log( 'no reply from ext' );
			delete self.availableTimeout;
			callback( null, false );
		}
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
		console.log( 'ScreenShare.sendInit', init );
		self.sendToExt( init, initBack );
		function initBack( res ) {
			if ( self.initInterval ) {
				clearInterval( self.initInterval );
				delete self.initInterval;
			}
			
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
