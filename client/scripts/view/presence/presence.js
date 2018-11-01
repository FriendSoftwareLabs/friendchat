'use strict';

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
		self.users = {};
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
		//self.messagesEl = document.getElementById( 'messages' );
		const emoPanelBtn = document.getElementById( 'emojii-panel-button' );
		const inputForm = document.getElementById( 'input-form' );
		const submitBtn = document.getElementById( 'chat-submit' );
		
		self.goVideoBtn.addEventListener( 'click', goVideoClick, false );
		self.goAudioBtn.addEventListener( 'click', goAudioClick, false );
		
		self.toggleUsersBtn.addEventListener( 'click', toggleUserList, false );
		emoPanelBtn.addEventListener( 'click', toggleEmoPanel, false );
		inputForm.addEventListener( 'submit', inputSubmit, false );
		submitBtn.addEventListener( 'click', inputSubmit, false );
		attachBtn.addEventListener( 'click', attach, false );
		
		function attach( e ) {
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
		window.addEventListener( 'paste', function( evt )
		{
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
			type : 'live-upgrade',
			data : type,
		};
		self.send( goLive );
	}
	
	ns.Presence.prototype.toggleUserList = function( force ) {
		const self = this;
		if ( null == force ) {
			self.usersEl.classList.toggle( 'users-hide' );
			self.toggleUsersBtn.classList.toggle( 'danger' );
		} else {
			self.usersEl.classList.toggle( 'users-hide', !force );
			self.toggleUsersBtn.classList.toggle( 'danger', !force );
		}
	}
	
	// conn
	
	ns.Presence.prototype.bindConn = function() {
		const self = this;
		self.conn.on( 'initialize', initialize );
		self.conn.on( 'state', state );
		self.conn.on( 'chat', chat );
		self.conn.on( 'live', live );
		self.conn.on( 'persistent', persistent );
		
		function initialize( e ) { self.handleInitialize( e ); }
		function state( e ) { self.handleState( e ); }
		function chat( e ) { self.handleChat( e ); }
		function live( e ) { self.handleLive( e ); }
		function persistent( e ) { self.handlePersistent( e ); }
	}
	
	ns.Presence.prototype.handleInitialize = function( conf ) {
		const self = this;
		friend.template.addFragments( conf.fragments );
		const state = conf.state;
		// things
		self.persistent = state.persistent;
		self.name = state.roomName;
		self.ownerId = state.ownerId;
		self.userId = state.userId;
		
		self.users = new library.component.UserCtrl(
			self.conn,
			state.users,
			state.onlineList,
			state.workgroups,
			state.guestAvatar,
			'users-position',
			friend.template
		);
		
		self.user = self.users.get( self.userId );
		
		// set peers live
		state.peers.forEach( setLive );
		function setLive( uid ) {
			self.users.setState( uid, 'live' );
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
			'messages',
			self.userId,
			self.users,
			onMsgEdit,
			self.parser,
			self.linkExpand,
			friend.template
		);
		
		function onMsgEdit( event ) {
			const edit = {
				type : 'edit',
				data : event,
			};
			self.sendChatEvent( edit );
		}
		
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
		
		// dont focus input if VR device / mode
		if ( 'VR' !== window.View.deviceType )
		{
			self.input.focus();
		}
		
		self.conn.ready();
		self.sendChatEvent({
			type : 'log',
			data : null,
		});
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
