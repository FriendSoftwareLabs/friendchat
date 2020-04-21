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
	
	ns.RTCStream.prototype.close = function() {
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
	ns.RTCStream.prototype.init = function() {
		const self = this;
		if ( 'DESKTOP' != window.View.deviceType )
			self.isMobile = true;
		
		self.isStreamer = self.isSource();
		console.log( 'RTCStream.init - isStreamer', self.isStreamer );
		if ( self.isStreamer )
			self.ui.setStreamerUI();
		else
			self.ui.setUserUI();
		
		self.setupProxy();
		
		self.convertLegacyDevices();
		self.setupUsers();
		self.bindUI();
		//self.bindMenu();
		
		if ( self.quality )
			self.ui.setQuality( self.quality.level );
		
		// ui
		self.ui.addChat(
			self.userId,
			self.identities,
			self.conn
		);
		
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
			if ( self.isStreamer ) {
				console.log( 'SOurce setup' );
				self.ui.addSettings();
				self.initChecks.checkDeviceAccess( self.permissions.send )
					.then( deviceBack )
					.catch( devFail );
			}
			else {
				console.log( 'user setup' );
				//self.updateMenuSendReceive();
				self.allChecksRun = true;
				closeInit();
				if ( self.sourceId )
					self.createSink();
				
				done();
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
			console.log( 'checkSourceReady' );
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
			console.log( 'done' );
			if ( self.isAdmin )
				self.setupAdmin();
			
			self.goLive( true );
		}
	}
	
	ns.RTCStream.prototype.convertLegacyDevices = function() {
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
	
	ns.RTCStream.prototype.bindMenu = function() {
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
	
	ns.RTC.prototype.showSourceSelect = function() {
		const self = this;
		console.log( 'showSourceSelect' );
		self.stream.showSourceSelect();
	}
	
	ns.RTCStream.prototype.bindUI = function() {
		const self = this;
		self.ui.on( 'close', e => self.close());
		self.ui.on( 'device-select', e => self.showSourceSelect());
		self.ui.on( 'use-devices'  , e => self.stream.useDevices( e ));
		self.ui.on( 'share-screen' , e => self.stream.toggleShareScreen());
	}
	
	ns.RTCStream.prototype.handleMute = function( e ) {
		const self = this;
		self.stream.toggleMute();
	}
	
	ns.RTCStream.prototype.handleBlind = function( e ) {
		const self = this;
		self.stream.toggleBlind();
	}
	
	ns.RTCStream.prototype.restartStream = function( e ) {
		const self = this;
		if ( !self.stream )
			return;
		
		self.stream.restart();
	}
	
	ns.RTCStream.prototype.changeUsername = function() {
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
	
	ns.RTCStream.prototype.updateSourceMenu = function() {
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
	
	ns.RTCStream.prototype.handleScreenMode = function() {
		const self = this;
		self.stream.toggleScreenMode();
	}
	
	ns.RTCStream.prototype.updateMenuSendReceive = function( devices ) {
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
	ns.RTCStream.prototype.isSource = function( sourceId ) {
		const self = this;
		const sid = self.sourceId || sourceId;
		console.log( 'isSource', {
			sourceId : sid,
			userId   : self.userId,
		});
		const isSource = sid === self.userId;
		return isSource;
	}
	
	ns.RTCStream.prototype.setupAdmin = function() {
		const self = this;
		console.log( 'setupAdmin' );
	}
	
	ns.RTCStream.prototype.goLive = function( testsPassed ) {
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
	
	ns.RTCStream.prototype.bindConn = function() {
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
	
	ns.RTCStream.prototype.handlePing = function( timestamp ) {
		const self = this;
		const pong = {
			type : 'pong',
			data : timestamp,
		};
		self.conn.send( pong );
	}
	
	ns.RTCStream.prototype.handleIdentity = function( conf ) {
		const self = this;
		self.identities[ conf.userId ] = conf.identity;
		self.updatePeerIdentity( conf.userId, conf.identity );
	}
	
	ns.RTCStream.prototype.handleIdentities = function( identities ) {
		const self = this;
		for ( let idKey in identities ) {
			const id = identities[ idKey ];
			self.identities[ idKey ] = id;
			self.updateUserIdentity( idKey );
		}
	}
	
	ns.RTCStream.prototype.updatePeerIdentity = function( peerId, id ) {
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
	
	ns.RTCStream.prototype.handleSettings = function( update ) {
		const self = this;
		if ( 'isStream' === update.setting )
			self.handleLiveSwitch( update.value );
	}
	
	ns.RTCStream.prototype.handleLiveSwitch = function( isStream ) {
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
	
	ns.RTCStream.prototype.handleSource = function( sourceId ) {
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
	
	ns.RTCStream.prototype.handleQuality = function( quality ) {
		const self = this;
		if ( !self.stream )
			return;
		
		console.log( 'handleQuality', quality );
		//self.source.setRoomQuality( quality );
		
	}
	
	ns.RTCStream.prototype.handleUserJoin = function( user ) {
		const self = this;
		const pId = user.peerId;
		if ( pId === self.userId )
			return;
		
		const id = user.identity;
		if ( id )
			self.identities[ pId ] = id;
		
		user.isHost = false;
		self.addUser( user );
	}
	
	ns.RTCStream.prototype.handleUserLeft = function( user ) {
		const self = this;
		const userId = user.peerId;
		self.closeUser( userId );
	}
	
	ns.RTCStream.prototype.handleClosed = function() {
		const self = this;
		self.close();
	}
	
	ns.RTCStream.prototype.setupUsers = function() {
		const self = this;
		console.log( 'setupUsers', self.peerList );
		if ( !self.peerList )
			return;
		
		self.peerList.forEach( pId => {
			self.createUser( pId );
		});
		self.peerList = [];
	}
	
	ns.RTCStream.prototype.addUser = function( user ) {
		const self = this;
		console.log( 'addUser', user );
		self.createUser( user.peerId );
	}
	
	ns.RTCStream.prototype.createUser = function( userId ) {
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
	
	ns.RTCStream.prototype.updateUserIdentity = function( userId ) {
		const self = this;
		console.log( 'updateUserIdentity', userId );
	}
	
	ns.RTCStream.prototype.getIdentity = function( userId ) {
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
	
	ns.RTCStream.prototype.closeUser = function( userId ) {
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
	
	ns.RTCStream.prototype.createSource = function( callback ) {
		const self = this;
		if ( self.stream )
			self.stream.close();
		
		const identity = self.getIdentity( self.userId );
		console.log( 'createSource', identity );
		const conf = {
			id            : 'stream',
			conn          : self.conn,
			view          : self.ui,
			menu          : self.menu,
			identity      : identity,
			browser       : self.browser,
			permissions   : self.permissions,
			quality       : self.quality,
			localSettings : self.localSettings,
			isAdmin       : null,
			topology      : 'stream',
			proxyConn     : self.proxy,
			rtcConf       : self.rtcConf,
		};
		
		self.stream = new library.rtc.StreamSource(
			conf,
			callback
		);
		
		self.ui.addSource( self.stream );
		
		self.stream.on( 'device-select', e => self.ui.showDeviceSelect( e ));
	}
	
	ns.RTCStream.prototype.createSink = function() {
		const self = this;
		if ( self.stream )
			self.stream.close();
		
		let sourceIdentity = null
		if ( self.sourceId )
			sourceIdentity = self.getIdentity( self.sourceId );
		
		const  conf = {
			id            : 'stream', //self.userId,
			conn          : self.conn,
			view          : self.ui,
			menu          : self.menu,
			identity      : sourceIdentity,
			localSettings : self.localSettings,
			proxyConn     : self.proxy,
			rtcConf       : self.rtcConf,
		};
		
		self.stream = new library.rtc.Sink( conf );
		self.ui.addSink( self.stream );
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
	ns.StreamSource = function(
		conf,
		callback
	) {
		const self = this;
		console.log( 'StreamSource', {
			conf     : conf,
			callback : callback,
		});
		
		library.rtc.Selfie.call( self, conf, callback );
		self.screenMode = 'contain';
		
		//self.init( conn, callback );
	}
	
	ns.StreamSource.prototype = Object.create( library.rtc.Selfie.prototype );
	
	// Public
	
	ns.StreamSource.prototype.restart = function() {
		const self = this;
		if ( self.session )
			self.closeSession();
		
		self.proxy.send({
			type : 'restart',
			data : Date.now(),
		});
	}
	
	// Private
	
	ns.StreamSource.prototype.init = function() {
		const self = this;
		const ignoreSysMute = self.localSettings[ 'ignore-system-mute' ];
		if ( ignoreSysMute )
			self.ignoreSystemMute = ignoreSysMute;
		
		//
		console.log( 'StreamSource.init', self.id );
		self.proxy = new library.component.EventNode(
			self.id,
			self.proxyConn,
			proxySink,
			null,
		);
		
		function proxySink( type, event ) {
			console.log( 'Source.proxy.eventsink', [
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
		//self.bindMenu();
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
	
	ns.StreamSource.prototype.bindVolume = function() {
		const self = this;
		//////
	}
	
	ns.StreamSource.prototype.saveLocalSetting = function( setting, value ) {
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
	
	ns.StreamSource.prototype.clearStream = function() {
		const self = this;
		if ( !self.stream )
			return;
		
		const tracks = self.stream.getTracks();
		tracks.forEach( stop );
		self.stream = null;
		self.emit( 'stream', null );
		
		function stop( track ) {
			self.stream.removeTrack( track );
			track.stop();
		}
	}
	
	ns.StreamSource.prototype.handleJoined = function( e ) {
		const self = this;
		self.createSource();
	}
	
	ns.StreamSource.prototype.handleRestart = function( e ) {
		const self = this;
		console.log( 'handleRestart', e );
	}
	
	ns.StreamSource.prototype.handleStreamState = function( webRTCisUP ) {
		const self = this;
		console.log( 'source.handleStreamState', webRTCisUP );
		if ( !webRTCisUP )
			self.restart();
	}
	
	ns.StreamSource.prototype.handleClientState = function( state ) {
		const self = this;
		self.emit( 'client-state', state );
	}
	
	ns.StreamSource.prototype.toggleScreenMode = function( mode ) {
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
	ns.StreamSource.prototype.createSource = function() {
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
	
	ns.StreamSource.prototype.closeSession = function() {
		const self = this;
		if ( !self.session )
			return;
		
		self.session.close();
		delete self.session;
	}
	
})( library.rtc );


// Sink
(function( ns, undefined ) {
	ns.Sink = function( conf ) {
		const self = this;
		console.log( 'Sink', conf );
		library.component.EventEmitter.call( self );
		
		self.id = conf.id;
		self.local = conf.conn;
		self.proxyConn = conf.proxyConn;
		self.view = conf.view;
		self.menu = conf.menu;
		self.identity = conf.identity;
		self.localSettings = conf.localSettings;
		self.rtcConf = conf.rtcConf;
		
		self.proxy = null;
		self.session = null;
		self.remoteMedia = null;
		self.isStreaming = true;
		self.screenMode = 'contain';
		
		self.isMute = false;
		self.isBlind = false;
		self.receiving = {
			audio : false,
			video : false,
		};
		
		self.init();
	}
	
	ns.Sink.prototype = Object.create( library.component.EventEmitter.prototype )
	
	// Public
	
	ns.Sink.prototype.close = function() {
		const self = this;
		self.view.removeStream( self.id );
		if ( self.session )
			self.session.close();
		
		if ( self.remoteMedia )
			self.stopStream();
		
		if ( self.proxy )
			self.proxy.close();
		
		if ( self.menu ) {
			
		}
		
		self.release(); // clear event emitter
		
		delete self.local;
		delete self.proxy;
		delete self.remoteMedia;
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
	
	ns.Sink.prototype.init = function() {
		const self = this;
		self.proxy = new library.component.EventNode(
			self.id,
			self.proxyConn,
			signalSink,
			null,
			true
		);
		
		self.proxy.on( 'source-state', sourceState );
		self.proxy.on( 'stream-state', streamState );
		
		function sourceState( e ) { self.handleSourceState( e ); }
		function streamState( e ) { self.handleStreamState( e ); }
		function signalSink( type, event ) {
			console.log( 'Sink.proxy.eventSink', [
				type,
				event,
			]);
		}
		
		//self.bindMenu();
		self.setupSession();
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
		self.conn.send( sett );
	}
	
	ns.Sink.prototype.setupSession = function() {
		const self = this;
		console.log( 'setupSession - rtcConf', self.rtcConf );
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
		
		self.session.on( 'track-add', e => self.handleTrack( e ));
		self.session.on( 'stats', e => self.handleStats( e ));
	}
	
	ns.Sink.prototype.handleStats = function( stats ) {
		const self = this;
		console.log( 'Sink.handleStats', stats );
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
		console.log( 'handleTrack', track );
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
		
		//self.emitStreamState( 'nominal' );
		
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
	
	ns.Sink.prototype.stopStream = function() {
		const self = this;
		if ( !self.remoteMedia )
			return;
		
		let tracks = self.remoteMedia.getTracks();
		tracks.forEach( track => {
			self.remoteMedia.removeTrack( track );
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
		
		console.log( 'Sink.handleStreamState', webRTCisUP  );
		let state = {
			type : 'stream',
			data : webRTCisUP,
		};
		self.emit( 'stream-state', state );
	}
	
	ns.Sink.prototype.handleSourceState = function( isStreaming ) {
		const self = this;
		console.log( 'handleSourceState', isStreaming );
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
		console.trace( 'toggleMute', self.isMute );
		self.emit( 'mute', self.isMute );
		return self.isMute;
	}
	
	ns.Sink.prototype.toggleBlind = function( force ) {
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
	
	ns.Sink.prototype.getAudioTrack = function() {
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
	
	ns.Sink.prototype.getVideoTrack = function() {
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
	
})( library.rtc );
