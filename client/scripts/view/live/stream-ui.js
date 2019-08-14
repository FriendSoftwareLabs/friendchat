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
	ns.UI = function( conn, liveConf, localSettings ) {
		const self = this;
		self.conn = conn;
		self.userId = liveConf.userId;
		self.sourceId = liveConf.rtcConf.sourceId;
		self.localSettings = localSettings;
		self.guestAvatar = liveConf.guestAvatar;
		
		self.uiPanes = {};
		self.uiVisible = true;
		self.panesVisible = 0;
		
		self.currentQuality = null;
		self.users = {};
		self.userList = null;
		
		self.resizeWait = null;
		self.doOneMoreResize = false;
		self.showUserStuff = false;
		
		self.init();
	}
	
	// Public
	
	ns.UI.prototype.close = function() {
		const self = this;
		delete self.conn;
		delete self.userId;
		delete self.localSettings;
	}
	
	ns.UI.prototype.showMenu = function() {
		const self = this;
		self.menuUI.show();
	}
	
	ns.UI.prototype.setAudioSink = function( deviceId ) {
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
	
	ns.UI.prototype.setQuality = function( qualityLevel ) {
		const self = this;
		self.currentQuality = qualityLevel;
	}
	
	ns.UI.prototype.addChat = function( conf, conn ) {
		const self = this;
		self.chatTease = new library.component.ChatTease( 'tease-chat-container', hello.template );
		
		const chatConf = {
			containerId : 'chat-container',
			conn        : conn,
			userId      : conf.userId,
			identities  : conf.identities,
			guestAvatar : self.guestAvatar,
			roomName    : conf.roomName,
			logTail     : conf.logTail,
		};
		self.chat = new library.component.LiveChat( chatConf, hello.template, self.chatTease );
		return self.chat;
	}
	
	ns.UI.prototype.addShare = function( conn ) {
		const self = this;
		const conf = {
			conn : conn,
		};
		self.shareUI = self.addUIPane( 'share', conf );
		return self.shareUI;
	}
	
	ns.UI.prototype.addExtConnPane = function( onshare ) {
		const self = this;
		const conf = {
			onshare : onshare,
		};
		self.extConnUI = self.addUIPane( 'ext-connect', conf );
		return self.extConnUI;
	}
	
	ns.UI.prototype.addUIPane = function( id, conf ) {
		const self = this;
		const Pane = self.uiPaneMap[ id ];
		if ( !Pane ) {
			console.log( 'no ui pane for id', { id : id, map : self.uiPaneMap });
			throw new Error( 'no ui pane found for id: ' + id );
			return;
		}
		
		const paneConf = {
			id           : id,
			parentId     : 'stream-ui-panes',
			onpanetoggle : onToggle,
			onpaneclose  : onClose,
			conf         : conf,
		};
		const pane = new Pane( paneConf );
		self.uiPanes[ pane.id ] = pane;
		return pane;
		
		function onToggle( setVisible ) {
			self.toggleUIPanes( setVisible );
		}
		
		function onClose() {
			self.removeUIPane( pane.id );
		}
	}
	
	ns.UI.prototype.addUser = function( user ) {
		const self = this;

		const userUI = new library.view.UserUI(
			user,
			self.userList,
		);
		self.users[ user.id ] = userUI;
		
	}
	
	ns.UI.prototype.addSource = function( source ) {
		const self = this;
		self.waiting.classList.toggle( 'hidden', true );
		if ( null == self.localSettings[ 'ui-user-stuff' ] ) {
			self.showUserStuff = true;
			self.updateShowUserStuff();
		}
		
		self.stream = new library.view.SourceUI( source, 'stream-element-container' );
		self.bindSource( source );
		source.on( 'client-state', clientState );
		function clientState( e ) { self.updateClientState( e ); }
	}
	
	ns.UI.prototype.addSink = function( sink ) {
		const self = this;
		self.waiting.classList.toggle( 'hidden', true );
		self.stream = new library.view.SinkUI( sink, 'stream-element-container' );
		self.bindSource( sink );
	}
	
	ns.UI.prototype.removeStream = function( sinkId ) {
		const self = this;
		if ( !self.stream )
			return;
		
		self.stream.close();
		delete self.stream;
		self.waiting.classList.toggle( 'hidden', false );
	}
	
	ns.UI.prototype.saveLocalSetting = function( setting, value ) {
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
	
	ns.UI.prototype.init = function() {
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
		self.applyLocalSettings();
	}
	
	ns.UI.prototype.bindSource = function( stream ) {
		const self = this;
		stream.on( 'mute', mute );
		function mute( e ) { self.handleIsMute( e ); }
	}
	
	ns.UI.prototype.handleIsMute = function( isMute ) {
		const self = this;
		self.uiMuteBtn.classList.toggle( 'danger', isMute );
	}
	
	ns.UI.prototype.updateClientState = function( user ) {
		const self = this;
		self.userList.updateConnected( user.clientId, user.state );
	}
	
	ns.UI.prototype.handleResize = function( e ) {
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
	
	ns.UI.prototype.bindUI = function() {
		const self = this;
		self.peerContainer = document.getElementById( self.peerContainerId );
		
		// ui
		self.mainContent = document.getElementById( 'main-content' );
		self.streamContainer = document.getElementById( 'stream-container' );
		self.streamEl = document.getElementById( 'stream-element-container' );
		self.waiting = document.getElementById( 'waiting-for-container' );
		self.waitingFritz = document.getElementById( 'waiting-for-stream-fritz' );
		self.waitingDots = document.getElementById( 'waiting-for-stream-dots' );
		self.ui = document.getElementById( 'stream-ui' );
		self.uiMenuBtn = document.getElementById( 'show-menu-btn' );
		self.uiMuteBtn = document.getElementById( 'mute-stream' );
		self.uiFullscreenBtn = document.getElementById( 'toggle-fullscreen' );
		self.uiUserStuffBtn = document.getElementById( 'toggle-user-stuff' );
		self.userStuffEl = document.getElementById( 'user-stuff' );
		self.uiPaneContainer = document.getElementById( 'stream-ui-panes' );
		self.teaseChat = document.getElementById( 'tease-chat-container' );
		
		document.addEventListener( 'mouseleave', catchLeave, false );
		document.addEventListener( 'mouseenter', catchEnter, false );
		document.addEventListener( 'mousemove', mouseMoved, false );
		
		window.addEventListener( 'resize', handleResize, false );
		self.streamContainer.addEventListener( 'click', contentClick, false );
		self.ui.addEventListener( 'transitionend', uiTransitionEnd, false );
		self.uiMenuBtn.addEventListener( 'click', menuClick, false );
		self.uiMuteBtn.addEventListener( 'click', muteClick, false );
		self.uiUserStuffBtn.addEventListener( 'click', userStuffClick, false );
		self.uiFullscreenBtn.addEventListener( 'click', fullscreenClick, false );
		
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
		function menuClick( e ) { self.showMenu(); }
		function muteClick( e ) { self.handleMuteClick( e ); }
		function userStuffClick( e ) { self.handleUserStuffClick( e ); }
		function fullscreenClick( e ) { self.handleFullscreenClick( e ); }
	}
	
	ns.UI.prototype.applyLocalSettings = function() {
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
	
	ns.UI.prototype.toggleUI = function( show, skipAnim ) {
		const self = this;
		let setVisible = self.uiVisible;
		if ( null != show )
			setVisible = show;
		
		if ( !!self.panesVisible )
			setVisible = false;
		
		self.ui.classList.toggle( 'hidden', !setVisible );
		self.reflow();
	}
	
	ns.UI.prototype.toggleUIMode = function() {
		const self = this;
		self.uiVisible = !self.uiVisible;
		self.saveLocalSetting( 'ui-visible', self.uiVisible );
		self.menu.setState( 'clean-ui', !self.uiVisible );
		self.toggleUI();
	}
	
	ns.UI.prototype.toggleUIPanes = function( setVisible ) {
		const self = this;
		if ( setVisible )
			self.panesVisible++;
		else
			self.panesVisible--;
		
		// theres is only change in container visibility
		// at 0 and 1 panes visible
		if ( self.panesVisible > 1 )
			return;
		
		//self.toggleUI( null, true );
		self.uiPaneContainer.classList.toggle( 'hidden', !setVisible );
	}
	
	ns.UI.prototype.getUIPane = function( id ) {
		const self = this;
		const pane = self.uiPanes[ id ];
		if ( !pane ) {
			console.log( 'getUIPane - no pane found for id', id );
			return null;
		}
		
		return pane;
	}
	
	ns.UI.prototype.hideUIPane = function( id ) {
		const self = this;
		const pane = self.getPane( id );
		if ( !pane )
			return;
		
		pane.hide();
	}
	
	ns.UI.prototype.removeUIPane = function( id ) {
		const self = this;
		const pane = self.getUIPane( id )
		if ( !pane )
			return;
		
		//pane.hide();
		delete self.uiPanes[ id ];
		self.toggleUIPanes( false );
	}
	
	ns.UI.prototype.uiTransitionEnd = function( e ) {
		const self = this;
		//console.log( 'uiTransitionEnd', e );
	}
	
	ns.UI.prototype.handleViewOver = function( e ) {
		const self = this;
		//console.log( 'handleViewOver', e );
	}
	
	ns.UI.prototype.handleMuteClick = function( e ) {
		const self = this;
		self.stream.toggleMute();
	}
	
	ns.UI.prototype.handleUserStuffClick = function( e ) {
		const self = this;
		self.showUserStuff = !self.showUserStuff;
		self.saveLocalSetting( 'ui-user-stuff', self.showUserStuff );
		self.updateShowUserStuff();
	}
	
	ns.UI.prototype.updateShowUserStuff = function() {
		const self = this;
		if ( self.menu )
			self.menu.setState( 'chat', self.showUserStuff );
		
		//self.uiUserStuffBtn.classList.toggle( 'danger', !self.showUserStuff );
		self.userStuffEl.classList.toggle( 'hidden', !self.showUserStuff );
		self.reflow();
	}
	
	ns.UI.prototype.handleFullscreenClick = function( e ) {
		const self = this;
		View.toggleFullscreen();
		self.reflow();
	}
	
	ns.UI.prototype.reflow = function() {
		const self = this;
		if ( !self.stream )
			return;
		
		self.stream.reflow();
	}
	
	ns.UI.prototype.buildMenu = function() {
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
	
	ns.UI.prototype.removeUser = function( userId ) {
		const self = this;
		let user = self.users[ userId ];
		if ( !user )
			return;
		
		user.close();
		delete self.users[ userId ];
	}
	
	ns.UI.prototype.setSource = function( source ) {
		const self = this;
		console.log( 'ui.setSource - NYI', source );
	}
	
	ns.UI.prototype.clearSource = function() {
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

// StreamUI

(function( ns, undefined ) {
	ns.StreamUI = function() {
		const self = this;
		self.source.on( 'screenmode', updateScreen );
		
		function updateScreen( e ) {
			self.doResize( e );
		}
	}
	
	ns.StreamUI.prototype.bindStreamResize = function() {
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
	
	ns.StreamUI.prototype.doResize = function() {
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
	
	ns.StreamUI.prototype.reflow = function() {
		const self = this;
		if ( !self.stream )
			return;
		
		let resize = new Event( 'resize' );
		self.stream.dispatchEvent( resize );
	}
	
	ns.StreamUI.prototype.toggleElementClass = function( element, className, set ) {
		var self = this;
		element.classList.toggle( className, set );
	}
	
	ns.StreamUI.prototype.toggleMute = function() {
		const self = this;
		self.source.toggleMute();
	}
	
	ns.StreamUI.prototype.toggleAvatar = function( show ) {
		const self = this;
		if ( !self.avatar )
			return;
		
		self.avatar.classList.toggle( 'hidden', !show );
	}
	
})( library.view );


// SourceUI
(function( ns, undefined ) {
	ns.SourceUI = function( source, containerId ) {
		const self = this;
		self.source = source;
		ns.StreamUI.call( self );
		
		self.init( containerId );
	}
	
	ns.SourceUI.prototype = Object.create( ns.StreamUI.prototype );
	
	// Public
	
	ns.SourceUI.prototype.updateAudioSink = function( sinkId ) {
		const self = this;
		console.log( 'sourceui.updateAudioSink', sinkId );
	}
	
	ns.SourceUI.prototype.close = function() {
		const self = this;
		delete self.source;
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
		
		// media element
		const streamContainer = document.getElementById( 'source-media-container' );
		const streamConf = {
			id  : 'source-media',
			src : '',
		};
		self.stream = hello.template.getElement( 'live-video-tmpl', streamConf );
		streamContainer.appendChild( self.stream );
		self.updateAudioSink();
		self.bindStreamResize();
		self.stream.onloadedmetadata = play;
		function play( e ) {
			self.stream.play();
		}
		
		self.source.on( 'media', media );
		self.source.on( 'mute', mute );
		self.source.on( 'blind', blind );
		function media( e ) { self.handleSelfie( e ); }
		function mute( e ) { console.log( 'mute' ); }
		function blind( e ) { console.log( 'blind' ); }
	}
	
	ns.SourceUI.prototype.handleSelfie = function( media ) {
		const self = this;
		self.handleMedia( media );
		self.stream.muted = true;
	}
	
	ns.SourceUI.prototype.handleMedia = function( media ) {
		const self = this;
		self.stream.pause();
		let srcObj = self.stream.srcObject;
		if ( srcObj ) {
			self.stream.pause();
			clear( srcObj );
			self.stream.load();
			self.stream.srcObject = null;
		}
		
		self.stream.srcObject = media;
		//self.bindStream();
		self.stream.load();
		self.toggleAvatar( !media );
		
		function clear( media ) {
			let tracks = media.getTracks();
			tracks.forEach( stop );
			
			function stop( track ) {
				track.stop();
				media.removeTrack( track );
			}
		}
	}
	
})( library.view );


// SinkUI
(function( ns, undefined ) {
	ns.SinkUI = function( source, containerId ) {
		const self = this;
		self.source = source;
		ns.StreamUI.call( self );
		
		self.init( containerId );
	}
	
	ns.SinkUI.prototype = Object.create( ns.StreamUI.prototype );
	
	// Public
	
	ns.SinkUI.prototype.close = function() {
		const self = this;
		self.removeStream();
		delete self.avatar;
		delete self.ui;
		self.el.parentNode.removeChild( self.el );
		self.source.release( 'media' );
		self.source.release( 'track' );
		delete self.source;
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
		
		self.source.on( 'media', handleMedia );
		self.source.on( 'track', handleTrack );
		self.source.on( 'stream-state', streamState );
		
		function handleMedia( media ) { self.handleMedia( media ); }
		function handleTrack( type, track ) { self.handleTrack( type, track ); }
		function streamState( state ) { self.state.update( state ); }
	}
	
	ns.SinkUI.prototype.handleMedia = function( media ) {
		const self = this;
		if ( !media ) {
			return;
		}
		
		if ( !self.stream ) {
			self.setStreamElement( media.id );
		}
		
		//self.stream.pause();
		let srcObj = self.stream.srcObject;
		if ( srcObj ) {
			self.stream.pause();
			clear( srcObj );
			self.stream.load();
			self.stream.srcObject = null;
		}
		
		self.stream.srcObject = media;
		//self.bindStream();
		self.stream.load();
		self.toggleAvatar( !media );
		
		function clear( media ) {
			let tracks = media.getTracks();
			tracks.forEach( stop );
			
			function stop( track ) {
				track.stop();
				media.removeTrack( track );
			}
		}
	}
	
	ns.SinkUI.prototype.handleTrack = function( type, track ) {
		const self = this;
		if ( !self.stream )
			return;
		
		// set state
		/*
		const alreadyUpdating = !!self.isUpdatingStream;
		if ( !self.isUpdatingStream ) {
			self.stream.pause();
			self.isUpdatingStream = true;
		}
		*/
		self.stream.load();
		//self.stream.play();
		
		/*
		self.stream.srcObject.addTrack( track );
		self.stream.load();
		*/
	}
	
	ns.SinkUI.prototype.setStreamElement = function( id ) {
		const self = this;
		if ( self.stream )
			self.removeStream();
		
		let conf = {
			id : id
		};
		
		let container = document.getElementById( 'source-media-container' );
		self.stream = hello.template.getElement( 'live-video-tmpl', conf );
		self.stream.onloadedmetadata = play;
		//self.updateAudioSink();
		
		container.appendChild( self.stream );
		//self.toggleSpinner( false );
		self.bindStreamResize();
		
		function play( e ) {
			self.stream.play();
		}
	}
	
	ns.SinkUI.prototype.removeStream = function() {
		const self = this;
		if ( self.stream ) {
			self.stream.parentNode.removeChild( self.stream );
			self.stream.srcObject = null;
		}
		
		delete self.stream;
	}
	
})( library.view );