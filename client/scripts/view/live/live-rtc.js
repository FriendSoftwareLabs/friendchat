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
	ns.RTC = function( conn, UI, conf, onclose, onready ) {
		const self = this;
		console.log( 'RTC conf', conf.rtcConf );
		self.conn = conn || null;
		self.ui = UI;
		self.userId = conf.userId;
		self.rtcConf = conf.rtcConf;
		self.isGuest = conf.isGuest;
		self.isPrivate = conf.isPrivate;
		self.isTempRoom = conf.isTempRoom;
		self.isPersistent = conf.isPersistent;
		self.peerList = conf.peerList;
		self.identities = conf.identities || {};
		self.guestAvatar = conf.guestAvatar;
		self.mode = conf.rtcConf.mode || null;
		self.topology = conf.rtcConf.topology || 'peer';
		self.isRecording = conf.rtcConf.isRecording || false;
		self.quality = conf.rtcConf.quality || null;
		self.permissions = conf.rtcConf.permissions;
		self.localSettings = conf.localSettings || {};
		self.onclose = onclose;
		self.onready = onready;
		
		console.log( 'RTC - localsettings', self.localSettings );
		
		self.peers = {};
		self.peerIds = [];
		self.selfie = null;
		self.joined = false;
		
		self.init();
	}
	
	// Public
	
	ns.RTC.prototype.restore = function( init ) {
		const self = this;
		self.identities = init.identities;
		const conf = init.liveConf;
		self.handleQuality( conf.quality );
		self.handleMode( conf.mode );
		self.syncPeers( conf.peerList );
	}
	
	// Private
	
	ns.RTC.prototype.init = function() {
		const self = this;
		if ( 'DESKTOP' != window.View.deviceType )
			self.isMobile = true;
		
		if ( 'star' === self.topology )
			self.setupProxy();
		
		self.convertLegacyDevices();
		self.updateMobileRestrictions();
		self.bindUI();
		self.bindMenu();
		
		if ( self.quality )
			self.ui.updateQualityLevel( self.quality.level );
		
		// ui
		self.ui.addChat( self.userId, self.identities, self.conn );
		self.statusMsg = self.ui.initStatusMessage();
		
		if ( self.isRecording )
			self.ui.setRecording( self.isRecording );
		
		// do init checks
		self.initChecks = new library.rtc.InitChecks( self.statusMsg );
		self.initChecks.on( 'source-select', showSourceSelect );
		self.initChecks.on( 'done', currentChecksDone );
		
		//self.initChecks.checkICE( self.rtcConf.ICE );
		const appConf = window.View.config.appConf || {};
		self.initChecks.checkBrowser( appConf.userAgent, browserBack );
		function browserBack( err, browser ) {
			if ( err ) {
				self.goLive( false );
				return;
			}
			
			self.browser = browser;
			self.ui.setBrowser( self.browser );
			self.initChecks.checkDeviceAccess( self.permissions.send )
				.then( devicesBack )
				.catch( devFail );
			
			function devFail( err ) {
				console.log( 'devFail', err );
				self.close();
			}
		}
		
		function devicesBack( permissions, devices ) {
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
			
			done();
			
			function passSelfieChecks() {
				self.initChecks.passCheck( 'source-check' );
			}
			
			function runSelfieChecks( gumErr, media ) {
				const ready = self.initChecks.checkSourceReady( !!media, gumErr );
				if ( !ready )
					return;
				
				self.initChecks.checkICE( self.rtcConf.ICE );
				self.allChecksRun = true;
			}
		}
		
		function currentChecksDone( forceClose ) {
			if ( forceClose  ) {
				self.close();
				return;
			}
			
			if ( !self.allChecksRun )
				return;
			
			closeInit();
		}
		
		function showSourceSelect() {
			if ( !self.selfie )
				return;
			
			self.showSourceSelect();
		}
		
		function closeInit() {
			self.initChecks.close();
			delete self.initChecks;
			self.ui.removeCover();
		}
		
		function done() {
			if ( self.isAdmin )
				self.setupAdmin();
			
			//self.showTestStatus();
			
			self.goLive( true );
		}
	}
	
	ns.RTC.prototype.showSourceSelect = function() {
		const self = this;
		console.log( 'showSourceSelect' );
		self.selfie.showSourceSelect();
	}
	
	ns.RTC.prototype.showTestStatus = function() {
		const self = this;
		const succ = {
			type    : 'success',
			title   : '',
			message : 'SUCC_ITS_FINE',
			events  : [ 'ok', 'close' ],
		};
		const info = {
			type    : 'info',
			title   : '',
			message : 'INFO_GUM_BLOCKED',
			events  : [ 'continue', 'accept' ],
		};
		const warning = {
			type    : 'warning',
			title   : '',
			message : 'WARN_AUDIO_SINK_NOT_ALLOWED',
			events  : [ 'close-live' ],
		};
		const error = {
			type    : 'error',
			title   : '',
			message : 'ERR_GUM_ERROR',
			events  : [ 'close' ],
		};
		const eid = self.statusMsg.showStatus( error );
		const wid = self.statusMsg.showStatus( warning );
		const iid = self.statusMsg.showStatus( info );
		const sid = self.statusMsg.showStatus( succ );
		self.statusMsg.once( eid, e => self.statusMsg.removeStatus( eid ));
		self.statusMsg.once( wid, e => self.statusMsg.removeStatus( wid ));
		self.statusMsg.once( iid, e => self.statusMsg.removeStatus( iid ));
		self.statusMsg.once( sid, e => self.statusMsg.removeStatus( sid ));
		
	}
	
	ns.RTC.prototype.convertLegacyDevices = function() {
		const self = this;
		const pref = self.localSettings.preferedDevices;
		if ( !pref )
			return;
		
		const thePutsBros = Object.keys( pref );
		thePutsBros.forEach( type => {
			if ( 'string' !== typeof( pref[ type ]))
				return;
			
			pref[ type ] = {
				deviceId : pref[ type ],
			};
		});
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
		
		if ( 'star' === self.topology ) {
			const ready = {
				type : 'ready',
				data : 'yep',
			};
			self.proxy.send( ready );
		}
		
		self.connectPeers();
		const onready = self.onready;
		delete self.onready;
		if ( onready )
			onready( null );
	}
	
	ns.RTC.prototype.bindConn = function() {
		var self = this;
		self.conn.on( 'ping'           , ping );
		self.conn.on( 'identity'       , identity );
		self.conn.on( 'identities'     , identities );
		self.conn.on( 'identity-update', e => self.handleIdUpdate( e ));
		self.conn.on( 'settings'       , settings );
		self.conn.on( 'speaking'       , speaking );
		self.conn.on( 'nested-app'     , nestedApp );
		self.conn.on( 'reset-output'   , e => self.resetOutput( e ));
		self.conn.on( 'quality'        , quality );
		self.conn.on( 'mode'           , mode );
		self.conn.on( 'join'           , join );
		self.conn.on( 'leave'          , leave );
		self.conn.on( 'close'          , close );
		
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
	
	ns.RTC.prototype.setupProxy = function() {
		const self = this;
		self.proxy = new library.component.EventNode(
			'proxy',
			self.conn,
			proxySink,
			null,
			true
		);
		
		self.proxy.on( 'room', e => self.handleProxyRoom( e ));
			
		function proxySink( type, data ) {
			console.log( 'RTC proxySink', {
				type : type,
				data : data,
			});
		}
	}
	
	ns.RTC.prototype.handleProxyRoom = function( event ) {
		const self = this;
		console.log( 'handleProxyRoom', self.rtcConf );
		self.selfie.publish( self.rtcConf );
	}
	
	ns.RTC.prototype.connectPeers = function() {
		const self = this;
		self.peerList.forEach( connect );
		
		function connect( peerId ) {
			if ( peerId === self.userId )
				return;
			
			self.createPeer( peerId );
		}
	}
	
	ns.RTC.prototype.bindUI = function() {
		const self = this;
		self.ui.on( 'close', e => self.close());
		self.ui.on( 'device-select', e => self.showSourceSelect());
		self.ui.on( 'use-devices'  , e => self.selfie.useDevices( e ));
		self.ui.on( 'share-screen' , e => self.selfie.toggleShareScreen());
	}
	
	ns.RTC.prototype.bindMenu = function() {
		const self = this;
		self.menu = self.ui.addMenu();
		self.menu.on( 'change-username'  , username );
		self.menu.on( 'restart'          , restart );
		self.menu.on( 'mode-presentation', presentation );
		
		if ( self.isGuest || self.isPrivate ) {
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
		const self = this;
		console.log( 'rtc.handleAppEvent - NYI', event );
		return;
		
		self.broadcast( event );
	}
	
	ns.RTC.prototype.saveSetting = function( setting, value ) {
		const self = this;
		const save = {
			setting : setting,
			value   : value,
		};
		const sett = {
			type : 'setting',
			data : save,
		};
		self.conn.send( sett );
	}
	
	ns.RTC.prototype.saveLocalSetting = function( setting, value ) {
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
	
	ns.RTC.prototype.handleIdUpdate = function( update ) {
		const self = this;
		const type = update.type;
		const id = update.data;
		const pId = id.clientId;
		const conf = {
			userId   : pId,
			identity : id,
		};
		self.handleIdentity( conf );
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
		self.switchPane = self.ui.addUIPane( 'live-stream-switch', conf );
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
		
		self.ui.setSpeaker( speaker );
	}
	
	ns.RTC.prototype.handleQuality = function( quality ) {
		const self = this;
		if ( !self.selfie )
			return;
		
		self.quality = quality;
		self.selfie.setRoomQuality( quality );
		
	}
	
	ns.RTC.prototype.handleMode = function( event ) {
		const self = this;
		if ( !event )
			event = {};
		
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
		self.ui.togglePresentation( null );
		self.modePerms = null;
		self.updatePermissions();
		
		if ( self.mode.data && ( null != self.mode.data.wasMuted ))
			self.selfie.toggleMute( self.mode.data.wasMuted );
		
		self.mode = null;
		self.updatePermissions();
	}
	
	ns.RTC.prototype.setModePresentation = function( conf ) {
		const self = this;
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
			self.ui.togglePresentation( 'selfie' );
		else
			self.ui.togglePresentation( presenterId );
		
		self.modePerms = {};
		if ( isPresenter )
			setPresenterPermissions();
		else
			setReceiverPermissions();
		
		self.updatePermissions();
		
		function setPresenterPermissions() {
			self.modePerms.send = {
				audio : true,
				video : self.permissions.send.video,
			};
			self.modePerms.receive = {
				audio : true,
				video : false,
			};
		}
		
		function setReceiverPermissions() {
			self.modePerms.send = {
				audio : true,
				video : false,
			};
			self.modePerms.receive = {
				audio : true,
				video : true,
			};
		}
	}
	
	ns.RTC.prototype.updateMobileRestrictions = function() {
		const self = this;
		if ( !self.isMobile )
			return;
		
		/*
		if ( 1 < self.peerIds.length )
			restrict();
		else
			restore();
		*/
		
		if ( self.isRestricted )
			return;
		
		self.isRestricted = true;
		restrict();
		
		self.updatePermissions();
		
		function restrict() {
			self.mobilePerms = {
				receive : {
					video : false,
				},
				send : {
					video : false,
				},
			};
		}
		
		function restore() {
			self.mobilePerms = null;
		}
	}
	
	ns.RTC.prototype.updatePermissions = function() {
		const self = this;
		let perms = getStdCopy();
		if ( self.modePerms )
			perms = applyPerms( perms, self.modePerms );
		
		if ( self.mobilePerms )
			perms = applyPerms( perms, self.mobilePerms );
		
		self.permissions.send = perms.send;
		self.permissions.receive = perms.receive;
		self.refreshMeta();
		
		function getStdCopy() {
			if ( !self.stdPerms )
				self.stdPerms = JSON.stringify( self.permissions );
			
			return JSON.parse( self.stdPerms );
		}
		
		function applyPerms( std, mod ) {
			if ( !mod )
				return std;
			
			if ( mod.send ) {
				const s = mod.send;
				if ( null != s.audio )
					std.send.audio = s.audio;
				if ( null != s.video )
					std.send.video = s.video;
			}
			
			if ( mod.receive ) {
				const r = mod.receive;
				if ( null != r.audio )
					std.receive.audio = r.audio;
				if ( null != r.video )
					std.receive.video = r.video;
			}
			
			return std;
		}
	}
	
	ns.RTC.prototype.handlePeerJoin = function( peer ) {
		const self = this;
		const pId = peer.peerId;
		if ( self.userId === pId )
			return;
		
		const id = peer.identity;
		if ( id )
			self.identities[ pId ] = id;
		
		peer.isHost = false;
		self.createPeer( pId );
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
		self.ui.addNestedApp( app );
		self.broadcast({
			type : 'nestedapp',
			data : app,
		});
	}
	
	ns.RTC.prototype.resetOutput = function() {
		const self = this;
		console.log( 'RTC.resetOutput' );
		self.restartPeers();
		//self.ui.restartAudioSinks();
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
		self.changeUsername = self.ui.addUIPane( 'change-username', conf );
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
	
	ns.RTC.prototype.refreshMeta = function() {
		const self = this;
		if ( self.selfie )
			self.selfie.setupStream();
		
		const pIds = Object.keys( self.peers );
		pIds.forEach( pId => {
			const peer = self.peers[ pId ];
			peer.refreshMeta();
		});
	}
	
	ns.RTC.prototype.restartStream = function() {
		const self = this;
		const pids = Object.keys( self.peers );
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
		const self = this;
		console.log( 'setupAdmin - NYI', self );
		return;
		
		self.menu.enable( 'settings' );
		self.menu.on( 'settings', settings );
		self.settings = self.ui.addSettings( onsave );
		
		function settings( s ) {
			if ( self.isAdmin && self.settings )
				self.settings.show();
		}
		
		function onsave( setting, value ) {
			self.saveSetting( setting, value );
		}
	}
	
	ns.RTC.prototype.syncPeers = function( peerIds ) {
		const self = this;
		checkRemoved( peerIds );
		restartCurrent();
		checkJoined( peerIds );
		
		function checkRemoved( serverPids ) {
			const localPids = Object.keys( self.peers );
			const removed = localPids.filter( notInPeers );
			removed.forEach( remove );
			function remove( pid ) {
				self.removePeer( pid );
			}
			
			function notInPeers( pid ) {
				if ( pid === self.userId )
					return false;
				
				var index = serverPids.indexOf( pid );
				return !!( -1 === index );
			}
		}
		
		function restartCurrent() {
			const healthCheck = true;
			self.restartPeers( healthCheck );
		}
		
		function checkJoined( pids ) {
			var joined = pids.filter( notFound );
			joined.forEach( add );
			
			function notFound( pid ) {
				if ( pid === self.userId )
					return false;
				
				return !self.peers[ pid ];
			}
			
			function add( pid ) {
				self.createPeer( pid )
			}
		}
	}
	
	ns.RTC.prototype.reconnectPeers = function() {
		var self = this;
		for( var pid in self.peers ) {
			var peer = self.peers[ pid ];
			peer.checkFailed();
		}
	}
	
	ns.RTC.prototype.restartPeers = function( healthCheck ) {
		const self = this;
		let pids = Object.keys( self.peers );
		pids.forEach( restart );
		function restart( peerId ) {
			if ( peerId === self.userId )
				return;
			
			let peer = self.peers[ peerId ];
			if ( !peer )
				return;
			
			peer.restart( healthCheck );
		}
	}
	
	ns.RTC.prototype.createPeer = function( peerId ) {
		const self = this;
		if ( peerId === self.userId ) {
			return;
		}
		
		let peer = self.peers[ peerId ];
		if ( peer ) {
			console.log( 'createPeer - already exists, soft restart', self.peers );
			const healthCheck = true;
			peer.restart( healthCheck );
			return;
		}
		
		let identity = self.identities[ peerId ];
		if ( !identity ) {
			identity = {
				name   : '---',
				avatar : self.guestAvatar,
			};
		}
		
		if ( !identity.avatar )
			identity.avatar = self.guestAvatar;
		
		let isFocus = undefined;
		if ( self.currentPeerFocus )
			isFocus = false;
		
		let Peer = getPeerConstructor( self.browser );
		let signal = self.conn;
		if ( 'star' === self.topology ) {
			signal = self.proxy;
			Peer = library.rtc.Sink;
		}
		
		peer = new Peer({
			id          : peerId,
			identity    : identity,
			permissions : self.permissions,
			isFocus     : isFocus,
			signal      : signal,
			rtcConf     : self.rtcConf,
			selfie      : self.selfie,
			topology    : self.topology,
			onremove    : signalRemovePeer,
			closeCmd    : closeCmd,
		});
		
		peer.on( 'nestedapp' , nestedApp );
		peer.on( 'set-focus', setFocus );
		
		function nestedApp( e ) { self.ui.addNestedApp( e ); }
		function setFocus( e ) { self.setPeerFocus( e, peerId ); }
		
		self.peers[ peerId ] = peer;
		self.peerIds.push( peerId );
		self.ui.addPeer( peer );
		
		self.updateMobileRestrictions();
		
		function signalRemovePeer() { self.signalRemovePeer( peerId ); }
		function closeCmd() { self.closePeer( peerId ); }
		
		function getPeerConstructor( browser ) {
			if ( 'safari' === browser )
				return library.rtc.PeerSafari;
			
			if ( 'firefox' === browser )
				return library.rtc.PeerFirefox;
			
			if ( 'brave' === browser )
				return library.rtc.PeerBrave;
			
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
		const self = this;
		const peer = self.peers[ peerId ];
		if ( !peer ) {
			console.log( 'RTC.closePeer - no peer for id', peerId );
			return;
		}
		
		self.ui.removePeer( peerId );
		delete self.peers[ peerId ];
		self.peerIds = Object.keys( self.peers );
		
		peer.close();
		if ( self.currentPeerFocus === peerId )
			self.setPeerFocus( false );
		
		self.updateMobileRestrictions();
	}
	
	ns.RTC.prototype.createSelfie = function( createBack ) {
		const self = this;
		let identity = self.identities[ self.userId ];
		if ( !identity ) {
			identity = {
				name   : '---',
				avatar : self.guestAvatar,
			};
		}
		
		if ( !identity.avatar )
			identity.avatar = self.guestAvatar;
		
		let Thing = library.rtc.Selfie;
		if ( 'star' === self.topology )
			Thing = library.rtc.Source;
		
		const selfieConf = {
			id            : 'selfie',
			conn          : self.conn,
			view          : self.ui,
			menu          : self.menu,
			identity      : identity,
			browser       : self.browser,
			permissions   : self.permissions,
			quality       : self.quality,
			localSettings : self.localSettings,
			isAdmin       : self.isAdmin,
			topology      : self.topology,
			proxyConn     : self.proxy || null,
		};
		
		self.selfie = new Thing( selfieConf, done );
		
		
		function done( err, res ) {
			createBack( err, res );
		}
		
		self.ui.addPeer( self.selfie );
		self.selfie.on( 'leave'           , onLeave );
		self.selfie.on( 'error'           , error );
		self.selfie.on( 'audio-sink'      , audioSink );
		self.selfie.on( 'mute'            , broadcastMute );
		self.selfie.on( 'blind'           , broadcastBlind );
		self.selfie.on( 'screen-mode'     , broadcastScreenMode );
		self.selfie.on( 'screen-share'    , broadcastScreenShare );
		self.selfie.on( 'system-mute'     , systemMute );
		//self.selfie.on( 'tracks-available', broadcastTracksAvailable );
		self.selfie.on( 'reflow'          , handleReflow );
		self.selfie.on( 'quality'         , setQuality );
		self.selfie.on( 'restart'         , restart );
		self.selfie.on( 'save'            , e => self.saveLocalSetting( e.setting, e.value ));
		self.selfie.on( 'device-select'   , e => self.ui.showDeviceSelect( e ));
		
		function onLeave() { self.leave(); }
		function error( e ) { self.handleSelfieError( e ); }
		function audioSink( e ) { self.handleAudioSink( e ); }
		function broadcastMute( isMuted ) { broadcast( 'mute', isMuted ); }
		function broadcastBlind( isBlinded ) { broadcast( 'blind', isBlinded ); }
		function broadcastScreenMode( mode ) { broadcast( 'screen-mode', mode ); }
		function broadcastScreenShare( isSharing ) {
			broadcast( 'screen-share', isSharing );
		}
		
		function systemMute( isMute ) {
			self.handleSystemMute( isMute );
		}
		
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
			self.ui.reflowPeers();
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
	
	ns.RTC.prototype.handleSystemMute = function( isMute ) {
		const self = this;
		if ( self.ignoreSystemMute ) {
			
			return;
		}
		
		const statusId = 'audio-input-check';
		let conf = null;
		if ( isMute ) {
			conf = {
				type    : 'warning',
				message : 'WARN_NO_AUDIO',
			};
		}
		
		if ( self.hasAudioStatus && !isMute ) {
			self.statusMsg.removeStatus( statusId );
			self.hasAudioStatus = false;
			/*
			conf = {
				type    : 'success',
				message : 'SUCC_ITS_FINE',
			};
			*/
		}
		
		if ( !conf )
			return;
		
		self.statusMsg.updateAudioInput( conf );
		if ( !self.hasAudioStatus )
			self.statusMsg.once( statusId, uiBack );
		
		self.hasAudioStatus = true;
		
		function uiBack( event ) {
			if ( 'close-live' === event ) {
				self.close();
				return;
			}
			
			if ( 'source-select' === event )
				self.showSourceSelect();
			
			if ( 'ignore' === event ) {
				self.ignoreSystemMute = true;
				self.selfie.setIgnoreSystemMute( true );
				self.saveLocalSetting( 'ignore-system-mute', true );
			}
			
			self.statusMsg.removeStatus( statusId );
			self.hasAudioStatus = false;
		}
	}
	
	ns.RTC.prototype.handleAudioSink = function( deviceId ) {
		const self = this;
		self.ui.setAudioSink( deviceId );
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
		const self = this;
		self.close();
	}
	
	ns.RTC.prototype.close = function() {
		const self = this;
		const peerIds = Object.keys( self.peers );
		peerIds.forEach( pId =>{
			self.closePeer( pId );
		});
		
		delete self.conf;
		delete self.conn;
		delete self.ui;
		delete self.menu;
		
		const onclose = self.onclose;
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
		
		self.id = conf.id;
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
		self.topology = conf.topology;
		self.proxyConn = conf.proxyConn;
		self.rtcConf = conf.rtcConf;
		
		self.media = null;
		self.stream = null;
		self.doneBack = callback;
		
		self.currentDevices = {};
		self.isBlind = false;
		self.isMute = false;
		self.userMute = false;
		self.systemMute = false;
		
		self.isChrome = null;
		self.isFirefox = null;
		
		self.init();
	}
	
	ns.Selfie.prototype = Object.create( library.component.EventEmitter.prototype );
	
	// Public
	
	ns.Selfie.prototype.useDevices = function( selected ) {
		const self = this;
		console.log( 'userDevices', selected );
		self.setMediaSources( selected );
	}
	
	ns.Selfie.prototype.updateIdentity = function( identity ) {
		const self = this;
		self.emit( 'identity', identity );
	}
	
	ns.Selfie.prototype.publish = function( rtcConf ) {
		const self = this;
		console.log( 'publsih', rtcConf );
		self.createSource( rtcConf );
		
	}
	
	
	// receive defaults to same as send
	ns.Selfie.prototype.toggleVideo = function( send, receive ) {
		const self = this;
		if ( null == receive )
			receive = send;
		
		const pSend = self.permissions.send;
		const pRec = self.permissions.receive;
		
		if ( null == send )
			pSend.video = !pSend.video;
		else
			pSend.video = send;
		
		if ( null == receive )
			pRec.video = !pRec.video;
		else
			pRec.video = receive;
		
		self.menu.setState( 'send-video', pSend.video );
		self.menu.setState( 'receive-video', pRec.video );
		self.emitVoiceOnly();
		self.setupStream( streamUp )
		function streamUp( err, media ) {
			//self.emit( 'restart' );
		}
	}
	
	ns.Selfie.prototype.setIgnoreSystemMute = function( ignore ) {
		const self = this;
		self.ignoreSystemMute = ignore;
		self.handleSystemMute( false );
		if ( null != self.sysMuteTimeout )
			window.clearTimeout( self.sysMuteTimeout );
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
		
		delete self.currentAudioOut;
		delete self.localSettings;
		delete self.speaking;
		delete self.volume;
		delete self.stream;
		delete self.shareMedia;
		delete self.media;
		delete self.view;
		delete self.extConn;
		delete self.menu;
		delete self.doneBack;
		delete self.conn;
	}
	
	// Private
	
	ns.Selfie.prototype.init =function() {
		const self = this;
		const ignoreSysMute = self.localSettings[ 'ignore-system-mute' ];
		if ( ignoreSysMute )
			self.ignoreSystemMute = ignoreSysMute;
		
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
		console.log( 'Selfie.topology', self.topology );
		if ( 'star' == self.topology )
			self.setupProxy();
		
		//
		self.extConn = self.view.addExtConnPane( onExtConnShare );
		function onExtConnShare( e ) {
			self.extConn.close();
			self.toggleShareScreen();
		}
		
		self.screenShare = new library.rtc.ScreenShare();
		self.screenShare.checkIsAvailable()
			.then( shareCheckBack )
			.catch( shareCheckErr );
		
		function shareCheckBack( isAvailable ) {
			self.screenShareAvailable = !!isAvailable;
		}
		
		function shareCheckErr( err ) {
			console.log( 'shareScreenErr', err );
			self.screenShareAvailable = false;
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
			const doneBack = self.doneBack;
			delete self.doneBack;
			if ( doneBack )
				doneBack( null, res );
		}
	}
	
	ns.Selfie.prototype.setupProxy = function() {
		const self = this;
		console.log( 'Selfie - star topoloig detected!!!!11', {
			pConn : self.proxyConn,
		});
		self.proxy = new library.component.EventNode(
			'source',
			self.proxyConn,
			proxySink,
			null,
			true
		);
		
		function proxySink( type, event ) {
			console.log( 'proxySink', {
				type  : type,
				event : event,
			});
		}
	}
	
	ns.Selfie.prototype.createSource = function( rtcConf ) {
		const self = this;
		console.log( 'createSource', {
			rtcConf : self.rtcConf,
			rtcConfpassed : rtcConf,
		});
		if ( rtcConf )
			self.rtcConf = rtcConf;
		
		if ( self.session ) {
			console.log( 'createSession', {
				state   : self.state,
				session : self.session,
			});
			return;
		}
		
		//if ( !self.media )
		self.proxyMedia = new window.MediaStream();
		
		const type = 'source';
		const isHost = true;
		const opts = {
			//useDefaultCodec : self.useDefaultCodec,
		};
		
		self.session = new library.rtc.Session(
			type,
			isHost,
			self.proxy,
			self.proxyMedia,
			self.rtcConf,
			opts,
			'source'
		);
		
		self.on( 'selfie', e => self.updatePublishedMedia());
		
		/*
		self.session = new library.rtc.Session({
			type      : type,
			isHost    : self.isHost,
			rtc       : self.rtcConf,
			signal    : self.signal,
			//modifySDP : modSDP,
		});
		*/
		
		self.session.on( 'stats', e => console.log( 'session stats', e ));
		self.session.on( 'state', e => console.log( 'session state', e ));
		self.session.on( 'error', e => console.log( 'session error', e ));
		
		self.updatePublishedMedia();
		/*
		self.session.on( 'track-add'   , e => self.trackAdded( e ));
		self.session.on( 'track-remove', e => self.trackRemoved( e ));
		self.session.on( 'nostream'    , sendNoStream );
		self.session.on( 'datachannel' , dataChannel );
		
		function sendNoStream( e ) { self.sendNoStream( type ); }
		function stateChange( e ) { self.handleSessionStateChange( e, type ); }
		function statsUpdate( e ) { self.handleStatsUpdate( e, type ); }
		function sessionError( e ) { self.handleSessionError( e, type ); }
		function dataChannel( e ) { self.bindDataChannel( e ); }
		*/
	}
	
	ns.Selfie.prototype.updatePublishedMedia = function() {
		const self = this;
		console.log( 'updatePublishedMedia', {
			session     : self.session,
			stream      : self.stream,
			permissions : self.permissions,
		});
		
		const perms = {
			type : 'permissions',
			data : self.permissions,
		};
		self.proxy.send( perms );
		
		if ( !self.session )
			return;
		
		if ( !self.stream )
			return;
		
		const pTracks = {};
		self.proxyMedia.getTracks().forEach( t => {
			const kind = t.kind;
			pTracks[ kind ] = t;
		});
		
		const sTracks = {};
		self.stream.getTracks().forEach( t => {
			const kind = t.kind;
			sTracks[ kind ] = t;
		});
		console.log( 'updatePublishedMedia', {
			session : self.session,
			stream  : self.stream,
			pmedia  : self.proxyMedia,
			audio   : self.hasAudio,
			video   : self.hasVideo,
			pTracks : pTracks,
			sTracks : sTracks,
		});
		
		if ( !self.hasAudio )
			remove( 'audio' );
		else
			update( 'audio' );
		
		if ( !self.hasVideo )
			remove( 'video' );
		else
			update( 'video' );
		
		function remove( kind ) {
			const pT = pTracks[ kind ];
			if ( !pT )
				return;
			
			self.proxyMedia.removeTrack( pT );
			self.session.removeTrack( kind );
		}
		
		function update( kind ) {
			const pT = pTracks[ kind ];
			const sT = sTracks[ kind ];
			if ( pT )
				self.proxyMedia.removeTrack( pT );
			
			self.proxyMedia.addTrack( sT );
			self.session.addTrack( kind );
		}
	}
	
	ns.Selfie.prototype.handleMedia = function( media ) {
		const self = this;
		self.setStream( media );
		if ( !media )
			return;
		
		let callback = self.streamBack;
		delete self.streamBack;
		if ( callback ) {
			callback( null, media );
		}
		
		if ( self.isScreenSharing ) {
			//self.menu.setState( 'toggle-screen-share', true );
			//self.toggleScreenMode( 'contain' );
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
		self.menu.on( 'q-high'              , qualityHigh );
		self.menu.on( 'q-normal'            , qualityNormal );
		self.menu.on( 'q-medium'            , qualityMedium );
		self.menu.on( 'q-low'               , qualityLow );
		self.menu.on( 'send-audio'          , sendAudio );
		self.menu.on( 'send-video'          , sendVideo );
		self.menu.on( 'receive-audio'       , receiveAudio );
		self.menu.on( 'receive-video'       , receiveVideo );
		self.menu.on( 'screen-mode'         , screenMode );
		self.menu.on( 'toggle-screen-share' , screenShare );
		self.menu.on( 'source-select'       , sourceSelect );
		
		function mute( e ) { self.toggleMute(); }
		function blind( e ) { self.toggleBlind(); }
		function leave( e ) { self.leave(); }
		function qualityHigh( e ) { self.handleQuality( 'high' )}
		function qualityNormal( e ) { self.handleQuality( 'normal' ); }
		function qualityMedium( e ) { self.handleQuality( 'medium' ); }
		function qualityLow( e ) { self.handleQuality( 'low' ); }
		function sendAudio( e ) { self.toggleSendAudio( e ); }
		function sendVideo( e ) { self.toggleSendVideo( e ); }
		function receiveAudio( e ) { self.toggleReceiveAudio( e ); }
		function receiveVideo( e ) { self.toggleReceiveVideo( e ); }
		function screenMode( e ) { self.toggleScreenMode(); }
		function screenShare( e ) { self.toggleShareScreen(); }
		function sourceSelect( e ) { self.showSourceSelect(); }
	}
	
	ns.Selfie.prototype.showError = function( errMsg ) {
		const self = this;
		self.emit( 'error', errMsg );
	}
	
	ns.Selfie.prototype.showSourceSelect = function() {
		const self = this;
		console.log( 'showSourceSelect' );
		const devices = self.media.getCurrentDevices() || null;
		devices.audiooutput = self.currentAudioOut;
		self.emit( 'device-select', devices );
	}
	
	ns.Selfie.prototype.openScreenExtInstall = function() {
		const self = this;
		window.open( 'https://chrome.google.com/webstore/detail/friend-screen-share/\
			ipakdgondpoahmhclacfgekboimhgpap' );
		
		self.extConn.show();
		self.screenShare.connect()
			.then( connected )
			.catch( connectErr );
		
		function connected( err, res ) {
			self.screenShareAvailable = true;
			self.extConn.setConnected( true );
		}
		
		function connectErr( err ) {
			console.log( 'openScreenExtInstall - connectErr', err );
			self.close();
			self.screenShareAvailable = false;
		}
	}
	
	ns.Selfie.prototype.toggleShareScreen = function() {
		const self = this;
		if ( !self.screenShareAvailable ) {
			self.openScreenExtInstall();
			return;
		}
		
		if ( self.chromeSourceId )
			unshare();
		else
			share();
		
		function unshare() {
			self.chromeSourceId = null;
			self.chromeSourceOpts = null;
			//self.menu.setState( 'toggle-screen-share', false );
			self.isScreenSharing = false;
			//self.toggleScreenMode( 'cover' );
			self.media.unshareScreen();
			self.setupStream();
			self.emit( 'screen-share', false );
		}
		
		function share() {
			self.screenShare.getSourceId()
				.then( sourceBack )
				.catch( sourceErr );
			
			function sourceBack( res ) {
				if ( !res || !res.sid )
					return;
				
				self.chromeSourceId = res.sid;
				self.chromeSourceOpts = res.opts;
				//self.menu.setState( 'toggle-screen-share', true );
				self.isScreenSharing = true;
				//self.toggleScreenMode( 'contain' );
				self.media.shareScreen( res.sid );
				self.emit( 'screen-share', true );
			}
			
			function sourceErr( err ) {
				console.log( 'Selfie.toggleShareScreen - getSourceId err', err );
			}
		}
	}
	
	ns.Selfie.prototype.setMediaSources = function( devices ) {
		const self = this;
		console.log( 'setMediaSources', devices );
		if ( !devices )
			return;
		
		let send = self.permissions.send;
		if ( null != devices.audioinput )
			send.audio = !!devices.audioinput;
		
		if ( null != devices.videoinput )
			send.video = !!devices.videoinput;
		
		if ( self.menu ) {
			self.menu.setState( 'send-audio', send.audio );
			self.menu.setState( 'send-video', send.video );
		}
		
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
		if ( !selected || !selected.audiooutput )
			return;
		
		self.sources.getByType()
			.then( devBack )
			.catch( fail );
		
		function devBack( devices ) {
			let deviceId = selected.audiooutput.deviceId;
			let out = devices.audiooutput[ deviceId ];
			if ( !out )
				return;
			
			self.currentAudioOut = out;
			self.emit( 'audio-sink', out.deviceId );
		}
		
		function fail( err ) {
			console.log( 'setAudioSink - enumerating devices failed', err );
		}
	}
	
	ns.Selfie.prototype.savePreferedDevices = function( devices ) {
		const self = this;
		console.log( 'savePreferedDevices', devices );
		self.saveLocalSetting( 'preferedDevices', devices );
	}
	
	ns.Selfie.prototype.saveLocalSetting = function( setting, value ) {
		const self = this;
		const sett = {
			setting : setting,
			value   : value,
		};
		self.emit( 'save', sett );
	}
	
	ns.Selfie.prototype.handleQuality = function( level ) {
		var self = this;
		self.changeStreamQuality( level );
	}
	
	ns.Selfie.prototype.changeStreamQuality = function( level ) {
		var self = this;
		if ( !level )
			level = 'normal';
		
		self.emit( 'quality', level );
	}
	
	ns.Selfie.prototype.setRoomQuality = function( quality ) {
		const self = this;
		try {
			self.media.setQuality( quality )
				.then( qOk )
				.catch( qErr );
		} catch( ex ) {
			console.log( 'setRoomQuality - ex', ex );
		}
		
		function qOk( quality ) {
			if ( !quality )
				return;
			
			self.currentQuality = quality;
			self.emit( 'room-quality', self.currentQuality.level ); // updating ui
		}
		
		function qErr( quality ) {
			console.log( 'setRoomQuality qErr', quality );
			if ( !quality )
				return;
			
			self.currentQuality = quality;
			self.setupStream();
			self.emit( 'room-quality', self.currentQuality.level );
		}
	}
	
	ns.Selfie.prototype.getOpusConf = function() {
		const self = this;
		self.media.getOpusConf();
	}
	
	ns.Selfie.prototype.setupStream = function( callback, permissions, preferedDevices ) {
		const self = this;
		console.log( 'setupStream - preferedDevices', preferedDevices );
		if ( self.streamBack ) {
			let oldBack = self.streamBack;
			delete self.streamBack;
			oldBack( 'CANCELED', null );
		}
		
		self.streamBack = callback;
		if ( self.isScreenSharing )
			self.media.shareScreen( self.chromeSourceId );
		else
			self.media.create( permissions, preferedDevices );
	}
	
	ns.Selfie.prototype.setStream = function( stream ) {
		const self = this;
		console.log( 'setStream', {
			stream      : stream,
			permissions : self.permissions,
		});
		self.stream = stream;
		
		if ( self.userMute ) {
			self.toggleMute( true );
		}
		
		if ( self.isBlind ) {
			self.toggleBlind( true );
		}
		
		const aTrack = self.getAudioTrack();
		const vTrack = self.getVideoTrack();
		self.hasAudio = !!aTrack;
		self.hasVideo = !!vTrack;
		
		if ( aTrack )
			self.bindVolume( self.stream );
		else
			self.releaseVolume();
		
		const tracks = {
			audio : self.hasAudio,
			video : self.hasVideo,
		};
		
		self.emit( 'tracks-available', tracks );
		self.emit( 'selfie', stream );
		
		// TODO refactor these to use tracks-available?
		self.emit( 'audio', self.hasAudio );
		self.emit( 'video', self.hasVideo );
		
		self.emitVoiceOnly( tracks );
	}
	
	ns.Selfie.prototype.getStream = function() {
		const self = this;
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
		
		self.hadInput = false;
		if ( null != self.sysMuteTimeout ) {
			window.clearTimeout( self.sysMuteTimeout );
			delete self.sysMuteTimeout;
		}
		
		self.volume = new library.rtc.Volume( stream );
		self.onVId = self.volume.on( 'volume', onVolume );
		//self.onBId = self.volume.on( 'buffer', onBuffer );
		self.speaking.setSource( self.volume );
		self.emit( 'volume-source', self.volume );
		
		function onVolume( volume ) {
			const hasVolume = ( 0 !== volume );
			
			if ( hasVolume && self.sysMuteTimeout ) {
				window.clearTimeout( self.sysMuteTimeout );
				self.sysMuteTimeout = null;
			}
			
			if ( hasVolume ) {
				self.hadInput = true;
				unsetSysMute();
				/*
				if ( self.systemMute && !self.sysUnmuteTimeout )
					self.sysUnmuteTimeout = window.setTimeout( unsetSysMute, 1000 );
				*/
			}
			
			if ( self.ignoreSystemMute )
				return;
			
			if ( 0 === volume && !self.userMute ) {
				if ( !self.systemMute && !self.sysMuteTimeout  ) {
					const timeout = self.hadInput ? 5000 : 1000;
					self.sysMuteTimeout = window.setTimeout( setSysMute, timeout );
				}
			}
			
			/*
			if ( 0 === volume && self.sysUnmuteTimeout ) {
				window.clearTimeout( self.sysUnmuteTimeout );
				self.sysUnmuteTimeout = null;
			}
			*/
			
			function setSysMute() {
				self.handleSystemMute( true );
				self.sysMuteTimeout = null;
			}
			
			function unsetSysMute() {
				self.handleSystemMute( false );
				self.sysUnmuteTimeout = null;
			}
		}
		
		function onBuffer( v ) {
			//console.log( 'Selfie.onBuffer', v );
		}
	}
	
	ns.Selfie.prototype.releaseVolume = function() {
		const self = this;
		if ( !self.volume )
			return;
		
		self.volume.release();
		self.volume.close();
		delete self.volume;
	}
	
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
		self.emit( 'screen-mode', self.screenMode );
	}
	
	ns.Selfie.prototype.toggleMute = function( force ) {
		const self = this;
		const audio = self.getAudioTrack();
		if ( !audio )
			return;
		
		if ( force === !audio.enabled )
			return;
		
		if ( typeof( force ) !== 'undefined' )
			audio.enabled = !force;
		else
			audio.enabled = !audio.enabled;
		
		self.userMute = !audio.enabled;
		const muted = ( self.userMute || self.systemMute );
		if ( muted === self.isMute )
			return;
		
		self.isMute = muted;
		self.emit( 'mute', self.isMute );
		return self.isMute;
	}
	
	ns.Selfie.prototype.handleSystemMute = function( isSysMute ) {
		const self = this;
		if ( isSysMute === self.systemMute )
			return;
		
		self.systemMute = isSysMute;
		self.emit( 'system-mute', isSysMute );
		const muted = ( self.userMute || self.systemMute );
		if ( muted === self.isMute )
			return;
		
		self.isMute = muted;
		self.emit( 'mute', self.isMute );
	}
	
	ns.Selfie.prototype.toggleBlind = function( force ) {
		const self = this;
		const video = self.getVideoTrack();
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
		const self = this;
		self.emit( 'leave', true );
	}
	
})( library.rtc );

// SOURCE, extends selfie
( function( ns, undefined ) {
	ns.Source = function( conf, callback ) {
		const self = this;
		library.rtc.Selfie.call( self, conf, callback );
		
		console.log( 'Source', self );
	}
	
	ns.Source.prototype = Object.create( library.rtc.Selfie.prototype );
	
})( library.rtc );

// PEER
(function( ns, undefined ) {
	ns.Peer = function( conf ) {
		const self = this;
		library.component.EventEmitter.call( self );
		
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
		self.remoteMedia = null;
		self.receiving = {
			video : false,
			audio : false,
		};
		
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
		
		self.spam = true;
		
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
			self.log( 'peer.unfocus' );
		}
		
		function setFocus( isFocus ) {
			self.log( 'peer.setFocus', isFocus );
		}
	}
	
	ns.Peer.prototype.checkFailed = function() {
		const self = this;
		if ( hasFailed( self.session ))
			self.restart();
		
		function hasFailed( session ) {
			var rtcState = session.conn.iceConnectionState;
			self.log( 'hasFailed', { sid : sid , state : rtcState });
			if ( 'failed' === rtcState )
				return true;
			return false;
		}
	}
	
	// healthcheck is optional and will abort restart if things look ok
	ns.Peer.prototype.restart = function( checkHealth ) {
		const self = this;
		self.log( 'Peer.restart', checkHealth );
		if ( checkHealth ) {
			let healthy = self.checkIsHealthy();
			self.log( 'healthy', healthy );
			if ( healthy )
				return;
		}
		
		sendRestart();
		self.state = '';
		self.doRestart();
		
		function sendRestart() {
			self.log( 'sendRestart' );
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
	
	ns.Peer.prototype.getName = function() {
		const self = this;
		return self.identity.name;
	}
	
	ns.Peer.prototype.getAvatar = function() {
		const self = this;
		return self.identity.avatar;
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
			self.log( 'Peer.eventsink', {
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
		self.isHost = null;
		self.syncStamp = now;
		const sync = {
			type : 'sync',
			data : now,
		};
		
		self.log( 'startSync', self.syncStamp );
		self.signal.send( sync );
		self.syncInterval = setInterval( sendSync, 2000 );
		function sendSync() {
			if ( !self.syncInterval )
				return;
			
			self.log( 'sendSync', now );
			self.signal.send( sync );
		}
	}
	
	ns.Peer.prototype.handleSync = function( remoteStamp ) {
		const self = this;
		self.log( 'handleSync', {
			locla  : self.syncStamp,
			remote : remoteStamp,
			isHost : self.isHost,
		});
		// invalid remote stamp, drop
		if ( null == remoteStamp )
			return;
		
		if ( null != self.isHost ) {
			if ( self.isHost )
				self.syncStamp = remoteStamp - 1;
			else
				self.syncStamp = remoteStamp + 1;
			
			self.acceptSync( remoteStamp );
			return;
		}
		
		// same stamp, reroll
		if ( self.syncStamp === remoteStamp ) {
			self.stopSync();
			const delay = ( Math.floor( Math.random * 20 ) + 1 );
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
		self.log( 'acceptSync', {
			remote : remoteStamp,
			isHost : self.isHost,
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
		if ( null == self.isHost )
			self.setDoInit( self.syncStamp, remoteStamp );
		else {
			self.stopSync();
			if ( !self.isHost )
				self.sendOpen();
		}
	}
	
	ns.Peer.prototype.handleSyncAccept = function( stamps ) {
		const self = this;
		self.log( 'handleSyncAccept', {
			stamps : stamps,
			isHost : self.isHost,
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
			self.isHost = true;
		else
			self.isHost = false;
		
		self.log( 'setDoinit', self.isHost );
		self.stopSync();
		if ( !self.isHost )
			self.sendOpen();
	}
	
	ns.Peer.prototype.bindSignalChannel = function() {
		const self = this;
		self.log( 'bindSignalChannel' );
		self.signal.on( 'sync'             , sync );
		self.signal.on( 'sync-accept'      , syncAccept );
		self.signal.on( 'connect-data'     , connectData );
		self.signal.on( 'restart'          , restart );
		self.signal.on( 'stop'             , stop );
		self.signal.on( 'open'             , open );
		self.signal.on( 'blind'            , blind );
		self.signal.on( 'mute'             , mute );
		self.signal.on( 'screen-mode'      , screenMode );
		self.signal.on( 'screen-share'     , screenShare );
		self.signal.on( 'tracks-available' , tracksAvailable );
		self.signal.on( 'refresh'          , refreshThings );
		self.signal.on( 'meta'             , meta );
		self.signal.on( 'constraints'      , handleConstraints );
		self.signal.on( 'nostream'         , peerNoStream );
		self.signal.on( 'nestedapp'        , nestedApp );
		self.signal.on( 'update-name'      , updateName );
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
		function screenShare( e ) { self.setScreenShare( e ); }
		function tracksAvailable( e ) { self.handleTracksAvailable( e ); }
		function refreshThings( e ) { self.handleRefreshThings( e ); }
		function meta( e ) { self.handleMeta( e ); }
		function handleConstraints( e ) { self.handleRemoteConstraints( e ); }
		function peerNoStream( e ) { self.handleNoStream(); }
		function nestedApp( e ) { self.emit( 'nestedapp', e ); }
		function updateName( e ) { self.emit( 'update-name', e ); }
		function recycle( e ) { self.handleRecycle( e ); }
		function reconnect( e ) { self.handleReconnect( e ); }
		function leave( e ) { self.log( 'peer left?' ); }
		function closed( e ) { self.closeCmd(); }
	}
	
	// stream setup
	
	ns.Peer.prototype.createSession = function() {
		const self = this;
		self.log( 'createSession', {
			id      : self.id,
			rtcConf : self.rtcConf,
		});
		if ( self.session ) {
			self.log( 'createSession', {
				state   : self.state,
				session : self.session,
			});
			return;
		}
		
		if ( !self.media )
			self.media = new window.MediaStream();
		
		const peerName = self.identity.name;
		const type = 'stream';
		if ( self.alpha )
			self.closeData();
		
		const opts = {
			isHost          : self.isHost,
			useDefaultCodec : self.useDefaultCodec,
		};
		
		self.session = new library.rtc.Session(
			type,
			self.isHost,
			self.signal,
			self.media,
			self.rtcConf,
			opts,
			peerName
		);
		
		/*
		self.session = new library.rtc.Session({
			type      : type,
			isHost    : self.isHost,
			rtc       : self.rtcConf,
			signal    : self.signal,
			//modifySDP : modSDP,
		});
		*/
		
		self.session.on( 'track-add'   , e => self.trackAdded( e ));
		self.session.on( 'track-remove', e => self.trackRemoved( e ));
		self.session.on( 'nostream'    , sendNoStream );
		self.session.on( 'state'       , stateChange );
		self.session.on( 'stats'       , statsUpdate );
		self.session.on( 'error'       , sessionError );
		self.session.on( 'datachannel' , dataChannel );
		
		self.showSelfie();
		
		function modSDP( e ) { return self.modifySDP( e, type ); }
		
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
		self.log( 'handleConnectData', {
			stamp : stamp,
			alpha : self.alpha,
		});
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
	
	ns.Peer.prototype.checkIsHealthy = function() {
		const self = this;
		if ( !self.session )
			return;
		
		const rtcState = self.session.getRTCState();
		if ( 'stable' === rtcState.signal )
			return true;
		else
			return false;
	}
	
	ns.Peer.prototype.handleReconnect = function( sid ) {
		const self = this;
		self.log( 'handleReconnect', sid );
		self.showSelfie( null, sid );
	}
	
	ns.Peer.prototype.handleRecycle = function( sid ) {
		const self = this;
		self.log( 'handleRecycle', sid );
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
		const self = this;
		self.log( 'doRestart', self.state );
		if ( 'sync-meta' === self.state ) {
			self.log( 'doRestart - syncing meta already, aborting' );
			return;
		}
		
		self.doStop();
		if ( self.isHost )
			self.sendMeta();
	}
	
	ns.Peer.prototype.doStop = function( sid ) {
		const self = this;
		self.log( 'doStop', sid );
		self.stopPing();
		self.emit( 'release-stream' );
		self.releaseRemoteMedia();
		self.closeMedia();
		self.closeSession();
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
		self.log( 'Peer.closeSession', self.id );
		self.closeData();
		
		const sess = self.session;
		delete self.session;
		if ( !sess )
			return;
		
		try {
			sess.close();
		} catch( e ) {
			self.log( 'Peer.closeSession - session already closed', e );
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
		self.log( 'Peer.handleQualityUpdate', e );
		if ( !self.session )
			return;
		
		self.session.renegotiate();
	}
	
	ns.Peer.prototype.modifySDP = function( SDPObj, type ) {
		const self = this;
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
				self.log( 'could not find opus in line', lines );
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
		self.log( 'Peer.setScreenMode', mode );
		self.screenMode = mode;
		self.emit( 'screen-mode', mode );
	}
	
	ns.Peer.prototype.setScreenShare = function( isSharing ) {
		const self = this;
		self.log( 'Peer.setScreenShare', isSharing );
		self.screenShare = isSharing;
		self.emit( 'screen-share', isSharing );
	}
	
	ns.Peer.prototype.handleSelfieStream = function( stream ) {
		var self = this;
		self.showSelfie( stream );
	}
	
	ns.Peer.prototype.showSelfie = function( stream, sessionType ) {
		const self = this;
		if ( !self.receive ) {
			self.log( 'showSelfie - no receive, meta has not been received yet' );
			return;
		}
		
		if ( !stream ) {
			stream = self.selfie.getStream();
			self.log( 'Peer.showSelfie - no stream passed, getStream()', stream );
		}
		
		if ( !stream ) {
			self.log( 'Peer.showSelfie - still no stream - send no stream' );
			self.sendNoStream( sessionType );
			return;
		}
		
		self.updateTracks( stream );
	}
	
	ns.Peer.prototype.updateTracks = function( fresh ) {
		const self = this;
		if ( !self.session )
			return;
		
		if ( !fresh )
			fresh = self.selfie.getStream();
		
		self.log( 'Peer.updateTracks', {
			fresh : fresh.getTracks(),
			media : self.media.getTracks(),
			rcv   : self.receive,
			send  : self.permissions.send,
		});
		
		const rcv = self.receive;
		const send = self.permissions.send;
		const currAT = self.media.getAudioTracks()[ 0 ];
		const currVT = self.media.getVideoTracks()[ 0 ];
		const freshAT = !fresh ? null : fresh.getAudioTracks()[ 0 ];
		const freshVT = !fresh ? null : fresh.getVideoTracks()[ 0 ];
		update( rcv, 'audio', currAT, freshAT );
		update( rcv, 'video', currVT, freshVT );
		self.sendTracksAvailable();
		
		function update( rcv, type, curr, fresh ) {
			const allow = ( !!rcv[ type ] && !!send[ type ]);
			self.log( 'allow', {
				type  : type,
				allow : allow,
				curr  : curr,
				fresh :fresh,
			});
			if ( !allow ) {
				if ( curr )
					remove( curr );
				
				return;
			}
			
			if ( !fresh )
				return;
			
			if ( curr ) {
				if ( curr.id === fresh.id )
					return;
				
				//remove( curr );
				replace( curr, fresh );
				return;
			}
			
			add( fresh );
			
		}
		
		function add( t ) {
			self.media.addTrack( t );
			const err = self.session.addTrack( t.kind );
			if ( !err )
				return;
			
			self.log( 'Peer.updateTracks - add err', {
				err   : err,
				track : t,
			});
		};
		
		function remove( t ) {
			self.media.removeTrack( t );
			const err = self.session.removeTrack( t.kind );
			if ( !err )
				return;
			
			self.log( 'Peer.updateTracks - remove err', {
				err   : err,
				track : t,
			});
		}
		
		function replace( curr, fresh ) {
			self.media.removeTrack( curr );
			self.media.addTrack( fresh );
			const err = self.session.replaceTrack( fresh.kind );
			if ( !err )
				return;
			
			self.log( 'Peer.updateTracks - replace err', {
				err    : err,
				tracks : [ curr, fresh ],
			});
		}
	}
	
	ns.Peer.prototype.setConstraints = function( constraints ) {
		const self = this;
		self.send({
			type : 'constraints',
			data : constraints,
		});
	}
	
	ns.Peer.prototype.handleRemoteConstraints = function( data ) {
		const self = this;
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
		const self = this;
		self.log( 'Peer.streamAdded - legacy event ABORT ABORT ABORT', stream );
		return;
		
		self.remoteMedia = stream;
		var tracks = self.remoteMedia.getTracks();
		self.receiving.audio = false;
		self.receiving.video = false;
		tracks.forEach( checkType );
		self.toggleBlind( self.isBlind );
		self.toggleMute( self.isMute );
		var conf = {
			isVideo : self.receiving.video,
			isAudio : self.receiving.audio,
			stream : stream,
		};
		
		self.emit( 'legacy-stream', conf );
		self.emitStreamState( 'nominal' );
		
		function checkType( track ) {
			var type = track.kind;
			if ( 'audio' === type )
				self.receiving.audio = true;
			if ( 'video' === type )
				self.receiving.video = true;
		}
	}
	
	ns.Peer.prototype.trackAdded = function( track ) {
		const self = this;
		self.log( 'Peer.trackAdded', {
			type : track.kind,
			id   : track.id,
		});
		if ( !self.remoteMedia ) {
			self.remoteMedia = new window.MediaStream();
			self.emit( 'media', self.remoteMedia );
		}
		
		//self.bindTrack( track );
		const type = track.kind;
		if ( 'video' === type )
			addVideo( track );
		if ( 'audio' === type )
			addAudio( track );
		
		self.emitStreamState( 'nominal' );
		
		function addVideo( track ) {
			self.emit( 'track', 'video', track );
			self.toggleBlind( self.isBlind );
			self.receiving.video = true;
			self.emit( 'video', self.receiving.video );
		}
		
		function addAudio( track ) {
			self.emit( 'track', 'audio', track );
			self.toggleMute( self.isMute );
			self.receiving.audio = true;
			self.emit( 'audio', self.receiving.audio );
		}
	}
	
	ns.Peer.prototype.trackRemoved = function( type ) {
		const self = this;
		if ( !self.remoteMedia ) {
			self.log( 'Peer.trackRemoved - no remote media' );
			return;
		}
		
		let track = null;
		if ( 'audio' == type )
			track = self.remoteMedia.getAudioTracks()[ 0 ];
		if( 'video' == type )
			track = self.remoteMedia.getVideoTracks()[ 0 ];
		
		self.log( 'Peer.trackRemoved', {
			type  : type,
			track : track,
		});
		if ( !track )
			return;
		
		self.remoteMedia.removeTrack( track );
		self.receiving[ type ] = false;
		self.emit( 'track', type, null );
		self.emit( type, self.receiving[ type ]);
	}
	
	ns.Peer.prototype.emitTrackInfo = function( track ) {
		const self = this;
		const kind = track.kind;
		const receiving = self.receiving[ kind ];
		if ( receiving )
			self.emit( 'track', kind, track );
		else
			self.emit( 'track', kind, null );
		
		self.emit( type, receiving );
	}
	
	ns.Peer.prototype.handleTracksAvailable = function( tracks ) {
		const self = this;
		self.log( 'PEer.handleTracksAvailable', tracks );
		self.sending = tracks;
		const s = self.sending;
		const r = self.receiving;
		if ( !s.audio && r.audio )
			self.trackRemoved( 'audio' );
		if ( !s.video && r.video )
			self.trackRemoved( 'video' );
		
		if ( !self.sending.video && self.isFocus )
			self.toggleFocus();
		
		self.emit( 'meta', {
			sending : self.sending,
		});
		
		if ( self.permissions.receive.audio )
			self.emit( 'audio', tracks.audio );
		
		if ( self.permissions.receive.video )
			self.emit( 'video', tracks.video );
		
		self.emit( 'tracks-available', tracks );
	}
	
	ns.Peer.prototype.sendTracksAvailable = function() {
		const self = this;
		self.log( 'Peer.sendTracksAvailable', self.media );
		const tracks = self.media.getTracks();
		const available = {
			audio : false,
			video : false,
		};
		tracks.forEach( t => {
			const k = t.kind;
			available[ k ] = true;
		});
		const event = {
			type : 'tracks-available',
			data : available,
		};
		self.log( 'available', event );
		self.send( event );
	}
	
	ns.Peer.prototype.handleRefreshThings = function( refresh ) {
		const self = this;
		self.log( 'hanleRefreshThings', refresh );
		const stream = self.selfie.getStream();
		if ( !stream ) {
			self.log( 'Peer.handleRefreshThings - no stream, aborting' );
			return;
		}
		
		if ( refresh.meta )
			self.applyMeta( refresh.meta );
		
		if ( !self.session ) {
			self.log( 'Peer.handleRefreshThings - no session' );
			return;
		}
		
		if ( !refresh.video && !refresh.audio )
			return;
		
		const tracks = stream.getTracks();
		let aT = null;
		let vT = null;
		tracks.forEach( t => {
			if ( 'audio' === t.kind )
				aT = t;
			if ( 'video' === t.kind )
				vT = t;
		});
		self.log( 'handleRefreshThings - tracks', {
			ref : refresh,
			a : aT,
			v : vT,
		});
		try {
			if ( refresh.audio && aT ) {
				self.session.renegotiateTrack( 'audio' );
			}
			
			if ( refresh.video && vT ) {
				self.session.renegotiateTrack( 'video' );
			}
		} catch( ex ) {
			self.log( 'Peer.handleRefreshThings - a/v replace ex', ex.message || ex );
		}
	}
	
	ns.Peer.prototype.sendMeta = function() {
		const self = this;
		if ( !self.selfie ) {
			self.log( 'sendMeta - no selfie, no send', self );
			return;
		}
		
		self.state = 'sync-meta';
		const meta = self.buildMeta();
		self.send({
			type : 'meta',
			data : meta,
		});
	}
	
	ns.Peer.prototype.buildMeta = function() {
		const self = this;
		const send = self.permissions.send;
		let rec = null;
		if ( null != self.isFocus ) {
			rec = {
				audio : self.permissions.receive.audio,
				video : self.isFocus,
			};
		} else
			rec = self.permissions.receive;
		
		const meta = {
			browser   : self.selfie.browser,
			state     : {
				isMuted         : self.selfie.isMute,
				isBlinded       : self.selfie.isBlind,
				screenMode      : self.selfie.screenMode,
				screenShare     : self.selfie.isScreenSharing,
				useDefaultCodec : self.useDefaultCodec,
			},
			sending : send,
			receive : rec,
		};
		return meta;
	}
	
	ns.Peer.prototype.handleMeta = function( meta ) {
		const self = this;
		self.log( 'handleMeta', {
			meta   : meta,
			state  : self.state,
			isHost : self.isHost,
		});
		if ( !self.isHost )
			self.sendMeta();
		
		if ( 'sync-meta' !== self.state ) {
			try {
				throw new Error( 'handleMeta - not in sync-meta state, is in: ' + self.state );
			} catch( e ) {
				self.log( 'handleMeta - invalid state', e );
				return;
			}
		}
		
		self.applyMeta( meta );
		const signalState = {
			type : 'signal',
			data : {
				type : 'nominal',
			},
		};
		self.emit( 'state', signalState );
		self.state = '';
		self.createSession();
	}
	
	ns.Peer.prototype.applyMeta = function( meta ) {
		const self = this;
		self.log( 'Peer.applyMeta', meta );
		if ( !meta )
			return;
		
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
		
		self.updateTracks();
		
		function updateState( state ) {
			if ( null != state.isMuted )
				self.setRemoteMute( state.isMuted );
			
			if ( null != state.isBlinded )
				self.setRemoteBlind( state.isBlinded );
			
			if ( null != state.screenMode )
				self.setScreenMode( state.screenMode );
			
			if ( null != state.screenShare )
				self.setScreenShare( state.screenShare );
			
			if ( null != state.useDefaultCodec ) {
				self.useDefaultCodec = ( self.useDefaultCodec || state.useDefaultCodec );
				if ( self.session )
					self.session.setDefaultCodec( self.useDefaultCodec );
			}
		}
	}
	
	ns.Peer.prototype.updateDoInit = function( browser ) {
		const self = this;
		/*
		if ( 'firefox' === browser )
			self.isHost = false;
		
		if ( 'safari' === browser )
			self.isHost = false;
		*/
	}
	
	ns.Peer.prototype.releaseRemoteMedia = function() {
		var self = this;
		self.log( 'releaseRemoteMedia', self.remoteMedia );
		var stream = self.remoteMedia;
		delete self.remoteMedia;
		
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
			self.log( 'track.getConstraints', track.getConstraints() );
		
		self.log( kind + '-track, onMute', e );
		self.log( kind + '-track, onUnMute', e );
		function onEnded( e ) {
			self.log( kind + '-track, onEnded', e );
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
		const self = this;
		self.log( 'handleSessionStateChange', event );
		if ( 'error' === event.type )
			self.handleSessionError( event );
		
		/*
		if ( 'nominal' === event.type ) {
			if ( !self.alpha && !self.isHost )
				self.sendConnectData();
		}
		*/
		const state = event.type;
		if ( state == self.rtcState )
			return;
		
		self.rtcState = event.type;
		const rtcState = {
			type : 'rtc',
			data : event,
		};
		
		self.emit( 'state', rtcState );
		if ( 'nominal' === self.rtcState )
			self.refreshTheThing();
	}
	
	ns.Peer.prototype.handleStatsUpdate = function( stats ) {
		const self = this;
		if ( 'error' == stats.type ) {
			self.log( 'Peer.handleStatsUpdate - err', stats );
			return;
		}
		
		self.checkStats( stats.data );
		//self.emit( 'state', stats );
	}
	
	ns.Peer.prototype.checkStats = function( stats ) {
		const self = this;
		if ( !stats || !stats.inbound )
			return;
		
		self.log( 'checkStats', stats );
		return;
		const trans = stats.transport;
		const inn = stats.inbound;
		const audio = inn.audio;
		const video = inn.video;
		if ( trans )
			checkTransport( trans, audio, video );
		if ( audio )
			checkAudio( audio );
		if ( video )
			checkVideo( video );
		
		function checkTransport( t, a, v ) {
			const p = t.pair;
			const report = {
				ping         : t.ping,
				bandwidthOut : ( p.availableOutgoingBitrate / 8 ),
				sendRate     : t.sendRate,
			}
			
			if ( a ) {
				report.audioPackets = a.packetRate;
				report.audioPLoss   = a.packetLoss;
			}
			
			if ( v ) {
				report.videoPackets = v.packetRate;
				report.videoPLoss   = v.packetLoss;
			}
			
			self.log( 'checkTransport', report );
		}
		
		function checkAudio( a ) {
			return;
			
			if ( !self.receiving.audio )
				return;
			
			const t = a.track;
			if ( null == t.volumeLevel )
				return;
			
			if ( 0 == t.volumeLevel && !self.remoteMute ) {
				self.log( 'checkAudio - AMBER ALERT NO AUDIO', a );
				
				self.refreshAudio();
			}
		}
		
		function checkVideo( v ) {
			if ( !self.receiving.video )
				return;
			
			const c = v.codec;
			const t = v.track;
			self.log( 'track', t );
			if ( !t.frameHeight || !t.frameWidth ) {
				self.log( 'checkVideo - OHSHIT RESTARTING', v );
				if ( !self.useDefaultCodec ) {
					self.useDefaultCodec = true;
					self.refreshMeta();
					if ( self.session )
						self.session.setDefaultCodec( self.useDefaultCodec );
				} else
					self.refreshVideo();
			}
		}
	}
	
	ns.Peer.prototype.refreshAudio = function() {
		const self = this;
		self.log( 'refreshAudio' );
		const conf = {
			audio : true,
		};
		self.refreshTheThing( conf );
	}
	
	ns.Peer.prototype.refreshVideo = function() {
		const self = this;
		self.log( 'refreshVideo' );
		const conf = {
			video : true,
		};
		self.refreshTheThing( conf );
	}
	
	ns.Peer.prototype.refreshMeta = function() {
		const self = this;
		const meta = self.buildMeta();
		self.log( 'refreshMeta', meta );
		const conf = {
			meta : meta,
		};
		self.refreshTheThing( conf );
	}
	
	ns.Peer.prototype.handleSessionError = function( event ) {
		const self = this;
		self.restart();
	}
	
	ns.Peer.prototype.refreshTheThing = function( conf ) {
		const self = this;
		self.log( 'refreshTheThing', {
			conf  : conf,
			state : self.rtcState,
			refsh : self.refreshConf,
			tout  : self.refreshTimeout,
			isHost : self.isHost,
		});
		if ( null == self.isHost ) {
			self.log( 'host has not yet been determined, aborting' );
			return;
		}
		
		if ( !conf ) {
			conf = self.refreshConf;
			delete self.refreshConf;
			if ( !conf )
				return;
		}
		
		if ( null == self.rtcState || 'nominal' != self.rtcState ) {
			self.log( 'refreshTheThing - invalid state', {
				conf  : conf,
				state : self.rtcState,
			});
			addToRefresh( conf );
			if ( null != self.refreshTimeout )
				self.refreshTimeout = window.setTimeout( timedout, 1000 * 5 );
			
			return;
		}
		
		if ( null != self.refreshTimeout ) {
			addToRefresh( conf );
			return;
		}
		
		self.refreshTimeout = window.setTimeout( timedout, 1000 * 5 );
		send( conf );
		
		function timedout() {
			self.refreshTimeout = null;
			const conf = self.refreshConf;
			delete self.refreshConf;
			if ( conf )
				send( conf );
		}
		
		function addToRefresh( conf ) {
			if ( null == self.refreshConf ) {
				self.refreshConf = conf;
				return;
			}
			
			const keys = Object.keys( conf );
			keys.forEach( key => {
				const value = conf[ key ];
				self.refreshConf[ key ] = value;
			});
		}
		
		function send( conf ) {
			const refresh = {
				type : 'refresh',
				data : conf,
			};
			self.send( refresh );
		}
	}
	
	ns.Peer.prototype.toggleMute = function( force ) {
		const self = this;
		const audio = self.getAudioTrack();
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
		return self.isMute;
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
		return self.isBlind;
	}
	
	ns.Peer.prototype.toggleFocus = function() {
		const self = this;
		self.isFocus = !self.isFocus;
		self.emit( 'set-focus', self.isFocus );
	}
	
	ns.Peer.prototype.getAudioTrack = function() {
		const self = this;
		//var streams = self.session.conn.getRemoteStreams()[ 0 ];
		if ( !self.remoteMedia ) {
			self.log( 'getAudioTrack', self.remoteMedia );
			return null;
		}
		
		var tracks = self.remoteMedia.getAudioTracks();
		if ( !tracks.length )
			return null;
		
		return tracks[ 0 ];
	}
	
	ns.Peer.prototype.getVideoTrack = function() {
		var self = this;
		//var stream = self.session.conn.getRemoteStreams()[ 0 ];
		if ( !self.remoteMedia ) {
			self.log( 'getVideoTrack', self.remoteMedia );
			return null;
		}
		
		var tracks = self.remoteMedia.getVideoTracks();
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
				type        : state,
				tracks      : tracks,
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
		const self = this;
		self.onremove();
	}
	
	ns.Peer.prototype.closeMedia = function() {
		const self = this;
		if ( !self.media )
			return;
		
		const m = self.media;
		delete self.media;
		const ts = m.getTracks();
		ts.forEach( t => {
			m.removeTrack( t );
		});
	}
	
	ns.Peer.prototype.close = function() {
		const self = this;
		self.stopPing();
		if ( self.metaInterval ) {
			window.clearInterval( self.metaInterval );
			self.metaInterval = null;
		}
		
		if ( self.refreshTimeout )
			window.clearTimeout( self.refreshTimeout );
		
		if ( self.media )
			self.closeMedia();
		
		self.stopSync();
		
		self.selfie.off( self.streamHandlerId );
		self.releaseRemoteMedia();
		self.release(); // component.EventEmitter
		//self.selfie.off( self.qualityHandlerId );
		delete self.selfie;
		
		delete self.onremove;
		delete self.closeCmd;
		
		if ( self.signal )
			self.signal.close();
		
		delete self.signal;
		
		self.closeAllSessions();
	}
	
	ns.Peer.prototype.log = function( str, obj ) {
		const self = this;
		if ( !self.spam )
			return;
		
		const id = self.identity;
		const name = id.name;
		const nameStr = name + ': ' + str;
		console.log( nameStr, obj );
	}
	
})( library.rtc );

// SINK - extends peer
(function( ns, undefined ) {
	ns.Sink = function( conf ) {
		const self = this;
		library.rtc.Peer.call( self, conf );
		
		self.isHost = false;
		
		self.log( 'Sink' );
	}
	
	ns.Sink.prototype = Object.create( library.rtc.Peer.prototype );
	
	// Pri>ate
	
	ns.Sink.prototype.init = function( parentSignal ) {
		const self = this;
		// websocket / signal server path
		self.signal = new library.component.EventNode(
			self.id,
			parentSignal,
			eventSink
		);
		
		function eventSink( type, event ) {
			self.log( 'Peer.eventsink', {
				t : type,
				e : event,
			});
		}
		
		self.bindSignalChannel();
		
		/*
		// selfie
		self.streamHandlerId = self.selfie.on( 'selfie', handleStream );
		function handleStream( e ) { self.handleSelfieStream( e ); }
		*/
		
		self.startSync();
	}
	
	ns.Sink.prototype.createSession = function() {
		const self = this;
		self.log( 'sink.createSession', self.id );
		if ( self.session ) {
			self.log( 'createSession', {
				state   : self.state,
				session : self.session,
			});
			return;
		}
		
		if ( !self.media )
			self.media = new window.MediaStream();
		
		const peerName = self.identity.name;
		const type = 'sink';
		if ( self.alpha )
			self.closeData();
		
		const opts = {
			isHost          : self.isHost,
			useDefaultCodec : true,
			//useDefaultCodec : self.useDefaultCodec,
		};
		
		self.session = new library.rtc.Session(
			type,
			self.isHost,
			self.signal,
			self.media,
			self.rtcConf,
			opts,
			peerName
		);
		
		self.session.on( 'track-add'   , e => self.trackAdded( e ));
		self.session.on( 'track-remove', e => self.trackRemoved( e ));
		self.session.on( 'nostream'    , sendNoStream );
		self.session.on( 'state'       , stateChange );
		self.session.on( 'stats'       , statsUpdate );
		self.session.on( 'error'       , sessionError );
		self.session.on( 'datachannel' , dataChannel );
		
		self.showSelfie();
		
		function modSDP( e ) { return self.modifySDP( e, type ); }
		
		function sendNoStream( e ) { self.sendNoStream( type ); }
		function stateChange( e ) { self.handleSessionStateChange( e, type ); }
		function statsUpdate( e ) { self.handleStatsUpdate( e, type ); }
		function sessionError( e ) { self.handleSessionError( e, type ); }
		function dataChannel( e ) { self.bindDataChannel( e ); }
	}
	
	ns.Sink.prototype.updateTracks = function() {
		const self = this;
		self.log( 'updateTracks - lol no' );
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
		/*
		if ( 'chrome' === browser )
			self.isHost = true;
		
		if ( 'firefox' === browser )
			self.isHost = false;
		*/
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
		/*
		if ( 'chrome' === browser )
			self.isHost = true;
		
		if ( 'safari' === browser )
			self.isHost = true;
		*/
	}
	
})( library.rtc );

(function( ns, undefined ) {
	ns.PeerBrave = function( conf ) {
		const self = this;
		library.rtc.Peer.call( self, conf );
	}
	
	ns.PeerBrave.prototype = Object.create( library.rtc.Peer.prototype );
	
	ns.PeerFirefox.prototype.updateDoInit = function( browser ) {
		const self = this;
	}
	
})( library.rtc );


