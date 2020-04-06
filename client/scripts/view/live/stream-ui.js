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

library.view = library.view || {};
library.component = library.component || {};

(function( ns, undefined ) {
	ns.UIStream = function( conn, liveConf, localSettings ) {
		const self = this;
		
		console.log( 'UIStream - liveConf', liveConf );
		self.sourceId = liveConf.rtcConf.sourceId;
		self.roomName = liveConf.roomName;
		self.logTail = liveConf.logTail;
		
		self.currentQuality = null;
		self.users = {};
		self.userList = null;
		
		self.resizeWait = null;
		self.doOneMoreResize = false;
		self.showUserStuff = false;
		
		library.view.UI.call( self, conn, liveConf, localSettings );
	}
	
	ns.UIStream.prototype = Object.create( library.view.UI.prototype );
	
	// Public
	
	ns.UIStream.prototype.close = function() {
		const self = this;
		delete self.conn;
		delete self.userId;
		delete self.localSettings;
	}
	
	ns.UIStream.prototype.showMenu = function() {
		const self = this;
		self.menuUI.show();
	}
	
	ns.UIStream.prototype.setAudioSink = function( deviceId ) {
		const self = this;
		self.audioSinkId = deviceId;
		return;
		
		const pids = Object.keys( self.peers );
		pids.forEach( setSinkId );
		function setSinkId( peerId ) {
			let peer = self.peers[ peerId ];
			peer.setAudioSink( self.audioSinkId );
		}
	}
	
	ns.UIStream.prototype.setQuality = function( qualityLevel ) {
		const self = this;
		self.currentQuality = qualityLevel;
	}
	
	ns.UIStream.prototype.addChat = function( userId, identities, conn ) {
		const self = this;
		self.chatTease = new library.component.ChatTease(
			'tease-chat-container',
			hello.template
		);
		
		self.chatTease.on( 'show-chat', showChat );
		function showChat( e ) {
			self.handleUserStuffClick();
		}
		
		const chatConf = {
			containerId : 'chat-container',
			conn        : conn,
			userId      : userId,
			identities  : identities,
			chatTease   : self.chatTease,
			guestAvatar : self.guestAvatar,
			roomName    : self.roomName,
			logTail     : self.logTail,
		};
		console.log( 'UIStream.addChat - chatConf', chatConf );
		self.chat = new library.component.LiveChat( chatConf, hello.template, self.chatTease );
		self.updateShowUserStuff();
		return self.chat;
	}
	
	ns.UIStream.prototype.addExtConnPane = function( onshare ) {
		const self = this;
		const conf = {
			onshare : onshare,
		};
		self.extConnUI = self.addUIPane( 'ext-connect', conf );
		return self.extConnUI;
	}
	
	ns.UIStream.prototype.addUser = function( user ) {
		const self = this;
		const userUI = new library.view.UserUI(
			user,
			self.userList,
		);
		self.users[ user.id ] = userUI;
		
	}
	
	ns.UIStream.prototype.addSource = function( source ) {
		const self = this;
		//self.setStreamerUI();
		self.waiting.classList.toggle( 'hidden', true );
		if ( null == self.localSettings[ 'ui-user-stuff' ] ) {
			self.showUserStuff = true;
			self.updateShowUserStuff();
		}
		
		self.stream = new library.view.SourceUI(
			'stream-element-container',
			source,
			self.uiMuteBtn,
			self.uiBlindBtn
		);
		source.on( 'client-state', clientState );
		function clientState( e ) { self.updateClientState( e ); }
	}
	
	ns.UIStream.prototype.addSink = function( sink ) {
		const self = this;
		//self.setUserUI();
		self.waiting.classList.toggle( 'hidden', true );
		self.stream = new library.view.SinkUI( 
			'stream-element-container',
			sink,
			self.uiMuteBtn,
			self.uiBlindBtn
		);
	}
	
	ns.UIStream.prototype.removeStream = function( sinkId ) {
		const self = this;
		if ( !self.stream )
			return;
		
		self.stream.close();
		delete self.stream;
		self.waiting.classList.toggle( 'hidden', false );
	}
	
	ns.UIStream.prototype.saveLocalSetting = function( setting, value ) {
		const self = this;
		const save = {
			type : 'local-setting',
			data : {
				setting : setting,
				value   : value,
			},
		};
		self.conn.send( save );
	}
	
	// Private
	
	ns.UIStream.prototype.init = function() {
		const self = this;
		self.uiPaneMap = {
			'init-checks'        : library.view.InitChecksPane      ,
			'source-select'      : library.view.SourceSelectPane    ,
			'change-username'    : library.view.ChangeUsernamePane  ,
			'live-stream-switch' : library.view.LiveStreamSwitchPane,
			'ext-connect'        : library.view.ExtConnectPane      ,
			'settings'           : library.view.SettingsPane        ,
			'share'              : library.view.SharePane           ,
			'menu'               : library.view.MenuPane            ,
		};
		
		const usersConf = {
			containerId : 'user-container',
			id          : 'users-list',
			label       : View.i18n( 'i18n_stream_users_list' ),
			faIcon      : 'fa-users',
			ontoggle    : usersListToggled,
			state       : self.localSettings.streamUserListState,
			userId      : self.userId,
		};
		if ( self.sourceId === self.userId )
			self.userList = new library.component.StreamUserList( usersConf );
		else
			self.userList = new library.component.UIList( usersConf );
		
		function usersListToggled( state ) {
			self.reflow();
			self.conn.send({
				type : 'local-setting',
				data : {
					setting : 'streamUserListState',
					value   : state,
				},
			});
		}
		
		window.addEventListener( 'resize', handleResize, false );
		function handleResize( e ) {
			self.handleResize( e );
		}
		
		self.bindUI();
		self.uiVisible = true;
		self.toggleUI();
	}
	
	ns.UIStream.prototype.updateClientState = function( user ) {
		const self = this;
		self.userList.updateConnected( user.clientId, user.state );
	}
	
	ns.UIStream.prototype.handleResize = function( e ) {
		var self = this;
		if ( !self.stream )
			return true;
		
		if ( self.resizeWait ) {
			self.doOneMoreResize = true;
			return true;
		}
		
		self.doOneMoreResize = false;
		self.stream.doResize();
		self.resizeWait = setTimeout( resizeThrottle, 50 );
		
		function resizeThrottle() {
			self.resizeWait = null;
			if ( self.doOneMoreResize )
				self.handleResize();
		}
	}
	
	ns.UIStream.prototype.bindUI = function() {
		const self = this;
		self.peerContainer = document.getElementById( self.peerContainerId );
		
		// ui
		self.live = document.getElementById( 'live' );
		self.streamContainer = document.getElementById( 'stream-container' );
		self.streamEl = document.getElementById( 'stream-element-container' );
		self.waiting = document.getElementById( 'waiting-for-container' );
		self.waitingFritz = document.getElementById( 'waiting-for-stream-fritz' );
		self.waitingDots = document.getElementById( 'waiting-for-stream-dots' );
		self.ui = document.getElementById( 'stream-ui' );
		self.uiPaneContainer = document.getElementById( 'live-ui-panes' );
		
		document.addEventListener( 'mouseleave', catchLeave, false );
		document.addEventListener( 'mouseenter', catchEnter, false );
		document.addEventListener( 'mousemove', mouseMoved, false );
		
		window.addEventListener( 'resize', handleResize, false );
		self.streamContainer.addEventListener( 'click', contentClick, false );
		self.ui.addEventListener( 'transitionend', uiTransitionEnd, false );
		
		function catchEnter( e ) { self.handleViewOver( true ); }
		function catchLeave( e ) { self.handleViewOver( false ); }
		function mouseMoved( e ) {
			// one time check to see if pointer is over view on startup
			//self.toggleUI( true );
			document.removeEventListener( 'mousemove', mouseMoved, false );
		}
		
		function contentClick( e ) { self.toggleUIMode(); }
		function uiTransitionEnd( e ) { self.uiTransitionEnd( e ); }
		function handleResize( e ) { self.handleResize( e ); }
	}
	
	ns.UIStream.prototype.setStreamerUI = function() {
		const self = this;
		console.log( 'setStreamerUI' );
		const container = self.ui;
		const el = hello.template.getElement( 'source-bar-tmpl', {});
		container.appendChild( el );
		
		self.bindBarCommon();
		self.uiShareScreenBtn = document.getElementById( 'share-screen-btn' );
		self.uiShareScreenBtn.addEventListener( 'click', shareScreenClick, false );
		self.applyLocalSettings();
		
		function shareScreenClick( e ) { self.stream.shareScreen(); }
	}
	
	ns.UIStream.prototype.setUserUI = function() {
		const self = this;
		console.log( 'setUserUI' );
		const container = self.ui;
		const el = hello.template.getElement( 'sink-bar-tmpl', {});
		container.appendChild( el );
		
		self.bindBarCommon();
		self.applyLocalSettings();
		
		self.uiFullscreenBtn = document.getElementById( 'fullscreen-btn' );		
		self.uiFullscreenBtn.addEventListener( 'click', fullscreenClick, false );
		function fullscreenClick( e ) { self.handleFullscreenClick( e ); }
	}
	
	ns.UIStream.prototype.bindBarCommon = function() {
		const self = this;
		//self.uiMenuBtn = document.getElementById( 'show-menu-btn' );
		self.uiLeaveBtn = document.getElementById( 'leave-stream-btn' );
		
		self.uiMuteBtn = document.getElementById( 'audio-toggle-btn' );
		self.uiBlindBtn = document.getElementById( 'video-toggle-btn' );
		
		self.uiMuteBtn.addEventListener( 'click', muteClick, false );
		self.uiBlindBtn.addEventListener( 'click', blindClick, false );
		
		self.shareLinkBtn = document.getElementById( 'share-link-btn' );
		self.settingsBtn = document.getElementById( 'settings-btn' );
		self.userStuffEl = document.getElementById( 'user-stuff' );
		
		//self.uiMenuBtn.addEventListener( 'click', menuClick, false );
		self.uiLeaveBtn.addEventListener( 'click', leaveClick, false );
		//self.shareLinkBtn.addEventListener( 'click', shareClick, false );
		
		self.shareUI = self.addShareLink( self.conn );
		if ( self.isTempRoom )
			self.shareUI.show();
		
		//function menuClick( e ) { self.showMenu(); }
		function leaveClick( e ) { self.leave(); }
		//function shareClik( e ) { self.toggleShare(); }
		function muteClick( e ) { self.stream.toggleMute(); }
		function blindClick( e ) { self.stream.toggleBlind(); }
	}
	
	ns.UIStream.prototype.leave = function() {
		const self = this;
		console.log( 'UIStream.leave' );
		self.emit( 'close' );
	}
	
	ns.UIStream.prototype.applyLocalSettings = function() {
		const self = this;
		// userlist / chat
		let userStuff = self.localSettings[ 'ui-user-stuff' ];
		self.showUserStuff = ( null != userStuff ) ? userStuff : self.showUserStuff;
		self.updateShowUserStuff();
		
		// clean ui
		let uiVisible = self.localSettings[ 'ui-visible' ];
		self.uiVisible = ( null != uiVisible ) ? uiVisible : true;
		self.toggleUI();
	}
	
	ns.UIStream.prototype.toggleUIMode = function() {
		const self = this;
		self.uiVisible = !self.uiVisible;
		self.saveLocalSetting( 'ui-visible', self.uiVisible );
		self.toggleUI();
	}
	
	ns.UIStream.prototype.handleUserStuffClick = function( e ) {
		const self = this;
		self.showUserStuff = !self.showUserStuff;
		self.saveLocalSetting( 'ui-user-stuff', self.showUserStuff );
		self.updateShowUserStuff();
	}
	
	ns.UIStream.prototype.updateShowUserStuff = function() {
		const self = this;
		console.log( 'updateShowUserStuff', self.userStuffEl );
		if ( self.chatTease )
			self.chatTease.setActive( self.showUserStuff );
		
		if ( self.menu )
			self.menu.setState( 'chat', self.showUserStuff );
		
		self.userStuffEl.classList.toggle( 'hidden', !self.showUserStuff );
		if ( self.shareUI )
			self.shareUI.updatePosition();
		if ( self.settingsUI )
			self.settingsUI.updatePosition();
		
		self.reflow();
	}
	
	ns.UIStream.prototype.handleFullscreenClick = function( e ) {
		const self = this;
		View.toggleFullscreen();
		self.reflow();
	}
	
	ns.UIStream.prototype.reflow = function() {
		const self = this;
		if ( !self.stream )
			return;
		
		self.stream.reflow();
	}
	
	ns.UIStream.prototype.buildMenu = function() {
		const self = this;
		const quality = {
			type   : 'folder',
			id     : 'quality',
			name   : View.i18n( 'i18n_stream_quality' ),
			faIcon : 'fa-tachometer',
			items  : [
				{
					type   : 'item',
					id     : 'q-default',
					name   : View.i18n( 'i18n_unconstrained' ),
					faIcon : 'fa-diamond',
				},
				{
					type   : 'item',
					id     : 'q-normal',
					name   : View.i18n( 'i18n_normal' ),
					faIcon : 'fa-eye',
				},
				{
					type   : 'item',
					id     : 'q-medium',
					name   : View.i18n('i18n_medium'),
					faIcon : 'fa-cubes',
				},
				{
					type   : 'item',
					id     : 'q-low',
					name   : View.i18n('i18n_low'),
					faIcon : 'fa-cube',
				},
			],
		};
		const mute = {
			type   : 'item',
			id     : 'mute',
			name   : View.i18n('i18n_mute_your_audio'),
			faIcon : 'fa-microphone-slash',
			toggle : false,
			close  : false,
		};
		const blind = {
			type   : 'item',
			id     : 'blind',
			name   : View.i18n('i18n_pause_your_video'),
			faIcon : 'fa-eye-slash',
			toggle : false,
			close  : false,
		};
		const screenShare = {
			type    : 'item',
			id      : 'toggle-screen-share',
			name    : View.i18n( 'i18n_toggle_share_screen' ),
			faIcon  : 'fa-laptop',
			toggle  : false,
			close   : true,
			disable : true,
		};
		const screenShareExt = {
			type    : 'item',
			id      : 'screen-share-ext',
			name    : View.i18n( 'i18n_get_screenshare_ext' ),
			faIcon  : 'fa-download',
			disable : true,
		};
		const source = {
			type   : 'item',
			id     : 'source-select',
			name   : View.i18n( 'i18n_select_media_sources' ),
			faIcon : 'fa-random',
		};
		const chat = {
			type   : 'item',
			id     : 'chat',
			name   : View.i18n( 'i18n_text_chat' ),
			faIcon : 'fa-keyboard-o',
			toggle : self.showUserStuff,
			close  : true,
		};
		const restart = {
			type   : 'item',
			id     : 'restart',
			name   : View.i18n( 'i18n_restart_stream' ),
			faIcon : 'fa-recycle',
		};
		const screenMode = {
			type   : 'item',
			id     : 'screen-mode',
			name   : View.i18n( 'i18n_toggle_cover_contain' ),
			faIcon : 'fa-arrows-alt',
			toggle : false,
			close  : false,
		};
		const fullscreen = {
			type   : 'item',
			id     : 'fullscreen',
			name   : View.i18n( 'i18n_toggle_fullscreen' ),
			faIcon : 'fa-tv',
			toggle : false,
		};
		const settings = {
			type    : 'item',
			id      : 'settings',
			name    : View.i18n( 'i18n_room_settings' ),
			faIcon  : 'fa-ellipsis-v',
			disable : true,
		};
		const share = {
			type   : 'item',
			id     : 'share',
			name   : View.i18n( 'i18n_share' ),
			faIcon : 'fa-share-alt',
		};
		const sendReceive = {
			type : 'folder',
			id : 'send-receive',
			name : View.i18n( 'Send / Receive media' ),
			faIcon : 'fa-exchange',
			items : [
				{
					type : 'item',
					id : 'send-audio',
					name : View.i18n( 'i18n_menu_send_audio' ),
					faIcon : 'fa-microphone',
					toggle : true,
					close : false,
				},
				{
					type : 'item',
					id : 'send-video',
					name : View.i18n( 'i18n_menu_send_video' ),
					faIcon : 'fa-video-camera',
					toggle : true,
					close : false,
				},
				{
					type   : 'item',
					id     : 'receive-audio',
					name   : View.i18n( 'i18n_menu_receive_audio' ),
					faIcon : 'fa-volume-up',
					toggle : true,
					close  : false,
				},
				{
					type   : 'item',
					id     : 'receive-video',
					name   : View.i18n( 'i18n_menu_receive_video' ),
					faIcon : 'fa-film',
					toggle : true,
					close  : false,
				},
			],
		};
		const username = {
			type : 'item',
			id : 'change-username',
			name : View.i18n( 'i18n_change_username' ),
			faIcon : 'fa-id-card-o',
		};
		const cleanUI = {
			type   : 'item',
			id     : 'clean-ui',
			name   : View.i18n( 'i18n_clean_ui' ),
			faIcon : 'fa-square-o',
			toggle : false,
			close  : false,
		};
		const leave = {
			type   : 'item',
			id     : 'leave',
			name   : View.i18n( 'i18n_leave' ),
			faIcon : 'fa-sign-out',
		};
		
		const content = [
			share,
			chat,
			blind,
			mute,
			//quality,
			restart,
			fullscreen,
			screenShare,
			screenShareExt,
			source,
			sendReceive,
			screenMode,
			//settings,
			username,
			cleanUI,
			leave,
		];
		
		const conf = {
			menuConf : {
				content      : content,
				onnolistener : noListenerFor,
			},
		};
		self.menuUI = self.addUIPane( 'menu', conf );
		self.menu = self.menuUI.getMenu();
		self.menu.on( 'share', shareHandler );
		self.menu.on( 'chat', chatHandler );
		self.menu.on( 'clean-ui', cleanUIHandler );
		self.menu.on( 'fullscreen', toggleFullscreen );
		return self.menu;
		
		function noListenerFor( e ) {
			console.log( 'menu - noListenerFor', e );
		}
		
		function shareHandler( state ) {
			if ( !self.shareUI )
				return;
			
			self.shareUI.toggle();
		}
		
		function chatHandler( state ) {
			self.handleUserStuffClick();
		}
		
		function cleanUIHandler( state ) {
			self.toggleUIMode();
		}
		
		function toggleFullscreen() {
			View.toggleFullscreen();
		}
	}
	
	ns.UIStream.prototype.removeUser = function( userId ) {
		const self = this;
		let user = self.users[ userId ];
		if ( !user )
			return;
		
		user.close();
		delete self.users[ userId ];
	}
	
	ns.UIStream.prototype.setSource = function( source ) {
		const self = this;
		console.log( 'ui.setSource - NYI', source );
	}
	
	ns.UIStream.prototype.clearSource = function() {
		const self = this;
		console.log( 'ui.clearSource - NYI', self.source );
	}
	
})( library.view );


// UserUI
(function( ns, undefined ) {
	ns.UserUI = function( user, userList ) {
		const self = this;
		self.user = user;
		self.userList = userList;
		
		self.init();
	}
	
	// Public
	
	ns.UserUI.prototype.close = function() {
		const self = this;
		if ( self.userList )
			self.userList.remove( self.el.id );
		
		if ( self.user )
			self.user.release( 'identity' );
		
		delete self.userList;
		delete self.user;
		delete self.el;
	}
	
	// Private
	
	ns.UserUI.prototype.init = function() {
		const self = this;
		let id = self.user.identity;
		const conf = {
			userId : self.user.id,
			name   : id.liveName || id.name,
			avatar : id.avatar,
		};
		self.el = hello.template.getElement( 'live-stream-user-tmpl', conf );
		self.userList.add( self.el, id.name );
		
		self.user.on( 'identity', identity );
		function identity( e ) { self.handleUpdateIdentity( e ); }
	}
	
	ns.UserUI.prototype.handleUpdateIdentity = function( identity ) {
		const self = this;
		let nameEl = self.el.querySelector( '.name' );
		let id = self.user.identity;
		let name = id.liveName || id.name;
		nameEl.textContent = name;
	}
	
})( library.view );

// MediaUI

(function( ns, undefined ) {
	ns.MediaUI = function(
		source,
		muteBtn,
		blindBtn
	) {
		const self = this;
		self.source = source;
		self.muteBtn = muteBtn;
		self.blindBtn = blindBtn;
		
		self.setupMedia();
	}
	
	// Public
	
	ns.MediaUI.prototype.close = function() {
		const self = this;
		self.closeMedia();
	}
	
	// Private
	
	ns.MediaUI.prototype.setupMedia = function() {
		const self = this;
		self.source.on( 'media'     , e => self.handleMedia( e ));
		self.source.on( 'track'     , ( ty, tr ) => self.handleTrack( ty, tr ));
		self.source.on( 'mute'      , e => self.handleMute( e ));
		self.source.on( 'blind'     , e => self.handleBlind( e ));
		self.source.on( 'screenmode', e => self.doResize( e ));
		self.source.on( 'audio'     , e => self.handleHasAudio( e ));
		self.source.on( 'video'     , e => self.handleHasVideo( e ));
		
		//self.muteBtn.addEventListener( 'click', muteClick, false );
		//self.blindBtn.addEventListener( 'click', blindClick, false );
		
		function muteClick( e ) {
			self.source.toggleMute();
		}
		
		function blindClick( e ) {
			self.source.toggleBlind();
		}
	}
	
	ns.MediaUI.prototype.closeMedia = function() {
		const self = this;
		self.source.release( 'mute' );
		self.source.release( 'blind' );
		self.source.release( 'screenmode' );
		delete self.source;
		delete self.avatar;
		delete self.ui;
	}
	
	ns.MediaUI.prototype.bindStreamResize = function() {
		const self = this;
		self.videoResizeListener = videoResize;
		self.stream.addEventListener( 'resize', self.videoResizeListener, false );
		self.doResize();
		function videoResize( e ) {
			let width = e.target.clientWidth;
			let height = e.target.clientHeight;
			let aspectRatio = width / height;
			
			if ( !aspectRatio )
				return;
			
			self.videoAspect = aspectRatio;
			self.doResize();
		}
	}
	
	ns.MediaUI.prototype.doResize = function() {
		const self = this;
		if ( !self.stream )
			return;
		
		const container = document.getElementById( 'source-media-container' );
		let width = container.scrollWidth;
		let height = container.scrollHeight;
		let containerAspect = width / height;
		if ( containerAspect < self.videoAspect )
			toggleUseWidth( true );
		else
			toggleUseWidth( false );
			
		function toggleUseWidth( useWidth ) {
			if ( !self.stream )
				return;
			
			//self.toggleElementClass( self.avatar, 'fade', !self.useCoverMode );
			/*
			if ( !self.useCoverMode ) {
				toggle( 'width', false );
				toggle( 'height', false );
				return;
			}
			*/
			
			if ( 'contain' === self.source.screenMode )
				useWidth = !useWidth;
			
			toggle( 'width', useWidth );
			toggle( 'height', !useWidth );
			
			function toggle( classStr, set ) {
				self.stream.classList.toggle( classStr, set );
			}
		}
	}
	
	ns.MediaUI.prototype.reflow = function() {
		const self = this;
		if ( !self.stream )
			return;
		
		let resize = new Event( 'resize' );
		self.stream.dispatchEvent( resize );
	}
	
	ns.MediaUI.prototype.toggleElementClass = function( element, className, set ) {
		const self = this;
		element.classList.toggle( className, set );
	}
	
	ns.MediaUI.prototype.toggleMute = function() {
		const self = this;
		console.log( 'toggleMute' );
		self.source.toggleMute();
	}
	
	ns.MediaUI.prototype.toggleBlind = function() {
		const self = this;
		self.source.toggleBlind();
	}
	
	ns.MediaUI.prototype.handleMedia = function( media ) {
		const self = this;
		console.log( 'MediaUI.handleMedia', media );
		if ( !media )
			return;
		
		const mId = media.id;
		if ( !self.stream )
			self.setStream( mId );
		
		self.stream.pause();
		let currMedia = self.stream.srcObject;
		if ( !currMedia ) {
			self.stream.srcObject = media;
			self.stream.load();
			return;
		}
		
		if ( currMedia.id == mId ) {
			self.stream.load();
			return;
		}
		
		const currTracks = currMedia.getTracks();
		currTracks.forEach( t => {
			currMedia.removeTrack( t );
		});
		self.stream.load();
		self.stream.srcObject = media;
		//self.bindStream();
		//self.updateAudioSink();
		self.stream.load();
	}
	
	
	ns.MediaUI.prototype.setStream = function( id, src ) {
		const self = this;
		if ( self.stream )
			self.removeStream();
		
		src = src || '';
		const conf = {
			id : id,
			src : src,
		};
		
		let container = document.getElementById( 'source-media-container' );
		self.stream = hello.template.getElement( 'stream-video-tmpl', conf );
		self.stream.onloadedmetadata = play;
		
		container.appendChild( self.stream );
		//self.toggleSpinner( false );
		self.bindStreamResize();
		
		function play( e ) {
			console.log( 'PLAY', e );
			self.updateAudioSink();
			self.playStream();
		}
	}
	
	ns.MediaUI.prototype.playStream = function() {
		const self = this;
		if ( !self.stream )
			return;
		
		self.stream.play()
			.then( playOk )
			.catch( playErr );
			
		function playOk( e ) {
			console.log( 'Peer.playStream - ok', e );
		}
		
		function playErr( ex ) {
			console.log( 'Peer.playStream - ex', {
				stream : self.stream,
				ex     : ex,
			});
		}
	}
	
	ns.MediaUI.prototype.removeStream = function() {
		const self = this;
		if ( !self.stream )
			return;
		
		self.unbindStream();
		if ( self.stream.pause )
			self.stream.pause();
		
		let srcObj = self.stream.srcObject;
		if ( srcObj )
			clear( srcObj );
		
		self.stream.srcObject = null;
		self.stream.src = '';
		self.stream.removeEventListener( 'resize', self.videoResizeListener );
		self.stream.onloadedmetadata = null;
		
		if ( self.stream.load )
			self.stream.load();
		
		self.videoResizeListener = null;
		
		if ( !self.stream.parentNode ) {
			console.log( 'removeStream - parent node not found', self.stream.parentNode );
			self.stream = null;
			return;
		}
		
		self.stream.parentNode.removeChild( self.stream );
		self.stream = null;
		self.toggleVideo( false );
		
		function clear( src ) {
			if ( !src.getTracks )
				return;
			
			let tracks = src.getTracks();
			tracks.forEach( remove );
			function remove( track ) {
				track.stop();
				src.removeTrack( track );
			}
		}
	}
	
	ns.MediaUI.prototype.unbindStream = function() {
		const self = this;
		if ( !self.stream )
			return;
		
	}
	
	
	ns.MediaUI.prototype.handleTrack = function( type, track ) {
		const self = this;
		console.log( 'MediaUI.handleTrack', {
			self  : self,
			type  : type,
			track : track,
		});
		// set state
		if ( !self.isUpdatingStream ) {
			self.stream.pause();
			self.isUpdatingStream = true;
		}
		
		//
		self.removeTrack( type );
		if ( null == track ) {
			self.stream.load();
			return;
		}
		
		self.stream.srcObject.addTrack( track );
		self.stream.load();
		console.log( 'stream.load called' );
	}
	
	ns.MediaUI.prototype.removeTrack = function( type ) {
		const self = this;
		if ( !self.stream )
			return;
		
		const srcObj = self.stream.srcObject;
		let removed = false;
		if ( !srcObj )
			return false;
		
		let tracks = srcObj.getTracks();
		tracks.forEach( removeType );
		return removed;
		
		function removeType( track ) {
			if ( type !== track.kind )
				return;
			
			srcObj.removeTrack( track );
			track.stop();
			removed = true;
		}
	}
	
	ns.MediaUI.prototype.updateAudioSink = function() {
		const self = this;
		const deviceId = self.audioSinkId || '';
		if ( !self.stream ) {
			self.audioSinkId = deviceId;
			console.log( 'setAudioSink - no stream' );
			return;
		}
		
		if ( !self.stream.setSinkId ) {
			console.log( 'setAudioSink - setSinkId is not supported' );
			return;
		}
		
		if ( !self.isAudio )
			return;
		
		/*
		if ( self.stream.sinkId === deviceId ) {
			console.log( 'setAudioSink - this deviceId is already set', deviceId );
			return;
		}
		*/
		
		self.stream.setSinkId( deviceId )
			.then( ok )
			.catch( fail );
			
		function ok() {
			self.audioSinkId = deviceId;
		}
		
		function fail( err ) {
			console.log( 'failed to set audio sink', {
				err : err,
				did : deviceId,
			});
			self.audioSinkId = null;
			const status = {
				type    : 'warning',
				message : 'WARN_AUDIO_SINK_NOT_ALLOWED',
				events  : [ 'close' ],
			};
			self.emit( 'status', status );
		}
	}
	
	ns.MediaUI.prototype.switchIcon = function( el, from, to ) {
		const self = this;
		el.classList.toggle( from, false );
		el.classList.toggle( to, true );
	}
	
	ns.MediaUI.prototype.toggleVideo = function( hasVideo ) {
		const self = this;
		self.avatar.classList.toggle( 'hidden', hasVideo );
		if ( self.stream )
			self.stream.classList.toggle( 'hidden', !hasVideo )
	}
	
})( library.view );


// SourceUI
(function( ns, undefined ) {
	ns.SourceUI = function(
		containerId,
		source,
		muteBtn,
		blindBtn
	) {
		const self = this;
		ns.MediaUI.call( self,
			source,
			muteBtn,
			blindBtn
		);
		
		self.init( containerId );
	}
	
	ns.SourceUI.prototype = Object.create( ns.MediaUI.prototype );
	
	// Public
	
	ns.SourceUI.prototype.shareScreen = function() {
		const self = this;
		self.source.toggleShareScreen();
	}
	
	ns.SourceUI.prototype.close = function() {
		const self = this;
		self.closeMedia();
		delete self.el;
	}
	
	// Private
	
	ns.SourceUI.prototype.init = function( containerId ) {
		const self = this;
		// main element
		const container = document.getElementById( containerId );
		let avatar = '';
		if ( self.source && self.source.identity )
			avatar = self.source.identity.avatar;
			
		const sourceConf = {
			avatar : avatar,
		};
		self.el = hello.template.getElement( 'live-stream-source-tmpl', sourceConf )
		container.appendChild( self.el );
		
		self.avatar = document.getElementById( 'source-avatar' );
		self.ui = document.getElementById( 'source-ui' );
		
		self.source.on( 'selfie', media );
		function media( e ) { self.handleSelfie( e ); }
		
	}
	
	ns.SourceUI.prototype.handleSelfie = function( media ) {
		const self = this;
		self.handleMedia( media );
		self.stream.muted = true;
	}
	
	ns.SourceUI.prototype.handleMute = function( isMute ) {
		const self = this;
		console.log( 'SourceUI.handleMute', isMute );
		self.isMute = isMute;
		self.muteBtn.classList.toggle( 'danger', isMute );
		if ( isMute )
			self.switchIcon( self.muteBtn.children[ 0 ], 'fa-microphone', 'fa-microphone-slash' );
		else
			self.switchIcon( self.muteBtn.children[ 0 ], 'fa-microphone-slash', 'fa-microphone' );
	}
	
	ns.SourceUI.prototype.handleBlind = function( isBlind ) {
		const self = this;
		console.log( 'SourceUI.handleBLind', isBlind );
		self.isBlind = isBlind;
		self.blindBtn.classList.toggle( 'danger', isBlind );
	}
	
	ns.SourceUI.prototype.handleHasAudio = function( hasAudio ) {
		const self = this;
		console.log( 'SourceUI.handleHasAudio', hasAudio );
	}
	
	ns.SourceUI.prototype.handleHasVideo = function( hasVideo ) {
		const self = this;
		console.log( 'SourceUI.handleHasVideo', hasVideo );
		self.toggleVideo( hasVideo );
	}

})( library.view );


// SinkUI
(function( ns, undefined ) {
	ns.SinkUI = function(
		containerId,
		source,
		muteBtn,
		blindBtn
	) {
		const self = this;
		console.log( 'SinkUI', [ containerId, source, muteBtn, blindBtn ]);
		ns.MediaUI.call( self,
			source,
			muteBtn,
			blindBtn,
		);
		
		self.init( containerId );
	}
	
	ns.SinkUI.prototype = Object.create( ns.MediaUI.prototype );
	
	// Public
	
	ns.SinkUI.prototype.close = function() {
		const self = this;
		self.removeStream();
		self.closeMedia();
		delete self.avatar;
		delete self.ui;
		
		self.el.parentNode.removeChild( self.el );
		delete self.el;
	}
	
	// Private
	
	ns.SinkUI.prototype.init = function( containerId ) {
		const self = this;
		// main element
		const container = document.getElementById( containerId );
		let avatar = '';
		if ( self.source && self.source.identity )
			avatar = self.source.identity.avatar;
			
		const sourceConf = {
			avatar : avatar,
		};
		self.el = hello.template.getElement( 'live-stream-sink-tmpl', sourceConf )
		container.appendChild( self.el );
		
		self.avatar = document.getElementById( 'source-avatar' );
		self.ui = document.getElementById( 'sink-ui' );
		
		// stream state
		self.state = new library.component.StreamStateUI( 'sink-ui' );
		
		self.source.on( 'stream-state', streamState );
		
		function streamState( state ) { self.state.update( state ); }
	}
	
	ns.SinkUI.prototype.handleMute = function( isMute ) {
		const self = this;
		console.log( 'SinkUI.handleMute', isMute );
		self.isMute = isMute;
		self.muteBtn.classList.toggle( 'danger', isMute );
		if ( isMute )
			self.switchIcon( self.muteBtn.children[ 0 ], 'fa-volume-up', 'fa-volume-off' );
		else
			self.switchIcon( self.muteBtn.children[ 0 ], 'fa-volume-off', 'fa-volume-up' );
	}
	
	ns.SinkUI.prototype.handleBlind = function( isBlind ) {
		const self = this;
		console.log( 'SinkUI.handleBLind', isBlind );
		self.isBlind = isBlind;
		self.blindBtn.classList.toggle( 'danger', isBlind );
		self.toggleVideo( !isBlind );
		if ( isBlind )
			self.switchIcon( self.blindBtn.children[ 0 ], 'fa-eye', 'fa-eye-slash' );
		else
			self.switchIcon( self.blindBtn.children[ 0 ], 'fa-eye-slash', 'fa-eye' );
	}
	
	ns.SinkUI.prototype.handleHasAudio = function( hasAudio ) {
		const self = this;
		console.log( 'SinkUI.handleHasAudio', hasAudio );
	}
	
	ns.SinkUI.prototype.handleHasVideo = function( hasVideo ) {
		const self = this;
		console.log( 'SinkUI.handleHasVideo', hasVideo );
		self.toggleVideo( hasVideo );
	}
	
})( library.view );
