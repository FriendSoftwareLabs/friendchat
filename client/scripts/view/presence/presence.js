
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
		self.inputMode = '';
		
		self.appOnline = null;
		
		self.init();
	}
	
	ns.Presence.prototype.init = function() {
		const self = this
		window.View.setBody()
		if ( window.View.appSettings )
			self.compact = !!window.View.appSettings.compactChat
		
		if ( window?.View?.config?.appConf?.hideTitle ) {
			const tit = document.getElementById( 'room-title' )
			if ( null != tit )
				tit.classList.toggle( 'hidden', true )
		}
		
		self.buildUserList()
		
		// scroll to bottom on new message
		self.messageScroller = new library.component.BottomScroller( 'messages' )
		
		// highlight
		self.highlight = new library.component.Highlight({
			cssClass : 'Highlight',
			listener : handleHighlight,
		})
		
		function handleHighlight( e ) {
			self.send({
				type : 'highlight',
				data : e,
			})
		}
		
		// drag and drop handler
		const dropConf = {
			targetId : 'hello',
			ondrop   : onDrop,
		}
		self.drop = new library.component.Drop( dropConf )
		function onDrop( event ) {
			self.send( event )
		}
		
		//
		self.bindUI()
		self.bindConn()
		
		//
		window.View.loaded()
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
		self.toggleUsersBtn.addEventListener( 'click', toggleUserList, false );
		self.inviteBtn.addEventListener( 'click', showInviter, false );
		
		emoPanelBtn.addEventListener( 'click', toggleEmoPanel, false );
		inputForm.addEventListener( 'submit', inputSubmit, false );
		submitBtn.addEventListener( 'click', inputSubmit, false );
		attachBtn.addEventListener( 'click', attachFiles, false );
		
		function attach( e ) {
			const menu = ge( 'attachment-menu' );
			var can = menu.querySelector( '.Cancel' );
			var cam = menu.querySelector( '.Camera' );
			var upl = menu.querySelector( '.Upload' );
			
			if( menu.classList.contains( 'Showing' )) {
				menu.classList.remove( 'Showing' );
			} else {
				menu.classList.add( 'Showing' );
			}
			
			window.View.prepareCamera( cam, function( data ) {
				menu.classList.remove( 'Showing' );
			});
			
			can.onclick = function() {
				menu.classList.remove( 'Showing' );
			}
			
			upl.onclick = function( e ) {
				menu.classList.remove( 'Showing' );
				attachFiles( e );
			}
		}
		
		function attachFiles() {
			const attach = {
				type: 'attach-files',
				data: false
			};
			self.send( attach );
		};
		
		function closeBack( e ) { self.closeBack(); }
		
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
		
		window.addEventListener( 'paste', handlePaste, false );
		function handlePaste( e ) { self.handlePaste( e ); }
		
		window.View.on( 'drop', e => {
			self.handlePaste( e );
		});
	}
	
	ns.Presence.prototype.handlePaste = function( e ) {
		const self = this;
		const data = e.clipboardData || e.dataTransfer;
		if ( !data )
			return;
		
		const types = data.types.toString();
		if ( 'Files' !== types )
			return;
		
		const fm = new api.FileMaker();
		fm.fromPaste( e )
			.then( uploaded )
			.catch( e => console.log( 'handlePaste err', e ));
		
		function uploaded( res ) {
			const share = {
				type: 'drag-n-drop',
				data: res,
			};
			self.conn.send( share );
		};
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
		if ( !self.liveAllowed )
			return;
		
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
			//self.usersEl.classList.toggle( 'hidden', !show );
			self.msgBuilder.pauseSmoothScrolling();
			
			//self.messagesEl.classList.toggle( 'SmoothScrolling', !show );
			self.usersEl.classList.toggle( 'users-hide', !show );
			const btnIcon = self.toggleUsersBtn.querySelector( 'i' );
			btnIcon.classList.toggle( 'AvailableText', show );
			self.users.setUserListActive( show );
		}
	}
	
	ns.Presence.prototype.toggleUserListBtn = function( show ) {
		const self = this
		self.toggleUsersBtn.classList.toggle( 'hidden', !show )
	}

	ns.Presence.prototype.bindConn = function() {
		const self = this;
		self.conn.on( 'initialize'     , initialize );
		self.conn.on( 'state'          , state );
		self.conn.on( 'online'         , online );
		self.conn.on( 'offline'        , offline );
		self.conn.on( 'chat'           , chat );
		self.conn.on( 'persistent'     , persistent );
		self.conn.on( 'title'          , title );
		self.conn.on( 'mention-list'   , e => self.setMentionParsing( e ));
		self.conn.on( 'at-list'        , e => self.setAtParsing( e ));
		self.conn.on( 'identity-update', e => self.handleIdUpdate( e ));
		self.conn.on( 'live-disable'   , e => self.handleLiveDisable( e ));
		
		function initialize( e ) {
			try {
				self.handleInitialize( e );
			} catch( ex ) {
				console.log( 'initalize ex', ex );
			}
		}
		function state(      e ) { self.handleState( e ); }
		function online(     e ) { self.handleOnline( true ); }
		function offline(    e ) { self.handleOnline( false ); }
		function chat(       e ) { self.handleChat( e ); }
		function persistent( e ) { self.handlePersistent( e ); }
		function title(      e ) { self.handleTitle( e ); }
	}
	
	ns.Presence.prototype.handleInitialize = async function( conf ) {
		const self = this;
		const isMobile = ( 'MOBILE' === window.View.deviceType )
		
		hello.template = friend.template
		const state = conf.state
		
		// things
		self.room   = state.room
		self.isView = state.isView
		self.userId = state.userId
		self.ownerId     = state.ownerId
		self.clientId    = state.clientId
		self.contactId   = state.contactId
		self.isPrivate   = state.isPrivate
		self.userAdmin   = state.userAdmin
		self.persistent  = state.persistent
		self.liveAllowed = ( null != state.liveAllowed ) ? state.liveAllowed : true
		
		if ( window?.View?.config?.appConf?.mode == 'jeanie' ) {
			const am = document.getElementById( 'attachment-menu' )
			if ( null != am )
				am.querySelector( 'button.Camera' ).classList.toggle( 'hidden', true )
			
		}
		
		// selecting constructors
		let UserCtrl = library.component.UserCtrl
		let MsgBuilder = library.component.MsgBuilder
		const isWorkroom = ( state.workgroups && state.workgroups.workId )
		if ( isWorkroom ) {
			UserCtrl = ns.UserWorkCtrl
			MsgBuilder = ns.WorkMsgBuilder
		}
		if ( window?.View?.config?.appConf?.mode == 'jeanie' )
			UserCtrl = ns.UserJeanieCtrl
		
		if ( self.isPrivate )
			MsgBuilder = ns.PrivateMsgBuilder
		
		//
		if ( !self.isPrivate )
			self.toggleUserListBtn( true )
		
		if ( !self.isPrivate && !isWorkroom && ( self.userId === self.ownerId && self.userAdmin ))
			self.inviteBtn.classList.toggle( 'hidden', false )
		
		//
		self.users = new UserCtrl(
			self.conn,
			state.userList,
			state.adminList,
			state.recentList,
			state.guestList,
			state.peerList,
			state.workgroups,
			state.room,
			state.guestAvatar,
			'users-position',
			state.config,
			state.allowedContacts,
		)
		
		window.setTimeout( doInit, 1000 )
		function doInit() {
			self.users.initialize()
			if ( state.config && state.config.showUserList && !isMobile )
				self.toggleUserList( true )
		}
		
		//
		if ( !window.View.appConf.hideLive ) {
			self.liveStatus = new library.component.LiveStatus(
				'live-status-container',
				self.users,
				self.userId,
			);
			self.liveStatus.update( state.peerList );
			self.liveStatus.on( 'show', e => self.goLive( e ));
			self.liveStatus.on( 'join', e => self.goLive( e ));
			
			if ( !self.liveAllowed )
				self.handleLiveDisable( true );
		}
		
		// get logs when scrolling to top
		self.logFetcher = new library.component.LogFetcher(
			'message-container',
			'messages',
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
		self.linkExpand = new library.component.LinkExpand( window.View.appSettings );
		//self.pathExpand = new library.component.FPathExpand();
		
		// message parsing
		self.parser = new library.component.parse.Parser()
		self.setMentionParsing( state.mentionList )
		self.setAtParsing( state.atList )
		self.parser.use( 'FriendPath' )
		self.parser.use( 'LinkStd' )
		self.parser.use( 'Emojii', conf.emojii )
		
		// multiline input
		const inputConf = {
			containerId     : 'input-container',
			templateManager : friend.template,
			enterIsNewline  : isMobile,
		}
		self.input = new library.component.MultiInput( inputConf )
		self.input.on( 'state' , e => self.handleInputState( e ))
		self.input.on( 'change', e => self.handleInputChange( e ))
		self.input.on( 'tab'   , e => self.handleInputTab( e ))
		self.input.on( 'arrow' , ( e, v ) => self.handleInputArrow( e, v ))
		self.input.on( 'enter' , e => self.handleInputEnter( e ))
		self.input.on( 'submit', e => self.handleInputSubmit( e ))
		
		// message builder
		const msgBuilderArgs = [
			self.conn,
			'messages',
			self.users,
			self.userId,
			self.clientId,
			self.input,
			self.parser,
			self.linkExpand,
			null,
		]
		
		if ( isWorkroom ) {
			msgBuilderArgs.push( self.isView )
			msgBuilderArgs.push( state.workgroups )
		}
		
		if ( state.isPrivate )
			msgBuilderArgs.push( self.contactId )
		
		self.msgBuilder = new MsgBuilder( ...msgBuilderArgs )
		
		// input history
		const hConf = {
			inputId : 'chat-input',
		};
		self.inputHistory = new library.component.InputHistory( hConf );
		
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
			emoElementMap,
			onEmojii
		);
		function onEmojii( str ) {
			self.input.add( ' ' + str );
			self.input.focus();
		}
		
		// notify helper
		const notieAnchor = self.input.getElement();
		const notieConf = {
			show : false,
			css  : '',
			position : {
				outside : {
					parent : 'top-left',
					self   : 'bottom-left',
				}
			},
		};
		
		try {
			self.notify = new library.component.InputHelper( 'notify', notieAnchor, notieConf );
		} catch ( ex ) {
			console.log( 'exxx', ex );
		}
		self.notify.on( 'add', e => self.handleNotifyAdd( e ));
		
		// things
		if ( self.isPrivate )
			self.setPrivateUI();
		else {
			if ( self.isView )
				self.setViewUI();
			else
				self.setGroupUI();
		}
		
		if ( state.isHidden )
			self.handleHidden( state );
		
		// only focus input if desktop
		if ( 'DESKTOP' == window.View.deviceType ) {
			self.input.focus();
		}
		
		window.View.ready();
		//window.View.showLoading( false );
		self.user = await self.users.getIdentity( self.userId );
		self.sendChatEvent({
			type : 'log',
			data : null,
		});
	}
	
	ns.Presence.prototype.setMentionParsing = function( mentions ) {
		const self = this;
		const mentionConf = {
			atStrings : mentions,
		};
		
		if ( self.mentionPId ) {
			self.parser.update( self.mentionPId, mentionConf );
			return;
		}
		
		mentionConf.cssKlass = 'Action';
		self.mentionPId = self.parser.use( 'AtThings', mentionConf, true );
	}
	
	ns.Presence.prototype.setAtParsing = function( ats ) {
		const self = this;
		ats = ats || [];
		ats.sort( byAN );
		/*
		self.atList = ats || [];
		self.atList.sort( byAN );
		*/
		
		if ( self.isPrivate )
			self.atList = ats;
		else {
			const atDefaults = self.users.getAtDefaults();
			self.atList = [ ...atDefaults, ...ats ];
			//self.atList = [ 'everyone', 'admins', 'active', 'guests', ...self.atList ];
		}
		
		const atConf = {
			atStrings : self.atList,
		};
		
		if ( self.atPId ) {
			self.parser.update( self.atPId, atConf );
			return;
		}
		
		atConf.cssKlass = 'ActionText';
		self.atPId = self.parser.use( 'AtThings', atConf, true );
		
		function byAN( nameA, nameB ) {
			if ( !nameA || !nameB )
				return 0;
			
			const a = nameA.toLowerCase();
			const b = nameB.toLowerCase();
			let sort = 0;
			let more = true;
			let i = 0;
			while( more ) {
				const ai = a[ i ];
				const bi = b[ i ];
				i++;
				
				if ( i == a.length ) {
					more = false;
					continue;
				}
				
				if ( ai === bi )
					continue;
				
				more = false;
				if ( ai > bi )
					sort = 1;
				else
					sort = -1;
			}
			
			return sort;
		}
	}
	
	ns.Presence.prototype.handleHidden = function( state ) {
		const self = this;
		self.isDisabled = state.isDisabled;
		const live = document.getElementById( 'live-status-container' );
		const actions = document.getElementById( 'room-actions' );
		const foot = document.getElementById( 'foot' );
		hide( live );
		hide( actions );
		hide( foot );
		
		// top info
		const elDisabled = hello.template.getElement( 'contact-disabled-tmpl', {});
		const title = document.getElementById( 'room-status' );
		title.appendChild( elDisabled );
		
		// input replacement
		const elNoReply = hello.template.getElement( 'input-disabled-tmpl', {});
		const conference = document.getElementById( 'conference' );
		conference.appendChild( elNoReply );
		
		function hide( el ) {
			if ( !el )
				return;
			
			el.classList.toggle( 'hidden', true );
		}
	}
	
	ns.Presence.prototype.setPrivateUI = async function() {
		const self = this;
		self.usersEl.classList.toggle( 'hidden', true );
		self.toggleUserListBtn( false );
		await self.setContactTitle();
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
		
		self.usersEl.classList.toggle( 'hidden', false );
		self.toggleUserListBtn( true );
		self.setGroupTitle();
		
	}
	
	ns.Presence.prototype.setContactTitle = async function() {
		const self = this;
		if ( self.titleId )
			self.clearTitle();
		
		self.titleId = friendUP.tool.uid( 'title' );
		const stateId = friendUP.tool.uid( 'cstate' );
		const user = await self.users.getIdentity( self.contactId );
		if ( !user ) {
			console.log( 'setContactTitle - no user', self );
			return;
		}
		
		const avatarKlass = await self.users.getAvatarKlass( self.contactId );
		const conf = {
			id             : self.titleId,
			statusId       : stateId,
			avatarCssKlass : avatarKlass,
			contactName    : user.name,
		};
		self.titleEl = friend.template.getElement( 'contact-title-tmpl', conf );
		self.titleContainer.appendChild( self.titleEl );
		
		if ( window?.View?.config?.appConf?.mode == 'jeanie' )
			return;
		
		const statusConf = {
			containerId : stateId,
			type        : 'led',
			cssClass    : 'led-online-status PadBackground',
			statusMap   : {
				offline   : 'Off',
				online    : 'On',
			},
		};
		self.contactStatus = new library.component.StatusIndicator( statusConf );
		const isOnline = user.isOnline;
		self.handleOnline( isOnline );
	}
	
	ns.Presence.prototype.updateContactTitle = function( update ) {
		const self = this;
		const id = update.data;
		const cId = id.clientId;
		if ( cId !== self.contactId )
			return;
		
		if ( null == self.titleEl )
			return;
		
		const nameEl = self.titleEl.querySelector( '.title-name' );
		nameEl.textContent = id.name;
	}
	
	ns.Presence.prototype.setGroupTitle = async function() {
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
		if ( window?.View?.config?.appConf?.mode == 'jeanie' ) {
			const conf = {
				id             : self.titleId,
				roomName       : self.room.name,
			};
			
			self.titleEl = friend.template.getElement( 'group-title-hash-tmpl', conf );
			
		} else {
			const avatarKlass = await self.users.getAvatarKlass( id.clientId );
			const conf = {
				id             : self.titleId,
				roomName       : self.room.name,
				avatarCssKlass : avatarKlass,
			};
			
			self.titleEl = friend.template.getElement( 'group-title-avatar-tmpl', conf );
		}
		
		
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
		
		if ( !self.contactStatus )
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
		
		if ( !event.state )
			return;
		
		const eType = event.state.type;
		const state = 'typing';
		let isTyping = null;
		// 'set-typing' or 'clear-typing'
		if ( 'set-typing' === eType )
			isTyping = true;
		if ( 'clear-typing' === eType )
			isTyping = false;
		
		self.users.setState( uid, state, isTyping );
	}
	
	/*
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
	*/
	
	ns.Presence.prototype.handlePersistent = function( event ) {
		const self = this;
		console.log( 'handlePersistent - NYI', event );
	}
	
	ns.Presence.prototype.handleTitle = function( title ) {
		const self = this;
		if ( !self.titleId )
			return;
		
		const titleEl = document.getElementById( self.titleId );
		if ( null == titleEl )
			return;
		
		const nameEl = titleEl.querySelector( '.title-name' );
		nameEl.textContent = title;
	}
	
	ns.Presence.prototype.handleIdUpdate = function( update ) {
		const self = this;
		self.users.updateIdentity( update );
		if ( self.isPrivate )
			self.updateContactTitle( update );
	}
	
	ns.Presence.prototype.handleLiveDisable = function( disable ) {
		const self = this
		self.liveAllowed = !disable
		if ( null != self.liveStatus )
			self.liveStatus.setLiveAllowed( !disable )
		
	}
	
	// things
	
	ns.Presence.prototype.handleInputChange = function( event ) {
		const self = this;
		const str = event.string;
		const lastChar = str[ event.caretPos -1 ];
		if ( !!self.inputMode && !str ) {
			self.unsetMode();
			return;
		}
		
		if ( 'notify' === self.inputMode ) {
			const at = self.getAtStr();
			if ( at )
				updateNotify( at.str );
			else
				self.unsetMode();
			
			return;
		}
		
		if ( '@' === lastChar ) {
			const at = self.getAtStr();
			showNotify( at.str );
			return;
		}
		
		/*
		const at = self.getAtStr();
		if ( at ) {
			showNotify( at.str );
			return;
		}
		*/
		
		if ( str.length === 1 && '/' === lastChar ) {
			showCommand();
			return;
		}
		
		function showNotify( str ) {
			self.inputMode = 'notify';
			//let names = self.users.getUserNames( self.userId );
			let names = self.atList;
			if ( !self.isPrivate ) {
				//
				//names = [ 'everyone', 'admins', 'active', 'guests', ...names ];
				
				//
				/*
				const groups = self.users.getGroupNames();
				if ( groups && groups.length )
					names = names.concat( groups );
				*/
			}
			
			self.notify.show( names, str );
		}
		
		function updateNotify( filter ) {
			self.notify.update( filter );
		}
		
		function showCommand( str ) {
			self.inputMode = 'command';
		}
	}
	
	ns.Presence.prototype.unsetMode = function() {
		const self = this;
		if ( 'notify' === self.inputMode ) {
			self.notify.hide();
		}
		
		self.inputMode = '';
	}
	
	ns.Presence.prototype.handleInputTab = function( e ) {
		const self = this;
		if ( '' === self.inputMode )
			return false;
		
		if ( 'notify' === self.inputMode )
			return self.tabCompleteNotify( e );
		
	}
	
	ns.Presence.prototype.tabCompleteNotify = function( e ) {
		const self = this;
		const at = self.getAtStr();
		if ( !at )
			return false;
		
		e.preventDefault();
		e.stopPropagation();
		return self.expandAtString( at, ' ' );
	}
	
	ns.Presence.prototype.handleNotifyAdd = function( str ) {
		const self = this;
		const at = self.getAtStr();
		if ( null == at )
			return;
		
		at.str = str;
		self.expandAtString( at, ' ' );
	}
	
	ns.Presence.prototype.handleInputArrow = function( direction, value ) {
		const self = this;
		if ( 'notify' == self.inputMode )
			return self.selectInNotify( direction );
		
		if ( !value && ( 'up' === direction )) {
			self.msgBuilder.editLastUserMessage();
			return true;
		}
		
		return false;
		
		/*
		if ( '' == self.inputMode )
			return false;
		*/
	}
	
	ns.Presence.prototype.selectInNotify = function( direction ) {
		const self = this;
		return self.notify.scrollItems( direction );
	}
	
	ns.Presence.prototype.handleInputEnter = function( e ) {
		const self = this;
		if ( 'notify' == self.inputMode ) {
			const at = self.getAtStr();
			if ( !at ) {
				self.unsetMode();
				return false;
			}
			
			const str = self.notify.selectItem(); 
			if ( !str )
				return false;
			
			at.str = str;
			self.expandAtString( at, ' ' );
			return true;
		}
		
		return false;
	}
	
	ns.Presence.prototype.expandAtString = function( at, postfix ) {
		const self = this;
		const atStr = at.str;
		const current = at.input;
		const start = current.slice( 0, at.position );
		const end = current.slice( at.end );
		const name = self.notify.getName( atStr );
		if ( !name )
			return false;
		
		let post = '';
		if ( null != postfix )
			post = postfix;
		
		const replacement = start
			+ '@'
			+ name
			+ post
			+ end;
		
		self.unsetMode();
		self.input.setValue( replacement );
		self.input.focus();
	}
	
	ns.Presence.prototype.getAtStr = function( offset ) {
		const self = this;
		const current = self.input.getValue();
		let cPos = self.input.getCursorPos();
		if ( null != offset )
			cPos = cPos + offset;
		
		let i = cPos || current.length;
		let aPos = null;
		let aEnd = i;
		i = i - 1;
		while(( null == aPos ) && ( 0 <= i )) {
			const c = current[ i ];
			if ( '@' === c )
				aPos = i;
			
			--i;
		}
		
		if ( null == aPos )
			return null;
		
		const atStart = current.slice( aPos, aEnd );
		const after = current.slice( aEnd );
		const post = after.split( ' ' )[ 0 ];
		let atStr = null;
		if ( post && post.length )
			atStr = atStart + post;
		else
			atStr = atStart;
		
		const at = {
			position : aPos,
			start    : aPos,
			end      : aEnd,
			str      : atStr,
			input    : current,
			cursor   : cPos,
		};
		return at;
	}
	
	ns.Presence.prototype.handleInputState = function( state ) {
		const self = this;
		const e = {
			type : 'state',
			data : state,
		};
		self.sendChatEvent( e );
	}
	
	ns.Presence.prototype.handleInputSubmit = function( message ) {
		const self = this;
		self.inputHistory.add( message );
		const msg = {
			type : 'msg',
			data : {
				message : message,
			},
		};
		self.sendChatEvent( msg );
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
		worgId,
		conf,
		containerId
	) {
		const self = this;
		library.component.UserGroup.call( self,
			worgId,
			conf,
			containerId,
		);
	}
	
	ns.WorkGroup.prototype = Object.create( library.component.UserGroup.prototype );
	
	// Public
	
	ns.WorkGroup.prototype.baseClose = library.component.UserGroup.prototype.close;
	ns.WorkGroup.prototype.close = function() {
		const self = this;
		self.baseClose();
	}
	
	// Private
	
	ns.WorkGroup.prototype.init = function() {
		const self = this;
		const elConf = {
			clientId     : self.id,
			name         : self.name,
			sectionKlass : self.sectionKlass,
			usersId      : self.usersId,
		};
		self.el = hello.template.getElement( 'user-group-tmpl', elConf );
		const container = document.getElementById( self.containerId );
		if ( !container )
			throw new Error( 'UserGroup.init - invalid container id: ' + self.containerId );
		
		container.appendChild( self.el );
		self.usersEl = document.getElementById( self.usersId );
		self.head = self.el.querySelector( '.section-head' );
		//self.head.addEventListener( 'click', headClick, false );
		self.head.addEventListener( 'click', groupPoke, false );
		self.itemList = new library.component.ListOrder( self.usersId, [ 'name' ]);
		self.updateVisible();
		/*
		if ( 'DESKTOP' === window.View.deviceType )
			self.head.addEventListener( 'click', groupPoke, false );
		else
			self.head.addEventListener( 'touchend', groupPoke, false );
		*/
		
		
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
		self.emit( 'click', self.id );
	}
	
})( library.view );


//
(function( ns, undefined ) {
	ns.WorkUser = function(
		clientId,
		conf,
		onClick
	) {
		const self = this;
		self.userId = conf.userId;
		self.onClick = onClick;
		
		library.component.GroupUser.call( self,
			clientId,
			null,
			conf
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
			self.onClick( self.userId );
	}
	
})( library.view );

// 
(function( ns, undefined ) {
	ns.UserWorkCtrl = function(
		conn,
		userList,
		adminList,
		recentList,
		guestList,
		peerList,
		workgroups,
		room,
		guestAvatar,
		containerId,
		serverConfig
	) {
		const self = this;
		self.conf = serverConfig;
		self.workId = null; // workgroup id for this room
		self.superId = null; // super room workgroup id
		self.subIds = []; // sub room workgroup ids
		self.members = {};
		self.memberList = {};
		self.userToMembers = {};
		self.memberToUser = {};
		self.works = {};
		self.workIds = [];
		self.rooms = null;
		library.component.UserCtrl.call( self,
			conn,
			userList,
			adminList,
			recentList,
			guestList,
			peerList,
			workgroups,
			room,
			guestAvatar,
			containerId,
			serverConfig
		);
	}
	
	ns.UserWorkCtrl.prototype = Object.create( library.component.UserCtrl.prototype );
	
	ns.UserWorkCtrl.prototype.initialize = async function() {
		const self = this;
		const noClick = true;
		self.showWorkgroup( self.workId, noClick );
		self.subIds.forEach( wId => self.showWorkgroup( wId ));
		if ( self.superId && !self.conf.supersSubHideSuper )
			self.showWorkgroup( self.superId );
		
		await self.populateUserList();
		self.isInitialized = true;
	}
	
	// Public
	
	ns.UserWorkCtrl.prototype.getMember = function( worgId, userId ) {
		const self = this;
		const members = self.members[ worgId ];
		if ( !members )
			return null;
		
		const u2m = self.userToMembers[ userId ];
		const memId = u2m[ worgId ];
		const member = members[ memId ];
		return member
	}
	
	ns.UserWorkCtrl.prototype.getAvatarKlass = function( clientId ) {
		const self = this;
		const user = self.users[ clientId ];
		if ( user && user.isGuest )
			clientId = 'guest-user';
		
		return self.getUserCssKlass( clientId );
	}
	
	ns.UserWorkCtrl.prototype.getUserNames = function( excludeId ) {
		const self = this;
		const allIds = {};
		self.userIds.forEach( uId => {
			allIds[ uId ] = true;
		});
		
		self.workIds.forEach( wId => {
			const worg = self.members[ wId ];
			const uIds = Object.keys( worg );
			uIds.forEach( uId => {
				allIds[ uId ] = true;
			});
		});
		
		if ( excludeId )
			delete allIds[ excludeId ];
		
		const ids = Object.keys( allIds );
		const names = ids.map( uId => {
			const id = self.getSync( uId );
			return id.name;
		});
		
		names.sort();
		return names;
	}
	
	ns.UserWorkCtrl.prototype.getGroupNames = function() {
		const self = this;
		const all = [];
		all.push( self.workId );
		self.workIds.forEach( wId => {
			if ( 'all_groups' == wId )
				return;
			
			all.push( wId );
		});
		
		const names = all.map( gId => {
			const grp = self.groupsAvailable[ gId ];
			return grp.name;
		});
		
		return names;
	}
	
	ns.UserWorkCtrl.prototype.getAtDefaults = function() {
		const self = this;
		return [];
	}
	
	// Private
	
	ns.UserWorkCtrl.prototype.init = async function(
		workgroups,
		room
	) {
		const self = this;
		self.room = room;
		self.build();
		self.groupList = new library.component.ListOrder( 'user-groups' );
		self.addId( room );
		self.initGroups();
		self.initWorkgroups( workgroups );
		self.bindConn();
		
		self.conn.on( 'workgroup-sub-rooms', e => self.handleSubRooms( e ));
		self.conn.on( 'workgroup-members', e => self.handleWorgMembers( e ));
		
		//function worgMembers( e ) { self.handleWorgMembers( e ); }
	}
	
	ns.UserWorkCtrl.prototype.initGroups = function() {
		const self = this;
		self.superPri = 1;
		self.worgPri = 2;
		self.basePri = 3;
		self.subPri = 4;
		const base = [
			{
				clientId     : 'all_groups',
				name         : View.i18n( 'i18n_all_groups' ),
				sectionKlass : 'base-group group-all',
				priority     : self.basePri,
			},
		];
		
		base.forEach( worg => {
			let wId = worg.clientId;
			self.groupsAvailable[ wId ] = worg;
			self.setupWorkgroup( worg.clientId );
			self.showWorkgroup( worg.clientId );
		});
	}
	
	ns.UserWorkCtrl.prototype.handleJoin = async function( conf ) {
		const self = this;
		const user = conf.user;
		const uId = user.clientId;
		if ( user.isRecent )
			self.recentAdd( uId );
		
		const worgs = user.workgroups;
		if ( null == worgs )
			throw new Error( 'handleJoin - no worgs' );
		
		self.addUser( user, worgs );
		self.addSuperMember( user, worgs );
		self.addSubMember( user, worgs );
	}
	
	ns.UserWorkCtrl.prototype.addUser = function( user, worgs ) {
		const self = this;
		let isUser = worgs.some( wId => wId === self.workId );
		if ( !isUser )
			return;
		
		const cId = user.clientId;
		const uIdx = self.userList.indexOf( cId );
		if ( -1 != uIdx )
			return;
		
		self.userList.push( cId );
		let mList = self.memberList[ self.workId ];
		if ( null == mList ) {
			mList = [ cId ];
			self.memberList[ self.workId ] = mList;
		} else
			self.memberList[ self.workId ].push( cId );
		
		self.buildUser( cId, worgs );
	}
	
	ns.UserWorkCtrl.prototype.addSuperMember = function( user, worgs ) {
		const self = this;
		const isSuper = worgs.some( wId => wId === self.superId );
		if ( !isSuper )
			return;
		
		const cId = user.clientId;
		self.memberList[ self.superId ].push( cId );
		self.setWorkMember( cId, self.superId );
	}
	
	ns.UserWorkCtrl.prototype.addSubMember = function( user, worgs ) {
		const self = this;
		worgs.forEach( wId => {
			const isSub = self.subIds.some( sId => sId === wId );
			if ( !isSub )
				return;
			
			const cId = user.clientId;
			self.memberList[ wId ].push( cId );
			self.setWorkMember( cId, wId );
		});
	}
	
	ns.UserWorkCtrl.prototype.handleSubRooms = function( subIds ) {
		const self = this;
		if ( !subIds )
			subIds = [];
		
		const curr = self.subIds;
		const remove = curr.filter( notInSubs );
		const add = subIds.filter( notInCurr );
		remove.forEach( wId => self.removeSubGroup( wId ));
		add.forEach( wId => {
			self.addSubGroup( wId );
		});
		
		self.toggleSpecials();
		
		function notInSubs( cId ) {
			return !subIds.some( sId => sId === cId );
		}
		
		function notInCurr( sId ) {
			return !curr.some( cId => cId === sId );
		}
	}
	
	ns.UserWorkCtrl.prototype.addSubGroup = function( subId ) {
		const self = this;
		const sIdx = self.subIds.indexOf( subId );
		if ( -1 != sIdx )
			return;
		
		self.subIds.push( subId );
		const subWorg = self.groupsAvailable[ subId ];
		subWorg.priority = self.subPri;
		self.setupWorkgroup( subId, 'base-group group-work' );
		if ( !self.isInitialized )
			return;
		
		self.showWorkgroup( subId );
		self.setWorkMembers( subId );
	}
	
	ns.UserWorkCtrl.prototype.removeSubGroup = function( subId ) {
		const self = this;
		const sIdx = self.subIds.indexOf( subId );
		if ( -1 == sIdx )
			return;
		
		self.removeWorkgroup( subId );
		self.subIds.splice( sIdx, 1 );
	}
	
	ns.UserWorkCtrl.prototype.handleWorgMembers = async function( event ) {
		const self = this;
		const workId = event.workId;
		const members = event.members;
		self.memberList[ workId ] = members;
		//const ids = event.identities;
		/*
		ids.forEach( id => {
			cId = id.clientId;
			if ( !self.identities[ cId ])
				self.identities[ cId ] = id;
		});
		*/
		//self.addIdentities( ids );
		await self.setWorkMembers( workId );
	}
	
	ns.UserWorkCtrl.prototype.initWorkgroups = function( conf ) {
		const self = this;
		if ( null == conf ) {
			console.log( 'UserWorkCtrl.initWorkgroups - no conf ???' );
			return;
		}
		
		self.workId = conf.workId;
		self.superId = conf.superId;
		self.subIds = [];
		self.addUserCss( self.workId, self.room.avatar );
		self.addRooms( conf.rooms );
		
		self.memberList = conf.members;
		const ava = conf.available;
		const wIds = Object.keys( ava );
		wIds.forEach( wId => {
			const worg = ava[ wId ];
			self.addWorgAvailable( worg );
		});
		
		self.addUserGroup();
		self.addSuperGroup();
		conf.subIds.forEach( sId => {
			self.addSubGroup( sId );
		});
		
		self.toggleSpecials();
	}
	
	ns.UserWorkCtrl.prototype.populateUserList = async function() {
		const self = this;
		await self.setUsers();
		//await self.setWorkMembers( self.workId );
		await self.setSuperMembers();
		const subWaits = self.subIds.map( wId => self.setWorkMembers( wId ));
		await Promise.all( subWaits );
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
	
	ns.UserWorkCtrl.prototype.addUserGroup = function() {
		const self = this;
		const userGroup = self.groupsAvailable[ self.workId ];
		userGroup.priority = self.worgPri;
		
		const noClick = true;
		const sectionKlass = 'base-group group-users';
		self.setupWorkgroup( self.workId, sectionKlass, noClick );
	}
	
	ns.UserWorkCtrl.prototype.addSuperGroup = function() {
		const self = this;
		if ( null == self.superId )
			return;
		
		if ( self.conf.supersSubHideSuper )
			return;
		
		const superWorg = self.groupsAvailable[ self.superId ];
		superWorg.priority = self.superPri;
		self.setupWorkgroup( self.superId, 'base-group group-other' );
	}
	
	ns.UserWorkCtrl.prototype.setSuperMembers = async function() {
		const self = this;
		if ( null == self.superId )
			return;
		
		if ( self.conf.supersSubHideSuper )
			return;
		
		await self.setWorkMembers( self.superId );
		//const groupEl = document.getElementById( self.workId );
		//const el = document.getElementById( self.superId );
		//self.el.insertBefore( el, groupEl );
	}
	
	ns.UserWorkCtrl.prototype.setupWorkgroup = function( worgId, sectionKlass, noClick ) {
		const self = this;
		let group = self.getGroup( worgId );
		if ( group ) {
			return;
		}
		
		const worg = self.groupsAvailable[ worgId ];
		if ( !worg ) {
			console.log( 'setupWorkgroup - no worg for', {
				wId : worgId,
				ava : self.groupsAvailable,
			});
			return;
		}
		
		if ( null == worg.sectionKlass )
			worg.sectionKlass = sectionKlass;
		
		if ( null == noClick )
			worg.sectionKlass = worg.sectionKlass + ' MousePointer clickie';
		
		if ( !self.members[ worgId ])
			self.members[ worgId ] = {};
		
	}
	
	ns.UserWorkCtrl.prototype.showWorkgroup = function( wId, noClick ) {
		const self = this;
		const worg = self.groupsAvailable[ wId ];
		const group = new library.view.WorkGroup(
			wId,
			worg,
			self.el.id,
		);
		
		const gId = group.id;
		self.works[ gId ] = group;
		self.workIds.push( gId );
		self.groupList.add( worg );
		if ( !noClick )
			group.on( 'click', onClick );
		
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
		const group = self.getGroup( worgId );
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
	
	ns.UserWorkCtrl.prototype.setUsers = async function() {
		const self = this;
		const waitU = self.userList.map( uId => {
			return self.buildUser( uId );
		});
		await Promise.all( waitU );
	}
	
	ns.UserWorkCtrl.prototype.setWorkMembers = async function( worgId ) {
		const self = this;
		const idList = self.memberList[ worgId ] || [];
		const group = self.getGroup( worgId );
		let members = self.members[ worgId ];
		if ( null == members ) {
			members = {};
			self.members[ worgId ] = members;
		}
		
		if ( !group ) {
			console.log( 'UserWorkCtrl.setWorkMembers - no group', {
				worgId : worgId,
				idList : idList,
				self   : self,
			});
			return;
		}
		
		const idWaits = idList.map( cId => {
			return self.getIdentity( cId );
		});
		
		const idMap = {};
		idList.forEach( cId => {
			idMap[ cId ] = true;
		});
		const mIds = Object.keys( members );
		const remove = mIds
			.map( mId => checkIsStale( mId, idMap ))
			.filter( rId => null != rId );
		
		remove.forEach( cId => self.removeMember( cId, worgId ));
		
		await Promise.all( idWaits );
		idList.forEach( cId => {
			self.setWorkMember( cId, worgId );
		});
		
		function checkIsStale( memId, idMap ) {
			let staleId = null;
			const currId = self.memberToUser[ memId ];
			if ( !idMap[ currId ])
				staleId = currId;
			
			return staleId;
		}
	}
	
	ns.UserWorkCtrl.prototype.setWorkMember = function( cId, worgId ) {
		const self = this;
		const members = self.members[ worgId ];
		const group = self.getGroup( worgId );
		if ( null == group )
			return;
		
		let u2m = self.userToMembers[ cId ];
		if (( null != u2m ) && ( null != u2m[ worgId ])) {
			// already set
			return;
		}
		
		const memberId = friendUP.tool.uid( 'mem' );
		if ( null == u2m ) {
			u2m = {
				list : [ memberId ],
			};
			self.userToMembers[ cId ] = u2m;
		} else {
			u2m.list.push( memberId );
		}
		
		u2m[ memberId ] = worgId;
		u2m[ worgId ] = memberId;
		
		const identity = self.getIdSync( cId );
		identity.isAuthed = true;
		const conf = {
			clientId   : memberId,
			userId     : identity.clientId,
			name       : identity.name,
			workgroups : [ ...identity.workgroups ],
		};
		
		let member = new library.view.WorkUser(
			memberId,
			conf,
			onClick
		);
		members[ memberId ] = member;
		self.memberToUser[ memberId ] = cId;
		self.detached.appendChild( member.el );
		//self.addUserCss( cId, identity.avatar );
		group.attach( member );
		let status = null;
		if ( identity.isOnline )
			status = 'online';
		else
			status = 'offline';
		
		member.setStatus( status );
		
		function onClick( id ) {
			const target = {
				workgroup : worgId,
				user      : id,
			};
			self.emit( 'msg-target', target );
		}
	}
	
	ns.UserWorkCtrl.prototype.getUser = function( userId ) {
		const self = this;
		const list = [];
		const user = self.users[ userId ];
		if ( user )
			list.push( user );
		
		const u2m = self.userToMembers[ userId ];
		if ( u2m )
			u2m.list.forEach( mId => {
				//const user = self.users[ mId ];
				const wId = u2m[ mId ];
				const membs = self.members[ wId ];
				const member = membs[ mId ];
				list.push( member );
			});
		
		return list;
	}
	
	ns.UserWorkCtrl.prototype.removeUser = function( userId ) {
		const self = this;
		/*
		console.log( 'removeUser - NOOP', {
			userId : userId,
			users  : self.users,
		});
		*/
	}
	
	ns.UserWorkCtrl.prototype.removeMember = function( userId, worgId ) {
		const self = this;
		const members = self.members[ worgId ];
		if ( null == members )
			return;
		
		const u2m = self.userToMembers[ userId ];
		if ( null == u2m )
			return;
		
		const memId = u2m.list.find( mId => {
			const wId = u2m[ mId ];
			if ( wId == worgId )
				return true;
		});
		const member = members[ memId ];
		
		if ( null == member ) {
			console.log( 'no member found', {
				userId  : userId,
				worgId  : worgId,
				members : members,
				u2m     : u2m,
				memId   : memId,
				member  : member,
			});
			return;
		}
		
		const group = self.getGroup( worgId );
		if ( null == group ) {
			console.log( 'WTF? a user with no group', {
				userId  : userId,
				worgId  : worgId,
				members : self.members,
				groups  : self.works,
				u2m     : u2m,
			});
			return;
		}
		group.detach( memId );
		
		delete u2m[ memId ];
		delete u2m[ worgId ];
		const mIdx = u2m.list.indexOf( memId );
		u2m.list.splice( mIdx, 1 );
		if ( 0 == u2m.list.length )
			delete self.userToMembers[ userId ];
		
		delete members[ memId ];
		delete self.memberToUser[ memId ];
		member.close();
	}
	
	ns.UserWorkCtrl.prototype.removeMembers = function( worgId ) {
		const self = this;
		const list = self.memberList[ worgId ];
		list.forEach( cId => {
			self.removeMember( cId, worgId );
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
		
		const isInRoom = user.workgroups.some( worgId => worgId === self.workId );
		if ( isInRoom ) {
			self.moveUserToGroup( userId, self.workId );
		} else {
			let toId = null;
			user.workgroups.some( wId => {
				const grp = self.getGroup( wId );
				if ( !grp )
					return false;
				
				toId = wId;
				return true;
			});
			self.moveUserToGroup( userId, toId );
		}
	}
	
	ns.UserWorkCtrl.prototype.getGroup = function( groupId ) {
		const self = this;
		if ( !groupId )
			return null;
		
		return self.works[ groupId ];
	}
	
	ns.UserWorkCtrl.prototype.toggleSpecials = function() {
		const self = this;
		const show = !!self.subIds.length;
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
		roomId,
		input,
		parser,
		linkExpand,
		pathExpand,
		isWorkView,
		workgroups
	) {
		const self = this; 
		self.isView = isWorkView;
		self.workgroupId = workgroups.workId || '';
		self.supergroupId = workgroups.superId || '';
		library.component.MsgBuilder.call( self,
			parentConn,
			containerId,
			users,
			userId,
			roomId,
			input,
			parser,
			linkExpand,
			pathExpand
		);
	}
	
	ns.WorkMsgBuilder.prototype =
		Object.create( library.component.MsgBuilder.prototype );
		
	ns.WorkMsgBuilder.prototype.getEditer = async function( msg ) {
		const self = this;
		const uId = msg.editBy;
		const user = await self.users.getIdentity( uId );
		if ( user )
			return user;
		
		const room = self.users.getIdSync( self.roomId );
		if ( room )
			return room;
		
		return null;
	}
	
	ns.WorkMsgBuilder.prototype.handleMsg = async function( event ) {
		const self = this;
		if ( self.exists( event.msgId ))
			return;
		
		// makes sure identity is available sync
		const fromId = event.fromId;
		const id = await self.users.getIdentity( fromId );
		
		//
		if ( event.fromId === self.userId )
			self.userLastMsg = event;
		
		const time = self.parseTime( event.time );
		const envelope = await self.getEnvelope( time.envelope );
		const isLastSpeaker = self.checkIsLastSpeaker( event, envelope );
		const conf = {
			inGroup : isLastSpeaker,
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
		const fromUser = self.users.getIdSync( uId );
		const selfUser = self.users.getIdSync( self.userId );
		const mId = msg.msgId;
		if ( !msg.targets ) {
			console.log( 'WorkMsgBuilder.buildWorkMsg - no targets', conf );
			return null;
		}
		
		const source = self.users.getWorkgroup( msg.source );
		if ( !source ) {
			console.log( 'WorkMsgBuilderbuildWorkMsg - no source, aborting', {
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
		let canDelete = false;
		let twIds = [];
		if ( self.isView )
			twIds = [];
		else
			twIds = Object.keys( msg.targets );
		
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
			if ( !fromUser ) {
				canEdit = true;
				canDelete = true;
			}
		}
		
		if ( uId === self.userId ) {
			selfKlass = 'sw2 isSelf';
			canEdit = true;
		}
		
		if ( selfUser && selfUser.isAdmin ) {
			canEdit = true;
			canDelete = true;
		}
		
		let original = msg.message;
		let message = null;
		if ( self.parser )
			message = self.parser.work( original );
		else
			message = original;
		
		/*
		console.log( 'buildWorkMsg', {
			msg        : msg,
			from       : fromUser,
			user       : selfUser,
			canEdit    : canEdit,
			canDelete  : canDelete,
			canForward : canForward,
			fromThis   : fromThis,
			fromSuper  : fromSuper,
			fromSub    : fromSub,
		});
		*/
		const timeStr = self.getClockStamp( msg.time );
		const actionsHtml = self.buildMsgActions( canEdit, canForward, canDelete );
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
			//original         : original,
			message          : message,
			msgActions       : actionsHtml,
		};
		const el = hello.template.getElement( tmplId, msgConf );
		if ( self.linkEx )
			self.linkEx.work( el );
		
		return el;
		
		function buildTargetEls( targets ) {
			return targets.map( target => {
				let tarStr = target; //source + ' -> ' + target;
				let html = hello.template.get( 'work-msg-target-tmpl', { target : tarStr });
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
				const user = self.users.getIdSync( uId );
				if ( !user ) {
					return;
				}
				
				targetNames.push( user.name );
			});
		}
		
		function setToAll( twId, msg, targetNames ) {
			const worg = self.users.getWorkgroup( twId );
			if ( !worg ) {
				return;
			}
			
			const target = msg.targets[ twId ];
			if ( null == target.length )
				targetNames.push( wName( worg ));
			else
				setNames( worg, target );
			
			function setNames( worg, targets ) {
				const wId = worg.clientId;
				targets.forEach( uId => {
					const user = self.users.getIdSync( uId );
					let uName = '';
					if ( !user ) {
						// YEP
					} else
						uName = user.name;
					
					const name = wName( worg ) + '/' + uName;
					targetNames.push( name );
				});
			}
			
			function wName( worg ) {
				return '#' + worg.name;
			}
		}
		
		function emptyTargetNames( msg ) {
			/*
			console.log( 'MsgBuilderbuildWorkMsg - empty target names' );
			console.log( 'msg', msg );
			console.log( 'users', self.users );
			console.log( 'self', self );
			*/
		}
	}
	
})( library.view );


(function( ns, undefined ){
	ns.PrivateMsgBuilder = function(
		parentConn,
		containerId,
		users,
		userId,
		roomId,
		input,
		parser,
		linkExpand,
		pathExpand,
		contactId
	) {
		const self = this;
		self.isPrivate = true;
		self.contactId = contactId;
		library.component.MsgBuilder.call( self,
			parentConn,
			containerId,
			users,
			userId,
			roomId,
			input,
			parser,
			linkExpand,
			pathExpand
		);
		
		self.initPriv();
	}
	
	ns.PrivateMsgBuilder.prototype =
		Object.create( library.component.MsgBuilder.prototype );
	
	ns.PrivateMsgBuilder.prototype.initPriv = function() {
		const self = this;
		self.eventMap[ 'delete' ] = e => self.handleDelete( e );
	}
	
	ns.PrivateMsgBuilder.prototype.handleDelete = async function( event ) {
		const self = this;
		const msg = event.data;
		const mId = msg.msgId;
		const currEl = document.getElementById( mId );
		if ( null == currEl )
			return false;
		
		const delEl = self.buildDeletedMsg({ event : msg });
		if ( null == delEl )
			return false;
		
		updateEnvelopeLastMsg( currEl );
		const nextEl = currEl.nextElementSibling;
		replace( currEl, delEl );
		if ( null == nextEl )
			return;
		
		const nextIsDelete = nextEl.classList.contains( 'delete' );
		const nextIsGroup = nextEl.classList.contains( 'msg-group' );
		if ( nextIsDelete || nextIsGroup )
			return;
		
		const nId = nextEl.id;
		await self.rebuildMessage( nId );
		
		function replace( rm, set ) {
			rm.parentNode.insertBefore( set, rm );
			rm.parentNode.removeChild( rm );
		}
		
		function updateEnvelopeLastMsg( mEl ) {
			const mId = mEl.id;
			const envEl = mEl.parentNode;
			const envId = envEl.id;
			const envelope = self.envelopes[ envId ];
			const lm = envelope.lastMsg;
			if ( null == lm )
				return;
			
			if ( mId != lm.msgId )
				return;
			
			lm.status = 'delete';
		}
	}
	
	ns.PrivateMsgBuilder.prototype.buildDeletedMsg = function( conf ) {
		const self = this;
		const msg = conf.event;
		const id = self.users.getIdSync( msg.fromId );
		const delConf = {
			id      : msg.msgId,
			type    : 'deleted',
			icon    : 'fa-close',
			message : window.View.i18n( 'i18n_message_deleted_by' ) + ' ' + id.name,
			time    : self.getClockStamp( msg.time ),
		};
		const el = hello.template.getElement( 'system-msg-tmpl', delConf );
		
		return el;
	}
	
	ns.PrivateMsgBuilder.prototype.buildMsg = function( conf, isLog ) {
		const self = this;
		const msg = conf.event;
		if ( 'delete' == msg.status )
			return self.buildDeletedMsg( conf );
		
		const tmplId =  conf.inGroup ? 'msg-tmpl' : 'msg-group-tmpl';
		const uId = msg.fromId;
		const mId = msg.msgId;
		const user = self.users.getIdSync( self.userId );
		const from = self.users.getIdSync( uId );
		const isGuest = uId == null ? true : false;
		
		let name = '';
		let userKlass = '';
		let selfKlass = 'sw1';
		let canEdit = false;
		let canDelete = false;
		let canForward = false; //self.checkCanForward( msg );
		if ( isGuest ) {
			name = 'Guest > ' + msg.name;
			userKlass = 'guest-user-klass';
		} else {
			if ( from )
				name = from.name;
			else
				name = msg.name;
			
			userKlass = uId + '-klass';
		}
		
		if ( uId === self.userId ) {
			selfKlass = 'sw2 isSelf';
			canEdit = true;
			canDelete = true;
		}
		
		let original = msg.message;
		let message = null;
		if ( self.parser )
			message = self.parser.work( original, isLog );
		else
			message = original;
		
		const timeStr = self.getClockStamp( msg.time );
		const actionsHtml = self.buildMsgActions( canEdit, canForward, canDelete );
		const msgConf = {
			msgId      : mId,
			userKlass  : userKlass,
			selfKlass  : selfKlass,
			from       : name,
			time       : timeStr,
			message    : message,
			msgActions : actionsHtml,
		};
		const el = hello.template.getElement( tmplId, msgConf );
		if ( self.linkEx )
			self.linkEx.work( el );
		
		return el;
	}
	
	ns.PrivateMsgBuilder.prototype.updateRelationState = function( relations ) {
		const self = this;
		const user = relations[ self.userId ];
		const contact = relations[ self.contactId ];
		
		if ( !relations.lastMsgId )
			return;
		
		if ( null == contact.lastReadId )
			return;
		
		if ( self.lastRead === contact.lastReadId )
			return;
		
		self.updateLastRead({
			msgId        : contact.lastReadId,
			lastReadTime : contact.lastReadTime,
		});
	}
	
	ns.PrivateMsgBuilder.prototype.handleConfirm = function( event ) {
		const self = this;
		if ( 'message' == event.type ) {
			confirmMessage( event.data );
			return;
		}
		
		console.log( 'MsgBuilder.handleConfirm - unknown confirm event', event );
		
		function confirmMessage( state ) {
			const mId = state.msgId;
			const msgEl = document.getElementById( mId );
			if ( !msgEl ) {
				console.log( 'handleConfirm.confirmMessage - no el found for', state );
				return;
			}
			
			if ( state.lastReadTime )
				self.updateLastRead( state );
			else
				self.updateLastDelivered( state );
			
			/*
			if ( state.userId === self.userId )
				self.updateLastDelivered( state );
			else
				self.updateLastRead( state );
			*/
		}
	}
	
})( library.view );

(function( ns, undefined ) {
	ns.UserJeanieCtrl = function(
		conn,
		userList,
		adminList,
		recentList,
		guestList,
		peerList,
		workgroups,
		room,
		guestAvatar,
		containerId,
		serverConfig,
		allowedContacts,
	) {
		const self = this
		console.log( 'UserJeanieCtrl', userList )
		self.conf = serverConfig
		self.allowedContacts = allowedContacts
		/*
		self.workId = null; // workgroup id for this room
		self.superId = null; // super room workgroup id
		self.subIds = []; // sub room workgroup ids
		self.members = {};
		self.memberList = {};
		self.userToMembers = {};
		self.memberToUser = {};
		self.works = {};
		self.workIds = [];
		self.rooms = null;
		*/
		library.component.UserCtrl.call( self,
			conn,
			userList,
			null,
			null,
			null,
			peerList,
			workgroups,
			room,
			guestAvatar,
			containerId,
			serverConfig,
			true
		);
	}
	
	ns.UserJeanieCtrl.prototype = Object.create( library.component.UserCtrl.prototype );
	ns.UserJeanieCtrl.prototype.buildTmpl = 'user-ctrl-tmpl'
	
	ns.UserJeanieCtrl.prototype.initBaseGroups = function() {
		const self = this
		self.addBaseGroup({
			clientId     : 'members',
			name         : View.i18n( 'i18n_members' ),
			sectionKlass : 'base-group group-members',
		})
	}
	
	ns.UserJeanieCtrl.prototype.initWorkgroups = function() {}
	
	ns.UserJeanieCtrl.prototype.setUserToGroup = function( userId ) {
		const self = this
		const user = self.users[ userId ]
		if ( null == user )
			return
		
		console.log( 'setUserToGroup', userId, user )
		self.moveUserToGroup( user.id, 'members' )
	}
	
	ns.UserJeanieCtrl.prototype.buildGroupUserConf = function( identity ) {
		const self = this
		const uId = identity.clientId
		console.log( 'UJC.buildGroupUserConf', identity, uId, self.allowedContacts )
		let canOpen = true
		if ( self.allowedContacts )
			canOpen = self.allowedContacts[ uId ]
		
		const avatarId = self.getUserCssKlass( uId )
		const conf = [
			uId, 
			self.conn, 
			identity, 
			avatarId, 
			canOpen, 
			library.view.GroupUserJeanie 
		]
		
		return conf
	}
	
})( library.view );

(function( ns, undefined ) {
	ns.GroupUserJeanie = function(
		userId,
		conn,
		conf,
		avatarId,
		canOpen,
	) {
		const self = this
		self.avatarId = avatarId
		self.canOpen = canOpen
		
		library.component.GroupUser.call( self,
			userId,
			conn,
			conf
		)
	}
	
	ns.GroupUserJeanie.prototype = Object.create( library.component.GroupUser.prototype )
	ns.GroupUserJeanie.prototype.userTmpl = 'user-list-jini-tmpl'
	
	ns.GroupUserJeanie.prototype.buildElementConf = function() {
		const self = this
		let tooltip = 'Click to open private chat'
		if ( !self.canOpen )
			tooltip = 'This person is not part of your team, only channel communication available'
			
		return {
			id       : self.id,
			statusId : self.statusId,
			name     : self.name,
			avatarId : self.avatarId,
			title    : tooltip,
		}
	}
	
	ns.GroupUserJeanie.prototype.handleClick = function( e ) {
		const self = this
		if ( !self.canOpen )
			return
		
		self.prototype.handleClick()
	}
	
	
})( library.view );

window.View.run = run;
function run( fupConf ) {
	window.conference = new library.view.Presence( fupConf );
}
