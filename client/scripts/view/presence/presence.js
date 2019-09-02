
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

var library = window.library || {};
var friendUP = window.friendUP || {};
var hello = window.hello || {};

library.view = library.view || {};

(function( ns, undefined ) {
	ns.Presence = function( fupConf ) {
		const self = this;
		self.conn = window.View;
		
		self.room = null;
		self.ownerId = null;
		self.userId = null;
		self.users = null;
		self.onlineList = [];
		
		self.appOnline = null;
		
		self.init();
	}
	
	ns.Presence.prototype.init = function() {
		const self = this;
		window.View.setBody();
		if ( window.View.appSettings )
			self.compact = !!window.View.appSettings.compactChat;
		
		self.buildUserList();
		self.appOnline = new library.component.AppOnline( View );
		
		// scroll to bottom on new message
		self.messageScroller = new library.component.BottomScroller( 'messages' );
		
		// highlight
		self.highlight = new library.component.Highlight({
			cssClass : 'Highlight',
			listener : handleHighlight,
		});
		
		function handleHighlight( e ) {
			self.send({
				type : 'highlight',
				data : e,
			});
		}
		
		// drag and drop handler
		const dropConf = {
			targetId : 'hello',
			ondrop   : onDrop,
		}
		self.drop = new library.component.Drop( dropConf );
		function onDrop( event ) { self.send( event ); }
		
		//
		self.bindUI();
		self.bindConn();
		
		//
		self.conn.loaded();
	}
	
	ns.Presence.prototype.buildUserList = function() {
		const self = this;
		let tmpl = null;
		const isDesktop = ( 'DESKTOP' === window.View.deviceType );
		if ( isDesktop )
			tmpl = 'users-desktop-tmpl';
		else
			tmpl = 'users-other-tmpl';
		
		const appendEl = document.getElementById( 'main' );
		const el = friend.template.getElement( tmpl, {});
		appendEl.appendChild( el );
		
		self.usersEl = document.getElementById( 'users-container' );
		if( !isDesktop )
			self.usersEl.addEventListener( 'click', usersClick, false );
		
		function usersClick( e ) {
			e.preventDefault();
			self.toggleUserList( false );
		}
	}
	
	ns.Presence.prototype.bindUI = function() {
		const self = this;
		self.titleContainer = document.getElementById( 'room-title' );
		// buttons?
		self.backBtn = document.getElementById( 'room-back' );
		self.goVideoBtn = document.getElementById( 'upgrade-to-video' );
		self.goAudioBtn = document.getElementById( 'upgrade-to-audio' );
		self.toggleUsersBtn = document.getElementById( 'show-hide-btn' );
		self.inviteBtn = document.getElementById( 'invite-btn' );
		
		// chat things
		self.messagesEl = document.getElementById( 'messages' );
		const emoPanelBtn = document.getElementById( 'emojii-panel-button' );
		const inputForm = document.getElementById( 'input-form' );
		const submitBtn = document.getElementById( 'chat-submit' );
		const attachBtn = document.getElementById( 'attachment' );
		
		//
		self.backBtn.addEventListener( 'click', closeBack, false );
		self.goVideoBtn.addEventListener( 'click', goVideoClick, false );
		self.goAudioBtn.addEventListener( 'click', goAudioClick, false );
		self.toggleUsersBtn.addEventListener( 'click', toggleUserList, false );
		self.inviteBtn.addEventListener( 'click', showInviter, false );
		
		emoPanelBtn.addEventListener( 'click', toggleEmoPanel, false );
		inputForm.addEventListener( 'submit', inputSubmit, false );
		submitBtn.addEventListener( 'click', inputSubmit, false );
		attachBtn.addEventListener( 'click', attach, false );
		
		function attach( e ) {
			var men = ge( 'attachment-menu' );
			var can = men.querySelector( '.Cancel' );
			var cam = men.querySelector( '.Camera' );
			var upl = men.querySelector( '.Upload' );
			can.onclick = function()
			{
				men.classList.remove( 'Showing' );
			}
			
			if( men.classList.contains( 'Showing' ) )
			{
				men.classList.remove( 'Showing' );
			}
			else
			{
				men.classList.add( 'Showing' );
			}
			upl.onclick = function( e ){
				men.classList.remove( 'Showing' );
				executeAttach( e );
			}
			
			self.conn.prepareCamera( cam, function( data ) {
				men.classList.remove( 'Showing' );
			} );
		}
		
		function executeAttach( e )
		{
			self.send( {
				type: 'attach',
				data: false
			} );
		};
		
		function closeBack( e ) { self.closeBack(); }
		function goVideoClick( e ) { self.goLive( 'video' ); }
		function goAudioClick( e ) { self.goLive( 'audio' ); }
		
		function toggleUserList( e ) {
			e.stopPropagation();
			e.preventDefault();
			self.toggleUserList();
		}
		
		function showInviter() {
			const inv = {
				type : 'invite-show',
				data : null,
			};
			self.send( inv );
		}
		
		function toggleEmoPanel( e ) {
			self.emojiis.show();
		}
		
		// TODO : this should be moved to multiline input. The entire input form actually
		function inputSubmit( e ) {
			e.stopPropagation();
			e.preventDefault();
			self.input.submit(); // input is multiline input model
		}
		
		// Handle paste if it isn't a file
		window.addEventListener( 'paste', function( evt ) {
			var pastedItems = (evt.clipboardData || evt.originalEvent.clipboardData).items;
			for( var i in pastedItems ) {
				var item = pastedItems[i];
				if( item.kind === 'file' ) {
					var p = new api.PasteHandler();
					p.paste( evt, function( res ) {
						if( res.response == true ) {
							self.conn.send(	{
								type: 'drag-n-drop',
								data: [ {
									Type: 'File',
									Path: res.path
								} ]
							} );
						}
					} );
					evt.preventDefault();
					evt.stopPropagation();
					break;
				}
			}
		} );
	}
	
	ns.Presence.prototype.toggleLiveBtns = function( show ) {
		const self = this;
		if ( show )
			self.liveStatus.show();
		else
			self.liveStatus.hide();
		
		/*
		vBtn = document.getElementById( 'upgrade-to-video' );
		aBtn = document.getElementById( 'upgrade-to-audio' );
		vBtn.classList.toggle( 'hidden', !show );
		aBtn.classList.toggle( 'hidden', !show );
		*/
	}
	
	ns.Presence.prototype.closeBack = function() {
		const self = this;
		const close = {
			type : 'close-back',
		};
		self.send( close );
	}
	
	ns.Presence.prototype.goLive = function( type ) {
		const self = this;
		const goLive = {
			type : 'live',
			data : type,
		};
		self.send( goLive );
	}
	
	ns.Presence.prototype.toggleUserList = function( force ) {
		const self = this;
		if ( null == force ) {
			const isHidden = self.usersEl.classList.contains( 'users-hide' );
			toggle( isHidden );
		} else
			toggle( force );
		
		function toggle( show ) {
			self.messagesEl.classList.toggle( 'SmoothScrolling', !show );
			self.usersEl.classList.toggle( 'users-hide', !show );
			const btnIcon = self.toggleUsersBtn.querySelector( 'i' );
			btnIcon.classList.toggle( 'DangerText', !show );
		}
	}
	
	ns.Presence.prototype.toggleUserListBtn = function( show ) {
		const self = this;
		self.toggleUsersBtn.classList.toggle( 'hidden', !show );
	}

	ns.Presence.prototype.bindConn = function() {
		const self = this;
		self.conn.on( 'initialize'     , initialize );
		self.conn.on( 'state'          , state );
		self.conn.on( 'online'         , online );
		self.conn.on( 'offline'        , offline );
		self.conn.on( 'chat'           , chat );
		self.conn.on( 'live'           , live );
		self.conn.on( 'persistent'     , persistent );
		self.conn.on( 'title'          , title );
		self.conn.on( 'identity-update', e => self.handleIdUpdate( e ));
		
		function initialize( e ) { self.handleInitialize( e ); }
		function state( e      ) { self.handleState( e ); }
		function online( e     ) { self.handleOnline( true ); }
		function offline( e    ) { self.handleOnline( false ); }
		function chat( e       ) { self.handleChat( e ); }
		function live( e       ) { self.handleLive( e ); }
		function persistent( e ) { self.handlePersistent( e ); }
		function title( e      ) { self.handleTitle( e ); }
	}
	
	ns.Presence.prototype.handleInitialize = function( conf ) {
		const self = this;
		hello.template = friend.template;
		friend.template.addFragments( conf.commonFragments );
		const state = conf.state;
		
		// things
		self.clientId   = state.clientId;
		self.isPrivate  = state.isPrivate;
		self.isView     = state.isView;
		self.persistent = state.persistent;
		self.room       = state.room;
		self.ownerId    = state.ownerId;
		self.userId     = state.userId;
		self.contactId  = state.contactId;
		
		let UserCtrl = library.component.UserCtrl;
		let MsgBuilder = library.component.MsgBuilder;
		const isWorkroom = ( state.workgroups && state.workgroups.workId );
		if ( isWorkroom ) {
			UserCtrl = ns.UserWorkCtrl;
			MsgBuilder = ns.WorkMsgBuilder;
		}
		
		if ( !self.isPrivate )
			self.toggleUserListBtn( true );
		
		if ( !self.isPrivate && !isWorkroom && ( self.userId === self.ownerId ))
			self.inviteBtn.classList.toggle( 'hidden', false );
		
		//
		self.users = new UserCtrl(
			self.conn,
			state.users,
			state.identities,
			state.onlineList,
			state.workgroups,
			state.room,
			state.guestAvatar,
			'users-position',
			friend.template,
			state.config
		);
		self.user = self.users.getId( self.userId );
		
		//
		if ( !window.View.appConf.hideLive ) {
			self.liveStatus = new library.component.LiveStatus(
				'live-status-container',
				self.users,
				self.userId,
				friend.template
			);
			self.liveStatus.update( state.peers );
			self.liveStatus.on( 'show', e => self.goLive( 'show' ));
			self.liveStatus.on( 'join', e => self.goLive( e ));
		}
		// get logs when scrolling to top
		self.logFetcher = new library.component.LogFetcher(
			'message-container',
			'messages',
			friend.template,
			onFetch
		);
		
		function onFetch() {
			const firstMsgId = self.msgBuilder.getFirstMsgId();
			const firstMsgTime = self.msgBuilder.getFirstMsgTime();
			const logBefore = {
				type : 'log',
				data : {
					firstId   : firstMsgId,
					firstTime : firstMsgTime,
				},
			};
			self.sendChatEvent( logBefore );
		}
		
		// link expansion
		const leConf = {
			templateManager : friend.template,
		}
		self.linkExpand = new library.component.LinkExpand( leConf );
		
		// message parsing
		self.parser = new library.component.parse.Parser();
		self.parser.use( 'LinkStd' );
		self.parser.use( 'Emojii', conf.emojii );
		
		// multiline input
		const isMobile = ( window.View.deviceType === 'MOBILE' );
		const inputConf = {
			containerId     : 'input-container',
			templateManager : friend.template,
			enterIsNewline  : isMobile,
			onsubmit        : onSubmit,
			onstate         : onState,
		};
		self.input = new library.component.MultiInput( inputConf );
		function onSubmit( message ) {
			self.inputHistory.add( message );
			const msg = {
				type : 'msg',
				data : {
					message : message,
				},
			};
			self.sendChatEvent( msg );
		}
		
		function onState( event ) {
			const state = {
				type: 'state',
				data : event,
			};
			self.sendChatEvent( state );
		}
		
		// message builder
		self.msgBuilder = new MsgBuilder(
			self.conn,
			'messages',
			self.users,
			self.userId,
			self.contactId || null,
			self.clientId,
			state.workgroups,
			self.input,
			self.parser,
			self.linkExpand,
			friend.template
		);
		
		// input history
		const hConf = {
			inputId : 'chat-input',
		};
		self.inputHistory = new library.component.InputHistory( hConf );
		
		// tab complete
		const inputArea = document.getElementById( 'chat-input' );
		inputArea.addEventListener( 'keydown', inputKeyDown, false );
		function inputKeyDown( e ) {
			self.checkAutoComplete( e );
		}
		
		// emojii panel
		const emoElementMap = {};
		Object.keys( conf.emojii ).forEach( parseToMap );
		function parseToMap( key ) {
			let el = self.parser.work( key );
			emoElementMap[ key ] = el;
		}
		
		self.emojiis = new library.component.EmojiiPanel(
			//'emojii-panel-button',
			'foot',
			friend.template,
			emoElementMap,
			onEmojii
		);
		function onEmojii( str ) {
			self.input.add( ' ' + str );
			self.input.focus();
		}
		
		if ( self.isPrivate )
			self.setPrivateUI();
		else {
			if ( self.isView )
				self.setViewUI();
			else
				self.setGroupUI();
		}
		
		// only focus input if desktop
		if ( 'DESKTOP' == window.View.deviceType ) {
			self.input.focus();
		}
		
		self.conn.ready();
		self.sendChatEvent({
			type : 'log',
			data : null,
		});
	}
	
	ns.Presence.prototype.setPrivateUI = function() {
		const self = this;
		self.usersEl.classList.toggle( 'hidden', true );
		self.toggleUserListBtn( false );
		self.setContactTitle();
	}
	
	ns.Presence.prototype.setViewUI = function() {
		const self = this;
		self.usersEl.classList.toggle( 'hidden', true );
		self.toggleUserListBtn( false );
		if ( self.liveStatus )
			self.liveStatus.close();
		
		self.goVideoBtn.classList.toggle( 'hidden', true );
		self.goAudioBtn.classList.toggle( 'hidden', true );
		self.setGroupTitle();
	}
	
	ns.Presence.prototype.setGroupUI = function() {
		const self = this;
		/*
		if ( self.contactStatus ) {
			self.contactStatus.close();
			delete self.contactStatus;
		}
		*/
		
		self.usersEl.classList.toggle( 'hidden', false );
		self.toggleUserListBtn( true );
		self.setGroupTitle();
		
	}
	
	ns.Presence.prototype.setContactTitle = function() {
		const self = this;
		if ( self.titleId )
			self.clearTitle();
		
		self.titleId = friendUP.tool.uid( 'title' );
		const stateId = friendUP.tool.uid( 'cstate' );
		const user = self.users.getId( self.contactId );
		if ( !user ) {
			console.log( 'setContactTitle - no user', self );
			return;
		}
		
		const conf = {
			id             : self.titleId,
			statusId       : stateId,
			avatarCssKlass : self.users.getAvatarKlass( self.contactId ),
			contactName    : user.name,
		};
		self.titleEl = friend.template.getElement( 'contact-title-tmpl', conf );
		self.titleContainer.appendChild( self.titleEl );
		
		const statusConf = {
			containerId : stateId,
			type        : 'led',
			cssClass    : 'led-online-status PadBorder',
			statusMap   : {
				offline   : 'Off',
				online    : 'On',
			},
		};
		self.contactStatus = new library.component.StatusIndicator( statusConf );
		const isOnline = self.users.checkIsOnline( self.contactId );
		self.handleOnline( isOnline );
	}
	
	ns.Presence.prototype.setGroupTitle = function() {
		const self = this;
		if ( !self.room ) {
			console.log( 'view.Presence.setGroupTitle - no identity', self );
			return;
		}
		
		const id = self.room;
		const added = self.users.addIdentity( id );
		if ( !added ) {
			console.log( 'could not add identity????', self.room );
			return;
		}
		
		if ( self.titleId )
			self.clearTitle();
		
		self.titleId = friendUP.tool.uid( 'title' );
		const avatarKlass = self.users.getAvatarKlass( id.clientId );
		const conf = {
			id             : self.titleId,
			roomName       : self.room.name,
			avatarCssKlass : avatarKlass,
		};
		
		self.titleEl = friend.template.getElement( 'group-title-tmpl', conf );
		self.titleContainer.appendChild( self.titleEl );
	}
	
	ns.Presence.prototype.clearTitle = function() {
		const self = this;
		if ( !self.titleId )
			return;
		
		const el = document.getElementById( self.titleId );
		self.titleId = null;
		self.titleEl = null;
		if ( !el )
			return;
		
		el.parentNode.removeChild( el );
	}

	ns.Presence.prototype.handleState = function( state ) {
		const self = this;
		self.users.updateAll( state );
		//removeOld( state.users );
		//addNew( state.users );
		//setOnline( state.online );
		//setLive( state.peers );
		reloadLog();
		
		function reloadLog() {
			let lastMsgTime = self.msgBuilder.getLastMsgTime();
			const logFrom = {
				type : 'log',
				data : {
					lastTime : lastMsgTime,
				},
			};
			self.sendChatEvent( logFrom );
		}
	}
	
	ns.Presence.prototype.handleOnline = function( isOnline ) {
		const self = this;
		if ( !self.isPrivate )
			return;
		
		let state = isOnline ? 'online' : 'offline';
		self.contactStatus.set( state );
		if ( isOnline )
			self.contactStatus.show();
		else
			self.contactStatus.hide();
	}
	
	ns.Presence.prototype.handleChat = function( event ) {
		const self = this;
		const type = event.type;
		const data = event.data;
		if ( 'state' === type ) {
			self.setChatState( data );
			return;
		}
		
		if ( 'log' === type ) {
			self.handleLog( data );
			return;
		}
		/*
		if ( 'update' === type ) {
			self.msgBuilder.update( data );
			return;
		}
		
		if ( 'edit' === type ) {
			const isEdit = true;
			self.msgBuilder.update( data, isEdit );
			return;
		}
		*/
		self.msgBuilder.handle( event );
	}
	
	ns.Presence.prototype.handleLog = function( logs ) {
		const self = this;
		if ( 'before' === logs.type && null == logs.data.events ) {
			self.logFetcher.unlock();
			self.logFetcher.setNoLogs( true );
			return;
		}
		
		self.msgBuilder.handle({
			type : 'log',
			data : logs,
		});
		self.logFetcher.unlock();
	}
	
	ns.Presence.prototype.setChatState = function( event ) {
		const self = this;
		const uid = event.fromId;
		if ( !uid )
			return;
		
		const state = 'typing';
		// 'set-typing' or 'clear-typing'
		let add = false;
		if ( 'set-typing' === event.state.type )
			add = true;
		
		self.users.setState( uid, state, add );
	}
	
	ns.Presence.prototype.handleLive = function( event ) {
		const self = this;
		if ( !event.data || !event.data.peerId )
			return;
		
		const uid = event.data.peerId;
		const state = 'live';
		// 'join' or 'leave'
		let add = false;
		if ( 'join' === event.type )
			add = true;
		
		self.users.setState( uid, state, add );
	}
	
	ns.Presence.prototype.handlePersistent = function( event ) {
		const self = this;
		console.log( 'handlePersistent - NYI', event );
	}
	
	ns.Presence.prototype.handleTitle = function( title ) {
		const self = this;
		if ( !self.titleId )
			return;
		
		const titleEl = document.getElementById( self.titleId );
		const nameEl = titleEl.querySelector( '.title-name' );
		nameEl.textContent = title;
	}
	
	ns.Presence.prototype.handleIdUpdate = function( update ) {
		const self = this;
		self.users.updateIdentity( update );
	}
	
	// things
	
	ns.Presence.prototype.checkAutoComplete = function( e ) {
		const self = this;
		//console.log( 'checkAutoComplete - NYI', e );
		return;
		
		var key = e.code || e.key;
		if ( 'Tab' !== key )
			return;
		
		if (
			e.shiftKey ||
			e.ctrlKey ||
			e.altKey ||
			e.repeat
		) {
			return;
		}
		
	}
	
	ns.Presence.prototype.sendChatEvent = function( event ) {
		const self = this;
		const wrap = {
			type : 'chat',
			data : event,
		};
		self.send( wrap );
	}
	
	ns.Presence.prototype.send = function( event ) {
		const self = this;
		if ( !self.conn )
			return;
		
		self.conn.sendMessage( event );
	}
	
	ns.Presence.prototype.close = function() {
		const self = this;
		self.appOnline.close();
	}
	
})( library.view );


//
(function( ns, undefined ) {
	ns.WorkGroup = function(
		conf,
		containerId,
		userSource,
		templateManager,
		onClick,
	) {
		const self = this;
		self.onClick = onClick;
		library.component.UserGroup.call( self,
			conf,
			containerId,
			userSource,
			templateManager
		);
	}
	
	ns.WorkGroup.prototype = Object.create( library.component.UserGroup.prototype );
	
	// Public
	
	ns.WorkGroup.prototype.baseClose = library.component.UserGroup.prototype.close;
	ns.WorkGroup.prototype.close = function() {
		const self = this;
		delete self.onClick;
		self.baseClose();
	}
	
	// Private
	
	ns.WorkGroup.prototype.init = function() {
		const self = this;
		const elConf = {
			clientId     : self.clientId,
			name         : self.name,
			sectionKlass : self.sectionKlass,
			usersId      : self.usersId,
		};
		self.el = self.template.getElement( 'user-group-tmpl', elConf );
		const container = document.getElementById( self.containerId );
		if ( !container )
			throw new Error( 'UserGroup.init - invalid container id: ' + self.containerId );
		
		container.appendChild( self.el );
		self.head = self.el.querySelector( '.section-head' );
		//self.head.addEventListener( 'click', headClick, false );
		self.head.addEventListener( 'click', groupPoke, false );
		/*
		if ( 'DESKTOP' === window.View.deviceType )
			self.head.addEventListener( 'click', groupPoke, false );
		else
			self.head.addEventListener( 'touchend', groupPoke, false );
		*/
		
		self.usersEl = document.getElementById( self.usersId );
		self.updateVisible();
		
		function groupPoke( e ) {
			//e.stopPropagation();
			//e.preventDefault();
			self.handleClick();
		}
	}
	
	ns.WorkGroup.prototype.updateVisible = function() {
		const self = this;
		self.el.classList.toggle( 'hidden', false );
	}
	
	ns.WorkGroup.prototype.handleClick = function( e ) {
		const self = this;
		if ( self.onClick )
			self.onClick( self.clientId );
	}
	
})( library.view );


//
(function( ns, undefined ) {
	ns.WorkUser = function(
		clientId,
		user,
		id,
		tmplManager,
		onClick
	) {
		const self = this;
		self.onClick = onClick;
		library.component.GroupUser.call( self,
			clientId,
			null,
			user,
			id,
			tmplManager
		);
		
	}
	
	ns.WorkUser.prototype = Object.create( library.component.GroupUser.prototype );
	
	// Public
	
	ns.WorkUser.prototype.baseClose = library.component.GroupUser.prototype.close;
	ns.WorkUser.prototype.close = function() {
		const self = this;
		delete self.onClick;
		self.baseClose();
	}
	
	// Private
	
	ns.WorkUser.prototype.handleClick = function( e ) {
		const self = this;
		e.preventDefault();
		if ( self.onClick )
			self.onClick( self.id );
	}
	
})( library.view );

// 
(function( ns, undefined ) {
	ns.UserWorkCtrl = function(
		conn,
		users,
		identities,
		onlineList,
		workgroups,
		room,
		guestAvatar,
		containerId,
		templateManager,
		serverConfig
	) {
		const self = this;
		self.conf = serverConfig;
		self.members = {};
		self.works = {};
		self.rooms = null;
		self.subGroups = [];
		library.component.UserCtrl.call( self,
			conn,
			users,
			identities,
			onlineList,
			workgroups,
			room,
			guestAvatar,
			containerId,
			templateManager
		);
	}
	
	ns.UserWorkCtrl.prototype = Object.create( library.component.UserCtrl.prototype );
	
	// Public
	
	ns.UserWorkCtrl.prototype.getMember = function( worgId, userId ) {
		const self = this;
		const members = self.members[ worgId ];
		if ( !members )
			return null;
		
		return members[ userId ];
	}
	
	ns.UserWorkCtrl.prototype.getAvatarKlass = function( clientId ) {
		const self = this;
		const user = self.users[ clientId ];
		if ( user && user.isGuest )
			clientId = 'guest-user';
		
		return self.getUserCssKlass( clientId );
	}
	
	// Private
	
	ns.UserWorkCtrl.prototype.init = function( workgroups, users, ids, room ) {
		const self = this;
		self.room = room;
		self.build();
		self.groupList = new library.component.ListOrder( 'user-groups' );
		self.initBaseGroups();
		self.addIdentities( ids );
		self.setWorkgroups( workgroups );
		self.addUsers( users );
		self.addId( room );
		self.bindConn();
		
		self.conn.on( 'workgroup-sub-rooms', e => self.handleSubRooms( e ));
		self.conn.on( 'workgroup-members', e => self.handleWorgMembers( e ));
		
		//function worgMembers( e ) { self.handleWorgMembers( e ); }
	}
	
	ns.UserWorkCtrl.prototype.initBaseGroups = function() {
		const self = this;
		self.worgPri = 2;
		self.superPri = 1;
		self.subPri = 4;
		const base = [
			{
				clientId     : 'all_groups',
				name         : View.i18n( 'i18n_all_groups' ),
				sectionKlass : 'Action clickie',
				priority     : 3,
			},
		];
		
		base.forEach( worg => {
			let wId = worg.clientId;
			self.groupsAvailable[ wId ] = worg;
			self.addWorkGroup( worg.clientId );
		});
	}
	
	ns.UserWorkCtrl.prototype.handleSubRooms = function( subIds ) {
		const self = this;
		if ( !subIds )
			subIds = [];
		
		const curr = self.subGroups;
		const remove = curr.filter( notInSubs );
		const add = subIds.filter( notInCurr );
		remove.forEach( wId => self.removeWorkgroup( wId ));
		add.forEach( wId => {
			const subWorg = self.groupsAvailable[ wId ];
			subWorg.priority = self.subPri;
			self.addWorkGroup( wId, 'Available' );
		});
		self.subGroups = subIds;
		
		self.toggleSpecials();
		
		function notInSubs( cId ) {
			return !subIds.some( sId => sId === cId );
		}
		
		function notInCurr( sId ) {
			return !curr.some( cId => cId === sId );
		}
	}
	
	ns.UserWorkCtrl.prototype.handleWorgMembers = function( event ) {
		const self = this;
		const workId = event.workId;
		const members = event.members;
		const ids = event.identities;
		/*
		ids.forEach( id => {
			cId = id.clientId;
			if ( !self.identities[ cId ])
				self.identities[ cId ] = id;
		});
		*/
		self.addIdentities( ids );
		self.setWorkMembers( event.workId, event.members );
	}
	
	ns.UserWorkCtrl.prototype.setWorkgroups = function( conf ) {
		const self = this;
		if ( !conf || !conf.available )
			return;
		
		const superId = conf.superId;
		self.workId = conf.workId;
		self.superId = conf.superId;
		self.addUserCss( self.workId, self.room.avatar );
		self.addRooms( conf.rooms );
		const users = conf.users;
		/*
		if ( users )
			users.forEach( user => self.addUserCss( user.clientId, user.avatar ));
		*/
		
		const members = conf.members;
		const groups = conf.available;
		const gIds = Object.keys( groups );
		gIds.forEach( setGAvailable );
		const uGrp = self.groupsAvailable[ self.workId ];
		uGrp.priority = self.worgPri;
		self.addUserGroup( self.workId, 'Accept' );
		
		if ( superId && !( self.conf && self.conf.subsHaveSuperView )) {
			const superWorg = self.groupsAvailable[ superId ];
			superWorg.priority = self.superPri;
			self.addWorkGroup( superId, 'Action' );
			self.setWorkMembers( superId, members[ superId ] );
			const groupEl = document.getElementById( self.workId );
			const el = document.getElementById( superId );
			self.el.insertBefore( el, groupEl );
		}
		
		self.handleSubRooms( conf.subIds, conf.members );
		self.subGroups.forEach( wId => {
			self.setWorkMembers( wId, members[ wId ]);
		});
		
		function setGAvailable( gId ) {
			group = groups[ gId ];
			self.groupsAvailable[ gId ] = group;
		}
	}
	
	ns.UserWorkCtrl.prototype.addRooms = function( rooms ) {
		const self = this;
		if ( !rooms )
			return;
		
		self.rooms = rooms;
		const rIds = Object.keys( rooms );
		rIds.forEach( rId => {
			const room = self.rooms[ rId ];
			self.addUserCss( room.workId, room.avatar );
		});
	}
	
	ns.UserWorkCtrl.prototype.addWorkGroup = function( worgId, sectionKlass ) {
		const self = this;
		if ( self.works[ worgId ]) {
			console.log( 'addWorkGroup - already added', worgId );
			return;
		}
		
		const worg = self.groupsAvailable[ worgId ];
		if ( !worg ) {
			console.log( 'addWorkGroup - no worg for', {
				wId : worgId,
				ava : self.groupsAvailable,
			});
			return;
		}
		
		if ( null == worg.sectionKlass )
			worg.sectionKlass = sectionKlass || 'Available';
		
		worg.sectionKlass = worg.sectionKlass + ' MousePointer clickie';
		
		if ( !self.members[ worgId ])
			self.members[ worgId ] = {};
		
		let members = self.members[ worgId ];
		let group = new library.view.WorkGroup(
			worg,
			self.el.id,
			members,
			self.template,
			onClick
		);
		
		let cId = group.clientId;
		self.works[ cId ] = group;
		self.workIds = Object.keys( self.works );
		self.groupList.add( worg );
		
		function onClick( id ) {
			const target = {
				workgroup : id,
				user      : null,
			};
			self.emit( 'msg-target', target );
		}
	}
	
	ns.UserWorkCtrl.prototype.removeWorkgroup = function( worgId ) {
		const self = this;
		const group = self.works[ worgId ];
		if ( !group ) {
			console.log( 'no group for', {
				wId     : worgId,
				members : self.members,
				works   : self.works,
			});
			return;
		}
		
		self.removeMembers( worgId );
		self.groupList.remove( worgId );
		delete self.works[ worgId ];
		group.close();
		self.workIds = Object.keys( self.works );
	}
	
	ns.UserWorkCtrl.prototype.setWorkMembers = function( worgId, idList ) {
		const self = this;
		idList = idList || [];
		let group = self.works[ worgId ];
		let members = self.members[ worgId ];
		if ( !group ) {
			console.log( 'UserWrokCtrl.setWorkMembers - no group', {
				worgId : worgId,
				idList : idList,
				self : self,
			});
			return;
		}
		
		const mIds = Object.keys( members );
		let remove = mIds.filter( notInIdList );
		remove.forEach( mId => self.removeMember( mId, worgId ));
		idList.forEach( cId => {
			if ( members[ cId ])
				return;
			
			const identity = self.identities[ cId ];
			const conf = {
				/* can we live without?
				isAuthed   : true,
				workgroups : [ worgId ],
				*/
			};
			let user = new library.view.WorkUser(
				cId,
				conf,
				identity,
				self.template,
				onClick
			);
			members[ cId ] = user;
			//self.addUserCss( cId, identity.avatar );
			group.attach( cId );
		});
		
		function notInIdList( mId ) {
			return !idList.some( cId => cId === mId );
		}
		
		function onClick( id ) {
			const target = {
				workgroup : worgId,
				user      : id,
			};
			self.emit( 'msg-target', target );
		}
	}
	
	ns.UserWorkCtrl.prototype.removeMember = function( userId, worgId ) {
		const self = this;
		const members = self.members[ worgId ];
		if ( !members )
			return;
		
		const user = members[ userId ];
		if ( !user )
			return;
		
		const group = self.works[ worgId ];
		if ( !group )
			return;
		
		group.detach( userId );
		delete members[ userId ];
		user.close();
	}
	
	ns.UserWorkCtrl.prototype.removeMembers = function( worgId ) {
		const self = this;
		const members = self.members[ worgId ];
		const mIds = Object.keys( members );
		mIds.forEach( mId => {
			self.removeMember( mId, worgId );
		});
		
		delete self.members[ worgId ];
	}
	
	ns.UserWorkCtrl.prototype.setUserToGroup = function( userId ) {
		const self = this;
		const user = self.users[ userId ];
		if ( !user || !user.workgroups ) {
			console.log( 'setUSertoGroup - no user for', {
				uid : userId,
				users : self.users,
			});
			return;
		}
		
		const isInWorg = user.workgroups.some( worgId => worgId === self.workId );
		if ( !isInWorg ) {
			console.log( 'wtf?=', {
				u : user,
				w : self.workId,
			});
		}
		
		self.moveUserToGroup( user.id, self.workId );
	}
	
	ns.UserWorkCtrl.prototype.toggleSpecials = function() {
		const self = this;
		const show = !!self.subGroups.length;
		const grps = self.works[ 'all_groups' ];
		const mbms = self.works[ 'all_members' ];
		if ( grps && grps.el )
			grps.el.classList.toggle( 'hidden', !show );
		
		if ( mbms && mbms.el )
			mbms.el.classList.toggle( 'hidden', !show );
	}
	
})( library.view );

(function( ns, undefined ) {
	ns.WorkMsgBuilder = function(
		parentConn,
		containerId,
		users,
		userId,
		contactId,
		roomId,
		workgroups,
		input,
		parser,
		linkExpand,
		templateManager
	) {
		const self = this;
		library.component.MsgBuilder.call( self,
			parentConn,
			containerId,
			users,
			userId,
			contactId,
			roomId,
			workgroups,
			input,
			parser,
			linkExpand,
			templateManager
		);
	}
	
	ns.WorkMsgBuilder.prototype =
		Object.create( library.component.MsgBuilder.prototype );
		
	ns.WorkMsgBuilder.prototype.getEditer = function( msg ) {
		const self = this;
		const uId = msg.editBy;
		const user = self.users.getId( uId );
		if ( user )
			return user;
		
		const room = self.users.getId( self.roomId );
		if ( room )
			return room;
		
		return null;
	}
	
	ns.WorkMsgBuilder.prototype.handleMsg = function( event ) {
		const self = this;
		if ( self.exists( event.msgId ))
			return;
		
		const time = self.parseTime( event.time );
		const envelope = self.getEnvelope( time.envelope );
		const conf = {
			inGroup : self.isLastSpeaker( event, envelope ),
			event   : event,
		};
		
		let el = null;
		if ( 'msg' === event.type ) {
			el = self.buildMsg( conf );
			envelope.lastSpeakerId = event.fromId;
		}
		else {
			el = self.buildWorkMsg( conf );
			envelope.lastSpeakerId = null;
		}
		
		self.addItem( el, envelope, event );
		if ( self.contactId )
			self.updateLastDelivered( event );
		
		self.confirmEvent( 'message', event.msgId );
		return el;
	}
	
	ns.WorkMsgBuilder.prototype.buildWorkMsg = function( conf ) {
		const self = this;
		const tmplId = 'work-msg-tmpl';
		const msg = conf.event;
		const uId = msg.fromId;
		const fromId = self.users.getId( uId );
		const fromUser = self.users.get( uId );
		const selfUser = self.users.get( self.userId );
		const mId = msg.msgId;
		if ( !msg.targets ) {
			console.log( 'MsgBuilder.buildWorkMsg - no targets', conf );
			return null;
		}
		
		const source = self.users.getWorkgroup( msg.source );
		if ( !source ) {
			console.log( 'buildWorkMsg - no source, aborting', {
				msg  : conf.event,
				self : self,
			});
			return null;
		}
		
		let fromSuper = false;
		let fromSub = false;
		let fromThis = false;
		if ( msg.source === self.supergroupId )
			fromSuper = true;
		
		if ( msg.source === self.workgroupId )
			fromThis = true;
		
		if ( !fromSuper && !fromThis )
			fromSub = true;
		
		let userKlass = '';
		let selfKlass = 'sw1';
		let avatarType = '';
		let toFromHidden = 'hidden';
		let toFromNameHidden = 'hidden';
		let toFromMsg = '';
		let toFromName = '';
		let name = null;
		let canEdit = false;
		let canForward = self.checkCanForward( msg );
		const twIds = Object.keys( msg.targets );
		let targetNames = [];
		let targetHtmls = [];
		
		if ( fromThis ) {
			if ( !fromUser ) {
				
			} else {
				twIds.forEach( twId => {
					setToAll( twId, msg, targetNames );
				});
				if ( targetNames.length ) {
					targetHtmls = buildTargetEls( targetNames );
					toFromHidden = '';
					toFromMsg = View.i18n( 'i18n_message_to' );
				} else {
					emptyTargetNames( msg );
				}
			}
		}
		
		if ( fromSuper ) {
			setToUsers( self.workgroupId, msg, targetNames )
			if ( targetNames.length ) {
				targetHtmls = buildTargetEls( targetNames );
				toFromHidden = '';
				toFromMsg = View.i18n( 'i18n_private_message_to' );
			} else {
				emptyTargetNames( msg );
			}
		}
		
		if ( fromSuper ) {
			userKlass = self.users.getAvatarKlass( self.supergroupId );
			avatarType = 'room';
			name = source.name;
		}
		
		if ( fromThis ) {
			if ( fromUser ) {
				userKlass = self.users.getAvatarKlass( uId );
				name = fromUser.name;
			}
			else {
				avatarType = 'room';
				userKlass = self.users.getAvatarKlass( self.workgroupId );
				name = source.name;
			}
		}
		
		if ( fromSub ) {
			userKlass = self.users.getAvatarKlass( msg.fromId );
			name = msg.name; //'#' + source.name
			toFromHidden = 'hidden';
			toFromNameHidden = 'hidden';
			toFromMsg = View.i18n( 'i18n_message_from' );
			toFromName =  msg.name;
			if ( !fromUser )
				canEdit = true;
		}
		
		if ( uId === self.userId ) {
			selfKlass = 'sw2 isSelf';
			canEdit = true;
		}
		
		if ( fromUser && fromUser.isAdmin )
			canEdit = true;
		
		let original = msg.message;
		let message = null;
		if ( self.parser )
			message = self.parser.work( original );
		else
			message = original;
		
		const timeStr = self.getClockStamp( msg.time );
		const actionsHtml = self.buildMsgActions( canEdit, canForward );
		const msgConf = {
			msgId            : mId,
			userKlass        : userKlass,
			selfKlass        : selfKlass,
			avatarType       : avatarType,
			name             : name,
			toFromHidden     : toFromHidden,
			toFromNameHidden : toFromNameHidden,
			toFromMsg        : toFromMsg,
			toFromName       : toFromName,
			targets          : targetHtmls.join( '' ),
			time             : timeStr,
			original         : original,
			message          : message,
			msgActions       : actionsHtml,
		};
		const el = self.template.getElement( tmplId, msgConf );
		if ( self.linkEx )
			self.linkEx.work( el );
		
		return el;
		
		function buildTargetEls( targets ) {
			return targets.map( target => {
				let tarStr = target; //source + ' -> ' + target;
				let html = self.template.get( 'work-msg-target-tmpl', { target : tarStr });
				return html;
			});
		}
		
		function setToUsers( twId, msg, targetNames ) {
			const worg = self.users.getWorkgroup( twId );
			if ( !worg )
				return;
			
			const targets = msg.targets[ twId ];
			if ( !targets || !targets.length )
				return;
			
			targets.forEach( uId => {
				const user = self.users.getId( uId );
				if ( !user )
					return;
				
				targetNames.push( user.name );
			});
		}
		
		function setToAll( twId, msg, targetNames ) {
			const worg = self.users.getWorkgroup( twId );
			if ( !worg ) {
				console.log( 'addTargetNames - no worg', {
					twId  : twId,
					users : self.users,
				});
				return;
			}
			
			const target = msg.targets[ twId ];
			if ( null == target.length )
				targetNames.push( wName( worg ) );
			else
				setNames( worg, target );
			
			function setNames( worg, targets ) {
				const wId = worg.clientId;
				targets.forEach( uId => {
					let user = self.users.getId( uId );
					/*
					if ( wId === self.workgroupId )
						user = 
					else
						user = self.users.getMember( wId, uId );
					
					*/
					if ( !user ) {
						console.log( 'setNames - no user for', {
							uid : uId,
							w   : worg,
						});
						return;
					}
					
					const name = wName( worg ) + '/' + user.name;
					targetNames.push( name );
				});
			}
			
			function wName( worg ) {
				return '#' + worg.name;
			}
		}
		
		function emptyTargetNames( msg ) {
			console.log( 'MsgBuilderbuildWorkMsg - empty target names' );
			console.log( 'msg', msg );
			console.log( 'users', self.users );
			console.log( 'self', self );
		}
	}
	
})( library.view );

window.View.run = run;
function run( fupConf ) {
	window.conference = new library.view.Presence( fupConf );
}
