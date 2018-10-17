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
	const origRTCPeerConn = window.RTCPeerConnection;
	window.RTCPeerConnection = function( pcConfig, pcConstraints ) {
		//var prop = Object.getOwnPropertyDescriptor( pcConfig, 'iceServers' );
		return new origRTCPeerConn( window.rtcConf, pcConstraints );
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
// holds all the actual peer objects and connections
(function( ns, undefined ) {
	ns.RTC = function( conn, view, conf, onclose, onready ) {
		const self = this;
		self.conn = conn || null;
		self.view = view;
		self.userId = conf.userId;
		self.rtcConf = conf.rtcConf;
		self.isGuest = conf.isGuest;
		self.peerList = conf.peerList;
		self.identities = conf.identities || {};
		self.guestAvatar = conf.guestAvatar;
		self.mode = conf.rtcConf.mode || null;
		self.quality = conf.rtcConf.quality || null;
		self.permissions = conf.rtcConf.permissions;
		self.localSettings = conf.localSettings;
		self.onclose = onclose;
		self.onready = onready;
		
		self.peers = {};
		self.selfie = null;
		self.joined = false;
		
		self.init();
	}
	
	ns.RTC.prototype.init = function() {
		var self = this;
		self.bindMenu();
		if ( self.quality )
			self.view.updateQualityLevel( self.quality.level );
		
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
		function browserBack( err, browser ) {
			if ( err ) {
				self.goLive( false );
				return;
			}
			
			self.browser = browser;
			self.initChecks.checkDeviceAccess( self.permissions.send, deviceBack );
		}
		
		function deviceBack( err, permissions, devices ) {
			if ( err || !permissions ) {
				console.log( 'oops?', {
					err : err,
					per : permissions,
					dev : devices,
				});
				return;
			}
			
			self.permissions.send = permissions;
			if ( devices )
				self.updateMenuSendReceive( self.permissions, devices );
			
			self.createSelfie( checkSelfieReady );
		}
		
		function checkSelfieReady( gumErr, media ) {
			if ( !self.permissions.send.audio && !self.permissions.send.video )
				passSelfieChecks();
			else
				runSelfieChecks( gumErr, media );
			
			function passSelfieChecks() {
				self.initChecks.passCheck( 'source-check' );
				self.initChecks.passCheck( 'audio-input' );
				self.initChecks.passCheck( 'video-input' );
			}
			
			function runSelfieChecks( gumErr, media ) {
				const ready = self.initChecks.checkSourceReady( !!media, gumErr );
				if ( !ready )
					return;
				
				const selfStream = self.selfie.getStream();
				const devicePref = self.localSettings.preferedDevices;
				self.initChecks.checkAudioDevices( selfStream, devicePref );
				self.initChecks.checkVideoDevices( selfStream, devicePref );
			}
			
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
			if ( !self.selfie )
				return;
			
			self.selfie.showSourceSelect();
		}
		
		function closeInit() {
			self.initChecks.close();
			delete self.initChecks;
			done();
		}
		
		function done() {
			if ( self.isAdmin )
				self.setupAdmin();
			
			self.goLive( true );
		}
	}
	
	ns.RTC.prototype.goLive = function( ready ) {
		const self = this;
		if ( !ready )
			return;
		
		if ( self.mode ) {
			if ( 'presentation' === self.mode.type )
				self.setModePresentation();
		}
		
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
		self.conn.on( 'settings'   , settings );
		self.conn.on( 'speaking'   , speaking );
		self.conn.on( 'nested-app' , nestedApp );
		self.conn.on( 'quality'    , quality );
		self.conn.on( 'mode'       , mode );
		self.conn.on( 'join'       , join );
		self.conn.on( 'leave'      , leave );
		self.conn.on( 'close'      , close );
		
		function roomConf(   e ) { self.initialize(       e ); }
		function identity(   e ) { self.handleIdentity(   e ); }
		function identities( e ) { self.handleIdentities( e ); }
		function settings(   e ) { self.handleSettings(   e ); }
		function speaking(   e ) { self.handleSpeaking(   e ); }
		function nestedApp(  e ) { self.handleNestedApp(  e ); }
		function quality(    e ) { self.handleQuality(    e ); }
		function mode(       e ) { self.handleMode(       e ); }
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
				isHost : true,
			};
			self.createPeer( conf );
		}
	}
	
	ns.RTC.prototype.bindMenu = function() {
		var self = this;
		self.menu = self.view.addMenu();
		self.menu.on( 'change-username'  , username );
		self.menu.on( 'restart'          , restart );
		self.menu.on( 'mode-presentation', presentation );
		
		if ( self.isGuest ) {
			self.menu.disable( 'share' );
		}
		
		function username( e ) { self.changeUsername(); }
		function restart( e ) { self.restartPeers(); }
		function presentation( e ) { self.togglePresentationMode( e ); }
	}
	
	ns.RTC.prototype.updateMenuSendReceive = function( permissions, devices ) {
		const self = this;
		updateSendToggles( permissions.send );
		updateReceiveToggles( permissions.receive );
		updateSendVisibility( devices );
		
		function updateSendToggles( send ) {
			self.menu.setState( 'send-audio', send.audio );
			self.menu.setState( 'send-video', send.video );
		}
		
		function updateReceiveToggles( rec ) {
			self.menu.setState( 'receive-audio', rec.audio );
			self.menu.setState( 'receive-video', rec.video );
		}
		
		function updateSendVisibility( devices ) {
			const aIds = Object.keys( devices.audioinput );
			const vIds = Object.keys( devices.videoinput );
			if ( !valid( aIds[ 0 ] ))
				self.menu.disable( 'send-audio' );
			
			if ( !valid( vIds[ 0 ] ))
				self.menu.disable( 'send-video' );
			
			function valid( id ) {
				if ( !id || !id.length )
					return false;
				
				if ( "" === id )
					return false;
				
				return true;
			}
		}
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
		for ( let idKey in identities ) {
			const id = identities[ idKey ];
			self.identities[ idKey ] = id;
			self.updatePeerIdentity( idKey, id );
		}
	}
	
	ns.RTC.prototype.handleSettings = function( update ) {
		const self = this;
		if ( 'isStream' === update.setting )
			self.handleLiveSwitch( update.value );
	}
	
	ns.RTC.prototype.handleLiveSwitch = function( isStream ) {
		const self = this;
		if ( !isStream ) {
			if ( self.switchPane )
				self.switchPane.close();
			
			return;
		}
		
		const conf = {
			isStream : isStream,
			onChoice : onChoice,
		};
		self.switchPane = self.view.addUIPane( 'live-stream-switch', conf );
		self.switchPane.show();
		
		function onChoice( choice ) {
			self.switchPane.close();
			self.switchPane = null;
			let viewSwitch = {
				type : 'view-switch',
				data : {
					choice : choice,
				},
			};
			self.conn.send( viewSwitch );
		}
	}
	
	ns.RTC.prototype.handleSpeaking = function( speaker ) {
		const self = this;
		if ( self.userId === speaker.peerId ) {
			speaker.peerId = 'selfie';
		}
		
		self.view.setSpeaker( speaker );
	}
	
	ns.RTC.prototype.handleQuality = function( quality ) {
		const self = this;
		if ( !self.selfie )
			return;
		
		self.selfie.setRoomQuality( quality );
		
	}
	
	ns.RTC.prototype.handleMode = function( event ) {
		const self = this;
		let mode = event.type;
		if ( '' === mode )
			self.setModeNormal();
		
		if ( 'presentation' === mode )
			self.setModePresentation( event.data );
		
		//self.restartStream();
	}
	
	ns.RTC.prototype.setModeNormal = function() {
		const self = this;
		self.menu.enable( 'mode-speaker' );
		self.menu.enable( 'send-receive' );
		self.menu.enable( 'mode-presentation', true );
		self.menu.enable( 'source-select' );
		self.menu.enable( 'toggle-screen-share' );
		self.menu.enable( 'dragger' );
		self.menu.setState( 'mode-presentation', false );
		self.view.togglePresentation( null );
		if ( self.stdPermissions )
			restorePermissions( JSON.parse( self.stdPermissions ));
		
		if ( self.mode.data && ( null != self.mode.data.wasMuted ))
			self.selfie.toggleMute( self.mode.data.wasMuted );
		
		self.mode = null;
		self.restartStream();
		
		function restorePermissions( std ) {
			console.log( 'restorePermissions', std );
			self.permissions.send = std.send;
			self.permissions.receive = std.receive;
		}
	}
	
	ns.RTC.prototype.setModePresentation = function( conf ) {
		const self = this;
		console.log( 'live.setModePresentation', {
			conf : conf,
			mode : self.mode,
		});
		if ( !self.mode && !conf ) {
			console.log( 'live.setModePresentation - invalid data', {
				conf : conf,
				mode : self.mode,
			});
			return;
		}
		
		if ( !self.mode )
			self.mode = {
				type : 'presentation',
				data : conf,
			};
		
		let presenterId = self.mode.data.owner;
		let isPresenter = presenterId === self.userId;
		if ( !isPresenter ) {
			self.mode.data.wasMuted = !!self.selfie.isMute;
			self.selfie.toggleMute( true );
		}
		
		self.menu.disable( 'dragger' );
		self.menu.disable( 'mode-speaker' );
		self.menu.disable( 'send-receive' );
		self.menu.setState( 'mode-presentation', true );
		if ( !isPresenter ) {
			self.menu.disable( 'source-select' );
			self.menu.disable( 'toggle-screen-share' );
		}
		
		if ( isPresenter )
			self.view.togglePresentation( 'selfie' );
		else
			self.view.togglePresentation( presenterId );
		
		self.stdPermissions = JSON.stringify( self.permissions );
		
		if ( isPresenter ) {
			setPresenterPermissions();
			self.restartPeers();
		}
		else {
			setReceiverPermissions();
			self.restartStream();
		}
		
		function setPresenterPermissions() {
			self.permissions.send = {
				audio : true,
				video : self.permissions.send.video,
			};
			self.permissions.receive = {
				audio : true,
				video : false,
			};
		}
		
		function setReceiverPermissions() {
			self.permissions.send = {
				audio : true,
				video : false,
			};
			self.permissions.receive = {
				audio : true,
				video : true,
			};
		}
	}
	
	ns.RTC.prototype.handlePeerJoin = function( peer ) {
		const self = this;
		peer.isHost = false;
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
	
	ns.RTC.prototype.changeUsername = function() {
		const self = this;
		const id = self.identities[ self.userId ];
		let current = '';
		if ( id )
			current = id.liveName || id.name;
		
		const conf = {
			current : current,
			onname : onName,
		};
		self.changeUsername = self.view.addUIPane( 'change-username', conf );
		self.changeUsername.show();
		
		function onName( name ) {
			if ( self.changeUsername ) {
				self.changeUsername.close();
				delete self.changeUsername;
			}
			
			if ( !name || !name.length )
				return;
			
			if ( name === current )
				return;
			
			const update = {
				type : 'live-name',
				data : name,
			};
			self.conn.send( update );
		}
	}
	
	ns.RTC.prototype.restartStream = function() {
		var self = this;
		console.log( 'RTC.restartStream()', {
			peers : self.peers,
			perms : self.permissions,
			selfi : self.selfie,
		});
		var pids = Object.keys( self.peers );
		pids.forEach( stop );
		// get new media
		self.selfie.setupStream( streamReady );
		function streamReady() {
			pids.forEach( restart );
		}
		
		function stop( pid ) {
			let peer = self.peers[ pid ];
			peer.stop();
		}
		
		function restart( pid ) {
			let peer = self.peers[ pid ];
			if ( !peer )
				return;
			
			peer.restart();
		}
	}
	
	ns.RTC.prototype.togglePresentationMode = function( e ) {
		const self = this;
		const mode = {
			type : 'mode',
			data : {
				mode : 'presentation',
			},
		};
		self.conn.send( mode );
	}
	
	ns.RTC.prototype.setupAdmin = function() {
		var self = this;
		console.log( 'setupAdmin - NYI', self );
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
		for( var pid in self.peers ) {
			var peer = self.peers[ pid ];
			peer.checkFailed();
		}
	}
	
	ns.RTC.prototype.restartPeers = function() {
		const self = this;
		let pids = Object.keys( self.peers );
		pids.forEach( restart );
		function restart( peerId ) {
			if ( peerId === self.userId )
				return;
			
			let peer = self.peers[ peerId ];
			if ( !peer )
				return;
			
			peer.restart();
		}
	}
	
	ns.RTC.prototype.createPeer = function( data ) {
		const self = this;
		const pid = data.peerId;
		let peer = self.peers[ pid ];
		if ( peer ) {
			console.log( 'createPeer - already exists', self.peers );
			peer.close();
			delete self.peers[ pid ];
			self.view.removePeer( pid );
			peer = null;
		}
		
		if ( null == data.isHost )
			data.isHost = false;
		
		let identity = self.identities[ pid ];
		if ( !identity )
			identity = {
				name   : '---',
				avatar : self.guestAvatar,
			};
		
		if ( !identity.avatar )
			identity.avatar = self.guestAvatar;
		
		let isFocus = undefined;
		if ( self.currentPeerFocus )
			isFocus = false;
		
		const Peer = getPeerConstructor( self.browser );
		peer = new Peer({
			id          : pid,
			identity    : identity,
			permissions : self.permissions,
			isFocus     : isFocus,
			isHost      : data.isHost,
			signal      : self.conn,
			rtcConf     : self.rtcConf,
			selfie      : self.selfie,
			onremove    : signalRemovePeer,
			closeCmd    : closeCmd,
		});
		
		peer.on( 'nestedapp' , nestedApp );
		peer.on( 'set-focus', setFocus );
		
		function nestedApp( e ) { self.view.addNestedApp( e ); }
		function setFocus( e ) { self.setPeerFocus( e, pid ); }
		
		self.peers[ peer.id ] = peer;
		self.view.addPeer( peer );
		
		function signalRemovePeer() { self.signalRemovePeer( data.peerId ); }
		function closeCmd() { self.closePeer( data.peerId ); }
		
		function getPeerConstructor( browser ) {
			if ( 'safari' === browser )
				return library.rtc.PeerSafari;
			
			if ( 'firefox' === browser )
				return library.rtc.PeerFirefox;
			
			return library.rtc.Peer;
		}
	}
	
	ns.RTC.prototype.updatePeerIdentity = function( peerId, identity ) {
		const self = this;
		if ( peerId === self.userId && self.selfie ) {
			self.selfie.updateIdentity( identity );
			return;
		}
		
		const peer = self.peers[ peerId ];
		if ( !peer ) {
			console.log( 'no peer found for', {
				pid : peerId,
				id : identity,
				peers : self.peers,
			});
			return;
		}
		
		peer.updateIdentity( identity );
	}
	
	ns.RTC.prototype.setPeerFocus = function( isFocus, peerId ) {
		const self = this;
		let focusPeer = null;
		const pids = Object.keys( self.peers )
			.filter( notSelf )
			.filter( notFocusPeer );
		
		// no peer to focus, always unfocus
		if ( !peerId ) {
			unFocus();
			return;
		}
		
		// no change
		if ( self.currentPeerFocus === peerId && isFocus )
			return;
		
		focusPeer = self.peers[ peerId ];
		
		// still no peer to focus.. might have left?
		if ( !focusPeer ) {
			unFocus();
			return;
		}
		
		if ( isFocus )
			focus( peerId );
		else
			unFocus();
		
		function focus( peerId ) {
			pids.forEach( setNotInFocus );
			self.currentPeerFocus = peerId;
			focusPeer.setFocus( true );
			
			function setNotInFocus( pid ) {
				let peer = self.peers[ pid ];
				peer.setFocus( false );
			}
		}
		
		function unFocus() {
			if ( focusPeer )
				focusPeer.setFocus( null );
			
			self.currentPeerFocus = null;
			pids.forEach( setNoFocus );
			
			function setNoFocus( pid ) {
				let peer = self.peers[ pid ];
				peer.setFocus( null );
			}
		}
		
		function notSelf( pid ) {
			return pid !== self.userId;
		}
		
		function notFocusPeer( pid ) {
			if ( !peerId )
				return true;
			
			return pid  !== peerId;
		}
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
		var peer = self.peers[ peerId ];
		if ( !peer ) {
			console.log( 'RTC.closePeer - no peer for id', peerId );
			return;
		}
		
		self.view.removePeer( peerId );
		delete self.peers[ peerId ];
		
		peer.close();
		if ( self.currentPeerFocus === peerId )
			self.setPeerFocus( false );
	}
	
	ns.RTC.prototype.createSelfie = function( createBack ) {
		var self = this;
		var identity = self.identities[ self.userId ];
		if ( !identity )
			identity = {
				name   : '---',
				avatar : self.guestAvatar,
			};
			
		if ( !identity.avatar )
			identity.avatar = self.guestAvatar;
		
		var selfie = new library.rtc.Selfie({
			conn            : self.conn,
			view            : self.view,
			menu            : self.menu,
			identity        : identity,
			browser         : self.browser,
			permissions     : self.permissions,
			quality         : self.quality,
			localSettings   : self.localSettings,
			isAdmin         : self.isAdmin,
			onleave         : onLeave,
		}, done );
		
		function onLeave() {
			self.leave();
		}
		
		function done( err, res ) {
			createBack( err, res );
		}
		
		self.selfie = selfie;
		self.view.addPeer( selfie );
		self.selfie.on( 'error'           , error );
		self.selfie.on( 'audio-sink'      , audioSink );
		self.selfie.on( 'mute'            , broadcastMute );
		self.selfie.on( 'blind'           , broadcastBlind );
		self.selfie.on( 'screenmode'      , broadcastScreenMode );
		self.selfie.on( 'tracks-available', broadcastTracksAvailable );
		self.selfie.on( 'reflow'          , handleReflow );
		self.selfie.on( 'quality'         , setQuality );
		self.selfie.on( 'restart'         , restart );
		
		function error( e ) { self.handleSelfieError( e ); }
		function audioSink( e ) { self.handleAudioSink( e ); }
		function broadcastMute( isMuted ) { broadcast( 'mute', isMuted ); }
		function broadcastBlind( isBlinded ) { broadcast( 'blind', isBlinded ); }
		function broadcastScreenMode( mode ) { broadcast( 'screenmode', mode ); }
		function broadcastTracksAvailable( tracks ) {
			broadcast( 'tracks-available', tracks );
		}
		
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
		
		function restart() {
			self.restartPeers();
		}
	}
	
	ns.RTC.prototype.handleSelfieError = function( err ) {
		const self = this;
		console.log( 'handleSelfieError - NYI', err );
	}
	
	ns.RTC.prototype.handleAudioSink = function( deviceId ) {
		const self = this;
		self.view.setAudioSink( deviceId );
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
		self.close();
	}
	
	ns.RTC.prototype.close = function() {
		var self = this;
		var peerIds = Object.keys( self.peers );
		peerIds.forEach( callClose );
		function callClose( peerId ) {
			self.closePeer( peerId );
		}
		
		delete self.conf;
		delete self.conn;
		delete self.view;
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
		const self = this;
		library.component.EventEmitter.call( self );
		
		self.id = 'selfie';
		self.conn = conf.conn;
		self.view = conf.view;
		self.menu = conf.menu;
		self.browser = conf.browser;
		self.identity = conf.identity;
		self.permissions = conf.permissions;
		self.localSettings = conf.localSettings;
		self.currentQuality = conf.quality || {
			level : 'normal',
			scale : 1,
		};
		self.isAdmin = conf.isAdmin;
		self.media = null;
		self.stream = null;
		self.onleave = conf.onleave;
		self.doneBack = callback;
		
		self.currentDevices = {};
		self.isBlind = false;
		self.isMute = false;
		
		self.isChrome = null;
		self.isFirefox = null;
		
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
		
		if ( self.speaking )
			self.speaking.close();
		
		if ( self.volume )
			self.volume.close();
		
		if ( self.media )
			self.media.close();
		
		if ( self.sourceSelect )
			self.sourceSelect.close();
		
		delete self.currentAudioOut;
		delete self.localSettings;
		delete self.speaking;
		delete self.volume;
		delete self.stream;
		delete self.shareMedia;
		delete self.sourceSelect;
		delete self.media;
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
		//self.supported = navigator.mediaDevices.getSupportedConstraints();
		//console.log( 'supported', self.supported );
		
		// IsSpeaking
		self.speaking = new library.rtc.IsSpeaking(
			null,
			onSpeaking
		);
		
		function onSpeaking( isSpeaking ) {
			const speaking = {
				type : 'speaking',
				data : {
					time       : Date.now(),
					isSpeaking : isSpeaking,
				},
			};
			self.conn.send( speaking );
		}
		
		self.conn.on( 'speaking', speaking );
		function speaking( speaker ) {
			if ( !self.speaking )
				return;
			
			if ( speaker.peerId === self.identity.clientId )
				self.speaking.setIsSpeaker( speaker.isSpeaking );
			else
				self.speaking.setIsSpeaker( false );
		}
		
		//
		self.extConn = self.view.addExtConnPane( onExtConnShare );
		function onExtConnShare( e ) {
			self.extConn.close();
			self.toggleShareScreen();
		}
		
		self.screenShare = new library.rtc.ScreenShare();
		self.screenShare.checkIsAvailable( shareCheckBack );
		function shareCheckBack( err, isAvailable ) {
			if ( err || !isAvailable ) {
				self.toggleMenuScreenShareInstall( true );
				return;
			}
			
		}
		
		const sourceConf = {
			view     : self.view,
			onselect : sourcesSelected,
		};
		self.sourceSelect = new library.rtc.SourceSelect( sourceConf );
		function sourcesSelected( selected ) {
			self.setMediaSources( selected );
		}
		
		self.bindMenu();
		self.sources = new library.rtc.MediaDevices();
		self.media = new library.rtc.Media(
			self.permissions,
			self.localSettings.preferedDevices,
			self.currentQuality,
			self.sources
		);
		
		self.media.on( 'media', media );
		self.media.on( 'track-ended', trackEnded );
		self.media.on( 'error', mediaError );
		function media( e ) { self.handleMedia( e ); }
		function trackEnded( e ) { self.handleTrackEnded( e ); }
		function mediaError( e ) { self.handleMediaError( e ); }
		
		self.setAudioSink( self.localSettings.preferedDevices );
		self.setupStream( done );
		
		function done( err, res ) {
			if ( !self.doneBack )
				throw new Error( 'selfie init has no callback' );
			
			var doneBack = self.doneBack;
			delete self.doneBack;
			doneBack( err, res );
		}
	}
	
	ns.Selfie.prototype.handleMedia = function( media ) {
		const self = this;
		self.setStream( media );
		if ( !media )
			return;
		
		let callback = self.streamBack;
		if ( callback ) {
			delete self.streamBack;
			callback( null, media );
		}
		
		if ( self.isScreenSharing ) {
			self.menu.setState( 'toggle-screen-share', true );
			self.toggleScreenMode( 'contain' );
		}
	}
	
	ns.Selfie.prototype.handleTrackEnded = function( track ) {
		const self = this;
		if ( self.isScreenSharing ) {
			self.toggleShareScreen();
			return;
		}
		
		self.media.create();
	}
	
	ns.Selfie.prototype.handleMediaError = function( err ) {
		const self = this;
		console.log( 'handleMediaError - NYI', err );
	}
	
	ns.Selfie.prototype.bindMenu = function() {
		var self = this;
		self.menu.on( 'mute'                , mute );
		self.menu.on( 'blind'               , blind );
		self.menu.on( 'leave'               , leave );
		self.menu.on( 'q-default'           , qualityDefault );
		self.menu.on( 'q-normal'            , qualityNormal );
		self.menu.on( 'q-medium'            , qualityMedium );
		self.menu.on( 'q-low'               , qualityLow );
		self.menu.on( 'send-audio'          , sendAudio );
		self.menu.on( 'send-video'          , sendVideo );
		self.menu.on( 'receive-audio'       , receiveAudio );
		self.menu.on( 'receive-video'       , receiveVideo );
		self.menu.on( 'screen-mode'         , screenMode );
		self.menu.on( 'toggle-screen-share' , screenShare );
		self.menu.on( 'screen-share-ext'    , screenExtInstall );
		self.menu.on( 'source-select'       , sourceSelect );
		
		function mute( e ) { self.toggleMute(); }
		function blind( e ) { self.toggleBlind(); }
		function leave( e ) { self.leave(); }
		function qualityDefault( e ) { self.handleQuality( 'default' )}
		function qualityNormal( e ) { self.handleQuality( 'normal' ); }
		function qualityMedium( e ) { self.handleQuality( 'medium' ); }
		function qualityLow( e ) { self.handleQuality( 'low' ); }
		function sendAudio( e ) { self.toggleSendAudio( e ); }
		function sendVideo( e ) { self.toggleSendVideo( e ); }
		function receiveAudio( e ) { self.toggleReceiveAudio( e ); }
		function receiveVideo( e ) { self.toggleReceiveVideo( e ); }
		function screenMode( e ) { self.toggleScreenMode(); }
		function screenShare( e ) { self.toggleShareScreen(); }
		function screenExtInstall( e ) { self.openScreenExtInstall( e ); }
		function sourceSelect( e ) { self.showSourceSelect(); }
	}
	
	ns.Selfie.prototype.showError = function( errMsg ) {
		const self = this;
		self.emit( 'error', errMsg );
	}
	
	ns.Selfie.prototype.showSourceSelect = function() {
		const self = this;
		const devices = self.media.getCurrentDevices() || null;
		devices.audiooutput = self.currentAudioOut;
		self.sourceSelect.show( devices );
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
		window.open( 'https://chrome.google.com/webstore/detail/friend-screen-share/\
			ipakdgondpoahmhclacfgekboimhgpap' );
		
		self.extConn.show();
		self.screenShare.connect( connBack );
		function connBack( err, res ) {
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
		if ( self.chromeSourceId )
			unshare();
		else
			share();
		
		function unshare() {
			self.chromeSourceId = null;
			self.chromeSourceOpts = null;
			self.menu.setState( 'toggle-screen-share', false );
			self.isScreenSharing = false;
			self.toggleScreenMode( 'cover' );
			self.setupStream();
		}
		
		function share() {
			self.screenShare.getSourceId( getBack );
			function getBack( res ) {
				if ( !res || !res.sid )
					return;
				
				self.chromeSourceId = res.sid;
				self.chromeSourceOpts = res.opts;
				self.menu.setState( 'toggle-screen-share', true );
				self.isScreenSharing = true;
				self.toggleScreenMode( 'contain' );
				self.media.shareScreen( res.sid );
			}
		}
	}
	
	ns.Selfie.prototype.setMediaSources = function( devices ) {
		const self = this;
		if ( !devices )
			return;
		
		let send = self.permissions.send;
		if ( typeof( devices.audioinput ) === 'boolean' )
			send.audio = false;
		else
			send.audio = true;
		
		if ( typeof( devices.videoinput ) === 'boolean' )
			send.video = false;
		else
			send.video = true;
		
		self.menu.setState( 'send-audio', send.audio );
		self.menu.setState( 'send-video', send.video );
		
		self.setupStream( streamBack, null, devices );
		function streamBack( err, res ) {
			if ( err )
				return;
			
			self.savePreferedDevices( devices );
			if ( devices.audiooutput )
				self.setAudioSink( devices );
		}
	}
	
	ns.Selfie.prototype.setAudioSink = function( selected ) {
		const self = this;
		if ( !selected )
			return;
		
		self.sources.getByType()
			.then( devBack )
			.catch( fail );
		
		function devBack( devices ) {
			let label = selected.audiooutput;
			let out = devices.audiooutput[ label ];
			if ( !out )
				return;
			
			self.currentAudioOut = label;
			self.emit( 'audio-sink', out.deviceId );
		}
		
		function fail( err ) {
			console.log( 'setAudioSink - enumerating devices failed', err );
		}
	}
	
	ns.Selfie.prototype.savePreferedDevices = function( devices ) {
		const self = this;
		self.saveLocalSetting( 'preferedDevices', devices );
	}
	
	ns.Selfie.prototype.saveLocalSetting = function( setting, value ) {
		const self = this;
		const sett = {
			type : 'local-setting',
			data : {
				setting : setting,
				value   : value,
			},
		};
		self.conn.send( sett );
	}
	
	ns.Selfie.prototype.handleQuality = function( level ) {
		var self = this;
		self.changeStreamQuality( level );
	}
	
	ns.Selfie.prototype.changeStreamQuality = function( level ) {
		var self = this;
		if ( !level )
			level = 'medium';
		
		self.emit( 'quality', level );
	}
	
	ns.Selfie.prototype.setRoomQuality = function( quality ) {
		const self = this;
		self.currentQuality = self.media.setQuality( quality );
		if ( !self.currentQuality )
			return;
		
		if ( self.isScreenSharing ) {
			console.log( 'is screen sharing, dont reinit stream' );
			return;
		}
		
		self.setupStream();
		self.emit( 'room-quality', self.currentQuality.level ); // updating ui
	}
	
	ns.Selfie.prototype.applyVideoConstraints = function( conf ) {
		var self = this;
		return;
		if ( !conf ) {
			console.log( 'applyVideoConstraints - conf not defined', conf );
			return;
		}
		
		if ( 'boolean' === typeof( conf )) {
			self.mediaConf.video = conf;
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
	
	ns.Selfie.prototype.getOpusConf = function() {
		const self = this;
		self.media.getOpusConf();
	}
	
	ns.Selfie.prototype.setupStream = function( callback, permissions, preferedDevices ) {
		var self = this;
		if ( self.streamBack ) {
			let oldBack = self.streamBack;
			delete self.streamBack;
			oldBack( 'CANCELED', null );
		}
		
		self.streamBack = callback;
		self.media.create( permissions, preferedDevices );
		return;
		
		
		if ( self.isScreenSharing ) {
			if ( callback )
				callback( null, self.stream );
			
			return;
		}
		
		if ( self.streamSetupRunning ) {
			self.recycleStream = true;
			return;
		}
		
		self.streamSetupRunning = true;
		if ( self.stream )
			self.clearStream();
		
		let send = self.permissions.send;
		if ( !send || ( !send.audio && !send.video )) {
			self.setStream( null );
			done( null, null );
			return
		}
		
		self.audio = send.audio;
		self.video = send.video;
		
		self.mediaConf.audio = {
			"echoCancellation" : true,
		};
		
		self.sources.getByType()
			.then( init )
			.catch( devicesError );
		
		function devicesError( err ) {
			console.log( 'setupStream - updating devices failed', err );
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
					conf[ type ] = {};
				
				conf[ type ].deviceId = device.deviceId;
			}
		}
		
		function getMedia( conf ) {
			window.navigator.mediaDevices.getUserMedia( conf )
				.then( success )
				.catch( error );
				
			function success( media ) { mediaCreated( media, conf ); }
			function error( err ) { mediaFailed( err, conf ); }
		}
		
		function mediaCreated( media, constraints ) {
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
			self.simpleConf = false;
			self.giveUp = false;
			self.setStream( media, constraints );
			done( null, media );
			
			function updateDevice( track, type ) {
				self.currentDevices[ type ] = track.label;
			}
		}
		
		function mediaFailed( err, constraints ) {
			self.clearStream();
			console.log( 'mediaFailed', {
				stack : err.stack,
				err   : err,
			});
			
			const errData = {
				err : err,
				constraints : constraints,
			};
			
			self.emit( 'mediafailed', errData );
			
			if ( self.giveUp )
				done( errData, null );
			else
				retrySimple();
		}
		
		/*
		function retryLastGood() {
			const conf = self.lastGoodConstraints;
			self.lastGoodConstraints = null;
			getMedia( conf );
		}
		*/
		
		function retrySimple() {
			// try audio + video, but no special conf
			if ( !self.simpleConf ) {
				self.simpleConf = {
					audio : true,
					video : true,
				};
				getMedia( self.simpleConf );
				return;
			}
			
			// try only audio, set giveUp so we dont try
			// again if it still fails.
			if ( self.simpleConf.video ) {
				self.simpleConf.video = false;
				self.giveUp = true;
				getMedia( self.simpleConf );
			}
		}
		
		function done( err, res ) {
			if ( self.recycleStream ) {
				setTimeout( recycle, 1 );
				return;
			}
			
			self.streamSetupRunning = false;
			if ( callback )
				callback( err, res );
			
			function recycle() {
				self.recycleStream = false;
				self.streamSetupRunning = false;
				self.setupStream( callback );
			}
		}
	}
	
	ns.Selfie.prototype.setStream = function( stream ) {
		const self = this;		
		self.stream = stream;
		
		if ( self.isMute ) {
			self.toggleMute( true );
		}
		
		if ( self.isBlind ) {
			self.toggleBlind( true );
		}
		
		const aTrack = self.getAudioTrack();
		const vTrack = self.getVideoTrack();
		
		if ( aTrack )
			self.bindVolume( stream );
		
		const tracks = {
			audio : !!aTrack,
			video : !!vTrack,
		};
		
		self.emit( 'tracks-available', tracks );
		self.emit( 'selfie', stream );
		
		// TODO refactor these to use tracks-available?
		self.emit( 'audio', !!aTrack );
		self.emit( 'video', !!vTrack );
		
		self.emitVoiceOnly( tracks );
	}
	
	ns.Selfie.prototype.getStream = function() {
		var self = this;
		return self.stream;
	}
	
	ns.Selfie.prototype.clearStream = function() {
		const self = this;
		delete self.stream;
	}
	
	ns.Selfie.prototype.bindVolume = function( stream ) {
		const self = this;
		if ( self.volume )
			self.releaseVolume();
		
		self.volume = new library.rtc.Volume(
			stream,
			onVolume,
			onBuffer
		);
		self.speaking.setSource( self.volume );
		self.emit( 'volume-source', self.volume );
		
		function onVolume( e ) {}
		function onBuffer( e ) {}
	}
	
	ns.Selfie.prototype.releaseVolume = function() {
		const self = this;
		if ( !self.volume )
			return;
		
		self.volume.release();
		self.volume.close();
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
		const self = this;
		self.emit( 'queue', data );
	}
	
	ns.Selfie.prototype.shareRoom = function() {
		const self = this;
		self.emit( 'share' );
	}
	
	ns.Selfie.prototype.emitReflow = function() {
		const self = this;
		self.emit( 'reflow' );
	}
	
	ns.Selfie.prototype.toggleSendAudio = function() {
		const self = this;
		let send = self.permissions.send;
		send.audio = !send.audio;
		self.menu.setState( 'send-audio', send.audio );
		self.setupStream( streamUp );
		function streamUp( err, media ) {
			//self.emit( 'restart' );
		}
	}
	
	ns.Selfie.prototype.toggleSendVideo = function() {
		const self = this;
		let send = self.permissions.send;
		send.video = !send.video;
		self.menu.setState( 'send-video', send.video );
		self.setupStream( streamUp );
		function streamUp( err, media ) {
			//self.emit( 'restart' );
		}
	}
	
	ns.Selfie.prototype.toggleReceiveAudio = function() {
		const self = this;
		let rec = self.permissions.receive;
		rec.audio = !rec.audio;
		self.menu.setState( 'receive-audio', rec.audio );
		self.emit( 'restart', rec );
	}
	
	ns.Selfie.prototype.toggleReceiveVideo = function() {
		const self = this;
		let rec = self.permissions.receive;
		rec.video = !rec.video;
		self.menu.setState( 'receive-video', rec.video );
		self.emit( 'restart', rec );
		self.emitVoiceOnly();
	}
	
	ns.Selfie.prototype.emitVoiceOnly = function( tracks ) {
		const self = this;
		const voiceOnly = checkIsVoiceOnly( tracks );
		self.emit( 'voice-only', voiceOnly );
		
		function checkIsVoiceOnly( tracks ) {
			const send = ( tracks && tracks.video ) || self.permissions.send.video;
			const receive = self.permissions.receive.video;
			if ( send || receive )
				return false;
			
			return true;
		}
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
		self.permissions = conf.permissions;
		self.isFocus = conf.isFocus;
		self.rtcConf = conf.rtcConf;
		self.onremove = conf.onremove; // when the remote peer initiates a close, call this
		self.closeCmd = conf.closeCmd; // closing from this end ( ui click f.ex. )
		self.selfie = conf.selfie;
		self.signal = null;
		
		self.alpha = null;
		self.session = null;
		//self.sessions = {};
		self.tracks = {};
		self.stream = null;
		
		self.isVideo = false;
		self.isAudio = false;
		
		self.isBlind = false;
		self.isMute = false;
		
		self.metaInterval = null;
		self.syncInterval = null;
		self.syncStamp = null;
		self.isHost = null;
		
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
	ns.Peer.prototype.send = function( event ) {
		const self = this;
		self.signal.send( event );
	}
	
	ns.Peer.prototype.updateIdentity = function( identity ) {
		const self = this;
		self.identity = identity;
		self.emit( 'identity', identity );
	}
	
	ns.Peer.prototype.setFocus = function( isFocus ) {
		const self = this;
		self.isFocus = isFocus;
		self.emit( 'is-focus', !!isFocus );
		if ( null == isFocus )
			unFocus();
		else
			setFocus( isFocus );
		
		self.restart();
		
		
		function unFocus() {
			console.log( 'peer.unfocus' );
		}
		
		function setFocus( isFocus ) {
			console.log( 'peer.setFocus', isFocus );
		}
	}
	
	ns.Peer.prototype.checkFailed = function() {
		const self = this;
		if ( hasFailed( self.session ))
			self.restart();
		
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
		sendRestart();
		self.state = '';
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
		
		self.bindSignalChannel();
		
		// selfie
		self.streamHandlerId = self.selfie.on( 'selfie', handleStream );
		function handleStream( e ) { self.handleSelfieStream( e ); }
		
		self.startSync();
	}
	
	// peer sync
	
	ns.Peer.prototype.startSync = function() {
		const self = this;
		const now = self.syncStamp || Date.now();
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
			
			console.log( 'sendSync', now );
			self.signal.send( sync );
		}
	}
	
	ns.Peer.prototype.handleSync = function( remoteStamp ) {
		const self = this;
		// sync has already been set, ignore
		if ( null != self.isHost )
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
		if ( null == self.isHost )
			self.setDoInit( self.syncStamp, remoteStamp );
	}
	
	ns.Peer.prototype.handleSyncAccept = function( stamps ) {
		const self = this;
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
			self.isHost = true;
		else
			self.isHost = false;
		
		self.stopSync();
		if ( !self.isHost )
			self.sendOpen();
	}
	
	ns.Peer.prototype.bindSignalChannel = function() {
		const self = this;
		self.signal.on( 'sync'             , sync );
		self.signal.on( 'sync-accept'      , syncAccept );
		self.signal.on( 'connect-data'     , connectData );
		self.signal.on( 'restart'          , restart );
		self.signal.on( 'stop'             , stop );
		self.signal.on( 'open'             , open );
		self.signal.on( 'blind'            , blind );
		self.signal.on( 'mute'             , mute );
		self.signal.on( 'screenmode'       , screenMode );
		self.signal.on( 'tracks-available' , tracksAvailable );
		self.signal.on( 'meta'             , meta );
		self.signal.on( 'constraints'      , handleConstraints );
		self.signal.on( 'nostream'         , peerNoStream );
		self.signal.on( 'nestedapp'        , nestedApp );
		self.signal.on( 'update-name'      , updateName )
		self.signal.on( 'recycle'          , recycle );
		self.signal.on( 'reconnect'        , reconnect );
		self.signal.on( 'leave'            , leave );
		self.signal.on( 'close'            , closed );
		
		function sync( e ) { self.handleSync( e ); }
		function syncAccept( e ) { self.handleSyncAccept( e ); }
		function connectData( e ) { self.handleConnectData( e ); }
		function restart( e ) { self.doRestart(); }
		function stop( e ) { self.doStop(); }
		function open( e ) { self.handleOpen( e ); }
		function blind( e ) { self.setRemoteBlind( e ); }
		function mute( e ) { self.setRemoteMute( e ); }
		function screenMode( e ) { self.setScreenMode( e ); }
		function tracksAvailable( e ) { self.updateTracksAvailable( e ); }
		function meta( e ) { self.handleMeta( e ); }
		function handleConstraints( e ) { self.handleRemoteConstraints( e ); }
		function peerNoStream( e ) { self.handleNoStream(); }
		function nestedApp( e ) { self.emit( 'nestedapp', e ); }
		function updateName( e ) { self.emit( 'update-name', e ); }
		function recycle( e ) { self.handleRecycle( e ); }
		function reconnect( e ) { self.handleReconnect( e ); }
		function leave( e ) { console.log( 'peer left?' ); }
		function closed( e ) { self.closeCmd(); }
	}
	
	// stream setup
	
	ns.Peer.prototype.createSession = function() {
		const self = this;
		const type = 'stream';
		if ( self.alpha )
			self.closeData();
		
		if ( self.session )
			self.closeSession();
		
		self.session = new library.rtc.Session({
			type      : type,
			isHost    : self.isHost,
			rtc       : self.rtcConf,
			signal    : self.signal,
			modifySDP : modSDP,
		});
		
		self.session.on( 'stream'     , streamAdded );
		self.session.on( 'track'      , trackAdded );
		self.session.on( 'nostream'   , sendNoStream );
		self.session.on( 'state'      , stateChange );
		self.session.on( 'stats'      , statsUpdate );
		self.session.on( 'error'      , sessionError );
		self.session.on( 'datachannel', dataChannel );
		
		self.showSelfie();
		
		function modSDP( e ) { return self.modifySDP( e, type ); }
		
		function streamAdded( e ) { self.streamAdded( e, type ); }
		function trackAdded( e ) { self.trackAdded( e, type ); }
		function trackRemoved( e ) { self.trackRemoved( e, type ); }
		function sendNoStream( e ) { self.sendNoStream( type ); }
		function stateChange( e ) { self.handleSessionStateChange( e, type ); }
		function statsUpdate( e ) { self.handleStatsUpdate( e, type ); }
		function sessionError( e ) { self.handleSessionError( e, type ); }
		function dataChannel( e ) { self.bindDataChannel( e ); }
	}
	
	ns.Peer.prototype.bindDataChannel = function( channel ) {
		const self = this;
		if ( self.alpha )
			self.closeData();
		
		self.alpha = channel;
		self.alpha.on( 'ping', ping );
		self.alpha.on( 'pong', pong );
		
		self.startPing();
		
		function ping( e ) { self.handlePing( e ); }
		function pong( e ) { self.handlePong( e ); }
	}
	
	//
	
	ns.Peer.prototype.sendOpen = function() {
		const self = this;
		const open = {
			type : 'open',
		};
		self.signal.send( open );
	}
	
	ns.Peer.prototype.handleOpen = function( e ) {
		const self = this;
		self.sendMeta();
	}
	
	ns.Peer.prototype.sendConnectData = function() {
		const self = this;
		const connectEvent = {
			type : 'connect-data',
			data : Date.now(),
		};
		self.signal.send( connectEvent );
	}
	
	ns.Peer.prototype.handleConnectData = function( stamp ) {
		const self = this;
		if ( self.alpha )
			return;
		
		const alpha = self.session.createDataChannel( 'alpha' );
		self.bindDataChannel( alpha );
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
		
		self.alpha.send( ping );
		let strStamp = stamp.toString();
		self.pingTimeouts[ strStamp ] = setTimeout( timeout, self.pingTimeout );
		function timeout() {
			const timer = self.pingTimeouts[ strStamp ];
			if ( null == timer )
				return;
			
			delete self.pingTimeouts[ strStamp ];
			self.setConnectionTimeout();
		}
	}
	
	ns.Peer.prototype.handlePing = function( stamp ) {
		const self = this;
		const pong = {
			type : 'pong',
			data : stamp,
		};
		self.alpha.send( pong );
	}
	
	ns.Peer.prototype.handlePong = function( stamp ) {
		const self = this;
		const now = Date.now();
		let strStamp = stamp.toString();
		const timer = self.pingTimeouts[ strStamp ];
		if ( null == timer )
			return; // it has already timed out
		
		clearTimeout( timer );
		delete self.pingTimeouts[ strStamp ];
		
		stamp = parseInt( stamp, 10 );
		const pingTime = now - stamp;
		self.emitRTCPing( pingTime );
	}
	
	ns.Peer.prototype.stopPing = function( ) {
		const self = this;
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
		self.stopPing();
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
		self.showSelfie( null, sid );
	}
	
	ns.Peer.prototype.handleRecycle = function( sid ) {
		var self = this;
		self.closeSession( sid );
		self.createSession( sid );
		if ( self.isHost )
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
		if ( 'sync-meta' === self.state ) {
			console.log( 'doRestart - syncing meta, aborting' );
			return;
		}
		
		self.doStop();
		if ( self.isHost )
			self.sendMeta();
	}
	
	ns.Peer.prototype.doStop = function( sid ) {
		var self = this;
		self.stopPing();
		self.emit( 'release-stream' );
		self.releaseStream();
		self.closeAllSessions();
	}
	
	ns.Peer.prototype.closeAllSessions = function() {
		var self = this;
		self.closeSession();
		return;
		
		/*
		self.metaSyncDone = false;
		for ( var sid in self.sessions )
			self.closeSession( sid );
		*/
	}
	
	ns.Peer.prototype.closeSession = function( sid ) {
		const self = this;
		self.closeData();
		
		const sess = self.session;
		delete self.session;
		if ( !sess )
			return;
		
		try {
			sess.close();
		} catch( e ) {
			console.log( 'Peer.closeSession - session already closed', e );
		}
	}
	
	ns.Peer.prototype.closeData = function( e ) {
		const self = this;
		if ( !self.alpha )
			return;
		
		self.alpha.close();
		delete self.alpha;
	}
	
	ns.Peer.prototype.handleQualityUpdate = function( e ) {
		var self = this;
		if ( !self.session )
			return;
		
		self.session.renegotiate();
	}
	
	ns.Peer.prototype.modifySDP = function( SDPObj, type ) {
		var self = this;
		return SDPObj;
		
		if ( 'video' === type )
			return SDPObj;
		
		if ( 'normal' === self.selfie.currentQuality.level )
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
		self.screenMode = mode;
		self.emit( 'screenmode' );
	}
	
	ns.Peer.prototype.handleSelfieStream = function( stream ) {
		var self = this;
		self.showSelfie( stream );
	}
	
	ns.Peer.prototype.showSelfie = function( stream, sessionType ) {
		var self = this;
		if ( !self.receive ) {
			console.log( 'showSelfie - no receive, meta has not been received yet' );
			return;
		}
		
		if ( !stream ) {
			stream = self.selfie.getStream();
			console.log( 'Peer.showSelfie - no stream passed, getStream()', stream );
		}
		
		if ( !stream ) {
			console.log( 'Peer.showSelfie - still no stream - send no stream' );
			self.sendNoStream( sessionType );
			return;
		}
		
		if ( !self.receive ) {
			console.log( 'showSelfie - no receive, meta has not been received yet' );
			return;
		}
		
		let media = getReceiveMedia( stream );
		self.addStream( media );
		
		function getReceiveMedia( source ) {
			let media = new window.MediaStream();
			let ats = source.getAudioTracks();
			let vts = source.getVideoTracks();
			if ( self.receive.audio && ats.length )
				media.addTrack( ats[ 0 ]);
			
			if ( self.receive.video && vts.length )
				media.addTrack( vts[ 0 ]);
			
			return media;
		}
	}
	
	ns.Peer.prototype.addStream  =function( stream ) {
		var self = this;
		var sess = self.session;
		if ( !sess ) {
			console.log( 'Peer.addStream - no session', self.session );
			return;
		}
		
		if ( stream.id === self.currentStreamId ) {
			console.log( 'stream already added, aborting', {
				stream :stream,
				currentId : self.currentStreamId,
			});
			return;
		}
		
		sess.addStream( stream );
		self.currentStreamId = stream.id;
	}
	
	ns.Peer.prototype.addTracks = function( stream, sessionType ) {
		const self = this;
		const session = self.session;
		if ( !session ) {
			console.log( 'peer.addTracks - no session found', self.session );
			return;
		}
		
		var tracks = stream.getTracks();
		tracks.forEach( addToSession );
		function addToSession( track ) {
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
	
	ns.Peer.prototype.setConstraints = function( constraints ) {
		var self = this;
		self.send({
			type : 'constraints',
			data : constraints,
		});
	}
	
	ns.Peer.prototype.handleRemoteConstraints = function( data ) {
		var self = this;
		self.constraints = data;
	}
	
	ns.Peer.prototype.handleNoStream = function() {
		var self = this;
		if ( !self.isHost )
			self.showSelfie();
		
		self.emit( 'nostream' );
	}
	
	ns.Peer.prototype.sendNoStream = function( sessionId ) {
		var self = this;
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
			self.stream = new window.MediaStream();
			self.emit( 'media', self.stream );
		}
		
		//self.bindTrack( track );
		var type = track.kind;
		if ( 'video' === type )
			addVideo( track );
		if ( 'audio' === type )
			addAudio( track );
		
		self.emitStreamState( 'nominal' );
		
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
		const self = this;
		const type = track.kind;
		self.emit( 'track', type, null );
	}
	
	ns.Peer.prototype.updateTracksAvailable = function( tracks ) {
		const self = this;
		console.log( 'updateTracksAvailable', tracks );
		self.sending = tracks;
		if ( !self.sending.video && self.isFocus )
			self.toggleFocus();
			
		self.emit( 'meta', {
			sending : self.sending,
		});
		
		if ( self.permissions.receive.audio )
			self.emit( 'audio', tracks.audio );
		
		if ( self.permissions.receive.video )
			self.emit( 'video', tracks.video );
	}
	
	ns.Peer.prototype.sendMeta = function() {
		var self = this;
		if ( !self.selfie ) {
			console.log( 'sendMeta - no selfie, no send', self );
			return;
		}
		
		let send = self.permissions.send;
		let rec = null;
		if ( null != self.isFocus ) {
			rec = {
				audio : self.permissions.receive.audio,
				video : self.isFocus,
			};
		} else
			rec = self.permissions.receive;
		
		self.state = 'sync-meta';
		var meta = {
			browser   : self.selfie.browser,
			state     : {
				isMuted    : self.selfie.isMute,
				isBlinded  : self.selfie.isBlind,
				screenMode : self.selfie.screenMode,
			},
			sending : send,
			receive : rec,
		};
		self.send({
			type : 'meta',
			data : meta,
		});
	}
	
	ns.Peer.prototype.handleMeta = function( meta ) {
		var self = this;
		if ( !self.isHost )
			self.sendMeta();
		
		if ( 'sync-meta' !== self.state ) {
			try {
				throw new Error( 'handleMeta - not in sync-meta state, is in: ' + self.state );
			} catch( e ) {
				console.log( 'handleMeta - invalid state', e );
				return;
			}
		}
		
		self.updateMeta( meta );
		var signalState = {
			type : 'signal',
			data : {
				type : 'nominal',
			},
		};
		self.emit( 'state', signalState );
		self.state = '';
		self.initializeSessions();
	}
	
	ns.Peer.prototype.updateMeta = function( meta ) {
		var self = this;
		if ( meta.state )
			updateState( meta.state );
		
		self.receive = meta.receive || {
			audio : true,
			video : false,
		};
		
		self.sending = meta.sending || {
			audio : true,
			video : true,
		};
		
		// if one peer is chrome and another is firefox, chrome will always be 'it'
		self.browser = meta.browser;
		self.updateDoInit( meta.browser );
		self.emit( 'meta', meta );
		if ( !self.permissions.receive.audio || !self.sending.audio )
			self.emit( 'audio', false );
		
		if ( !self.permissions.receive.video || !self.sending.video || ( false === self.isFocus ))
			self.emit( 'video', false );
		
		function updateState( state ) {
			if ( null != state.isMuted )
				self.setRemoteMute( state.isMuted );
			
			if ( null != state.isBlinded )
				self.setRemoteBlind( state.isBlinded );
			
			if ( null != state.screenMode )
				self.setScreenMode( state.screenMode );
		}
	}
	
	ns.Peer.prototype.updateDoInit = function( browser ) {
		const self = this;
		if ( 'firefox' === browser )
			self.isHost = false;
		
		if ( 'safari' === browser )
			self.isHost = false;
	}
	
	ns.Peer.prototype.initializeSessions = function() {
		var self = this;
		self.createSession();
		//self.showSelfie();
	}
	
	ns.Peer.prototype.bindStream = function( stream ) {
		var self = this;
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
			self.releaseTrack( track );
		}
	}
	
	ns.Peer.prototype.releaseTrack = function( track ) {
		var self = this;
		if ( !track )
			return;
		
		track.onmute = null;
		track.onunmute = null;
		track.onended = null;
		if ( track.stop ) {
			try {
				track.stop();
			} catch ( e ) {}
		}
	}
	
	ns.Peer.prototype.handleSessionStateChange = function( event ) {
		var self = this;
		if ( 'error' === event.type )
			self.handleSessionError( event );
		
		if ( 'nominal' === event.type ) {
			if ( !self.alpha && !self.isHost )
				self.sendConnectData();
		}
		
		var rtcState = {
			type : 'rtc',
			data : event,
		};
		
		self.emit( 'state', rtcState );
	}
	
	ns.Peer.prototype.handleSessionError = function( event ) {
		var self = this;
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
	
	ns.Peer.prototype.toggleFocus = function() {
		const self = this;
		self.isFocus = !self.isFocus;
		self.emit( 'set-focus', self.isFocus );
	}
	
	ns.Peer.prototype.getAudioTrack = function() {
		var self = this;
		//var streams = self.session.conn.getRemoteStreams()[ 0 ];
		if ( !self.stream ) {
			console.log( 'getAudioTrack', self.stream );
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
			console.log( 'getVideoTrack', self.stream );
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
			let atState = at ? at.readyState : 'unknown';
			let vtState = vt ? vt.readyState : 'unknown';
			
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
		
		delete self.signal;
		
		self.closeAllSessions();
	}
	
})( library.rtc );

/*

	These are used based on local browser, NOT remote( peer ).

*/

(function( ns, undefined ) {
	ns.PeerSafari = function( conf ) {
		const self = this;
		library.rtc.Peer.call( self, conf );
	}
	
	ns.PeerSafari.prototype = Object.create( library.rtc.Peer.prototype );
	
	ns.PeerSafari.prototype.updateDoInit = function( browser ) {
		const self = this;
		if ( 'chrome' === browser )
			self.isHost = true;
		
		if ( 'firefox' === browser )
			self.isHost = false;
	}
	
})( library.rtc );

(function( ns, undefined ) {
	ns.PeerFirefox = function( conf ) {
		const self = this;
		library.rtc.Peer.call( self, conf );
	}
	
	ns.PeerFirefox.prototype = Object.create( library.rtc.Peer.prototype );
	
	ns.PeerFirefox.prototype.updateDoInit = function( browser ) {
		const self = this;
		if ( 'chrome' === browser )
			self.isHost = true;
		
		if ( 'safari' === browser )
			self.isHost = true;
	}
	
})( library.rtc );


