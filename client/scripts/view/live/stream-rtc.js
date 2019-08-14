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

(function( ns, undefined ) {
	ns.RTC = function( conn, view, conf, onclose, onready ) {
		const self = this;
		self.conn = conn;
		self.view = view;
		self.userId = conf.userId;
		self.sourceId = conf.rtcConf.sourceId || null;
		self.rtcConf = conf.rtcConf;
		self.isGuest = conf.isGuest;
		self.userList = conf.peerList;
		self.identities = conf.identities || {};
		self.guestAvatar = conf.guestAvatar;
		self.mode = conf.rtcConf.mode || null;
		self.quality = conf.rtcConf.quality || null;
		self.permissions = conf.rtcConf.permissions;
		self.localSettings = conf.localSettings;
		self.onclose = onclose;
		self.onready = onready;
		
		self.users = {};
		self.chat = null;
		
		self.init( conf );
	}
	
	// Public
	
	ns.RTC.prototype.close = function() {
		const self = this;
		delete self.conf;
		delete self.conn;
		delete self.view;
		delete self.sourceSelect;
		delete self.menu;
		
		let onclose = self.onclose;
		delete self.onclose;
		if ( onclose )
			onclose();
	}
	
	// Private
	ns.RTC.prototype.init = function( conf ) {
		const self = this;
		
		self.bindConn();
		self.setupUsers();
		self.bindMenu();
		
		if ( self.quality )
			self.view.setQuality( self.quality.level );
		
		const sourceConf = {
			view     : self.view,
			onselect : sourcesSelected,
		};
		self.sourceSelect = new library.rtc.SourceSelect( sourceConf );
		function sourcesSelected( selected ) {
			if ( !selected )
				return;
			
			if ( !self.stream )
				return;
			
			self.stream.setMediaSources( selected );
		}
		
		// ui
		let chatConf = {
			userId     : self.userId,
			identities : self.identities,
			roomName   : conf.roomName,
			logTail    : conf.logTail,
		};
		self.chat = self.view.addChat( chatConf, self.conn );
		self.share = self.view.addShare( self.conn );
		
		// do init checks
		const initConf = {
			view           : self.view,
			onsourceselect : showSourceSelect,
			ondone         : allChecksDone,
		};
		self.initChecks = new library.rtc.InitChecks( initConf );
		self.initChecks.checkICE( self.rtcConf.ICE );
		self.initChecks.checkBrowser( browserBack );
		function browserBack( err, browser ) {
			if ( err ) {
				console.log( 'browserBack - err', err );
				self.goLive( false );
				return;
			}
			
			self.browser = browser;
			if ( self.isSource() )
				self.initChecks.checkDeviceAccess( self.permissions.send, deviceBack );
			else {
				self.updateMenuSendReceive();
				passSourceChecks();
				if ( self.sourceId )
					self.createSink();
			}
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
				self.updateMenuSendReceive( devices );
			
			self.createSource( checkSourceReady );
		}
		
		function checkSourceReady( gumErr, media ) {
			if ( !self.permissions.send.audio && !self.permissions.send.video )
				passSourceChecks();
			else
				runSourceChecks( gumErr, media );
			
			function passSourceChecks() {
				self.initChecks.passCheck( 'source-check' );
				self.initChecks.passCheck( 'audio-input' );
				self.initChecks.passCheck( 'video-input' );
			}
			
			function runSourceChecks() {
				const ready = self.initChecks.checkSourceReady( !!media, gumErr );
				if ( !ready )
					return;
				
				const selfStream = self.stream.getStream();
				const devicePref = self.localSettings.sourcePreferedDevices;
				self.initChecks.checkAudioDevices( selfStream, devicePref );
				self.initChecks.checkVideoDevices( selfStream, devicePref );
			}
		}
		
		function passSourceChecks() {
			self.initChecks.passCheck( 'devices' );
			self.initChecks.passCheck( 'source-check' );
			self.initChecks.passCheck( 'audio-input' );
			self.initChecks.passCheck( 'video-input' );
		}
		
		function allChecksDone( close ) {
			if ( close  ) {
				self.close();
				return;
			}
			
			self.initChecks.close();
			delete self.initChecks;
			done();
		}
		
		function showSourceSelect() {
			closeInit();
			self.showSourceSelect();
		}
		
		function done() {
			if ( self.isAdmin )
				self.setupAdmin();
			
			self.goLive( true );
		}
	}
	
	ns.RTC.prototype.bindMenu = function() {
		const self = this;
		self.menu = self.view.buildMenu();
		self.menu.on( 'mute'            , mute );
		self.menu.on( 'blind'           , blind );
		self.menu.on( 'change-username' , username );
		self.menu.on( 'source-select'   , sourceSelect );
		self.menu.on( 'screen-mode'     , screenMode );
		self.menu.on( 'restart'         , restart );
		
		if ( self.isGuest ) {
			self.menu.disable( 'share' );
		}
		
		self.updateSourceMenu();
		
		function mute( e ) { self.handleMute(); }
		function blind( e ) { self.handleBlind(); }
		function restart( e ) { self.restartStream( e ); }
		function username( e ) { self.changeUsername(); }
		function sourceSelect( e ) { self.showSourceSelect(); }
		function screenMode( e ) { self.handleScreenMode(); }
	}
	
	ns.RTC.prototype.handleMute = function( e ) {
		const self = this;
		self.stream.toggleMute();
	}
	
	ns.RTC.prototype.handleBlind = function( e ) {
		const self = this;
		self.stream.toggleBlind();
	}
	
	ns.RTC.prototype.restartStream = function( e ) {
		const self = this;
		if ( !self.stream )
			return;
		
		self.stream.restart();
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
	
	ns.RTC.prototype.showSourceSelect = function() {
		const self = this;
		let devices = null;
		if ( self.stream )
			devices = self.stream.currentDevices;
		
		self.sourceSelect.show( devices );
	}
	
	ns.RTC.prototype.updateSourceMenu = function() {
		const self = this;
		if ( self.isSource() ) {
			self.menu.enable( 'source-select' );
			self.menu.enable( 'send-receive' );
			self.menu.disable( 'receive-audio' );
			self.menu.disable( 'receive-video' );
		} else {
			self.menu.disable( 'source-select' );
			self.menu.disable( 'send-receive' );
			//self.menu.enable( 'send-receive' );
		}
	}
	
	ns.RTC.prototype.handleScreenMode = function() {
		const self = this;
		self.stream.toggleScreenMode();
	}
	
	ns.RTC.prototype.updateMenuSendReceive = function( devices ) {
		const self = this;
		let perms = self.permissions;
		updateSendToggles( perms.send );
		updateReceiveToggles( perms.receive );
		if ( devices )
			updateSendVisibility( devices );
		else
			setNoSend();
		
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
		
		function setNoSend() {
			self.menu.disable( 'send-audio' );
			self.menu.disable( 'send-video' );
		}
	}
	
	// sourceId is optional
	ns.RTC.prototype.isSource = function( sourceId ) {
		const self = this;
		const sid = self.sourceId || sourceId;
		const isSource = sid === self.userId;
		return isSource;
	}
	
	ns.RTC.prototype.setupAdmin = function() {
		const self = this;
		console.log( 'setupAdmin' );
	}
	
	ns.RTC.prototype.goLive = function( testsPassed ) {
		const self = this;
		if ( !testsPassed )
			return;
		
		const onready = self.onready;
		delete self.onready;
		if ( onready )
			onready( null );
	}
	
	ns.RTC.prototype.bindConn = function() {
		const self = this;
		self.conn.on( 'ping'       , ping       );
		self.conn.on( 'identity'   , identity   );
		self.conn.on( 'identities' , identities );
		self.conn.on( 'settings'   , settings   );
		self.conn.on( 'nested-app' , nestedApp  );
		self.conn.on( 'source'     , source     );
		self.conn.on( 'quality'    , quality    );
		self.conn.on( 'join'       , join       );
		self.conn.on( 'leave'      , leave      );
		self.conn.on( 'close'      , close      );
		
		function ping(       e ) { self.handlePing(       e ); }
		function identity(   e ) { self.handleIdentity(   e ); }
		function identities( e ) { self.handleIdentities( e ); }
		function settings(   e ) { self.handleSettings(   e ); }
		function nestedApp(  e ) { self.handleNestedApp(  e ); }
		function source(     e ) { self.handleSource(     e ); }
		function quality(    e ) { self.handleQuality(    e ); }
		function join(       e ) { self.handleUserJoin(   e ); }
		function leave(      e ) { self.handleUserLeft(   e ); }
		function close(      e ) { self.handleClosed(     e ); }
	}
	
	ns.RTC.prototype.handleNestedApp = function( event ) {
		const self = this;
		console.log( 'handleNestedApp', event );
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
			self.updateUserIdentity( idKey );
		}
	}
	
	ns.RTC.prototype.updatePeerIdentity = function( peerId, id ) {
		const self = this;
		const user = self.users[ peerId ];
		if ( !user ) {
			console.log( 'updatePeerIdentity - no user for', [
				peerId,
				id,
				self.identities,
			]);
			return;
		}
		
		user.updateIdentity( id );
	}
	
	ns.RTC.prototype.handleSettings = function( update ) {
		const self = this;
		if ( 'isStream' === update.setting )
			self.handleLiveSwitch( update.value );
	}
	
	ns.RTC.prototype.handleLiveSwitch = function( isStream ) {
		const self = this;
		if ( isStream ) {
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
	
	ns.RTC.prototype.handleSource = function( sourceId ) {
		const self = this;
		const isSource = self.isSource( sourceId );
		if ( !!sourceId )
			addSource( sourceId );
		else
			sourceRemoved();
		
		function addSource( sourceId ) {
			self.sourceId = sourceId;
			if ( isSource ) {
				self.createSource();
			} else
				self.createSink();
		}
		
		function sourceRemoved() {
			self.sourceId = null;
			if ( self.stream )
				self.stream.close();
			
			self.stream = null;
		}
	}
	
	ns.RTC.prototype.handleQuality = function( quality ) {
		const self = this;
		if ( !self.stream )
			return;
		
		console.log( 'handleQuality', quality );
		//self.source.setRoomQuality( quality );
		
	}
	
	ns.RTC.prototype.handleUserJoin = function( user ) {
		const self = this;
		user.isHost = false;
		self.addUser( user );
	}
	
	ns.RTC.prototype.handleUserLeft = function( user ) {
		const self = this;
		const userId = user.peerId;
		self.closeUser( userId );
	}
	
	ns.RTC.prototype.handleClosed = function() {
		const self = this;
		self.close();
	}
	
	ns.RTC.prototype.setupUsers = function() {
		const self = this;
		self.userList.forEach( add );
		function add( uid ) {
			self.createUser( uid );
		}
	}
	
	ns.RTC.prototype.addUser = function( user ) {
		const self = this;
		self.createUser( user.peerId );
	}
	
	ns.RTC.prototype.createUser = function( userId ) {
		const self = this;
		if ( self.users[ userId ])
			self.closeUser( userId );
		
		let id = self.getIdentity( userId );
		if ( !id.avatar )
			id.avatar = self.guestAvatar;
		
		let conf = {
			id       : userId,
			identity : id,
		};
		
		const user = new library.rtc.User( conf );
		self.users[ userId ] = user;
		self.view.addUser( user );
	}
	
	ns.RTC.prototype.updateUserIdentity = function( userId ) {
		const self = this;
		console.log( 'updateUserIdentity', userId );
	}
	
	ns.RTC.prototype.getIdentity = function( userId ) {
		const self = this;
		const identity = self.identities[ userId ];
		if ( !identity )
			return {
				name   : '---',
				avatar : self.guestAvatar,
			};
		
		if ( !identity.avatar )
			identity.avatar = self.guestAvatar;
		
		return identity;
	}
	
	ns.RTC.prototype.closeUser = function( userId ) {
		const self = this;
		const user = self.users[ userId ];
		if ( !user ) {
			console.log( 'RTC.closeUser - no user for id', userId );
			return;
		}
		
		self.view.removeUser( userId );
		delete self.users[ userId ];
		
		user.close();
	}
	
	ns.RTC.prototype.createSource = function( callback ) {
		const self = this;
		if ( self.stream )
			self.stream.close();
		
		const identity = self.getIdentity( self.userId );
		const conf = {
			id            : 'stream', //self.userId,
			browser       : self.browser,
			identity      : identity,
			permissions   : self.permissions,
			localSettings : self.localSettings,
			rtcConf       : self.rtcConf,
		};
		self.stream = new library.rtc.Source(
			self.conn,
			self.view,
			self.menu,
			conf,
			callback
		);
	}
	
	ns.RTC.prototype.createSink = function( callback ) {
		const self = this;
		if ( self.stream )
			self.stream.close();
		
		let sourceIdentity = null
		if ( self.sourceId )
			sourceIdentity = self.getIdentity( self.sourceId );
		
		const  conf = {
			id            : 'stream', //self.userId,
			identity      : sourceIdentity,
			localSettings : self.localSettings,
			rtcConf       : self.rtcConf,
		};
		self.stream = new library.rtc.Sink(
			self.conn,
			self.view,
			self.menu,
			conf
		);
	}
	
})( library.rtc );


// User
(function( ns, undefined ) {
	ns.User = function( conf ) {
		const self = this;
		library.component.EventEmitter.call( self );
		self.id = conf.id;
		self.identity = conf.identity;
		
		self.init();
	}
	
	ns.User.prototype = Object.create( library.component.EventEmitter.prototype );
	
	// Public 
	
	ns.User.prototype.updateIdentity = function( id ) {
		const self = this;
		self.identity = id;
		self.emit( 'identity' );
	}
	
	ns.User.prototype.close = function() {
		const self = this;
	}
	
	// Private
	
	ns.User.prototype.init = function() {
		const self = this;
		console.log( 'User.init', self );
	}
	
} )( library.rtc );


// Source
(function( ns, undefined ) {
	ns.Source = function(
		conn,
		view,
		menu,
		conf,
		callback
	) {
		const self = this;
		library.component.EventEmitter.call( self );
		
		self.id = conf.id;
		self.local = conn;
		self.view = view;
		self.menu = menu;
		self.browser = conf.browser;
		self.identity = conf.identity;
		self.permissions = conf.permissions;
		self.localSettings = conf.localSettings;
		self.rtcConf = conf.rtcConf;
		
		self.signal = null;
		self.session = null;
		self.stream = null;
		self.currentDevices = {};
		self.screenMode = 'contain';
		
		self.init( conn, callback );
	}
	
	ns.Source.prototype = Object.create( library.component.EventEmitter.prototype );
	
	// Public 
	
	ns.Source.prototype.close = function() {
		const self = this;
		self.release();
		if ( self.stream )
			self.clearStream();
		
		if ( self.shareMedia )
			self.clearShareMedia();
		
		if ( self.session )
			self.session.close();
		
		if ( self.signal )
			self.signal.close();
		
		delete self.local;
		delete self.signal;
		delete self.session;
		delete self.stream;
		delete self.view;
		delete self.menu;
	}
	
	ns.Source.prototype.getStream = function() {
		const self = this;
		return self.stream || null;
	}
	
	ns.Source.prototype.restart = function() {
		const self = this;
		if ( self.session )
			self.closeSession();
		
		self.signal.send({
			type : 'restart',
			data : Date.now(),
		});
	}
	
	// Private
	
	ns.Source.prototype.init = function( parentSignal, callback ) {
		const self = this;
		self.signal = new library.component.EventNode(
			self.id,
			parentSignal,
			signalSink
		);
		
		function signalSink( type, event ) {
			console.log( 'Source.signal.eventsink', [
				type,
				event,
			]);
		}
		
		self.signal.on( 'joined', joined );
		self.signal.on( 'restart', restart );
		self.signal.on( 'stream-state', streamState );
		self.signal.on( 'client-state', clientState );
		
		
		function joined( e ) { self.handleJoined( e ); }
		function restart( e ) { self.handleRestart( e ); }
		function streamState( e ) { self.handleStreamState( e ); }
		function clientState( e ) { self.handleClientState( e ); }
		
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
			
			self.menu.enable( 'toggle-screen-share' );
		}
		
		self.bindMenu();
		self.sources = new library.rtc.MediaDevices();
		self.sources.getByType()
			.then( devsBack )
			.catch( devErr );
			
		self.view.addSource( self );
		
		function devsBack( devices ) {
			self.tryPreferedDevices( devices );
			self.setupMedia( done );
		}
		
		function devErr( err ) {
			done( err, null );
		}
		
		function done( err, res ) {
			callback( err, res );
			//self.setupSession();
		}
	}
	
	ns.Source.prototype.tryPreferedDevices = function( available ) {
		const self = this;
		if ( !self.localSettings || !self.localSettings.sourcePreferedDevices )
			return;
		
		let pref = self.localSettings.sourcePreferedDevices;
		if ( !pref || available )
			return;
		
		let prefAudio = available.audioinput[ pref.audioinput ];
		let prefVideo = available.videoinput[ pref.videoinput ];
		let prefOut = available.audiooutput[ pref.audiooutput ];
		if ( prefAudio )
			self.currentDevices.audioinput = pref.audioinput;
		
		if ( prefVideo )
			self.currentDevices.videoinput = pref.videoinput;
		
		if ( prefOut ) {
			self.currentDevices.audiooutput = pref.audiooutput;
			self.setAudioSink( pref );
		}
	}
	
	ns.Source.prototype.bindMenu = function() {
		var self = this;
		self.menu.on( 'leave'               , leave );
		//self.menu.on( 'q-default'           , qualityDefault );
		//self.menu.on( 'q-normal'            , qualityNormal );
		//self.menu.on( 'q-medium'            , qualityMedium );
		//self.menu.on( 'q-low'               , qualityLow );
		self.menu.on( 'send-audio'          , sendAudio );
		self.menu.on( 'send-video'          , sendVideo );
		//self.menu.on( 'receive-audio'       , receiveAudio );
		//self.menu.on( 'receive-video'       , receiveVideo );
		self.menu.on( 'toggle-screen-share' , screenShare );
		self.menu.on( 'screen-share-ext'    , screenExtInstall );
		
		function leave( e ) { self.leave(); }
		//function qualityDefault( e ) { self.handleQuality( 'default' )}
		//function qualityNormal( e ) { self.handleQuality( 'normal' ); }
		//function qualityMedium( e ) { self.handleQuality( 'medium' ); }
		//function qualityLow( e ) { self.handleQuality( 'low' ); }
		function sendAudio( e ) { self.toggleSendAudio( e ); }
		function sendVideo( e ) { self.toggleSendVideo( e ); }
		//function receiveAudio( e ) { self.toggleReceiveAudio( e ); }
		//function receiveVideo( e ) { self.toggleReceiveVideo( e ); }
		function screenShare( e ) { self.toggleShareScreen(); }
		function screenExtInstall( e ) { self.openScreenExtInstall( e ); }
	}
	
	ns.Source.prototype.toggleSendAudio = function() {
		const self = this;
		let send = self.permissions.send;
		send.audio = !send.audio;
		self.menu.setState( 'send-audio', send.audio );
		self.setupStream( streamUp );
		function streamUp( err, media ) {
			//self.emit( 'restart' );
		}
	}
	
	ns.Source.prototype.toggleSendVideo = function() {
		const self = this;
		let send = self.permissions.send;
		send.video = !send.video;
		self.menu.setState( 'send-video', send.video );
		self.setupStream( streamUp );
		function streamUp( err, media ) {
			//self.emit( 'restart' );
		}
	}
	
	ns.Source.prototype.toggleMenuScreenShareInstall = function( showInstall ) {
		const self = this;
		if ( showInstall ) {
			self.menu.disable( 'toggle-screen-share' );
			self.menu.enable( 'screen-share-ext' );
		} else {
			self.menu.disable( 'screen-share-ext' );
			self.menu.enable( 'toggle-screen-share' );
		}
	}
	
	ns.Source.prototype.openScreenExtInstall = function() {
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
	
	ns.Source.prototype.toggleShareScreen = function() {
		const self = this;
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
	
	ns.Source.prototype.bindShareTracks = function( media ) {
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
	
	ns.Source.prototype.clearShareMedia = function() {
		const self = this;
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
	
	ns.Source.prototype.setMediaSources = function( devices ) {
		const self = this;
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
		
		self.currentDevices = devices;
		self.setupStream( streamBack );
		function streamBack( err, res ) {
			if ( err )
				return;
			
			self.savePreferedDevices();
			if ( devices.audiooutput )
				self.setAudioSink( devices );
		}
	}
	
	ns.Source.prototype.savePreferedDevices = function() {
		const self = this;
		self.saveLocalSetting( 'sourcePreferedDevices', self.currentDevices );
	}
	
	ns.Source.prototype.saveLocalSetting = function( setting, value ) {
		const self = this;
		const sett = {
			type : 'local-setting',
			data : {
				setting : setting,
				value   : value,
			},
		};
		self.local.send( sett );
	}
	
	ns.Source.prototype.setupMedia = function( callback ) {
		const self = this;
		let send = self.permissions.send;
		self.mediaConf = {
			audio : send.audio,
			video : send.video,
		};
		//self.applyStreamQuality();
		self.setupStream( streamBack );
		
		function streamBack( err, res ) {
			callback( err, res );
		}
	}
	
	ns.Source.prototype.setupStream = function( callback ) {
		var self = this;
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
				self.currentDevices[ type ] = track.labelExtra;
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
	
	ns.Source.prototype.setStream = function( stream, constraints ) {
		var self = this;
		if ( self.stream )
			self.clearStream();
		
		self.stream = stream;
		
		if ( self.isMute ) {
			self.toggleMute( true );
		}
		
		if ( self.isBlind ) {
			self.toggleBlind( true );
		}
		
		const aTrack = self.getAudioTrack();
		const vTrack = self.getVideoTrack();
		
		/*
		if ( aTrack )
			self.bindVolume( stream );
		*/
		
		const tracks = {
			audio : !!aTrack,
			video : !!vTrack,
		};
		
		self.emit( 'tracks-available', tracks );
		self.emit( 'media', stream );
		
		// TODO refactor these to use tracks-available?
		self.emit( 'audio', !!aTrack );
		self.emit( 'video', !!vTrack );
		
		self.emitVoiceOnly( tracks );
		
		if ( self.session )
			self.restart();
	}
	
	ns.Source.prototype.clearStream = function() {
		var self = this;
		if ( !self.stream )
			return;
		
		var tracks = self.stream.getTracks();
		tracks.forEach( stop );
		self.stream = null;
		self.emit( 'stream', null );
		
		function stop( track ) {
			self.stream.removeTrack( track );
			track.stop();
		}
	}
	
	ns.Source.prototype.toggleMute = function( force ) {
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
		self.menu.setState( 'mute', self.isMute );
		self.emit( 'mute', self.isMute );
		return self.isMute;
	}
	
	ns.Source.prototype.toggleBlind = function( force ) {
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
		self.menu.setState( 'blind', self.isBlind );
		self.emit( 'blind', self.isBlind );
		return self.isBlind;
	}
	
	ns.Source.prototype.getAudioTrack = function() {
		var self = this;
		if ( self.stream )
			return self.stream.getAudioTracks()[ 0 ];
		else
			return null;
	}
	
	ns.Source.prototype.getVideoTrack = function() {
		var self = this;
		if ( self.stream )
			return self.stream.getVideoTracks()[ 0 ];
		else
			return null;
	}
	
	ns.Source.prototype.emitVoiceOnly = function( tracks ) {
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
	
	ns.Source.prototype.handleJoined = function( e ) {
		const self = this;
		self.setupSession();
	}
	
	ns.Source.prototype.handleRestart = function( e ) {
		const self = this;
		console.log( 'handleRestart', e );
	}
	
	ns.Source.prototype.handleStreamState = function( webRTCisUP ) {
		const self = this;
		console.log( 'source.handleStreamState', webRTCisUP );
		if ( !webRTCisUP )
			self.restart();
	}
	
	ns.Source.prototype.handleClientState = function( state ) {
		const self = this;
		self.emit( 'client-state', state );
	}
	
	ns.Source.prototype.toggleScreenMode = function( mode ) {
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
	
	ns.Source.prototype.setupSession = function() {
		const self = this;
		const conf = {
			type   : 'source',
			isHost : true,
			rtc    : self.rtcConf,
			signal : self.signal,
		};
		self.session = new library.rtc.Session( conf );
		self.session.addStream( self.stream );
	}
	
	ns.Source.prototype.closeSession = function() {
		const self = this;
		if ( !self.session )
			return;
		
		self.session.close();
		delete self.session;
	}
	
})( library.rtc );


// Sink
(function( ns, undefined ) {
	ns.Sink = function(
		conn,
		view,
		menu,
		conf
	) {
		const self = this;
		library.component.EventEmitter.call( self );
		
		self.id = conf.id;
		self.local = conn;
		self.view = view;
		self.menu = menu;
		self.identity = conf.identity;
		self.localSettings = conf.localSettings;
		self.rtcConf = conf.rtcConf;
		
		self.signal = null;
		self.session = null;
		self.stream = null;
		self.isStreaming = false;
		self.screenMode = 'contain';
		
		self.init( conn );
	}
	
	ns.Sink.prototype = Object.create( library.component.EventEmitter.prototype )
	
	// Public
	
	ns.Sink.prototype.close = function() {
		const self = this;
		self.view.removeStream( self.id );
		if ( self.session )
			self.session.close();
		
		if ( self.stream )
			self.stopStream();
		
		if ( self.signal )
			self.signal.close();
		
		if ( self.menu ) {
			
		}
		
		self.release(); // clear event emitter
		
		delete self.local;
		delete self.signal;
		delete self.stream;
		delete self.view;
		delete self.menu;
		delete self.identity;
		delete self.rtcConf;
	}
	
	ns.Sink.prototype.restart = function() {
		const self = this;
		if ( self.session )
			self.closeSession();
		
		self.isStreaming = false;
		
		self.signal.send({
			type : 'restart',
			data : Date.now(),
		});
	}
	
	// Private
	
	ns.Sink.prototype.init = function( parentSignal ) {
		const self = this;
		self.signal = new library.component.EventNode(
			self.id,
			parentSignal,
			signalSink,
		);
		
		self.signal.on( 'source-state', sourceState );
		self.signal.on( 'stream-state', streamState );
		
		function sourceState( e ) { self.handleSourceState( e ); }
		function streamState( e ) { self.handleStreamState( e ); }
		function signalSink( type, event ) {
			console.log( 'Sink.signal.eventSink', [
				type,
				event,
			]);
		}
		
		self.view.addSink( self );
		//self.bindMenu();
		//self.setupSession();
	}
	
	ns.Sink.prototype.bindMenu = function() {
		const self = this;
		self.menu.on( 'restart', restart );
		
		function restart() {
			self.restart();
		}
	}
	
	ns.Sink.prototype.saveLocalSetting = function( setting, value ) {
		const self = this;
		const sett = {
			type : 'local-setting',
			data : {
				setting : setting,
				value   : value,
			},
		};
		self.local.send( sett );
	}
	
	ns.Sink.prototype.setupSession = function() {
		const self = this;
		if ( self.session )
			self.closeSession();
		
		const conf = {
			type         : 'sink',
			isHost       : false,
			signal       : self.signal,
			rtc          : self.rtcConf,
			//bundlePolicy : 'max-bundle',
		};
		self.session = new library.rtc.Session( conf );
		//self.sessionData = self.session.createDataChannel( 'hello' );
		self.session.on( 'track', handleTrack );
		
		function handleTrack( track ) { self.handleTrack( track ); }
	}
	
	ns.Sink.prototype.toggleScreenMode = function( mode ) {
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
	
	ns.Sink.prototype.handleTrack = function( track ) {
		const self = this;
		if ( !self.stream ) {
			self.stream = new window.MediaStream();
			self.emit( 'media', self.stream );
		}
		
		const type = track.kind;
		remove( type );
		
		self.stream.addTrack( track );
		
		if ( 'audio' === type ) {
			track.enabled = !self.isMute;
			self.hasAudio = true;
		}
		if ( 'video' === type ) {
			track.enabled = !self.isBlind;
			self.hasVideo = true;
		}
		
		self.emit( 'track', type, !!track );
		
		function remove( type ) {
			let srcObj = self.stream;
			if ( !srcObj )
				return;
			
			let tracks = srcObj.getTracks();
			tracks.forEach( removeType );
			function removeType( track ) {
				if ( type !== track.kind )
					return;
				
				srcObj.removeTrack( track );
				track.stop();
			}
		}
	}
	
	ns.Sink.prototype.stopStream = function() {
		const self = this;
		if ( !self.stream )
			return;
		
		let tracks = self.stream.getTracks();
		tracks.forEach( track => {
			self.stream.removeTrack( track );
			track.stop();
		});
	}
	
	ns.Sink.prototype.closeSession = function() {
		const self = this;
		if ( !self.session )
			return;
		
		self.session.close();
		delete self.session;
	}
	
	ns.Sink.prototype.handleStreamState = function( webRTCisUP ) {
		const self = this;
		if ( !webRTCisUP )
			self.restart();
		
		let state = {
			type : 'stream',
			data : webRTCisUP,
		};
		self.emit( 'stream-state', state );
	}
	
	ns.Sink.prototype.handleSourceState = function( isStreaming ) {
		const self = this;
		if ( self.isStreaming === isStreaming )
			return;
		
		self.isStreaming = isStreaming;
		if ( isStreaming )
			self.setupSession();
		else
			self.closeSession();
		
		let state = {
			type : 'source',
			data : isStreaming,
		};
		self.emit( 'stream-state', state );
	}
	
	ns.Sink.prototype.toggleMute = function( force ) {
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
		self.menu.setState( 'mute', self.isMute );
		self.emit( 'mute', self.isMute );
		return self.isMute;
	}
	
	ns.Sink.prototype.toggleBlind = function( force ) {
		const self = this;
		const video = self.getVideoTrack();
		if ( !video ) {
			console.log( 'selfie.toggleBlind - no video track' );
			return;
		}
		
		if ( force === !video.enabled )
			return;
		
		if ( null != force )
			video.enabled = !force;
		else
			video.enabled = !video.enabled;
		
		self.isBlind = !video.enabled;
		self.menu.setState( 'blind', self.isBlind );
		self.emit( 'blind', self.isBlind );
		return self.isBlind;
	}
	
	ns.Sink.prototype.getAudioTrack = function() {
		const self = this;
		if ( self.stream )
			return self.stream.getAudioTracks()[ 0 ];
		else
			return null;
	}
	
	ns.Sink.prototype.getVideoTrack = function() {
		const self = this;
		if ( self.stream )
			return self.stream.getVideoTracks()[ 0 ];
		else
			return null;
	}
	
})( library.rtc );
