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
	ns.RTCStream = function( conn, UI, conf, onclose, onready ) {
		const self = this;
		console.log( 'RTCStream', {
			conn    : conn,
			UI      : UI,
			conf    : conf,
			onclose : onclose,
			onready : onready,
		});
		
		self.sourceId = conf.rtcConf.sourceId || null;
		
		self.mode = conf.rtcConf.mode || null;
		self.topology = 'stream'; //conf.rtcConf.topology || 'peer';
		library.rtc.RTC.call( self, conn, UI, conf, onclose, onready );
		
		console.log( 'RTCStream - self', self );
	}
	
	ns.RTCStream.prototype = Object.create( library.rtc.RTC.prototype );
	
	// Public
	
	ns.RTC.prototype.close = function() {
		const self = this;
		delete self.conf;
		delete self.conn;
		delete self.ui;
		delete self.sourceSelect;
		delete self.menu;
		
		let onclose = self.onclose;
		delete self.onclose;
		if ( onclose )
			onclose();
	}
	
	// Private
	ns.RTC.prototype.init = function() {
		const self = this;
		if ( 'DESKTOP' != window.View.deviceType )
			self.isMobile = true;
		
		self.setupProxy();
		
		self.convertLegacyDevices();
		self.setupUsers();
		self.bindUI();
		self.bindMenu();
		
		if ( self.quality )
			self.ui.setQuality( self.quality.level );
		
		// ui
		self.chat = self.ui.addChat(
			self.userId,
			self.identities,
			self.conn
		);
		self.share = self.ui.addShareLink( self.conn );
		if ( self.share && self.isTempRoom )
			self.share.show();
		
		self.statusMsg = self.ui.initStatusMessage();
		
		self.initChecks = new library.rtc.InitChecks( self.statusMsg );
		self.initChecks.on( 'source-select', showSourceSelect );
		self.initChecks.on( 'done', currentChecksDone );
		
		const appConf = window.View.config.appConf || {};
		self.initChecks.checkBrowser( appConf.userAgent, browserBack );
		function browserBack( err, browser ) {
			if ( err ) {
				console.log( 'browserBack - err', err );
				self.goLive( false );
				return;
			}
			
			self.browser = browser;
			self.ui.setBrowser( self.browser );
			if ( self.isSource() ) {
				console.log( 'SOurce setup' );
				self.initChecks.checkDeviceAccess( self.permissions.send )
					.then( deviceBack )
					.catch( devFail );
			}
			else {
				console.log( 'user setup' );
				self.updateMenuSendReceive();
				self.allChecksRun = true;
				closeInit();
				done();
				if ( self.sourceId )
					self.createSink();
			}
		}
		
		function devFail( err ) {
			console.log( 'devFail', err );
			self.close();
		}
		
		function deviceBack( permissions, devices ) {
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
			
			done();
			
			function passSourceChecks() {
				self.initChecks.passCheck( 'source-check' );
			}
			
			function runSourceChecks() {
				const ready = self.initChecks.checkSourceReady( !!media, gumErr );
				if ( !ready )
					return;
				
				self.allChecksRun = true;
				self.initChecks.checkICE( self.rtcConf.ICE );
			}
		}
		
		function currentChecksDone( forceClose ) {
			console.log( 'currentChecksDone', {
				forceClose   : forceClose,
				allChecksRun : self.allChecksRun,
			});
			if ( forceClose  ) {
				self.close();
				return;
			}
			
			if ( !self.allChecksRun )
				return;
			
			closeInit();
		}
		
		function showSourceSelect() {
			self.showSourceSelect();
		}
		
		function closeInit() {
			if ( !self.initChecks )
				return;
			
			self.initChecks.close();
			delete self.initChecks;
			self.ui.removeCover();
		}
		
		function done() {
			if ( self.isAdmin )
				self.setupAdmin();
			
			self.goLive( true );
		}
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
	
	ns.RTC.prototype.bindMenu = function() {
		const self = this;
		self.menu = self.ui.buildMenu();
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
	
	ns.RTC.prototype.bindUI = function() {
		const self = this;
		self.ui.on( 'close', e => self.close());
		self.ui.on( 'settings', e => self.showSourceSelect());
		self.ui.on( 'share-screen', e => self.stream.toggleShareScreen());
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
	
	ns.RTC.prototype.showSourceSelect = function() {
		const self = this;
		self.stream.showSourceSelect();
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
		console.log( 'isSource', {
			sourceId : sid,
			userId   : self.userId,
		});
		const isSource = sid === self.userId;
		return isSource;
	}
	
	ns.RTC.prototype.setupAdmin = function() {
		const self = this;
		console.log( 'setupAdmin' );
	}
	
	ns.RTC.prototype.goLive = function( testsPassed ) {
		const self = this;
		console.log( 'RTC.goLive', testsPassed );
		if ( !testsPassed )
			return;
		
		self.bindConn();
		
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
		self.conn.on( 'source'     , source     );
		self.conn.on( 'quality'    , quality    );
		self.conn.on( 'join'       , join       );
		self.conn.on( 'leave'      , leave      );
		self.conn.on( 'close'      , close      );
		
		function ping(       e ) { self.handlePing(       e ); }
		function identity(   e ) { self.handleIdentity(   e ); }
		function identities( e ) { self.handleIdentities( e ); }
		function settings(   e ) { self.handleSettings(   e ); }
		function source(     e ) { self.handleSource(     e ); }
		function quality(    e ) { self.handleQuality(    e ); }
		function join(       e ) { self.handleUserJoin(   e ); }
		function leave(      e ) { self.handleUserLeft(   e ); }
		function close(      e ) { self.handleClosed(     e ); }
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
		const user = self.peers[ peerId ];
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
		console.log( 'setupUsers', self.userList );
		if ( !self.userList )
			return;
		
		self.userList.forEach( add );
		function add( uid ) {
			self.createUser( uid );
		}
	}
	
	ns.RTC.prototype.addUser = function( user ) {
		const self = this;
		console.log( 'addUser', user );
		self.createUser( user.peerId );
	}
	
	ns.RTC.prototype.createUser = function( userId ) {
		const self = this;
		if ( self.peers[ userId ])
			self.closeUser( userId );
		
		let id = self.getIdentity( userId );
		if ( !id.avatar )
			id.avatar = self.guestAvatar;
		
		let conf = {
			id       : userId,
			identity : id,
		};
		
		const user = new library.rtc.User( conf );
		self.peers[ userId ] = user;
		self.peerIds.push( userId );
		self.ui.addUser( user );
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
		const user = self.peers[ userId ];
		if ( !user ) {
			console.log( 'RTC.closeUser - no user for id', userId );
			return;
		}
		
		self.ui.removeUser( userId );
		delete self.peers[ userId ];
		self.peerIds = Object.keys( self.peers );
		
		user.close();
	}
	
	ns.RTC.prototype.createSource = function( callback ) {
		const self = this;
		if ( self.stream )
			self.stream.close();
		
		const identity = self.getIdentity( self.userId );
		console.log( 'createSource', identity );
		const conf = {
			id            : 'stream', //self.userId,
			browser       : self.browser,
			identity      : identity,
			permissions   : self.permissions,
			localSettings : self.localSettings,
			rtcConf       : self.rtcConf,
		};
		self.stream = new library.rtc.Source(
			self.proxy,
			self.ui,
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
			self.proxy,
			self.ui,
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
		
		self.proxy = null;
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
		
		if ( self.proxy )
			self.proxy.close();
		
		delete self.local;
		delete self.proxy;
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
		
		self.proxy.send({
			type : 'restart',
			data : Date.now(),
		});
	}
	
	// Private
	
	ns.Source.prototype.init = function( parentSignal, callback ) {
		const self = this;
		const ignoreSysMute = self.localSettings[ 'ignore-system-mute' ];
		if ( ignoreSysMute )
			self.ignoreSystemMute = ignoreSysMute;
		
		//
		self.proxy = new library.component.EventNode(
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
		
		self.proxy.on( 'joined', joined );
		self.proxy.on( 'restart', restart );
		self.proxy.on( 'stream-state', streamState );
		self.proxy.on( 'client-state', clientState );
		
		function joined( e ) { self.handleJoined( e ); }
		function restart( e ) { self.handleRestart( e ); }
		function streamState( e ) { self.handleStreamState( e ); }
		function clientState( e ) { self.handleClientState( e ); }
		
		//
		self.extConn = self.view.addExtConnPane( onExtConnShare );
		function onExtConnShare( e ) {
			self.extConn.close();
			self.toggleShareScreen();
		}
		
		//
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
		
		//
		const sourceConf = {
			view     : self.view,
			onselect : sourcesSelected,
		};
		self.sourceSelect = new library.rtc.SourceSelect( sourceConf );
		function sourcesSelected( selected ) {
			self.setMediaSources( selected );
		}
		
		//
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
		
		self.view.addSource( self );
		self.setAudioSink( self.localSettings.preferedDevices );
		self.setupStream( done );
		function done( err, res ) {
			callback( err, res );
			//self.createSource();
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
		self.createSource();
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
	
	/*
	ns.Source.prototype.createSource = function() {
		const self = this;
		console.log( 'createSource', self );
		
		self.proxyMedia
		
		self.session = new library.rtc.Session(
			'source',
			true,
			self.proxy,
			self.stream,
			self.rtcConf,
			null,
			'source',
		);
		if ( self.stream )
			self.session.addTracks();
	}
	*/
	
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
		
		self.proxy = null;
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
		
		if ( self.proxy )
			self.proxy.close();
		
		if ( self.menu ) {
			
		}
		
		self.release(); // clear event emitter
		
		delete self.local;
		delete self.proxy;
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
		
		self.proxy.send({
			type : 'restart',
			data : Date.now(),
		});
	}
	
	// Private
	
	ns.Sink.prototype.init = function( parentSignal ) {
		const self = this;
		self.proxy = new library.component.EventNode(
			self.id,
			parentSignal,
			signalSink,
		);
		
		self.proxy.on( 'source-state', sourceState );
		self.proxy.on( 'stream-state', streamState );
		
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
			signal       : self.proxy,
			rtc          : self.rtcConf,
			//bundlePolicy : 'max-bundle',
		};
		self.session = new library.rtc.Session(
			'sink',
			false,
			self.proxy,
			null,
			self.rtcConf,
			null,
			self.identity.name,
		);
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
