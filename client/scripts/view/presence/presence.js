
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
		
		self.name = null;
		self.ownerId = null;
		self.userId = null;
		self.users = null;
		self.onlineList = [];
		
		self.appOnline = null;
		
		self.init();
	}
	
	ns.Presence.prototype.init = function() {
		const self = this;
		View.setBody();
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
		var dropConf = {
			targetId : 'hello',
			ondrop : onDrop,
		}
		self.drop = new library.component.Drop( dropConf );
		function onDrop( event ) { self.send( event ); }
		
		//
		self.bindUI();
		self.bindConn();
		
		if ( 'MOBILE' === window.View.deviceType )
			self.toggleUserList( false );
		
		//
		self.conn.loaded();
	}
	
	// ui
	
	ns.Presence.prototype.bindUI = function() {
		const self = this;
		self.titleContainer = document.getElementById( 'room-title' );
		// buttons?
		self.goVideoBtn = document.getElementById( 'upgrade-to-video' );
		self.goAudioBtn = document.getElementById( 'upgrade-to-audio' );
		
		// user list things
		self.usersEl = document.getElementById( 'users-container' );
		self.adminsEl = document.getElementById( 'admin-users' );
		self.onlineEl = document.getElementById( 'online-users' );
		self.guestsEl = document.getElementById( 'guest-users' );
		self.offlineEl = document.getElementById( 'offline-users' );
		self.detachedEl = document.getElementById( 'detached' );
		self.toggleUsersBtn = document.getElementById( 'show-hide-btn' );
		const attachBtn = document.getElementById( 'attachment' );
		
		// chat things
		self.messagesEl = document.getElementById( 'messages' );
		const emoPanelBtn = document.getElementById( 'emojii-panel-button' );
		const inputForm = document.getElementById( 'input-form' );
		const submitBtn = document.getElementById( 'chat-submit' );
		
		if( 'DESKTOP' != window.View.deviceType )
		{
			document.getElementById( 'users-header' ).innerHTML = '<span>' + View.i18n( 'i18n_conference_members' ) + ':</span>';
		}
		
		// Timeout for loading messages
		setTimeout( function()
		{
			self.messagesEl.classList.add( 'SmoothScrolling' );
		}, 50 );
		
		self.goVideoBtn.addEventListener( 'click', goVideoClick, false );
		self.goAudioBtn.addEventListener( 'click', goAudioClick, false );
		self.usersEl.addEventListener( 'touchend', function( e )
		{
			var t = e.target ? e.target : e.srcElement;
			if( t && ( t.id == 'users-container' || t.id == 'users-header' || t.tagName == 'SPAN' ) )
			{
				setTimeout( function()
				{
					self.toggleUserList( false );
				}, 50 );
			}
		}, false );
		
		self.toggleUsersBtn.addEventListener( 'click', toggleUserList, false );
		emoPanelBtn.addEventListener( 'click', toggleEmoPanel, false );
		inputForm.addEventListener( 'submit', inputSubmit, false );
		submitBtn.addEventListener( 'click', inputSubmit, false );
		attachBtn.addEventListener( 'click', attach, false );
		
		function attach( e ) {
			var men = ge( 'attachment-menu' );
			
			var can = men.querySelector( '.Cancel' );
			var cam = men.querySelector( '.Camera' );
			var upl = men.querySelector( '.Upload' );
			can.onclick = function(){
				men.classList.remove( 'Showing' );
			}
			
			if( men.classList.contains( 'Showing' ) ) {
				men.classList.remove( 'Showing' );
			}
			else {
				men.classList.add( 'Showing' );
			}
			upl.onclick = function( e ){
				men.classList.remove( 'Showing' );
				executeAttach( e );
			}
			cam.onclick = function( e ){
				men.classList.remove( 'Showing' );
				self.conn.openCamera( false, function( data ) {
					
					var raw = window.atob( data.data.split( ';base64,' )[1] );
					
					var uInt8Array = new Uint8Array( raw.length );
					for ( var i = 0; i < raw.length; ++i ) {
						uInt8Array[ i ] = raw.charCodeAt( i );
					}
				
					var bl = new Blob( [ uInt8Array ], { type: 'image/png', encoding: 'utf-8' } );
					
					// Paste the blob!
					var p = new api.PasteHandler();
					p.paste( { type: 'blob', blob: bl }, function( data )
					{
						self.conn.send(	{
							type: 'drag-n-drop',
							data: [ {
								Type: 'File',
								Path: data.path
							} ]
						} );
					} );
				
					
				} );
			}
		}
		
		function executeAttach( e )
		{
			self.send( {
				type: 'attach',
				data: false
			} );
		};
		
		function goVideoClick( e ) { self.goLive( 'video' ); }
		function goAudioClick( e ) { self.goLive( 'audio' ); }
		
		function toggleUserList( e ) {
			e.stopPropagation();
			e.preventDefault();
			self.toggleUserList();
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
			self.usersEl.classList.toggle( 'users-hide' );
			if( self.usersEl.classList.contains( 'users-hide' ) )
			{
				self.toggleUsersBtn.classList.remove( 'danger' );
			}
			else
			{
				self.toggleUsersBtn.classList.add( 'danger' );
			}
		// We are forcing
		} 
		else
		{
			if( force === false ) {
				self.usersEl.classList.add( 'users-hide' );
				self.toggleUsersBtn.classList.remove( 'danger' );
			}
			else {
				self.usersEl.classList.remove( 'users-hide' );
				self.toggleUsersBtn.classList.add( 'danger' );
			}
		}
	}
	
	ns.Presence.prototype.toggleUserListBtn = function( isVisible ) {
		const self = this;
		self.toggleUsersBtn.classList.toggle( 'hidden', !isVisible );
	}

	ns.Presence.prototype.bindConn = function() {
		const self = this;
		self.conn.on( 'initialize', initialize );
		self.conn.on( 'state'     , state );
		self.conn.on( 'online'    , online );
		self.conn.on( 'offline'   , offline );
		self.conn.on( 'chat'      , chat );
		self.conn.on( 'live'      , live );
		self.conn.on( 'persistent', persistent );
		self.conn.on( 'title'     , title );
		
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
		console.log( 'view.Presence.handleInitialize', state );
		
		// things
		self.isPrivate  = state.isPrivate;
		self.persistent = state.persistent;
		self.name       = state.roomName;
		self.ownerId    = state.ownerId;
		self.userId     = state.userId;
		self.contactId  = state.contactId;

		self.users = new library.component.UserCtrl(
			self.conn,
			state.users,
			state.onlineList,
			state.workgroups,
			state.guestAvatar,
			'users-position',
			friend.template
		);
		
		// Just kill this class (only needed on load)
		setTimeout( function()
		{
			self.usersEl.removeAttribute( 'mobileHidden' );
		}, 800 );
		
		self.user = self.users.get( self.userId );
		/*
		state.peers.forEach( uid => {
			self.users.setState( uid, 'live', true );
		});
		*/
		
		self.liveStatus = new library.component.LiveStatus(
			'live-status-container',
			self.users,
			self.userId,
			friend.template
		);
		self.liveStatus.update( state.peers );
		self.liveStatus.on( 'show', e => self.goLive( 'show' ));
		self.liveStatus.on( 'join', e => self.goLive( 'video' ));
		
		// get logs when scrolling to top
		self.logFetcher = new library.component.LogFetcher(
			'message-container',
			'messages',
			friend.template,
			onFetch
		);
		
		function onFetch() {
			const firstMsgId = self.msgBuilder.getFirstMsgId();
			const logFrom = {
				type : 'log',
				data : {
					firstId : firstMsgId,
				},
			};
			self.sendChatEvent( logFrom );
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
		
		// message builder
		self.msgBuilder = new library.component.MsgBuilder(
			self.conn,
			'messages',
			self.userId,
			self.users,
			self.parser,
			self.linkExpand,
			friend.template
		);
		
		// multiline input
		const inputConf = {
			containerId     : 'input-container',
			templateManager : friend.template,
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
		else
			self.setGroupUI();
		
		// dont focus input if VR device / mode
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
	
	ns.Presence.prototype.setGroupUI = function() {
		const self = this;
		if ( self.contactStatus ) {
			self.contactStatus.close();
			delete self.contactStatus;
		}
		
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
		const user = self.users.get( self.contactId );
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
		if ( self.titleId )
			self.clearTitle();
		
		self.titleId = friendUP.tool.uid( 'title' );
		const conf = {
			id       : self.titleId,
			roomName : self.name,
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
			let lastMsgId = self.msgBuilder.getLastMsgId();
			const logFrom = {
				type : 'log',
				data : {
					lastId : lastMsgId,
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
		if ( 'msg' === event.type )
			self.msgBuilder.handle( event );
		
		if ( 'state' === event.type )
			self.setChatState( event.data );
		
		if ( 'log' === event.type )
			self.handleLog( event.data );
		
		if ( 'update' === event.type )
			self.msgBuilder.update( event.data );
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
		console.log( 'chat.Presence.handleLive', event )
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

window.View.run = run;
function run( fupConf ) {
    window.conference = new library.view.Presence( fupConf );
}
