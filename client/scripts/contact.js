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

library.contact = library.contact || {};

// Contact basemodel
(function( ns, undefined ) {
	ns.Contact = function( conf ) {
		if( !( this instanceof ns.Contact ))
			return new ns.Contact( conf );
		
		const self = this;
		library.component.EventEmitter.call( self );
		self.moduleId = conf.moduleId;
		self.dormantParentPath = conf.dormantParentPath || '';
		self.clientId = self.data.clientId;
		self.displayName = self.data.displayName || self.data.name;
		self.lastMessage = self.data.lastMessage;
		self.messagesWaiting = 0;
		self.mentionsWaiting = 0;
		self.chatCrypts = {};
		self.encryptMessages = false;
		self.activity = conf.activity;
		self.conn = null;
		self.view = null;
		self.chat = null;
		self.live = null;
		
		self.contactInit( conf.parentConn, conf.parentView );
	}
	
	ns.Contact.prototype = Object.create( library.component.EventEmitter.prototype );
	
	// Public
	
	ns.Contact.prototype.show = function() {
		const self = this;
		if ( self.chatView )
			self.chatView.show();
		else
			self.openChat();
	}
	
	ns.Contact.prototype.handleEvent = function( event ) {
		const self = this;
		if ( !self.conn )
			return;
		
		self.conn.handle( event );
	}
	
	ns.Contact.prototype.checkMsgBeepSetting = function() {
		throw new Error( 'Contact.checkMsgBeepSetting - implement in module' );
	}
	
	ns.Contact.prototype.getLastMessage = function() {
		const self = this;
		return self.lastMessage || null;
	}
	
	ns.Contact.prototype.getTitle = function() {
		const self = this;
		return self.identity.name;
	}
	
	ns.Contact.prototype.formatNotifyText = function( msg ) {
		const self = this;
		return msg.from + ": " + msg.message;
	}
	
	ns.Contact.prototype.getIdentity = function() {
		const self = this;
		return self.identity;
	}
	
	// Private
	ns.Contact.prototype.contactInit = function( parentConn, parentView ) {
		const self = this;
		if ( parentConn )
			self.setupConn( parentConn );
		
		self.interceptTypes = {
			'live-invite'    : Application.i18n( 'i18n_live_invite' ),
			'calendar-event' : Application.i18n( 'i18n_calendar_event' ),
		};
		
		self.interceptMap = {
			'live-invite'    : startLive,
			'calendar-event' : addCalendarEvent,
		};
		
		function startLive( event, from, msg ) { self.startLive( event, from, msg ); }
		function addCalendarEvent( event, from ) { self.addCalendarEvent( event, from ); }
		
		self.view = new library.component.SubView({
			parent : parentView,
			type : self.clientId,
		});
		
		self.setIdentity(); // must be implemented by every module, see reference
	}
	
	ns.Contact.prototype.setupConn = function( parentConn ) {
		const self = this;
		self.conn = new library.component.EventNode(
			self.clientId,
			parentConn,
			eventSink
		);
		function eventSink( type, data ) {
			console.log( 'Contact.eventSink', {
				type : type,
				data : data,
			});
		}
		
		self.conn.on( 'log', log );
		self.conn.on( 'message', message );
		self.conn.on( 'notification', notification );
		self.conn.on( 'viewtheme', updateViewTheme );
		
		function log( msg ) { self.handleLog( msg ); }
		function message( msg ) { self.doMessageIntercept( msg ); }
		function notification( msg ) { self.handleNotification( msg ); }
		function updateViewTheme( msg ) { self.updateViewTheme( msg ); }
	}
	
	ns.Contact.prototype.setIdentity = function() {
		const self = this;
		self.identity = {
			clientId : null,
			name : null,
			avatar : null,
		};
	}
	
	ns.Contact.prototype.doMessageIntercept = function( data ) {
		const self = this;
		const intercept = self.checkIntercept( data.message );
		let didIntercept = false;
		if ( intercept ) {
			didIntercept = self.handleIntercept( data, intercept );
		}
		
		if ( didIntercept )
			return;
		
		self.onChatMessage( data );
		self.chatMessage( data );
	}
	
	// returns a promise
	ns.Contact.prototype.onChatMessage = function( msg, silent ) {
		const self = this;
		if ( self.chatView && !self.chatView.checkMinimized())
			return self.whenChatOpen( msg, silent );
		else
			return self.whenChatClosed( msg, silent );
	}
	
	ns.Contact.prototype.whenChatClosed = function( msg, silent ) {
		const self = this;
		if ( hello.account.settings.popupChat === true ) {
			api.Say( 'Message received' );
			self.startChat(); // contact must implement
			return self.recentMessage( msg.message, msg.from, msg.time );
		}
		
		if ( !silent )
			notifyThings();
		
		return self.messageWaiting( true, msg.message, msg.from, msg.time );
		
		function notifyThings() {
			if ( self.checkMsgBeepSetting())
				hello.playMsgAlert();
			
			const message =  self.formatNotifyText( msg );
			const notie = {
				title         : self.getTitle(),
				text          : message,
				callback      : nClose,
				clickCallback : nClick
			};
			hello.app.notify( notie );
			
			function nClose( res ) {
				//console.log( 'notify - no action', res );
			}
			function nClick( res ) {
				self.startChat();
			}
		}
	}
	
	ns.Contact.prototype.whenChatOpen = function( msg, silent ) {
		const self = this;
		if ( !silent )
			notifyThings();
		
		return self.recentMessage( msg.message, msg.from, msg.time );
		
		function notifyThings() {
			if ( self.checkMsgBeepSetting())
				hello.playMsgAlert();
			
			if ( !self.chatView.checkMinimized())
				return;
			
			const message =  self.formatNotifyText( msg );
			const notie = {
				title         : self.getTitle(),
				text          : message,
				callback      : nClose,
				clickCallback : nClick
			};
			hello.app.notify( notie );
			
			function nClose( res ) {
				//console.log( 'notify - no action', res );
			}
			function nClick( res ) {
				self.chatView.show();
			}
		}
		
	}
	
	// returns true if the intercept was acted on, otherwise returns false
	ns.Contact.prototype.handleIntercept = function( msg, intercept ) {
		const self = this;
		var event = intercept.data;
		var handler = self.interceptMap[ event.type ];
		if ( !handler ) {
			console.log( 'Contact.handleIntercept - no handler for', intercept );
			return false;
		}
		
		var notify = self.getInterceptNotification( msg, intercept );
		self.handleNotification( notify );
		
		// stop if it is from yourself ( aka from == null )
		if ( !msg.from )
			return true;
		
		let now = Date.now();
		let oneHourAgo = now - 1000 * 60 * 60;
		if ( msg && !msg.time )
			msg.time = now;
		
		if ( msg && msg.time < oneHourAgo ) {
			hello.log.notify( 'Stale event, dropping - type: ' + event.type );
			hello.log.show();
			return true;
		}
		
		handler( event.data, msg.from, msg );
		return true;
	}
	
	ns.Contact.prototype.getInterceptNotification = function( msg, intercept ) {
		const self = this;
		var message = !!msg.from ? 'Received: ' : 'Sent: ';
		var type = 'unknown';
		if ( intercept.data && intercept.data.type )
			type = intercept.data.type;
		else
			type = intercept.type || type;
		
		const typeStr = self.interceptTypes[ type ] || type;
		message += typeStr;
		
		if ( !self.identity && msg.from ) // no identity means this is a room
			message += ' from ' + msg.from; // so lets give a bit more infos
		
		if ( hello.config.hideLive && ( 'live-invite' === type )) {
			message += ' - live blocked by app config';
		}
		
		return {
			level : 'warn',
			from : msg.from,
			message : message,
			time : msg.time,
		};
	}
	
	ns.Contact.prototype.chatMessage = function( msg ) {
		const self = this;
		var wrap = {
			type : 'message',
			data : msg,
		};
		self.toChat( wrap );
	}
	
	ns.Contact.prototype.handleLog = function( log ) {
		const self = this;
		if ( !log ) {
			nullMessage();
			return;
		}
		
		var intercept = self.checkIntercept( log.data.message );
		if ( intercept ) {
			var notify = self.getInterceptNotification( log.data, intercept );
			log.type = 'notification';
			log.data = notify;
		}
		
		var wrap = {
			type : 'log',
			data : log,
		};
		
		self.toChat( wrap );
		
		function nullMessage() {
			var nullEvent = {
				type : 'log',
				data : null,
			};
			self.toChat( nullEvent );
		}
	}
	
	ns.Contact.prototype.handleNotification = function( data ) {
		const self = this;
		var msg = {
			type : 'notification',
			data : data,
		};
		self.toChat( msg );
	}
	
	ns.Contact.prototype.recentMessage = function( message, from, time, opts ) {
		const self = this;
		if ( !self.activity ) {
			console.log( 'Contact.recentMessgae - activity missing', self );
			return null;
		}
		
		const intercept = self.checkIntercept( message );
		if ( intercept )
			return null;
		
		if ( null == message )
			throw new Error( 'app.Contact.recentMessage - message is required' );
		
		if ( null == from )
			from = '';
		if ( null == time )
			time = Date.now();
		
		let res = null;
		const args = [
			self.roomType,
			self.clientId,
			self.priority,
			from,
			message,
			time,
			opts
		];
		return self.activity.message( ...args );
	}
	
	ns.Contact.prototype.recentLive = function( infoMessage, direction, timestamp, opts ) {
		const self = this;
		if ( !self.activity ) {
			console.log( 'Contact.recentLive - activity missing', self );
			return;
		}
		
		if ( opts )
			opts.priority = self.priority;
		else
			opts = {
				priority : self.priority,
			};
		
		return self.activity.live(
			self.roomType,
			self.clientId,
			self.priority,
			direction,
			infoMessage,
			timestamp,
			opts
		);
	}
	
	ns.Contact.prototype.messageWaiting = function( isWaiting, message, from, time ) {
		const self = this;
		if ( isWaiting )
			self.messagesWaiting++;
		else {
			if ( 0 === self.mentionWaiting )
				return;
			
			self.messagesWaiting = 0;
		}
		
		if ( !self.activity ) {
			console.log( 'Contact.messageWaiting - no activity' );
			return;
		}
		
		const opts = {
			broadcast : true,
			unread    : self.messagesWaiting,
		};
		
		const uptd = {
			type : 'msg-waiting',
			data : opts,
		};
		self.view.send( uptd );
		
		if ( !!message )
			return self.recentMessage( message, from, time, opts );
		else
			return self.activity.updateItem( self.clientId, opts );
		
	}
	
	ns.Contact.prototype.setUnreadMessages = function( unread ) {
		const self = this;
		self.messagesWaiting = unread || 0;
		const opts = {
			broadcast : true,
			unread    : self.messagesWaiting,
		};
		return self.activity.updateItem( self.clientId, opts );
	}
	
	ns.Contact.prototype.mentionWaiting = function( isWaiting, message, from, time ) {
		const self = this;
		if ( isWaiting )
			self.mentionsWaiting++;
		else {
			if ( 0 === self.mentionWaiting )
				return;
			
			self.mentionsWaiting = 0;
		}
		
		const opts = {
			broadcast : true,
			mentions  : self.mentionsWaiting,
		};
		
		return self.activity.updateItem( self.clientId, opts );
	}
	
	ns.Contact.prototype.setMentions = function( mentions ) {
		const self = this;
		self.mentionsWaiting = mentions || 0;
		const opts = {
			broadcast : true,
			mentions  : self.mentionsWaiting,
		};
		return self.activity.updateItem( self.clientId, opts );
	}
	
	ns.Contact.prototype.sendMessage = function( str ) {
		const self = this;
		self.send({
			type  : 'message',
			data  : str
		});
	}
	
	ns.Contact.prototype.sendCryptoMessage = function( data ) {
		const self = this;
		const msg = {
			type : 'cryptomessage',
			data : data,
		};
		self.send( msg );
	}
	
	ns.Contact.prototype.checkIntercept = function( message ) {
		const self = this;
		if ( !hello.intercept )
			throw new Error( 'intercept has not been initiated' );
		
		var intercept = hello.intercept.check( message );
		if ( intercept ) {
			return intercept;
		}
		
		return false;
	}
	
	ns.Contact.prototype.startVideo = function( perms ) {
		const self = this;
		const conf = {
			mode        : 'video',
			permissions : perms || null,
		};
		self.handleStartLive( conf );
	}
	
	ns.Contact.prototype.startAudio = function( perms ) {
		const self = this;
		const conf = {
			mode        : 'audio',
			permissions : perms || null,
		};
		self.handleStartLive( conf );
	}
	
	ns.Contact.prototype.handleStartLive = function( event ) {
		const self = this;
		event = event || {};
		const mode = event.mode || 'video';
		const perms = event.permissions || buildPermsFor( mode );
		const user = self.getParentIdentity();
		const contact = self.identity; // create a session and invite this contact
		contact.invite = sendInvite;
		hello.rtc.invite( [ contact ], perms );
		
		function sendInvite( invite ) {
			self.sendMessage( invite );
		}
		
		function buildPermsFor( mode ) {
			const video = 'video' === mode ? true : false;
			const perms = {
				send : {
					audio : true,
					video : video,
				},
				receive : {
					audio : true,
					video : video,
				},
			};
			
			return perms;
		}
	}
	
	ns.Contact.prototype.startLive = function( invite, from ) {
		const self = this;
		if ( !invite )
			throw new Error( 'Contact.startLive - no invite' );
		
		if ( hello.config.hideLive ) {
			console.log( 'startLive - blocked by conf', hello.config );
			return;
		}
		
		const user = self.getParentIdentity();
		const host = self.identity || { name : from }; // this contact is inviting you
		hello.rtc.askClient( invite, host, user );
	}
	
	ns.Contact.prototype.getParentIdentity = function() {
		const self = this;
		const module = hello.module.get( self.moduleId );
		const id = module.identity;
		return id;
	}
	
	ns.Contact.prototype.addCalendarEvent = function( event, from ) {
		const self = this;
		if ( self.identity )
			from = self.identity.name;
		
		var message = 'Calendar event from ' + from;
		var cal = new api.Calendar();
		cal.addEvent( event, message, addBack );
		function addBack( res ) {
			console.log( 'calendar addback - do a thing?', res );
		}
	}
	
	ns.Contact.prototype.showOptions = function( e ) {
		const self = this;
		
		if( self.optionsView ) {
			return;
		}
	}
	
	ns.Contact.prototype.updateRequest = function( data ) {
		data.clientId = self.clientId;
		var req = {
			url : 'contact/update',
			verb : 'post',
			data : data,
			holdOnSuccess : true
		};
		
		component.tool.requestOverlay( req, updateCallback, view._window );
		function updateCallback( response ) {
			if ( !response.success ) {
				console.log( 'udapteCallback: denied for ' + self.getName())
				return;
			}
			
			// view.sendMessage( updated );
		}
	}
	
	ns.Contact.prototype.updateViewTheme = function( filepath ) {
		const self = this;
		self.viewTheme = filepath;
		if ( !self.chatView || !self.chatView.view )
			return;
		
		self.chatView.view.setViewTheme( filepath );
	}
	
	ns.Contact.prototype.remove = function() {
		const self = this;
		console.log( 'app.Contact.remove - not implemented' );
	}
	
	ns.Contact.prototype.getName = function() {
		const self = this;
		return self.identity.name || self.clientId || self.type;
	}
	
	ns.Contact.prototype.toView = function( msg ) {
		const self = this;
		if ( !self.view )
			return;
		
		self.view.send( msg );
	}
	
	ns.Contact.prototype.toChat = function( event ) {
		const self = this;
		if ( !self.chatView )
			return;
		
		self.chatView.send( event );
	}
	
	ns.Contact.prototype.send = function( event ) {
		const self = this;
		self.conn.send( event );
	}
	
	ns.Contact.prototype.contactClose = function() {
		const self = this;
		self.release();
		if ( self.conn )
			self.conn.close();
		
		if ( self.view )
			self.view.close();
		
		if ( self.chatView )
			self.chatView.close();
		
		delete self.conn;
		delete self.view;
		delete self.chatView;
	}
	ns.Contact.prototype.close = ns.Contact.prototype.contactClose;
	
})( library.contact );

//
// PRESENCEROOM
(function( ns, undefined ) {
	ns.PresenceRoom = function( conf ) {
		const self = this;
		self.type = 'presence';
		self.data = conf.room;
		self.idc = conf.idCache;
		self.host = conf.host;
		self.user = conf.user;
		self.userId = conf.userId;
		
		const room = conf.room;
		self.priority = room.priority || 0;
		self.isView = room.isView;
		self.workgroupId = room.workgroupId || null;
		self.supergroupId = room.supergroupId || null;
		
		ns.Contact.call( self, conf );
		
		self.roomType = 'room';
		self.settings = null;
		self.identities = {};
		self.adminList = [];
		self.recentList = [];
		self.guestList = [];
		self.onlineList = [];
		self.users = {};
		self.userIds = [];
		self.peers = [];
		self.isActive = false;
		self.isMinimized = false;
		self.initialized = false;
		
		self.init();
	}
	
	ns.PresenceRoom.prototype = Object.create( ns.Contact.prototype );
	
	// Public
	
	ns.PresenceRoom.prototype.sendMessage = function( message, openView ) {
		const self = this;
		const msg = {
			type : 'msg',
			data : {
				message : message,
			},
		};
		self.sendChatEvent( msg );
		if ( openView )
			self.openChat();
	}
	
	ns.PresenceRoom.prototype.reconnect = function() {
		const self = this;
		self.initialized = false;
		self.send({
			type : 'initialize',
		});
	}
	
	ns.PresenceRoom.prototype.getTitle = function() {
		const self = this;
		return '#' + self.identity.name;
	}
	
	ns.PresenceRoom.prototype.formatNotifyText = function( msg ) {
		const self = this;
		return msg.from + ": " + msg.message;
	}
	
	ns.PresenceRoom.prototype.joinLive = function( conf ) {
		const self = this;
		if ( hello.config.hideLive ) {
			console.log( 'PresenceRoom.joinLive - blocked by conf', hello.config );
			return;
		}
		
		// check if room has been initialized
		if ( self.live ) {
			self.live.show();
			return; // we already are in a live _in this room_
		}
		
		if ( !self.settings ) {
			self.goLivePending = conf || {};
			return;
		}
		
		const cId = friendUP.tool.uid( 'lc' );
		conf = conf || {};
		conf.clientId = cId;
		conf.roomId = self.clientId;
		conf.roomName = self.identity.name;
		conf.isPrivate = self.isPrivate || false;
		conf.isTempRoom = !self.persistent;
		conf.guestAvatar = self.guestAvatar;
		if ( self.settings.isStream )
			conf.isStream = true;
		
		self.live = hello.rtc.createSession(
			conf,
			liveToServer,
			onClose
		);
		
		if ( !self.live ) {
			console.log( 'P.joinLive - live was not created..', self );
			return; // session wasnt created, because :reasons:
		}
		
		// tell server
		
		const join = {
			type : 'live-join',
			data : cId,
		};
		self.send( join );
		
		// events from live view we care about, everything else is passed on
		self.live.on( 'chat', chat );
		self.live.on( 'invite', invite );
		self.live.on( 'live-name', liveName );
		self.live.on( 'view-switch', viewSwitch );
		
		function chat( e ) { self.sendChatEvent( e ); }
		function invite( e ) { self.inviteToServer( e ); }
		function liveName( e ) { self.handleLiveName( e ); }
		function viewSwitch( e ) { self.handleViewSwitch( e ); }
		function onClose( e ) {
			self.closeLive();
			const leave = {
				type : 'leave',
			}
			self.liveToServer( leave );
		}
		
		function liveToServer( type, data ) {
			const event = {
				type : type,
				data : data,
			};
			self.liveToServer( event );
		}
	}
	
	ns.PresenceRoom.prototype.getInviteToken = function( type, callback ) {
		const self = this;
		type = type || 'private';
		let reqId = null;
		if ( callback )
			reqId = self.setRequest( callback )
		
		const getInv = {
			type : type,
			data : {
				reqId : reqId,
				token : null,
			},
		};
		self.inviteToServer( getInv );
	}
	
	ns.PresenceRoom.prototype.checkMsgBeepSetting = function() {
		const self = this;
		if ( !!hello.account.settings.roomAlert )
			return true;
		else
			return false;
	}
	
	ns.PresenceRoom.prototype.getLastMessage = function() {
		const self = this;
		return null;
	}
	
	ns.PresenceRoom.prototype.startChat = function() {
		const self = this;
		self.openChat();
	}
	
	ns.PresenceRoom.prototype.setUserOnline = function( userId, isOnline ) {
		const self = this;
		if ( userId === self.userId )
			return;
		
		if ( !isOnline ) {
			self.setUserOffline( userId );
			return;
		}
		
		let current = self.users[ userId ];
		if ( !current )
			return;
		
		self.onlineList.push( userId );
		const online = {
			type : 'online',
			data : userId,
		};
		//self.toChat( online );
		self.updateViewUsers();
	}
	
	ns.PresenceRoom.prototype.updateIdentity = function( update ) {
		const self = this;
		const id = update.data;
		const cId = id.clientId;
		const isRoom = ( self.clientId == cId );
		if ( isRoom ) {
			self.identity = id;
			self.activity.updateIdentity( cId, id );
		}
		
		const isUser = self.userIds.some( uId => uId === cId );
		const isInWorg = self.checkIsInWorkgroup( cId );
		if ( !isRoom && !isUser && !isInWorg )
			return;
		
		const event = {
			type : 'identity-update',
			data : update,
		};
		self.toChat( event );
		self.toLive( event );
		
	}
	
	ns.PresenceRoom.prototype.close = function() {
		const self = this;
		if ( self.live )
			self.live.close();
		
		self.contactClose();
		
		if ( self.settings )
			self.settings.close();
		
		if ( self.settingsView )
			self.settingsView.close();
		
		delete self.live;
		delete self.settingsView;
		delete self.settings;
	}
	
	ns.PresenceRoom.prototype.setActive = function( isActive ) {
		const self = this;
		self.isActive = isActive;
		self.sendActive();
	}
	
	// Private
	
	ns.PresenceRoom.prototype.init = function() {
		const self = this;
		self.conn.on( 'initialize', init );
		self.conn.on( 'persistent', persistent );
		self.conn.on( 'priority', e => self.handlePriority( e ));
		self.conn.on( 'identity', identity );
		self.conn.on( 'authed', authed );
		self.conn.on( 'workgroup', workgroup );
		self.conn.on( 'invite', invite );
		self.conn.on( 'room-update', roomUpdate );
		self.conn.on( 'join', userJoin );
		self.conn.on( 'leave', userLeave );
		self.conn.on( 'live', live );
		self.conn.on( 'chat', chat );
		self.conn.on( 'sub-rooms', e => self.handleSubRooms( e ));
		self.conn.on( 'counter-reset', e => self.handleCounterReset( e ));
		self.conn.on( 'recent-add', e => self.handleRecentAdd( e ));
		self.conn.on( 'recent-remove', e => self.handleRecentRemove( e ));
		self.conn.on( 'admin-add', e => self.handleAdminAdd( e ));
		self.conn.on( 'admin-remove', e => self.handleAdminRemove( e ));
		self.conn.on( 'at-add', e => self.handleAtNameAdd( e ));
		self.conn.on( 'at-names', e => self.handleAtNames( e ));
		
		self.settings = new library.component.RequestNode( 'settings', self.conn, settingsSink );
		self.settings.on( 'update', e => self.handleSettingUpdate( e ));
		
		self.bindView();
		self.send({
			type : 'initialize',
		});
		
		function init( e ) { self.handleInitialize( e ); }
		function persistent( e ) { self.handlePersistent( e ); }
		function identity( e ) { self.handleIdentity( e ); }
		function authed( e ) { self.handleAuthed( e ); }
		function workgroup( e ) { self.handleWorkgroup( e ); }
		function invite( e ) { self.handleInvite( e ); }
		function roomUpdate( e ) { self.handleRoomUpdate( e ); }
		function userJoin( e ) { self.handleJoin( e ); }
		function userLeave( e ) { self.handleLeave( e ); }
		function live( e ) { self.handleLive( e ); }
		function chat( e ) { self.handleChat( e ); }
		
		function settingsSink( ...args ) {
			console.log( 'PresenceRoom - settings event sink', arguments );
		}
	}
	
	ns.PresenceRoom.prototype.bindView = function() {
		const self = this;
		self.view.on( 'persist', persist );
		self.view.on( 'settings', settings );
		self.view.on( 'rename', rename );
		self.view.on( 'live-video', startVideo );
		self.view.on( 'live-audio', startAudio );
		self.view.on( 'live-show', e => self.joinLive());
		self.view.on( 'open-chat', chat );
		self.view.on( 'leave-room', leave );
		self.view.on( 'invite-show', e => self.showInviter( e ));
		
		function persist( e ) { self.persistRoom( e ); }
		function settings( e ) { self.loadSettings( e ); }
		function rename( e ) { self.renameRoom( e ); }
		function startVideo( e ) { self.startVideo( e ); }
		function startAudio( e ) { self.startAudio( e ); }
		function chat( e ) { self.openChat( e ); }
		function leave( e ) { self.leaveRoom( e ); }
		
	}
	
	ns.PresenceRoom.prototype.setUserOffline = function( userId ) {
		const self = this;
		const uIdx = self.onlineList.indexOf( userId );
		if ( -1 !== uIdx )
			self.onlineList.splice( uIdx, 1 );
		
		const offline = {
			type : 'offline',
			data : userId,
		};
		//self.toChat( offline );
		self.updateViewUsers();
	}
	
	ns.PresenceRoom.prototype.updateActive = function() {
		const self = this;
		let isActive = false;
		if ( self.chatView || self.liveView )
			isActive = true;
		
		if ( isActive === self.isActive )
			return;
		
		self.isActive = isActive;
		self.sendActive();
	}
	
	ns.PresenceRoom.prototype.sendActive = function() {
		const self = this;
		const active = {
			type : 'active',
			data : {
				isActive : self.isActive,
				time     : Date.now(),
			},
		};
		self.send( active );
	}
	
	ns.PresenceRoom.prototype.handleActive = function( event ) {
		const self = this;
		console.log( 'PresenceRoom.handleActive - NYI', event );
	}
	
	
	ns.PresenceRoom.prototype.persistRoom = function( name ) {
		const self = this;
		const persist = {
			type : 'persist',
			data : {
				name       : name,
				persistent : true,
			},
		};
		self.send( persist );
	}
	
	ns.PresenceRoom.prototype.loadSettings = function() {
		const self = this;
		if ( self.expectSettings )
			return;
		
		self.expectSettings = true;
		const req = {
			type : 'get',
		};
		self.settings.request( req )
			.then( settBack )
			.catch( settBoop );
		
		function settBack( settings ) {
			self.showSettings( settings );
		}
		
		function settBoop( err ) {
			console.log( 'PresenceRoom.loadSettings - settboop', err );
		}
	}
	
	ns.PresenceRoom.prototype.renameRoom = function( name ) {
		const self = this;
		throw new Error( 'PresenceRoom.renameRoom - should not be used, use settings' );
	}
	
	ns.PresenceRoom.prototype.startVideo = function() {
		const self = this;
		const permissions = {
			send : {
				video : true,
				audio : true,
			},
			receive : {
				video : true,
				audio : true,
			},
		};
		self.setupLive( permissions );
	}
	
	ns.PresenceRoom.prototype.startAudio = function() {
		const self = this;
		const permissions = {
			send : {
				video : false,
				audio : true,
			},
			receive : {
				video : false,
				audio : true,
			},
		};
		self.setupLive( permissions );
	}
	
	ns.PresenceRoom.prototype.openChat = function( notification, preView ) {
		const self = this;
		self.hasNotification = !!notification;
		
		if ( self.chatView ) {
			self.chatView.show();
			return;
		}
		
		if ( !self.initialized ) {
			self.openChatPending = {
				notification : notification,
				view         : preView || null,
			};
			return;
		}
		
		const initData = {
			clientId    : self.clientId,
			room        : self.identity,
			roomName    : self.identity.name,
			persistent  : self.persistent,
			userList    : self.userIds,
			adminList   : self.adminList,
			recentList  : self.recentList,
			onlineList  : self.onlineList,
			guestList   : self.guestList,
			peerList    : self.peers,
			ownerId     : self.ownerId,
			userId      : self.userId,
			isPrivate   : self.isPrivate,
			isView      : self.isView,
			config      : self.workConfig,
			guestAvatar : self.guestAvatar,
			workgroups  : self.workgroups,
			mentionList : self.mentionList,
			atList      : self.atList,
		};
		
		if ( preView ) {
			self.chatView = preView;
			preView.updateState( initData );
		}
		else {
			self.chatView = new library.view.PresenceChat(
				initData,
				self.isPrivate
			);
		}
		
		const reset = {
			type : 'counter-reset',
		};
		self.conn.send( reset );
		
		self.chatView.on( 'chat', e => self.sendChatEvent( e ));
		self.chatView.on( 'live', goLive );
		self.chatView.on( 'contact-open', e => self.handleContactOpen( e ));
		self.chatView.on( 'invite-show', e => self.showInviter( e ));
		self.chatView.on( 'close-back', e => self.handleCloseBack( e ));
		self.chatView.on( 'minimized', e => self.handleMinimized( e ));
		self.chatView.on( 'close', e => self.closeChat());
		self.chatView.on( 'get-identity', e => self.handleGetId( e ));
		
		function eventSink( e ) { console.log( 'unhandled chat view event', e ); }
		function onClose( e ) {
			self.closeChat();
		}
		
		function goLive( e ) {
			if ( 'video' === e )
				self.startVideo();
			if ( 'audio' === e )
				self.startAudio();
			if ( 'show' === e )
				self.joinLive();
		}
	}
	
	ns.PresenceRoom.prototype.handleContactOpen = function( contactId ) {
		const self = this;
		if ( contactId === self.userId )
			return;
		
		self.emit( 'contact', {
			type : 'open',
			data : contactId,
		});
	}
	
	ns.PresenceRoom.prototype.handleMinimized = function( isMinz ) {
		const self = this;
		if ( self.isMinimized === isMinz )
			return;
		
		self.isMinimized = isMinz;
		if ( !isMinz ) {
			self.resetCounters();
			//self.messageWaiting( false );
			//self.mentionWaiting( false );
		}
		
	}
	
	ns.PresenceRoom.prototype.closeChat = function() {
		const self = this;
		if ( !self.chatView )
			return;
		
		let cView = self.chatView;
		delete self.chatView;
		cView.close();
		self.updateActive();
	}
	
	ns.PresenceRoom.prototype.handleGetId = async function( userId ) {
		const self = this;
		const id = await self.idc.get( userId );
		return id;
	}
	
	ns.PresenceRoom.prototype.leaveRoom = function() {
		const self = this;
		const leave = { type : 'leave' };
		self.send( leave );
	}
	
	ns.PresenceRoom.prototype.showInviter = function( e ) {
		const self = this;
		if ( self.inviter ) {
			self.inviter.show();
			return;
		}
		
		const allIds = self.idc.readList();
		const ids = allIds
			.filter( notInRoom );
		
		self.inviter = new library.view.PresenceInviter(
			self.identity.name,
			ids,
			onClose,
			eventSink
		);
		self.inviter.on( 'add', add );
		
		function onClose() {
			if ( self.inviter )
				self.inviter.close();
			
			delete self.inviter;
		}
		
		function eventSink() {
			console.log( 'inviteer event sink', arguments );
		}
		
		function add( user ) {
			const roomAdd = {
				type : 'room-add',
				data : user,
			};
			
			const inv = {
				type : 'invite',
				data : roomAdd,
			};
			self.send( inv );
		}
		
		function isOnline( id ) {
			return id.isOnline;
		}
		
		function notInRoom( cId ) {
			const inRoom = self.userIds.some( uId => uId === cId.clientId );
			return !inRoom;
		}
	}
	
	ns.PresenceRoom.prototype.handleMention = function( e ) {
		const self = this;
		hello.playMsgAlert();
		if ( self.chatView && !self.chatView.checkMinimized())
			return;
		
		self.mentionWaiting( true );
	}
	
	ns.PresenceRoom.prototype.handleCloseBack = function( e ) {
		const self = this;
		self.closeChat();
		hello.focusMain();
	}
	
	ns.PresenceRoom.prototype.handleInitialize = async function( state ) {
		const self = this;
		self.setUsers( state.users );
		self.ownerId = state.ownerId;
		self.workConfig = state.workConfig || null;
		self.workgroups = state.workgroups;
		self.adminList = state.admins || [];
		self.onlineList = state.online || [];
		self.recentList = state.recent || [];
		self.guestList = state.guests || [];
		self.authList = state.authed || [];
		self.atNames = state.atNames || [];
		self.atWorgs = state.atWorg || [];
		self.persistent = state.persistent;
		self.guestAvatar = state.guestAvatar;
		self.identity.name = state.name;
		
		self.setSettings( state.settings );
		self.setupWorkroom();
		
		let ids = null;
		try {
			ids = await self.getIdentities( self.userIds );
		} catch( ex ) {
			console.log( 'handleInitalize - getIdentities boop', ex );
			return;
		}
		
		ids.forEach( id => {
			const cId = id.clientId;
			self.identities[ cId ] = id;
		});
		
		if ( self.workgroups ) {
			self.setWorkgroupMembers();
			if ( !selfIsUser())
				self.valueAddedRoom = true;
		}
		
		let user = null;
		try {
			user = self.idc.get( self.userId );
		} catch( ex ) {
			console.log( 'handleInitialize - get ex', ex );
		}
		
		if ( !user ) {
			console.log( 'PresenceRoom.handleInitialize - no id for user', {
				uid  : self.userId,
				idc  : self.idc,
				self : self,
			});
			return;
		}
		
		self.isAuthed = ( -1 != self.authList.indexOf( self.userId ));
		const viewUpdate = {
			type : 'init',
			data : {
				name        : self.identity.name,
				isOwner     : self.userId === self.ownerId,
				isAdmin     : user.isAdmin,
				isAuthed    : self.isAuthed,
				persistent  : self.persistent,
			},
		};
		self.toView( viewUpdate );
		
		self.updateViewUsers();
		self.updateIdentities();
		self.updateMentions();
		self.updateAtList();
		
		await self.updateRelation( state.relation );
		
		self.initialized = true;
		// update main view with # of peers in a live session
		const uptdPeers = {
			type : 'peers',
			data : {
				peerIds : state.peers,
			},
		};
		self.onLive( uptdPeers );
		
		if ( self.chatView )
			self.chatView.send({
				type : 'state',
				data : state,
			});
		
		if ( self.goLivePending ) {
			let liveConf = self.goLivePending;
			delete self.goLivePending;
			self.joinLive( liveConf );
		}
		else if ( self.live ) {
			self.restoreLive();
		}
		
		if ( self.openChatPending ) {
			const pend = self.openChatPending;
			self.openChatPending = null;
			self.openChat(
				pend.notification,
				pend.view
			);
		}
		
		self.updateActive();
		
		function selfIsUser() {
			const is = !!self.users[ self.userId ];
			return is;
		}
	}
	
	ns.PresenceRoom.prototype.setUsers = function( userList ) {
		const self = this;
		self.userIds = userList;
		userList.forEach( uId => {
			self.users[ uId ] = uId;
		});
	}
	
	ns.PresenceRoom.prototype.updateAtList = function() {
		const self = this;
		/*
		console.log( 'updateAtList', {
			worgs    : self.workgroups,
			atList   : self.atList,
			atNames  : self.atNames,
			atWorgs  : self.atWorgs,
			mentions : self.mentionList,
		});
		*/
		if ( null != self.workgroups ) {
			self.atWorgs = self.workgroups.assigned.map( ass => {
				return ass.name;
			});
		} else {
			self.atWorgs = [];
		}
		
		const all = [ ...self.atNames, ...self.atWorgs ];
		//console.log( 'all', all );
		self.atList = all;
		if ( !self.chatView )
			return;
		
		const uptd = {
			type : 'at-list',
			data : self.atList,
		};
		self.toChat( uptd );
	}
	
	ns.PresenceRoom.prototype.restoreLive = function() {
		const self = this;
		const restore = {
			type : 'live-restore',
			data : {
				clientId  : self.live.clientId,
				sessionId : self.live.id,
			},
		};
		self.send( restore );
	}
	
	ns.PresenceRoom.prototype.updateRelation = async function( relation ) {
		const self = this;
		if ( !relation ) {
			self.setWorkActivity();
			return;
		}
		
		self.relation = relation;
		await self.setLastMessage( relation.lastMessage );
		if ( relation.unreadMessages )
			relation.unread = relation.unreadMessages;
		
		const activityItem = await self.activity.read( self.clientId );
		if ( activityItem ) {
			self.updateRelationFromActivity(
				relation,
				activityItem.data.options
			);
			
			self.checkActivityPriority( activityItem );
		}
		
		const rel = {
			type : 'relation',
			data : relation,
		};
		self.toView( rel );
		
		self.updateWorkActivity( relation, activityItem );
		
		if ( !self.lastMessage )
			return;
		
		if ( checkHasActivity( relation )) {
			const msg = self.lastMessage.data;
			self.recentMessage( msg.message, msg.from, msg.time );
			if ( self.chatView && !self.chatView.checkMinimized()) {
				self.setUnreadMessages( 0 );
				self.setMentions( 0 );
			} else {
				self.setUnreadMessages( relation.unread );
				self.setMentions( relation.mentions );
			}
		} else {
			self.setUnreadMessages( 0 );
			self.setMentions( 0 );
		}
		
		function checkHasActivity( rel ) {
			if ( self.hasNotification ) {
				self.hasNotification = false;
				return true;
			}
			
			if ( !rel.unread )
				return false;
			
			return true;
		}
	}
	
	ns.PresenceRoom.prototype.updateRelationFromActivity = function( rel, act ) {
		const self = this;
		if (( null == rel ) || ( null == act ))
			return;
		
		update( 'unread', rel, act );
		update( 'mentions', rel, act );
		
		function update( key, rel, act ) {
			const rv = rel[ key ];
			const av = act[ key ];
			if ( rv === av )
				return;
			
			if ( null == av )
				return;
			
			if ( null == rv ) {
				rel[ key ] = av;
				return;
			}
			
			if ( rv < av )
				rel[ key ] = av;
			
		}
	}
	
	ns.PresenceRoom.prototype.checkActivityPriority = function( activity ) {
		const self = this;
		if ( !activity || !activity.data )
			return;
		
		const pri = activity.data.priority;
		if ( null == pri )
			return;
		
		if ( pri === self.priority )
			return;
		
		const opts = {
			priority : self.priority,
		};
		self.activity.updateItem( self.clientId, opts );
	}
	
	ns.PresenceRoom.prototype.setWorkActivity = function() {
		const self = this;
		if ( !self.workgroupId )
			return;
		
		if ( 0 == self.priority )
			return;
		
		self.recentMessage( 'Joined room', ' ', Date.now() );
		//throw new Error( 'setWorkActivity - NYI' );
	}
	
	ns.PresenceRoom.prototype.updateWorkActivity = function( relation, activityItem ) {
		const self = this;
		if ( !self.workgroupId )
			return;
		
		if ( !activityItem )
			set( relation );
		else
			update( relation, activityItem );
		
		function set( rel ) {
			if ( 0 == self.priority )
				return;
			
			const lm = rel.lastMessage;
			if ( !lm ) {
				self.setWorkActivity();
				return;
			}
			
			const msg = lm.data;
			self.recentMessage( msg.message, msg.from, msg.time );
		}
		
		function update( rel, act ) {
			console.log( 'update - NYI', [ rel, act ]);
		}
	}
	
	ns.PresenceRoom.prototype.updateMentions = function() {
		const self = this;
		const id = self.idc.read( self.userId );
		if ( !id ) {
			console.trace( 'updateMentions - could not find user', self );
			self.mentionList = null;
			return;
		}
		
		const uId = id.clientId;
		const name = id.name;
		const nameChecks = self.atStringsFromName( name );
		const groupChecks = self.atStringsFromGroups( uId );
		
		let tests = null;
		if ( groupChecks )
			tests = [ ...nameChecks, ...groupChecks ];
		else
			tests = nameChecks;
		
		//tests.push( 'all' );
		tests.push( 'everyone' );
		if ( self.checkIsRecent())
			tests.push( 'active' );
		
		if ( self.checkIsAdmin())
			tests.push( 'admins' );
		
		if ( self.checkIsGuest())
			tests.push( 'guests' );
		
		self.mentionList = tests;
		if ( self.mentionPId )
			update();
		else
			init();
		
		if ( !self.chatView )
			return;
		
		self.chatView.send({
			type : 'mention-list',
			data : self.mentionList,
		});
		
		function update() {
			const update = {
				atStrings : self.mentionList,
			};
			self.parser.update( self.mentionPId, update );
		}
		
		function init() {
			const mentionConf = {
				atStrings : self.mentionList,
				onlyEmit  : true,
			};
			self.parser = new library.component.parse.Parser();
			self.mentionPId = self.parser.use( 'AtThings', mentionConf, true );
			self.parser.on( 'mention', str => self.handleMention( str ));
		}
	}
	
	ns.PresenceRoom.prototype.atStringsFromGroups = function( uId ) {
		const self = this;
		const user = self.users[ uId ];
		if ( !user )
			return null;
		
		const memberOf = [];
		if ( !user.workgroups || !user.workgroups.length )
			return null;
		
		const uwgs = user.workgroups
		const wgs = self.workgroups;
		if ( !wgs )
			return null;
		
		let relevant = [];
		if ( wgs.assigned && wgs.assigned.length ) {
			const ass = wgs.assigned.map( a => a.clientId );
			relevant = relevant.concat( ass );
		}
		
		if ( wgs.superId )
			relevant.push( wgs.superId );
		
		if ( wgs.workId )
			relevant.push( wgs.workId );
		
		if ( !relevant.length )
			return null;
		
		relevant = relevant.filter( rId => {
			return uwgs.some( uwId => uwId === rId );
		});
		
		const names = relevant.map( rwId => {
			const wg = wgs.available[ rwId ];
			return wg.name;
		});
		
		return names;
	}
	
	ns.PresenceRoom.prototype.atStringsFromName = function( name ) {
		const self = this;
		const tests = [];
		tests.push( name );
		return tests;
	}
	
	ns.PresenceRoom.prototype.checkIsRecent = function( userId ) {
		const self = this;
		return self.checkInList( userId, self.recentList );
	}
	
	ns.PresenceRoom.prototype.checkIsAdmin = function( userId ) {
		const self = this;
		return self.checkInList( userId, self.adminList );
	}
	
	ns.PresenceRoom.prototype.checkIsGuest = function( userId ) {
		const self = this;
		return self.checkInList( userId, self.guestList );
	}
	
	ns.PresenceRoom.prototype.checkInList = function( userId, list ) {
		const self = this;
		if ( null == userId )
			userId = self.userId;
		
		return list.some( lId => lId === userId );
	}
	
	ns.PresenceRoom.prototype.setLastMessage = async function( lm ) {
		const self = this;
		if ( null == lm || null == lm.data )
			return;
		
		self.lastMessage = lm;
		const msg = lm.data;
		let from = null;
		try {
			from = await self.resolveMessageName( msg );
		} catch( ex ) {
			console.log( 'PresenceRoom.setLastMessage - resolveMessageName ex', ex );
			return false;
		}
		
		if ( null == from )
			return false;
		
		msg.from = from;
		self.lastMessage.data = msg;
		
		return true;
	}
	
	ns.PresenceRoom.prototype.handlePersistent = function( event ) {
		const self = this;
		self.persistent = event.persistent;
		const persistent = {
			type : 'persistent',
			data : event,
		};
		self.toView( persistent );
		
		if ( !self.chatView )
			return;
		
		self.toChat( persistent );
	}
	
	ns.PresenceRoom.prototype.handlePriority = async function( prio ) {
		const self = this;
		if ( prio === self.priority )
			return;
		
		self.priority = prio;
		if ( null == prio )
			prio = 0;
		
		const activity = await self.activity.read( self.clientId );
		if ( null == activity )
			return;
		
		const opts = {
			priority : prio,
		};
		self.activity.updateItem( self.clientId, opts );
	}
	
	ns.PresenceRoom.prototype.setupWorkroom = function() {
		const self = this;
		if ( null == self.workConfig )
			return;
		
		/*
		console.log( 'setupWorkroom - doesnt actually do anything atm', {
			prio : self.priority,
			wid  : self.workgroupId,
			sid  : self.supergroupId,
			conf : self.workConfig,
			worg : self.workgroups,
		});
		*/
		
	}
	
	ns.PresenceRoom.prototype.setSettings = function( settings ) {
		const self = this;
		const keys = Object.keys( settings );
		keys.forEach( k => {
			const value = settings[ k ];
			self.settings[ k ] = value;
		});
	}
	
	ns.PresenceRoom.prototype.showSettings = function( event ) {
		const self = this;
		const settings = event;
		if ( !self.expectSettings )
			return;
		
		self.expectSettings = false;
		if ( self.settingsView )
			return;
		
		if ( settings.authorized ) {
			const selfRemoved = settings.authorized.filter( notSelf );
			settings.authorized = selfRemoved;
			self.idc.getList( settings.authorized )
				.then( authIdsBack )
				.catch( authIdsFail );
		}
		else
			showView( settings );
		
		function authIdsBack( list ) {
			const ids = {};
			list.forEach( id => {
				ids[ id.clientId ] = id;
			});
			settings.authorized = {
				authed : settings.authorized,
				ids    : ids,
			};
			
			showView( settings );
		}
		
		function authIdsFail( err ) {
			console.log( 'authIdsFail', err );
			delete settings.authorized;
			showView( settings );
		}
		
		function showView( settings ) {
			conf = {
				type     : 'presence-room',
				title    : self.identity.name + ' - Presence',
				settings : settings,
				onsave   : onSave,
				onclose  : onClose,
			};
			self.settingsView = new library.view.Settings( conf );
			function onSave( keyValue ) {
				const setting = {
					type : 'setting',
					data : keyValue,
				};
				
				self.settings.send( setting );
			}
			
			function onClose( e ) {
				self.settingsView = null;
			}
		}
		
		function notSelf( authId ) {
			return authId !== self.userId;
		}
	}
	
	ns.PresenceRoom.prototype.handleSettingUpdate = function( event ) {
		const self = this;
		if ( !self.settings )
			return;
		
		if ( self.settingsView )
			self.settingsView.saved( event );
		
		if ( !event.success )
			return;
		
		if ( 'isStream' === event.setting )
			self.settings.isStream = event.value;
		
		const update = {
			type : 'settings',
			data : event,
		};
		if ( self.chatView )
			self.chatView.send( update );
		
		if ( self.live )
			self.live.send( update );
	}
	
	ns.PresenceRoom.prototype.changeLiveType = function() {
		const self = this;
		if ( !self.live )
			return;
		
		const viewSwitch = {
			type : 'view-switch',
			data : {
				isStream : self.isStream,
			},
		};
		self.live.send( viewSwitch );
	}
	
	ns.PresenceRoom.prototype.getIdentities = function( idList ) {
		const self = this;
		if( !idList )
			idList = Object.keys( self.users );
		
		return new Promise(( resolve, reject ) => {
			self.idc.getList( idList )
				.then( resolve )
				.catch( reject );
		});
	}
	
	ns.PresenceRoom.prototype.handleIdentity = function( event ) {
		const self = this;
		if ( !event.userId || !event.identity )
			return;
		
		self.identities[ event.userId ] = event.identity;
		self.updateIdentities( event.userId );
	}
	
	ns.PresenceRoom.prototype.updateIdentities = function( userId ) {
		const self = this;
		var uptd  = null;
		if ( userId )
			uptd = {
				type : 'identity',
				data : {
					userId   : userId,
					identity : self.identities[ userId ],
				},
			};
		else
			uptd = {
				type : 'identities',
				data : self.identities,
			};
		
		if ( self.live )
			self.live.send( uptd );
		
		if ( self.chatView )
			self.chatView.send( uptd );
	}
	
	ns.PresenceRoom.prototype.handleAuthed = function( event ) {
		const self = this;
		if ( event.userId === self.userId ) {
			const isAuthed = {
				type : 'auth',
				data : {
					isAuthed : event.isAuthed,
				},
			};
			self.toView( isAuthed );
		}
		
		if ( self.chatView ) {
			const authed = {
				type : 'authed',
				data : event,
			};
			self.chatView.send( authed );
		}
	}
	
	ns.PresenceRoom.prototype.handleWorkgroup = function( event ) {
		const self = this;
		if ( !self.workgroups )
			return;
		
		const type = event.type;
		const data = event.data;
		
		if ( 'assigned' === type )
			updateAssigned( data );
		
		if ( 'added' === type )
			add( data );
		
		if ( 'members' === type )
			updateMembers( data );
		
		if ( 'sub-rooms' === type )
			updateSubs( data );
		
		
		function updateAssigned( ass ) {
			self.workgroups.assigned = ass;
			if ( self.chatView )
				self.chatView.send({
					type : 'workgroups-assigned',
					data : self.workgroups.assigned,
				});
			
			self.updateMentions();
			self.updateAtList();
		}
		
		function add( worg ) {
			const wId = worg.clientId;
			self.workgroups.available[ wId ] = worg;
			if ( self.chatView )
				self.chatView.send({
					type : 'workgroup-added',
					data : worg,
				});
		}
		
		function updateMembers( event ) {
			self.updateWorkgroupMembers( event.workId, event.members );
		}
		
		function updateSubs( subIds ) {
			self.workgroups.subIds = subIds;
			if ( !self.chatView )
				return;
			
			const update = {
				type : 'workgroup-sub-rooms',
				data : subIds,
			};
			self.chatView.send( update );
			
			self.updateMentions();
			self.updateAtList();
		}
	}
	
	ns.PresenceRoom.prototype.setWorkgroupMembers = function() {
		const self = this;
		return;
		const members = self.workgroups.members;
		/*
		const superList = self.workgroups.users;
		if ( superList && superList.length ) {
			self.getIdentities( superList )
				.then( uBacks )
				.catch( err );
		}
		*/
		
		if ( !members )
			return;
		
		const worgIds = Object.keys( members );
		worgIds.forEach( wId => {
			self.updateWorkgroupMembers( wId, members[ wId ] );
		});
		
		function uBacks( ids ) {
			ids.forEach( id => {
				const cId = id.clientId;
				if ( self.identities[ cId ])
					return;
				
				self.identities[ cId ] = id;
			});
		}
		
		function err( e ) {
			console.log( 'failed for fetch workgroups users', e );
			self.workgroups.users = [];
		}
	}
	
	ns.PresenceRoom.prototype.checkIsInWorkgroup = function( userId ) {
		const self = this;
		if (( null == self.workgroups ) || ( null == self.workgroups.members ))
			return null;
		
		const members = self.workgroups.members;
		const wIds = Object.keys( members );
		let isMember = wIds.some( wId => {
			const worgUList = members[ wId ];
			return worgUList.some( uId => uId === userId );
		});
		
		return isMember;
	}
	
	ns.PresenceRoom.prototype.updateWorkgroupMembers = function( worgId, list ) {
		const self = this;
		if ( !self.workgroups || !self.workgroups.members )
				return;
		
		self.workgroups.members[ worgId ] = list;
		if ( !self.chatView )
			return;
		
		self.chatView.send({
			type : 'workgroup-members',
			data : {
				workId     : worgId,
				members    : list,
			},
		});
	}
	
	ns.PresenceRoom.prototype.handleInvite = function( event ) {
		const self = this;
		if ( 'revoke' === event.type )
			send( event );
		else
			self.buildInvites( event )
				.then( invitesBack )
				.catch( boop );
		
		function boop( e ) {
			console.log( 'handleInvite.buildInvites boop', e );
		}
		
		function invitesBack( event ) {
			if ( event.data.reqId ) {
				self.handleRequest( event.data.reqId, event.data );
			}
			
			send( event );
		}
		
		function send( event ) {
			const inv = {
				type : 'invite',
				data : event,
			};
			
			if ( self.chatView )
				self.chatView.send( inv );
			
			if ( self.live )
				self.live.send( inv );
		}
	}
	
	ns.PresenceRoom.prototype.handleRoomUpdate = function( update ) {
		const self = this;
		const name = update.name;
		self.identity.name = name;
		self.identity.avatar = update.avatar;
		self.toView({
			type : 'identity',
			data : self.identity,
		});
		if ( self.chatView )
			self.chatView.setTitle( name );
		
		if ( self.live )
			self.live.setTitle( name );
	}
	
	ns.PresenceRoom.prototype.handleJoin = async function( user ) {
		const self = this;
		const uId = user.clientId;
		if ( user.name )
			self.handleAtNameAdd( user.name );
		
		if ( user.isAdmin )
			self.handleAdminAdd( uId );
		
		if ( user.isGuest )
			self.guestAdd( uId );
		
		if ( user.isRecent )
			self.recentAdd( uId );
		
		self.users[ uId ] = uId;
		if ( -1 === self.userIds.indexOf( uId ))
			self.userIds.push( uId );
		
		const join = {
			type : 'join',
			data : {
				user : user,
			},
		};
		self.toChat( join );
		
		if ( user.isOnline )
			self.setUserOnline( uId, true );
		else
			self.updateViewUsers();
	}
	
	ns.PresenceRoom.prototype.handleLeave = function( userId ) {
		const self = this;
		delete self.users[ userId ];
		self.userIds = Object.keys( self.users );
		const leave = {
			type : 'leave',
			data : userId,
		};
		self.toChat( leave );
		self.recentRemove( userId );
		self.guestRemove( userId );
		
		self.onlineList = self.onlineList.filter( oId => oId !== userId );
		self.updateViewUsers();
	}
	
	ns.PresenceRoom.prototype.updateViewUsers = function( event ) {
		const self = this;
		const users = {
			type : 'users',
			data : {
				users  : 0,
				online : self.onlineList.length,
			},
		};
		self.toView( users );
	}
	
	ns.PresenceRoom.prototype.setupLive = function( permissions ) {
		const self = this;
		const conf = {
			permissions : permissions,
		};
		
		self.joinLive( conf );
	}
	
	ns.PresenceRoom.prototype.handleLive = async function( event ) {
		const self = this;
		const type = event.type;
		if ( 'open' === type ) {
			self.handleLiveOpen( event.data );
			return;
		}
		
		if ( 'close' === type ) {
			self.handleLiveClose( event.data );
			return;
		}
		
		if ( 'ping' === type ) {
			if ( !self.live )
				return;
			
			const pong = {
				type : 'pong',
				data : event.data,
			}
			self.liveToServer( pong );
			return;
		}
		
		if ( 'peers' === type
			|| 'join' === type
			|| 'leave' === type
		) {
			self.onLive( event );
		}
		
		if ( !self.live )
			return;
		
		if ( 'join' === type ) {
			const peer = event.data;
			const id = await self.idc.get( peer.peerId );
			peer.identity = id;
		}
		
		if ( 'peers' === type ) {
			const data = event.data;
			const pIds = data.peerIds;
			const identityList = await self.idc.getList( pIds );
			data.identities = setIdMap( identityList );
		}
		
		self.live.send( event );
		
		function setIdMap( list ) {
			const map = {};
			list.forEach( id => {
				const cId = id.clientId;
				map[ cId ] = id;
			});
			return map;
		}
	}
	
	ns.PresenceRoom.prototype.onLive = function( event ) {
		const self = this;
		self.liveToView( event );
		self.updatePeers( event );
	}
	
	ns.PresenceRoom.prototype.handleChat = function( event ) {
		const self = this;
		const chat = {
			type : 'chat',
			data : event,
		}
		
		if (
			( 'msg' === event.type ) 
			|| ( 'work-msg' === event.type )
		) {
			self.onMessage( event.data );
		}
		
		self.toChat( chat );
		self.toLive( chat );
	}
	
	ns.PresenceRoom.prototype.onMessage = function( msg ) {
		const self = this;
		self.hasNotification = false;
		let fromSelf = false;
		if ( msg.fromId === self.userId )
			fromSelf = true;
		
		self.resolveMessageName( msg )
			.then( nameBack )
			.catch( nameBack );
		
		function nameBack( from ) {
			const event = {
				from    : from,
				message : msg.message,
				time    : msg.time,
			};
			
			let silent = false;
			if ( self.valueAddedRoom ) // workrooms added as subrooms
				silent = true;
			
			if ( fromSelf )
				self.recentMessage( msg.message, from, msg.time );
			else
				self.onChatMessage( event, silent );
			
			if ( silent )
				return;
			
			if ( !fromSelf )
				self.parser.work( msg.message );
			
			/*
			self.recentMessage( msg.message, from, msg.time );
			
			if ( !self.chatView )
				self.messageWaiting( true, msg.message, from, msg.time );
			*/
		}
	}
	
	ns.PresenceRoom.prototype.resolveMessageName = function( msg ) {
		const self = this;
		return new Promise(( resolve, reject ) => {
			if ( msg.fromId )
				self.resolveName( msg.fromId )
					.then( resolve )
					.catch( resolve );
			else
				resolve( 'Guest > ' + msg.name );
			
		});
	}
	
	ns.PresenceRoom.prototype.resolveName = function( accId ) {
		const self = this;
		return new Promise(( resolve, reject ) => {
			self.idc.get( accId )
				.then( idBack )
				.catch( idSad );
				
			function idBack( identity ) {
				if ( !identity )
					resolve( '<id not found>' );
				else
					resolve( identity.name );
			}
			
			function idSad( err ) {
				console.log( 'PresenceRoom.resolveName - idSad', err );
				resolve( 'unknown' );
			}
		});
	}
	
	ns.PresenceRoom.prototype.handleCounterReset = function( e ) {
		const self = this;
		self.resetCounters();
	}
	
	ns.PresenceRoom.prototype.resetCounters = function() {
		const self = this;
		self.messageWaiting( false );
		self.mentionWaiting( false );
	}
	
	ns.PresenceRoom.prototype.handleRecentAdd = function( userId ) {
		const self = this;
		const added = self.recentAdd( userId );
		
		if ( !added )
			return;
		
		const uptd = {
			type : 'recent-add',
			data : userId,
		};
		self.toChat( uptd );
		
		if ( userId == self.userId )
			self.updateMentions();
	}
	
	ns.PresenceRoom.prototype.recentAdd = function( userId ) {
		const self = this;
		const idx = self.recentList.indexOf( userId );
		if ( -1 != idx )
			return false;
		
		self.recentList.push( userId );
		return true;
	}
	
	ns.PresenceRoom.prototype.handleRecentRemove = function( userId ) {
		const self = this;
		const removed = self.recentRemove( userId );
		if ( !removed )
			return;
		
		const uptd = {
			type : 'recent-remove',
			data : userId,
		};
		self.toChat( uptd );
		
		if ( userId == self.userId )
			self.updateMentions();
	}
	
	ns.PresenceRoom.prototype.recentRemove = function( userId ) {
		const self = this;
		const idx = self.recentList.indexOf( userId );
		if ( -1 == idx )
			return false;
		
		self.recentList.splice( idx, 1 );
		return true;
	}
	
	ns.PresenceRoom.prototype.handleAtNameAdd = function( name ) {
		const self = this;
		const idx = self.atNames.indexOf( name );
		if ( -1 != idx )
			return;
		
		self.atNames.push( name );
		self.updateAtList();
	}
	
	ns.PresenceRoom.prototype.handleAtNames = function( nameList ) {
		const self = this;
		self.atNames = nameList;
		self.updateAtList();
	}
	
	ns.PresenceRoom.prototype.handleAdminAdd = function( userId ) {
		const self = this;
		const aIdx = self.adminList.indexOf( userId );
		if ( -1 != aIdx )
			return;
		
		self.adminList.push( userId );
		const add = {
			type : 'admin-add',
			data : userId,
		};
		self.toChat( add );
	}
	
	ns.PresenceRoom.prototype.handleAdminRemove = function( userId ) {
		const self = this;
		const aIdx = self.adminList.indexOf( userId );
		if ( -1 == aIdx )
			return;
		
		self.adminList.splice( aIdx, 1 );
		const remove = {
			type : 'admin-remove',
			data : userId,
		};
		self.toChat( remove );
	}
	
	ns.PresenceRoom.prototype.guestAdd = function( userId ) {
		const self = this;
		const gIdx = self.guestList.indexOf( userId );
		if ( -1 != gIdx )
			return;
		
		self.guestList.push( userId );
	}
	
	ns.PresenceRoom.prototype.guestRemove = function( userId ) {
		const self = this;
		const gIdx = self.guestList.indexOf( userId );
		if ( -1 == gIdx )
			return;
		
		self.guestList.splice( gIdx, 1 );
	}
	
	ns.PresenceRoom.prototype.setRequest = function( callback ) {
		const self = this;
		if ( !callback )
			return;
		
		self.requests = self.requests || {};
		const reqId = friendUP.tool.uid( 'req' );
		self.requests[ reqId ] = callback;
		return reqId;
	}
	
	ns.PresenceRoom.prototype.handleRequest = function( reqId, data ) {
		const self = this;
		if ( !reqId || !self.requests )
			return;
		
		const callback = self.requests[ reqId ];
		if ( !callback )
			return;
		
		delete self.requests[ reqId ];
		callback( data );
	}
	
	ns.PresenceRoom.prototype.buildInvites = function( event ) {
		const self = this;
		return new Promise(( resolve, reject ) => {
			if ( 'state' === event.type )
				parseState( event.data )
					.then( parseDone )
					.catch( buildBoop );
			else
				build( event.data )
					.then( buildBack )
					.catch( buildBoop );
			
			function buildBoop( err ) {
				console.log( 'PresenceRoom.buildInvites - err', err );
				reject( err );
			}
			
			function buildBack( conf ) {
				event.data = conf;
				resolve( event );
			}
			
			function parseDone( conf ) {
				event.data = conf;
				resolve( event );
			}
			
		});
		
		function build( conf ) {
			return new Promise(( resolve, reject ) => {
				if ( 'string' === typeof( conf ))
					conf = { token : conf };
					
				const data = {
					type   : 'live',
					token  : conf.token,
					host   : conf.host,
					roomId : self.clientId,
					v      : 2,
				};
				const bundle = {
					type : 'live-invite',
					data : data,
				};
				
				conf.link = hello.intercept.buildURL( bundle, false, 'i18n_join_me_live' );
				conf.link.url += '&theme=borderless';
				
				conf.data = hello.intercept.buildJSON( bundle );
				conf.data = conf.data.prefix + conf.data.url;
				
				friend.tinyURL.compress( conf.link.url )
					.then( tinyBack )
					.catch( tinyErr );
				
				//
				function tinyBack( res ) {
					done( res.url );
				}
				
				function tinyErr( err ) {
					console.log( 'tinyErr', err );
					reject();
				}
				
				function done( url ) {
					if ( !url )
						conf.message = conf.link.prefix + conf.link.url;
					else {
						conf.link = url;
						conf.message = conf.link.prefix + url;
					}
					
					resolve( conf );
				}
			});
		}
		
		function parseState( state, callback ) {
			return new Promise(( resolve, reject ) => {
				Promise.all( state.privateTokens.map( buildPriv ))
					.then( privsDone )
					.catch( err );
				
				function privsDone( privs ) {
					state.privateTokens = privs;
					if ( state.publicToken )
						buildPub();
					else
						resolve( state );
				}
				
				function buildPub() {
					const conf = {
						token : state.publicToken,
						host  : state.host,
					};
					const pub = build( conf )
						.then( pubBack )
						.catch( err );
				}
				
				function pubBack( conf ) {
					state.publicToken = conf;
					resolve( state );
				}
				
				function buildPriv( token ) {
					const conf = {
						token : token,
						host  : state.host,
					};
					return build( conf );
				}
				
				function err( err ) {
					console.log( 'eer', err );
				}
			});
		}
	}
	
	ns.PresenceRoom.prototype.liveToView = function( event ) {
		const self = this;
		const wrap = {
			type : 'live',
			data : event,
		};
		
		if ( self.view )
			self.view.send( wrap );
		if ( self.chatView )
			self.chatView.send( wrap );
	}
	
	ns.PresenceRoom.prototype.toLive = function( event ) {
		const self = this;
		if ( !self.live )
			return;
		
		self.live.send( event );
	}
	
	ns.PresenceRoom.prototype.updatePeers = function( event ) {
		const self = this;
		if ( 'peers' === event.type ) {
			const data = event.data;
			self.peers = data.peerIds;
			update();
			return;
		}
		
		const pid = event.data.peerId;
		if ( 'join' === event.type ) {
			self.peers.push( pid );
			update();
			return;
		}
		
		if ( 'leave' === event.type ) {
			self.peers = self.peers.filter( notPID );
			update();
			return;
		}
		
		function update() {
			const opts = {
				live : self.peers.length,
			};
			
			if ( self.activity )
				self.activity.updateItem( self.clientId, opts );
		}
		
		function notPID( peerId ) {
			return peerId !== pid;
		}
	}
	
	ns.PresenceRoom.prototype.setIdentity = function() {
		const self = this;
		self.identity = {
			clientId : self.clientId,
			name     : self.data.name || null,
			avatar   : self.data.avatar || null,
		};
	}
	
	ns.PresenceRoom.prototype.sendChatEvent = function( event ) {
		const self = this;
		const chat = {
			type : 'chat',
			data : event,
		};
		self.send( chat );
	}
	
	ns.PresenceRoom.prototype.inviteToServer = function( event ) {
		const self = this;
		const invite = {
			type : 'invite',
			data : event,
		};
		self.send( invite );
	}
	
	ns.PresenceRoom.prototype.handleLiveName = function( name ) {
		const self = this;
		const id = self.identities[ self.userId ];
		if ( !name || !name.length || !id ) {
			console.log( 'handleLiveName - invalid', {
				name : name,
				id   : id,
			});
			return;
		}
		
		id.liveName = name;
		const idUpdate = {
			type : 'identity',
			data : id,
		};
		self.send( idUpdate );
	}
	
	ns.PresenceRoom.prototype.handleViewSwitch = function( event ) {
		const self = this;
		self.live.close();
		self.live = null;
		
		let choice = event.choice;
		if ( 'close' === choice )
			return;
		
		if ( 'stream' === choice ) {
			self.joinLive();
			return;
		}
		
		if ( 'video' === choice )
			self.startVideo();
		else
			self.startAudio();
		
	}
	
	ns.PresenceRoom.prototype.liveToServer = function( event ) {
		const self = this;
		const wrap = {
			type : 'live',
			data : event,
		};
		self.send( wrap );
	}
	
	ns.PresenceRoom.prototype.closeLive = function() {
		const self = this;
		const live = self.live;
		if ( !live )
			return;
		
		delete self.live;
		live.close();
		const userLeave = {
			type : 'user-leave',
		};
		self.liveToView( userLeave );
		self.updateActive();
	}
	
	ns.PresenceRoom.prototype.handleLiveOpen = async function( event ) {
		const self = this;
		const liveId = event.clientId;
		const userJoin = {
			type : 'user-join',
		};
		self.liveToView( userJoin );
		
		const isClient = checkClientLive( liveId );
		const state = isClient ? 'client' : 'user';
		const opts = {
			'live-state' : state,
		};
		
		if ( !isClient ) {
			self.activity.updateItem( self.clientId, opts );
			return;
		}
		
		self.activity.live(
			self.roomType,
			self.clientId,
			self.priority,
			'i18n_you_joined_the_call',
			Date.now(),
			opts
		);
		
		const init = event.live;
		const lConf = init.liveConf;
		const peers = lConf.peerList;
		const idList = await self.idc.getList( peers );
		init.identities = toIdMap( idList );
		self.live.initialize( init );
		
		function checkClientLive( lId ) {
			if ( !self.live )
				return false;
			
			if ( lId !== self.live.clientId )
				return false;
			
			return true;
		}
		
		function toIdMap( idList ) {
			const map = {};
			idList.forEach( id => {
				if ( null == id )
					return;
				
				const cId = id.clientId;
				map[ cId ] = id;
			});
			
			return map;
		}
	}
	
	ns.PresenceRoom.prototype.handleLiveClose = function( event ) {
		const self = this;
		const sessionId = event.sessionId;
		const liveId = event.clientId;
		// close without clientId means user left live, close all the things
		if ( !liveId ) {
			updateView( 'close' );
			close( true );
			return;
		}
		
		// we're closing live in this client, but user is still live somewhere else
		if ( liveId === self.live.clientId ) {
			updateView( 'user' );
			close();
			return;
		}
		
		// a live was told to close, but not this one. User is still live here or somewhere else
		return;
		
		//
		function updateView( state ) {
			const userLeave = {
				type : 'user-leave',
			};
			self.liveToView( userLeave );
			
			const opts = {
				'live-state' : state
			};
			self.activity.updateItem( self.clientId, opts );
		}
		
		function close( sendLeave ) {
			if ( sendLeave ) {
				self.activity.live(
					self.roomType,
					self.clientId,
					self.priority,
					'i18n_you_left_the_call',
					Date.now(),
				);
			}
			
			if ( !self.live )
				return;
			
			const live = self.live;
			delete self.live;
			live.close();
			
		}
	}
	
})( library.contact );

//
// PRESENCEHIDDEN
(function( ns, undefined ) {
	ns.PresenceHidden = function( conf ) {
		const self = this;
		self.type = 'presence';
		self.data = conf.contact.identity;
		self.idc = conf.idCache;
		self.user = conf.user;
		self.userId = conf.userId;
		
		ns.Contact.call( self, conf );
		
		self.roomType = 'room';
		self.contactId = null;
		self.isPrivate = true;
		self.isHidden = true;
		self.isDisabled = null;
		self.settings = null;
		self.identities = {};
		self.onlineList = [];
		self.users = {};
		
		self.init( conf.contact );
	}
	
	ns.PresenceHidden.prototype = Object.create( ns.PresenceRoom.prototype );
	
	// Public
	
	// Private
	
	ns.PresenceHidden.prototype.init = function( contact ) {
		const self = this;
		self.identity = contact.identity;
		self.identities[ self.user.clientId ] = self.user;
		self.identities[ self.identity.clientId ] = self.identity;
		self.contactId = self.identity.clientId;
		self.isDisabled = !!self.identity.fIsDisabled;
		
		self.conn.on( 'chat', e => {
			const chat = {
				type : 'chat',
				data : e,
			};
			self.toChat( chat );
		});
		
		self.openChat();
	}
	
	ns.PresenceHidden.prototype.openChat = function() {
		const self = this;
		const initData = {
			isPrivate   : true,
			persistent  : true,
			isHidden    : true,
			isDisabled  : self.isDisabled,
			roomName    : self.identity.name,
			users       : self.identities,
			identities  : self.identities,
			workgroups  : [],
			onlineList  : [],
			peers       : [],
			ownerId     : self.ownerId,
			userId      : self.userId,
			contactId   : self.contactId,
		};
		
		self.chatView = new library.view.PresenceChat( initData );
		self.chatView.on( 'close', onClose );
		self.chatView.on( 'chat', onChat );
		
		function onClose() {
			self.emit( 'close' );
		}
		
		function onChat( e ) {
			const chat = {
				type : 'chat',
				data : e,
			};
			self.send( chat );
		}
	}
})( library.contact );

//
// PRESENCECONTACT

(function( ns, undefined ) {
	ns.PresenceContact = function( conf ) {
		const self = this;
		self.type = 'presence';
		self.data = conf.contact.identity;
		self.idc = conf.idCache;
		self.host = conf.host;
		self.user = conf.user;
		self.userId = conf.userId;
		
		ns.Contact.call( self, conf );
		
		self.roomType = 'contact';
		self.liveState = {
			user    : false,
			contact : false,
		};
		self.contactId = null;
		self.isOnline = false;
		self.isPrivate = true;
		self.settings = null;
		self.identities = {};
		self.onlineList = [];
		self.users = {};
		self.peers = [];
		
		self.init( conf.contact );
	}
	
	ns.PresenceContact.prototype = Object.create( ns.PresenceRoom.prototype );
	
	// Public
	
	ns.PresenceContact.prototype.reconnect = function() {
		const self = this;
		if ( !self.isOpen ) {
			if ( self.openChatPending ) {
				self.open();
				return true;
			}
			
			return false;
		}
		
		self.sendInit();
		return true;
	}
	
	ns.PresenceContact.prototype.updateIdentity = function( update ) {
		const self = this;
		const id = update.data;
		const cId = id.clientId;
		const isRoom = ( self.clientId = cId );
		if ( isRoom ) {
			self.identity = id;
			self.activity.updateIdentity( cId, id );
		}
		
		const isContact = ( self.contactId === cId );
		const isUser = ( self.userId === cId );
		if ( !isContact && !isUser )
			return;
		
		const event = {
			type : 'identity-update',
			data : update,
		};
		self.toView( event );
		self.toChat( event );
		self.toLive( event );
	}
	
	ns.PresenceContact.prototype.updateState = function( state ) {
		const self = this;
		if ( null == state )
			return;
		
		const peers = state.peers;
		if ( null == peers )
			return;
		
		self.open();
	}
	
	ns.PresenceContact.prototype.getTitle = function() {
		const self = this;
		return self.identity.name;
	}
	
	ns.PresenceContact.prototype.formatNotifyText = function( msg ) {
		const self = this;
		return msg.message;
	}
	
	ns.PresenceContact.prototype.getViewConf = function() {
		const self = this;
		return {
			clientId : self.clientId,
			identity : self.identity,
			relation : self.relation,
		}
	}
	
	ns.PresenceContact.prototype.checkMsgBeepSetting = function() {
		const self = this;
		if ( !!hello.account.settings.privateAlert )
			return true;
		else
			return false;
	}
	
	ns.PresenceContact.prototype.getInviteToken = function( type, callback ) {
		const self = this;
		if ( callback )
			callback( null );
		
		return false;
	}
	
	ns.PresenceContact.prototype.setOnline = async function( userState ) {
		const self = this;
		const isOnline = !!userState;
		if ( self.isOnline === isOnline )
			return;
		
		self.isOnline = isOnline;
		if ( isOnline )
			self.onlineList.push( self.clientId );
		else
			self.onlineList = [ self.userId ];
		
		let online = {
			type : 'online',
			data : isOnline,
		};
		self.toView( online );
		
		if ( isOnline )
			self.toChat({
				type : 'online',
				data : {
					clientId : self.clientId,
					isAuthed : true,
				},
			});
		else
			self.toChat({
				type : 'offline',
				data : self.clientId,
			});
		
		if ( !self.activity )
			return;
		
		const status = isOnline ? 'online' : 'offline';
		const uptd = {
			status : status,
		};
		try {
			await self.activity.updateItem( self.clientId, uptd );
		} catch( ex ) {
			console.log( 'PresenceContact.setOnline - activity.updateItem ex', ex );
		}
	}
	
	
	// Private
	
	ns.PresenceContact.prototype.init = function( contact ) {
		const self = this;
		self.identity = contact.identity;
		self.identities[ self.user.clientId ] = self.user;
		self.identities[ self.identity.clientId ] = self.identity;
		self.contactId = self.identity.clientId;
		
		self.setRelation( contact.relation );
		self.updateState( contact.state );
		
		self.conn.on( 'open', open );
		self.conn.on( 'initialize', init );
		self.conn.on( 'identity', identity );
		self.conn.on( 'live', live );
		self.conn.on( 'chat', chat );
		
		self.settings = new library.component.RequestNode( 'settings', self.conn );
		self.settings.on( 'update', e => self.handleSettingUpdate( e ));
		
		self.bindView();
		/*
		self.view.on( 'call-notification',
			( e ) => self.handleCallNotification( e ));
		*/
		
		self.isOpen = false;
		self.updateMentions();
		self.setOnline( self.identity.isOnline );
		
		function open( e ) { self.handleOpen( e ); }
		function init( e ) { self.handleInitializeContact( e ); }
		function identity( e ) { self.handleIdentity( e ); }
		function live( e ) { self.handleLive( e ); }
		function chat( e ) { self.handleChat( e ); }
	}
	
	ns.PresenceContact.prototype.setIdentity = function() {
		const self = this;
	}
	
	ns.PresenceContact.prototype.setRelation = async function( rel ) {
		const self = this;
		if ( !rel )
			return;
		
		self.relation = rel;
		if ( null != rel.lastMessage ) {
			self.setLastMessage( rel.lastMessage );
			self.relation.lastMessage = self.lastMessage;
		}
		
		if ( rel.unreadMessages )
			rel.unread = rel.unreadMessages;
		
		const activityItem = await self.activity.read( self.clientId );
		if ( activityItem )
			self.updateRelationFromActivity(
				rel,
				activityItem.data.options
			);
		
		if ( null == self.lastMessage )
			return;
		
		if ( checkHasActivity( rel )) {
			const msg = self.lastMessage.data;
			self.recentMessage( msg.message, msg.from, msg.time );
			if ( self.chatView && !self.chatView.checkMinimized()) {
				self.setUnreadMessages( 0 );
				self.setMentions( 0 );
			} else {
				self.setUnreadMessages( rel.unread );
				self.setMentions( rel.mentions );
			}
		} else {
			self.setUnreadMessages( 0 );
			self.setMentions( 0 );
		}
		
		function checkHasActivity( rel ) {
			if ( self.hasNotification ) {
				self.hasNotification = false;
				return true;
			}
			
			if ( !rel.unread )
				return false;
			
			return true;
		}
	}
	
	ns.PresenceContact.prototype.open = function() {
		const self = this;
		self.send({
			type : 'open',
			data : null,
		});
	}
	
	ns.PresenceContact.prototype.handleOpen = function( isOpen ) {
		const self = this;
		if ( self.isOpen === isOpen )
			return;
		
		self.isOpen = isOpen;
		if ( self.isOpen && !self.initialized )
			self.sendInit();
		
		/*
		if ( self.openChatPending && self.initialized )
			self.openChatView();
		*/
	}
	
	ns.PresenceContact.prototype.onLive = function( event ) {
		const self = this;
		self.liveToView( event );
		self.updatePeers( event );
	}
	
	ns.PresenceContact.prototype.updatePeers = function( event ) {
		const self = this;
		if ( 'peers' === event.type ) {
			const data = event.data;
			self.peers = data.peerIds;
			checkWhosWho();
			return;
		}
		
		const peerId = event.data.peerId;
		const isContact = peerId === self.clientId;
		if ( !isContact )
			return;
		
		if ( 'join' === event.type ) {
			self.peers.push( peerId );
			self.liveState.contact = true;
			if ( self.liveState.user ) {
				if ( self.live )
					self.liveState.description = 'client';
				else
					self.liveState.description = 'user';
				
				self.updateLiveState();
			} else {
				postIncoming();
			}
			
			return;
		}
		
		if ( 'leave' === event.type ) {
			self.peers = self.peers.filter( pId => pId !== peerId );
			self.liveState.contact = false;
			if ( self.liveState.user ) {
				self.liveState.description = 'outgoing';
				self.updateLiveState();
			}
			else {
				let missed = false;
				if ( 'incoming' === self.liveState.description )
					missed = true;
				
				self.liveState.description = 'none';
				if ( !missed ) {
					self.updateLiveState();
				} else {
					postMissed();
				}
			}
			
			return;
		}
		
		function checkWhosWho() {
			let contactLive = false;
			let userLive = false;
			contactLive = self.peers.some( pId => pId === self.clientId );
			userLive = self.peers.some( pId => pId === self.userId );
			let lState = {
				user        : userLive,
				contact     : contactLive,
				description : 'none',
			};
			if ( contactLive && !userLive )
				lState.description = 'incoming';
			if ( !contactLive && userLive )
				lState.description = 'outgoing';
			if ( contactLive && userLive ) {
				if ( self.live )
					lState.description = 'client';
				else
					lState.description = 'user';
			}
			
			if ( lState.description === self.liveState.description )
				return;
			
			self.liveState = lState;
			if ( 'incoming' === self.liveState.description )
				postIncoming();
			else
				self.updateLiveState();
		}
		
		function postIncoming() {
			hello.incommingCall.showCall( self.clientId, self.identity );
			self.liveState.description = 'incoming';
			const opts = {
				'live-state' : self.liveState,
			};
			toView( self.liveState );
			self.activity.live(
				self.roomType,
				self.clientId,
				1,
				'i18n_incoming_call',
				Date.now(),
				opts
			);
			
			self.postCallNotification();
		}
		
		function postMissed() {
			hello.incommingCall.hideCall( self.clientId );
			const opts = {
				'live-state' : self.liveState,
			};
			toView( self.liveState );
			self.activity.live(
				self.roomType,
				self.clientId,
				self.priority,
				'i18n_missed_call',
				Date.now(),
				opts
			);
		}
		
		function toView( state ) {
			if ( !self.view )
				return;
			
			self.view.send({
				type : 'live-state',
				data : state,
			});
		}
	}
	
	ns.PresenceContact.prototype.handleLiveOpen = function( event ) {
		const self = this;
		const liveId = event.clientId;
		self.liveState.user = true;
		self.peers.push( self.userId );
		const isClient = checkClientLive( liveId );
		const state = isClient ? 'client' : 'user';
		if ( state === self.liveState.description ) {
			console.log( 'aborting' );
			return;
		}
		
		self.liveState.description = state;
		self.updateLiveState();
		
		if ( !isClient )
			return;
		
		const opts = {
			'live-state' : self.liveState,
		};
		self.activity.live(
			self.roomType,
			self.clientId,
			self.priority,
			'i18n_you_joined_the_call',
			Date.now(),
			opts
		);
		
		let init = event.live;
		init.identities = self.identities;
		self.live.initialize( init );
		
		function checkClientLive( lId ) {
			if ( !self.live )
				return false;
			
			return lId === self.live.clientId;
		}
	}
	
	ns.PresenceContact.prototype.handleLiveClose = function( event ) {
		const self = this;
		const sessionId = event.sessionId;
		const liveId = event.clientId;
		self.peers = self.peers.filter( pId => pId != self.userId );
		const others = self.peers.some( pId => pId != self.userId );
		let state = others ? 'others' : 'none';
		// close without liveId means user left live, close all the things
		if ( null == liveId ) {
			self.liveState.user = false;
			self.liveState.description = state;
			self.updateLiveState();
			tellActivity( true );
			close();
			return;
		}
		
		// the user closed the live session in a client 
		// to start it in a different client
		
		// live session switched to this client, liveState will be set in handleLiveOpen
		if ( self.live && self.live.clientId !== liveId )
			return;
		
		state = 'user';
		if ( state === self.liveState.description )
			return;
		
		self.liveState.description = state;
		self.updateLiveState();
		close();
		
		/*
		// we're closing live in this client, but user is still live somewhere else
		if ( liveId === self.live.clientId ) {
			
			return;
		}
		
		return;
		*/
		//
		
		function close() {
			if ( !self.live )
				return;
			
			const live = self.live;
			delete self.live;
			live.close();
		}
		
		function tellActivity( isClose ) {
			const opts = {
				'live-state' : self.liveState,
			};
			self.activity.live(
				self.roomType,
				self.clientId,
				self.priority,
				'i18n_you_left_the_call',
				Date.now(),
				opts
			);
		}
	}
	
	ns.PresenceContact.prototype.updateLiveState = function() {
		const self = this;
		hello.incommingCall.hideCall( self.clientId );
		if ( self.view )
			self.view.send({
				type : 'live-state',
				data : self.liveState,
			});
		
		if ( null == self.activity )
			return;
		
		const opts = {
			'live-state' : self.liveState,
		};
		self.activity.updateItem( self.clientId, opts );
	}
	
	ns.PresenceContact.prototype.liveToView = function( event ) {
		const self = this;
		if ( self.chatView )
			self.chatView.send({
				type : 'live',
				data : event,
			});
	}
	
	ns.PresenceContact.prototype.postCallNotification = function() {
		const self = this;
		//const incCall = Application.i18n( 'i18n_incoming_call' );
		const callNotie = Application.i18n( 'i18n_join_video_call' );
		//api.Say( incCall );
		const notie = {
			title         : self.identity.name,
			text          : callNotie,
			callback      : nClose,
			clickCallback : nClick,
		};
		
		hello.app.notify( notie );
		
		function nClose() {}
		function nClick() {
			self.startVideo();
		}
	}
	
	ns.PresenceContact.prototype.sendInit = function() {
		const self = this;
		self.send({
			type : 'initialize',
		});
	}
	
	ns.PresenceContact.prototype.handleInitializeContact = function( state ) {
		const self = this;
		self.isOpen = true;
		if ( self.openChatPending || self.openLivePending )
			delete state.relation;
		
		self.handleInitialize( state );
		
		/*
		if ( self.openChatPending )
			self.openChatView();
		
		if ( self.openLivePending ) {
			self.openLivePending = false;
			let perms = self.livePermissions || null;
			delete self.livePermissions;
			self.setupLive( perms );
		}
		*/
	}
	
	ns.PresenceContact.prototype.updateMentions = function() {
		const self = this;
		self.idc.get( self.userId )
			.then( uBack )
			.catch( uErr );
		
		function uErr( err ) {
			console.log( 'updateMentions - failed to get id', self );
		}
		
		function uBack( user ) {
			if ( !user )
				return;
			
			const name = user.name;
			const tests = self.atStringsFromName( name );
			self.mentionList = tests;
			if ( self.parser )
				self.parser.close();
			
			const mentionConf = {
				atStrings : self.mentionList,
				onlyEmit  : true,
			};
			self.parser = new library.component.parse.Parser();
			self.parser.use( 'AtThings', mentionConf, true );
			self.parser.on( 'mention', str => self.handleMention( str ));
			
		}
		
	}
	
	/*
	ns.PresenceContact.prototype.handleMention = function( e ) {
		const self = this;
		hello.playMsgAlert();
	}
	*/
	
	ns.PresenceContact.prototype.openChat = function( notification, preView ) {
		const self = this;
		if ( !self.isOpen ) {
			self.openChatPending = {
				notification : notification,
				view         : preView || null,
			};
			self.open();
		} else {
			const pending = self.openChatPending;
			if ( pending ) {
				delete self.openChatPending;
				self.openChatView(
					pending.notification,
					pending.view
				);
			 }
			 else
				self.openChatView();
		}
	}
	
	ns.PresenceContact.prototype.openChatView = function( notification, preView ) {
		const self = this;
		self.openChatPending = false;
		self.hasNotification = !!notification;
		self.resetCounters();
		
		if ( self.chatView ) {
			self.chatView.show();
			return;
		}
		
		const initData = {
			isPrivate   : self.isPrivate,
			roomName    : self.identity.name,
			persistent  : self.persistent,
			userList    : self.userIds,
			recentList  : self.recentList,
			onlineList  : self.onlineList,
			peers       : self.peers,
			ownerId     : self.ownerId,
			userId      : self.userId,
			contactId   : self.contactId,
			mentionList : self.mentionList,
			atList      : self.atList,
			guestAvatar : self.guestAvatar,
		};
		
		if ( preView ) {
			self.chatView = preView;
			self.chatView.updateState( initData );
		} else
			self.chatView = new library.view.PresenceChat( initData );
		
		self.chatView.on( 'close', onClose );
		self.chatView.on( 'chat', chat );
		self.chatView.on( 'live', goLive );
		self.chatView.on( 'close-back', e => self.handleCloseBack( e ));
		self.chatView.on( 'get-identity', e => self.handleGetId( e ));
		
		self.updateActive();
		
		function onClose( e ) {
			self.closeChat();
		}
		
		function chat( e ) { self.sendChatEvent( e ); }
		function goLive( e ) {
			if ( 'video' === e )
				self.startVideo();
			else
				self.startAudio();
		}
	}
	
	ns.PresenceContact.prototype.setupLive = function( permissions ) {
		const self = this;
		const conf = {
			permissions : permissions,
		};
		
		if ( !self.isOpen ) {
			self.goLivePending = conf;
			self.open();
			return;
		}
		
		self.joinLive( conf );
	}
	
	ns.PresenceContact.prototype.onMessage = function( event ) {
		const self = this;
		self.hasNotification = false;
		let fromSelf = false;
		if ( event.fromId === self.userId )
			fromSelf = true;
		
		self.resolveMessageName( event )
			.then( nameBack )
			.catch( nameBack );
			
		function nameBack( from ) {
			const msg = {
				from    : from,
				message : event.message,
				time    : event.time,
			};
			
			if ( fromSelf )
				self.recentMessage( event.message, from, event.time );
			else
				self.onChatMessage( msg );
			
			if ( fromSelf )
				return;
			
			if ( !self.parser ) {
				console.log( 'PresenceContact.onMessage - no parser yet', event );
				return;
			}
			
			self.parser.work( event.message );
		}
	}
	
	ns.PresenceContact.prototype.resolveMessageName = async function( msg ) {
		const self = this;
		if ( msg.fromId === self.userId )
			return 'You';
		else
			return '';
	}
	
	ns.PresenceContact.prototype.setLastMessage = function( event ) {
		const self = this;
		if ( !event || !event.data )
			return;
		
		
		const msg = event.data;
		const from = msg.fromId === self.contactId ? self.identity.name : null;
		self.lastMessage = {
			type : event.type,
			data : {
				from    : from,
				time    : msg.time,
				message : msg.message,
			},
		};
	}
	
	ns.PresenceContact.prototype.startChat = function() {
		const self = this;
		self.openChat();
	}
	
})( library.contact );


//
// SUBSCRIBER
(function( ns, undefined ) {
	ns.Subscriber = function( conf ) {
		if ( !( this instanceof ns.Subscriber ))
			return new ns.Subscriber( conf );
		
		const self = this;
		self.data = conf.subscriber;
		self.subscribe = conf.subscribe;
		
		library.contact.Contact.call( self, conf );
		self.init();
	}
	
	ns.Subscriber.prototype = Object.create( library.contact.Contact.prototype );
	
	ns.Subscriber.prototype.init = function() {
		const self = this;
		self.bindView();
	}
	
	ns.Subscriber.prototype.setIdentity = function() {
		const self = this;
		self.identity = {
			clientId : self.clientId,
			name : self.displayName,
			avatar : null,
		};
	}
	
	ns.Subscriber.prototype.bindView = function() {
		const self = this;
		self.view.on( 'allow', allow );
		self.view.on( 'deny', deny );
		self.view.on( 'cancel', cancel );
		
		function allow( msg ) { self.allow(); }
		function deny( msg ) { self.deny(); }
		function cancel( msg ) { self.cancel(); }
	}
	
	ns.Subscriber.prototype.allow = function() {
		const self = this;
		self.subscribe({
			type : 'allow',
			data : self.clientId,
		});
	}
	
	ns.Subscriber.prototype.deny = function() {
		const self = this;
		self.subscribe({
			type : 'deny',
			data : self.clientId,
		});
	}
	
	ns.Subscriber.prototype.cancel = function() {
		const self = this;
		self.subscribe({
			type : 'cancel',
			data : self.clientId,
		});
	}
	
	ns.Subscriber.prototype.close = function() {
		const self = this;
		delete self.subscribe;
		self.contactClose();
	}
	
})( library.contact );


// TREEROOT CONTACT
(function( ns, undefined ) {
	ns.TreerootContact = function( conf ) {
		if ( !( this instanceof ns.TreerootContact ))
			return new ns.TreerootContact( conf );
		
		const self = this;
		self.type = 'treeroot';
		self.data = conf.contact;
		
		ns.Contact.call( self, conf );
		
		self.roomType = 'contact';
		self.encryptMessages = conf.msgCrypto;
		self.publicKey = conf.contact.publicKey;
		self.encrypt = conf.encrypt;
		self.decrypt = conf.decrypt;
		
		self.init();
	}
	
	ns.TreerootContact.prototype = Object.create( ns.Contact.prototype );
	
	// Public
	
	ns.TreerootContact.prototype.removeRelation = function() {
		const self = this;
		self.conn.send({
			type : 'subscription',
			data : {
				type : 'unsubscribe',
				data : self.clientId,
			},
		});
	}
	
	ns.TreerootContact.prototype.startChat = function() {
		const self = this;
		self.openChat( ready );
		function ready() {
			self.getChatLog();
			self.messageWaiting( false );
			self.mentionWaiting( false );
		}
	}
	
	ns.TreerootContact.prototype.checkMsgBeepSetting = function() {
		const self = this;
		if ( !!hello.account.settings.privateAlert )
			return true;
		else
			return false;
	}
	
	ns.TreerootContact.prototype.updateLastMessage = function( lastMessage ) {
		const self = this;
		if ( !self.lastMessage ) {
			self.preprocessMessage( lastMessage.data );
			return;
		}
		
		let update = lastMessage.data;
		let current = self.lastMessage.data;
		if ( update.msgId === current.msgId )
			return;
		
		self.preprocessMessage( lastMessage.data );
	}
	
	// Private
	
	ns.TreerootContact.prototype.init = function() {
		const self = this;
		self.parseLastMessage();
		self.bindView();
		self.setupDormant();
		self.conn.release( 'message' );
		self.conn.release( 'log' ); // remove base contact event handler
		
		self.conn.on( 'message', preMessage );
		self.conn.on( 'log', preLog );
		self.conn.on( 'chatencrypt', addChatEncrypt );
		self.conn.on( 'publickey', updatePublicKey );
		
		if ( self.data.enc ) {
			self.addChatEncrypt( self.data.enc );
		}
		
		function preMessage( e ) { self.preprocessMessage( e ); }
		function preLog( e ) { self.preprocessLog( e ); }
		function addChatEncrypt( e ) { self.addChatEncrypt( e ); }
		function updatePublicKey( e ) { self.updatePublicKey( e ); }
	}
	
	ns.TreerootContact.prototype.parseLastMessage = function() {
		const self = this;
		if ( !self.lastMessage )
			return;
		
		let msg = self.lastMessage.data;
		if ( !msg )
			return;
		
		if ( msg.dec )
			msg = self.decryptMessage( msg );
		
		const intercept = self.checkIntercept( msg.message );
		if ( !intercept )
			return;
		
		const notie = self.getInterceptNotification( msg, intercept );
		self.lastMessage.data.message = notie.message;
	}
	
	ns.TreerootContact.prototype.setIdentity = function() {
		const self = this;
		self.identity = {
			clientId  : self.clientId,
			name      : self.displayName,
			username  : self.data.Username,
			email     : self.data.email,
			serviceId : self.data.ID,
			avatar    : null,
		};
		self.setAvatar();
	}
	
	ns.TreerootContact.prototype.setAvatar = function() {
		const self = this;
		self.identity.avatar = self.data.imagePath;
	}
	
	ns.TreerootContact.prototype.setupDormant = function() {
		const self = this;
		if ( !self.dormantParentPath )
			return;
		
		let path = [
			self.identity.username,
			self.identity.serviceId,
		];
		path = path.join( '_' );
		
		self.door = new api.DoorDir({
			title : path,
			path  : path + '/',
		}, self.dormantParentPath );
		
		const getId = new api.DoorFun({
			title   : 'GetIdentity',
			execute : getIdentity,
		}, self.door.fullPath );
		
		const sendMsg = new api.DoorFun({
			title   : 'SendMessage',
			execute : sendMessage,
		}, self.door.fullPath );
		
		const invite = new api.DoorFun({
			title  : 'InviteToLive',
			execute : inviteToLive,
		}, self.door.fullPath );
		
		hello.dormant.addDir( self.door );
		hello.dormant.addFun( getId );
		hello.dormant.addFun( sendMsg );
		hello.dormant.addFun( invite );
		
		function getIdentity() {
			return self.identity;
		}
		
		function sendMessage( msg ) {
			if ( !msg )
				return true;
			
			if ( msg.join )
				msg = msg.join( ' ' );
			
			self.sendChatMessage( msg );
			return true;
		}
		
		function inviteToLive( args ) {
			args = args || [];
			let mode = args[ 0 ];
			mode = mode || 'video';
			self.handleStartLive({
				mode : mode,
			});
		}
	}
	
	ns.TreerootContact.prototype.bindView = function() {
		const self = this;
		
		// buttons
		self.view.on( 'open-chat', startChat );
		self.view.on( 'invite-video', startVideo );
		self.view.on( 'invite-audio', startAudio );
		// option menu
		self.view.on( 'option', option );
		self.view.on( 'remove-relation', remove );
		
		function startChat( msg ) { self.startChat( msg ); }
		function startVideo( e ) { self.startVideo( e ); }
		function startAudio( e ) { self.startAudio( e ); }
		function option( msg ) { console.log( 'contact.option - NYI', msg ); }
		function remove( msg ) { self.removeRelation( msg ); }
	}
	
	ns.TreerootContact.prototype.updatePublicKey = function( pKey ) {
		const self = this;
		self.publicKey = pKey;
	}
	
	ns.TreerootContact.prototype.addChatEncrypt = function( data ) {
		const self = this;
		var crypter = self.decryptMsgKey( data.key, data.id );
		if ( !crypter )
			return;
		
		const bundle = {
			crypter : crypter,
		};
		self.setCrypto( bundle, data.id );
	}
	
	ns.TreerootContact.prototype.setupChatEncrypt = function() {
		const self = this;
		var seed = Math.random().toString().split( '.' )[ 1 ];
		var cryptoId = window.SHA256( friendUP.tool.uid());
		const crypter = new library.component.FCrypto({ seed : seed });
		const keys = self.getCryptoKeys( crypter );
		const bundle = {
			crypter : crypter,
			keys    : keys,
		};
		self.chatCrypto = bundle;
		self.chatCryptoId = cryptoId;
		return bundle;
	}
	
	ns.TreerootContact.prototype.decryptMsgKey = function( encKey ) {
		const self = this;
		var res = self.decrypt( encKey );
		if ( !res.success ) {
			console.log( 'decrypting chat key derped', { key : encKey, res : res });
			return null;
		}
		
		if ( !res.plaintext || !res.plaintext.length ) {
			console.log( 'decrypted chatKey plaintext missing' );
			return null;
		}
		
		const privKey = res.plaintext.split( '<!--split-->' )[ 0 ];
		const conf = {
			privateKey : privKey,
		};
		const crypter = new library.component.FCrypto( conf );
		if ( !crypter )
			return null;
		
		return crypter;
	}
	
	ns.TreerootContact.prototype.setCrypter = function( crypter, id ) {
		const self = this;
		if ( !crypter || !id ) {
			console.log( 'setCrypter - missing inputs', {
				self    : self,
				crypter : crypter,
				id      : id,
			});
			throw new Error( 'see log ^^^' );
		}
		
		const bundle = {
			crypter : crypter,
		};
		self.chatCrypto = bundle;
		self.chatCryptoId = id;
		return bundle;
	}
	
	ns.TreerootContact.prototype.setCrypto = function( bundle, id ) {
		const self = this;
		self.chatCrypto = bundle;
		if ( id )
			self.chatCryptoId = id;
		else
			self.chatCryptoId = null;
	}
	
	ns.TreerootContact.prototype.getCrypto = function( id ) {
		const self = this;
		if ( !id )
			return self.chatCrypto || null;
		
		if ( self.chatCryptoId !== id )
			return null
		else
			return self.chatCrypto || null;
	}
	
	ns.TreerootContact.prototype.getCryptoKeys = function( crypter ) {
		const self = this;
		const keys = crypter.getKeys();
		const chatKey = keys.priv;
		const sender = self.encrypt( chatKey );
		const receiver = window.fcrypt.encryptString( chatKey, self.publicKey );
		const chatKeys = {
			sender   : sender.cipher,
			receiver : receiver.cipher,
		};
		return chatKeys;
	}
	
	ns.TreerootContact.prototype.preprocessMessage = function( msg ) {
		const self = this;
		if ( msg.dec )
			msg = self.decryptMessage( msg );
		
		self.lastMessage = {
			type : 'message',
			data : msg,
		};
		
		self.doMessageIntercept( msg );
	}
	
	ns.TreerootContact.prototype.preprocessLog = function( msg ) {
		const self = this;
		if ( !msg ) {
			self.handleLog( null );
			return;
		}
		
		if ( ( 'message' === msg.type ) && ( msg.data.dec ) )
			msg.data = self.decryptMessage( msg.data );
		
		self.handleLog( msg );
	}
	
	ns.TreerootContact.prototype.decryptMessage = function( msg ) {
		const self = this;
		var crypter = null;
		var msgCrypter = null;
		msg.cipherText = msg.message;
		const bundle = self.getCrypto( msg.dec.id );
		if ( bundle && bundle.crypter )
			crypter = bundle.crypter;
		else
			msgCrypter = self.decryptMsgKey( msg.dec.key, msg.dec.id );
		
		if ( !crypter && !msgCrypter ) {
			console.log( 'decryptMessage - could not decrypt chat key', {
				self : self,
				msg  : msg,
			});
			msg.message = '[ error : could not decrypt key ]';
			return msg;
		}
		
		if ( crypter )
			var de = crypter.de( msg.message );
		
		if ( !de || !de.success ) {
			msgCrypter = self.decryptMsgKey( msg.dec.key, msg.dec.id );
			de = msgCrypter.de( msg.message );
		}
		
		if ( !de || !de.success ) {
			console.log( 'decryptMessage - could not decrypt message', {
				msg : msg,
				self : self,
			});
			msg.message = '[ error : could not decrypt message ]';
			return msg;
		}
		
		if ( msgCrypter )
			self.setCrypter( msgCrypter, msg.dec.id );
		
		msg.message = de.plaintext;
		msg.cipherText = de.cipherText;
		msg.encrypted = true;
		return msg;
	}
	
	ns.TreerootContact.prototype.getChatLog = function() {
		const self = this;
		var fetchLog = {
			type : 'log',
		}
		self.send( fetchLog );
	}
	
	ns.TreerootContact.prototype.openChat = function( readyCallback ) {
		const self = this;
		var module = hello.module.get( self.moduleId );
		if ( self.chatView )
			self.chatView.close();
		
		var chatConf = {
			onready   : readyCallback,
			onmessage : onMessage,
			onlive    : startLive,
			onencrypt : toggleEncrypt,
			onclose   : onClose,
			state     : {
				contact          : self.identity,
				user             : module.identity,
				encryptIsDefault : true,
				canEncrypt       : true,
				doEncrypt        : !!self.encryptMessages,
				multilineCap     : true,
			},
		};
		self.chatView = new library.view.IMChat( 'treeroot', chatConf );
		function onMessage( e ) { self.sendChatMessage( e ); }
		function startLive( e ) { self.handleStartLive( e ); }
		function toggleEncrypt( e ) { self.toggleEncrypt(); }
		function onClose( e ) { self.chatView = null; }
	}
	
	ns.TreerootContact.prototype.toggleEncrypt = function( force ) {
		const self = this;
		if ( 'undefined' !== typeof( force ))
			var toggle = !!force;
		else
			var toggle = !self.encryptMessages;
		
		self.encryptMessages = toggle;
		if ( self.chatView )
			self.chatView.toggleEncrypt( toggle );
	}
	
	ns.TreerootContact.prototype.sendChatMessage = function( msg ) {
		const self = this;
		if ( !self.encryptMessages ) {
			self.sendMessage( msg );
			return;
		}
		
		self.encryptMessage( msg );
	}
	
	ns.TreerootContact.prototype.encryptMessage = function( str ) {
		const self = this;
		var bundle = self.getCrypto();
		if ( !bundle || !bundle.crypter )
			bundle = self.setupChatEncrypt();
		
		if ( !bundle.keys )
			bundle.keys = self.getCryptoKeys( bundle.crypter );
		
		const crypter = bundle.crypter;
		var en = crypter.en( str );
		if ( !en.success ) {
			fail( 'Failed to encrypt, message not sent' );
			return;
		}
		
		str = en.cipher;
		var msg = {
			message : str,
			encId   : self.chatCryptoId,
			encKeys : bundle.keys,
		};
		
		self.sendCryptoMessage( msg );
		
		function fail( message ) {
			var failMsg = {
				type : 'cryptofail',
				data : {
					message : message,
				},
			};
			self.toChat( failMsg );
		}
	}
	
	ns.TreerootContact.prototype.close = function() {
		const self = this;
		if ( self.chatView )
			self.chatView.close();
		
		if ( self.door )
			self.door.close();
		
		self.contactClose();
	}
	
})( library.contact );


// IRC CHANNEL
(function( ns, undefined ) {
	ns.IrcChannel = function( conf ) {
		if ( !( this instanceof ns.IrcChannel ))
			return new ns.IrcChannel( conf );
		
		const self = this;
		self.type = 'irc';
		self.data = conf.channel;
		self.viewTheme = conf.viewTheme;
		self.user = conf.user;
		self.requests = {};
		
		ns.Contact.call( this, conf );
		
		self.roomType = 'room';
		self.chatView = null;
		
		self.init();
	}
	
	ns.IrcChannel.prototype = Object.create( ns.Contact.prototype );
	
	// Public
	
	ns.IrcChannel.prototype.close = function() {
		const self = this;
		self.closeChannel();
		self.contactClose();
	}
	
	// Private
	
	ns.IrcChannel.prototype.sendRequest = function( req, callback ) {
		const self = this;
		reqId = friendUP.tool.uid( 'req' );
		self.requests[ reqId ] = callback;
		self.send({
			type : 'request',
			data : {
				type : reqId,
				data : req,
			},
		});
	}
	
	ns.IrcChannel.prototype.handleRequest = function( event ) {
		const self = this;
		const reqId = event.type;
		const reqCallback = self.requests[ reqId ];
		if ( !reqCallback ) {
			console.log( 'handleREquest - no callback for', {
				event : event,
				reqs  : self.requests,
			});
			return;
		}
		
		delete self.requests[ reqId ];
		let res  = event.data;
		reqCallback( res.err, res.res );
	}
	
	ns.IrcChannel.prototype.init = function() {
		const self = this;
		delete self.interceptMap[ 'live-invite' ];
		
		if ( self.data.users )
			self.setState( self.data );
		
		self.setupDormant();
		self.bindServerEvents();
		self.bindView();
		self.setSettingsMaps();
	}
	
	ns.IrcChannel.prototype.setIdentity = function() {
		const self = this;
		self.room = {
			name     : self.data.displayName,
			clientId : self.data.clientId,
		};
	}
	
	ns.IrcChannel.prototype.setupDormant = function() {
		const self = this;
		if ( !self.dormantParentPath )
			return;
		
		let mid = self.clientId.split( '-' )[ 1 ];
		path = self.room.name;
		self.door = new api.DoorDir({
			title : path,
			path  : path + '/',
		}, self.dormantParentPath );
		
		const sendMsg = new api.DoorFun({
			title   : 'SendMessage',
			execute : sendMessage,
		}, self.door.fullPath );
		
		const userlist = new api.DoorFun({
			title   : 'GetUserlist',
			execute : getUserlist,
		}, self.door.fullPath );
		
		hello.dormant.addDir( self.door );
		hello.dormant.addFun( sendMsg );
		hello.dormant.addFun( userlist );
		
		function sendMessage( msg ) {
			if ( !msg )
				return true; 
			
			if ( msg.join )
				msg = msg.join( ' ' );
			
			self.sendMessage( msg );
			return true;
		}
		
		function getUserlist( args, callback ) {
			self.sendRequest({
				type : 'userlist',
				
			}, listBack );
			
			function listBack( err, res ) {
				callback( err, res );
			}
		}
	}
	
	ns.IrcChannel.prototype.bindServerEvents = function() {
		const self = this;
		self.conn.on( 'action', handleAction );
		self.conn.on( 'join', userJoin );
		self.conn.on( 'mode', modeChange );
		self.conn.on( 'usermode', userModeChange );
		self.conn.on( 'nick', nickChange );
		self.conn.on( 'userlist', userList );
		self.conn.on( 'part', userPart );
		self.conn.on( 'quit', userQuit );
		self.conn.on( 'kick', kick );
		self.conn.on( 'ban', ban );
		//self.conn.on( 'log', logMsg );
		self.conn.on( 'topic', updateTopic );
		self.conn.on( 'setting', setting );
		self.conn.on( 'state', handleState );
		self.conn.on( 'user', updateUser );
		self.conn.on( 'request', requestResult );
		
		function handleMessage(  e ) { self.handleMessage( e ); }
		function handleAction(   e ) { self.handleAction( e ); }
		function modeChange(     e ) { self.modeChange( e ); }
		function userModeChange( e ) { self.userModeChange( e ); }
		function userList(       e ) { self.userList( e ); }
		function updateTopic(    e ) { self.updateTopic( e ); }
		function userJoin(       e ) { self.userJoin( e ); }
		function userPart(       e ) { self.userPart( e ); }
		function userQuit(       e ) { self.userQuit( e ); }
		function kick(           e ) { self.userKicked( e ); }
		function ban(            e ) { self.userBanned( e ); }
		function nickChange(     e ) { self.nickChange( e ); }
		function setting(        e ) { self.updateSetting( e ); }
		function handleState(    e ) { self.showChannel( e ); }
		function updateUser(     e ) { self.updateUser( e ); }
		function requestResult(  e ) { self.handleRequest( e ); }
	}
	
	ns.IrcChannel.prototype.onChatMessage = function( msg ) {
		const self = this;
		if ( !self.chatView ) {
			self.messageWaiting( true, msg.message, msg.from );
			return;
		}
		
		//self.chatMessage( msg );
	}
	
	ns.IrcChannel.prototype.handleAction = function( msg ) {
		const self = this;
		if ( !self.chatView ) {
			self.messageWaiting( true, msg.message, msg.from );
			return;
		}
		
		self.toChat({
			type : 'action',
			data : msg,
		});
	}
	
	ns.IrcChannel.prototype.setState = function( state ) {
		const self = this;
		self.topic = state.topic;
		self.mode = state.mode;
		state.users.forEach( add );
		function add( user ) { self.userJoin( user ); }
	}
	
	ns.IrcChannel.prototype.modeChange = function( data ) {
		const self = this;
		self.mode = data.mode;
		self.toChat({
			type : 'mode',
			data : self.mode,
		});
	}
	
	ns.IrcChannel.prototype.userModeChange = function( data ) {
		const self = this;
		self.toChat({
			type : 'usermode',
			data : data,
		});
	}
	
	ns.IrcChannel.prototype.userList = function( data ) {
		const self = this;
		self.toChat({
			type : 'participants',
			data : data,
		});
	}
	
	ns.IrcChannel.prototype.userJoin = function( user ) {
		const self = this;
		self.toChat({
			type : 'join',
			data : user,
		});
	}
	
	ns.IrcChannel.prototype.userPart = function( data ) {
		const self = this;
		self.toChat({
			type : 'part',
			data : data,
		});
	}
	
	ns.IrcChannel.prototype.userQuit = function( data ) {
		const self = this;
		self.toChat({
			type : 'quit',
			data : data,
		});
	}
	
	ns.IrcChannel.prototype.userKicked = function( data ) {
		const self = this;
		self.toChat({
			type : 'kick',
			data : data,
		});
	}
	
	ns.IrcChannel.prototype.userBanned = function( data ) {
		const self = this;
		self.toChat({
			type : 'ban',
			data : data,
		});
	}
	
	ns.IrcChannel.prototype.nickChange = function( update ) {
		const self = this;
		var nickUpdate = {
			type : 'nick',
			data : update,
		};
		
		self.toChat( nickUpdate );
	}
	
	ns.IrcChannel.prototype.updateUser = function( update ) {
		const self = this;
		self.user = update;
		var idUpdate = {
			type : 'user',
			data : update,
		};
		self.toChat( idUpdate );
	}
	
	ns.IrcChannel.prototype.updateTopic = function( msg ) {
		const self = this;
		var wrap = {
			type : 'topic',
			data : msg,
		};
		self.toView( wrap );
		self.toChat( wrap );
	}
	
	ns.IrcChannel.prototype.bindView = function() {
		const self = this;
		self.view.on( 'open-chat', toggleChannelView );
		self.view.on( 'leave-room', leave );
		self.view.on( 'topic', changeTopic );
		self.view.on( 'mode', changeMode );
		
		function toggleChannelView( msg ) {
			if ( self.chatView )
				self.closeChannel();
			else
				self.getChannelState();
		}
		
		function leave( msg ) { self.leave( msg ); }
		function changeTopic( msg ) { self.changeTopic( msg ); }
		function changeMode( msg ) { self.changeMode( msg ); }
	}
	
	ns.IrcChannel.prototype.leave = function( msg ) {
		const self = this;
		self.send({
			type : 'leave',
		});
	}
	
	ns.IrcChannel.prototype.changeTopic = function( msg ) {
		const self = this;
		console.log( 'channel.changeTopic - NYI', msg );
	}
	
	ns.IrcChannel.prototype.changeMode = function( msg ) {
		const self = this;
		console.log( 'channel.changeMode - NYI', msg );
	}
	
	ns.IrcChannel.prototype.getChannelState = function() {
		const self = this;
		var msg = {
			type : 'state',
		};
		self.send( msg );
	}
	
	ns.IrcChannel.prototype.showChannel = function( state ) {
		const self = this;
		if ( self.chatView )
			self.chatView.close();
		
		if ( !state  ) {
			self.getChannelState();
			return;
		}
		
		state.user = self.user;
		state.participants = state.users;
		delete state.users;
		self.messageWaiting( false );
		self.mentionWaiting( false );
		var conf = {
			viewConf : {
				title     : self.room.name,
				viewTheme : self.viewTheme,
			},
			onmessage   : sendMessage,
			onsettings  : toggleSettings,
			onprivate   : openPrivate,
			onhighlight : onHighlight,
			onclose     : onclose,
			state       : state,
		};
		self.chatView = new library.view.Conference( conf, readyBack );
		
		function sendMessage( e ) { self.sendMessage( e ); }
		function onclose( e ) { self.chatView = null; }
		function toggleSettings( e ) { self.toggleSettings( e ); }
		function openPrivate( e ) { self.openPrivateWindow( e ); }
		function onHighlight( e ) { self.handleHighlight( e ); }
		function readyBack() {
			self.send({ type : 'log' });
		}
		
	}
	
	ns.IrcChannel.prototype.openPrivateWindow = function( participant ) {
		const self = this;
		var module = hello.module.get( self.moduleId );
		module.openPrivate( participant.name );
	}
	
	ns.IrcChannel.prototype.handleHighlight = function() {
		const self = this;
		if ( !hello.account.settings.msgAlert )
			return;
		
		hello.playMsgAlert();
	}
	
	ns.IrcChannel.prototype.toggleSettings = function( msg ) {
		const self = this;
		if ( self.settingsView )
			self.settingsView.close();
		else
			self.showSettings();
	}
	
	ns.IrcChannel.prototype.showSettings = function() {
		const self = this;
		if ( self.settingsView )
			return;
		
		var topic = self.topic.topic || 'no topic';
		var mode = {
			kittiesOnly : true,
			noASL : false,
		};
		var conf = {
			type : 'conference',
			title : self.room.name,
			onsave : saveHandler,
			onclose : closeHandler,
			settings : {
				topic : topic,
				mode : mode,
			},
		};
		
		self.settingsView = new library.view.Settings( conf );
		
		function saveHandler( msg ) { self.updateSetting( msg ); }
		function closeHandler( msg ) { self.settingsView = null; }
	}
	
	ns.IrcChannel.prototype.setSettingsMaps = function() {
		const self = this;
		self.settingSaveMap = {
			topic : setTopic,
			mode : setMode,
		};
		
		function setTopic( msg ) { self.setTopic( msg ); }
		function setMode( msg ) { self.setMode( msg ); }
	}
	
	ns.IrcChannel.prototype.updateSetting = function( data ) {
		const self = this;
		var handler = self.settingSaveMap[ data.setting ];
		if ( !handler ) {
			console.log( 'channel.updateSetting - no handler for', data );
			return;
		}
		
		handler( data.value );
	}
	
	ns.IrcChannel.prototype.setTopic = function( topic ) {
		const self = this;
		var topicMsg = '/topic ' + topic;
		self.sendMessage( topicMsg );
		
		if ( !self.settingsView )
			return;
		
		var update = {
			setting : 'topic',
			value : topic,
			success : true,
		};
		self.settingsView.saved( update );
	}
	
	ns.IrcChannel.prototype.setMode = function( mode ) {
		const self = this;
		if ( !self.settingsView )
			return;
		
		var update = {
			setting : 'mode',
			value : {},
			success : false,
		}
		self.settingsView.saved( update );
	}
	
	ns.IrcChannel.prototype.closeChannel = function( msg ) {
		const self = this;
		if ( self.chatView )
			self.chatView.close();
		
		self.chatView = null;
		
		if ( self.door )
			self.door.close();
		
		self.door = null;
	}
	
})( library.contact );

(function( ns, undefined ) {
	ns.IrcPrivMsg = function( conf ) {
		if ( !( this instanceof ns.IrcPrivMsg ))
			return new ns.IrcPrivMsg( conf );
		
		const self = this;
		self.data = conf.contact;
		self.user = conf.user;
		self.viewTheme = conf.viewTheme;
		
		ns.Contact.call( self, conf );
		
		self.roomType = 'contact';
		self.chatView = null;
		
		self.init();
	}
	
	ns.IrcPrivMsg.prototype = Object.create( ns.Contact.prototype );
	
	ns.IrcPrivMsg.prototype.init = function() {
		const self = this;
		self.bindView();
		
		self.conn.on( 'nick', updateIdentity );
		self.conn.on( 'user', updateUser );
		self.conn.on( 'action', handleAction );
		
		function updateIdentity( msg ) { self.updateIdentity( msg ); }
		function updateUser( msg ) { self.updateUser( msg ); }
		function handleAction( msg ) { self.handleAction( msg ); }
	}
	
	ns.IrcPrivMsg.prototype.setIdentity = function() {
		const self = this;
		self.identity = {
			clientId : self.clientId,
			name : self.data.name,
			avatar : library.component.Identity.prototype.avatarAlt,
		};
	}
	
	ns.IrcPrivMsg.prototype.updateIdentity = function( data ) {
		const self = this;
		if ( self.identity.name !== data.current )
			return;
		
		self.identity.name = data.update;
		var update = {
			type : 'identity',
			data : self.identity,
		};
		self.toView( update );
		
		if ( !self.chatView )
			return;
		
		self.chatView.setTitle( 'Chatting with ' + self.identity.name );
		self.toChat( update );
	}
	
	ns.IrcPrivMsg.prototype.updateUser = function( data ) {
		const self = this;
		self.user.name = data.name;
		var update = {
			type : 'user',
			data : data,
		};
		self.toChat( update );
	}
	
	ns.IrcPrivMsg.prototype.handleAction = function( msg ) {
		const self = this;
		self.onChatMessage( msg );
		self.toChat({
			type : 'action',
			data : msg,
		});
	}
	
	ns.IrcPrivMsg.prototype.bindView = function() {
		const self = this;
		self.view.on( 'open-chat', toggleChat );
		self.view.on( 'invite-video', startVideo );
		self.view.on( 'invite-audio', startAudio );
		self.view.on( 'remove-chat', removePrivate );
		
		function toggleChat( e ) {
			if ( self.chatView )
				self.chatView.close();
			else
				self.startChat();
		}
		
		function startVideo( e ) { self.startVideo(); }
		function startAudio( e ) { self.startAudio(); }
		function removePrivate( e ) { self.remove(); }
	}
	
	ns.IrcPrivMsg.prototype.remove = function() {
		const self = this;
		var module = hello.module.get( self.moduleId );
		module.removePrivate( self.identity.name );
	}
	
	ns.IrcPrivMsg.prototype.startChat = function() {
		const self = this;
		self.messageWaiting( false );
		self.mentionWaiting( false );
		self.openChat( chatReady );
		function chatReady() {
			self.getLog();
		}
	}
	
	ns.IrcPrivMsg.prototype.openChat = function( readyBack ) {
		var self =this;
		if ( self.chatView ) {
			self.chatView.show();
			return;
		}
		
		var conf = {
			onready : readyBack,
			onmessage : onMessage,
			onlive : onLive,
			onclose : onClose,
			onhighlight : onHighlight,
			state : {
				contact : self.identity,
				user : self.user,
			},
			viewConf : {
				viewTheme : self.viewTheme,
			},
		};
		self.chatView = new library.view.IMChat( 'irc', conf );
		
		function onMessage( e ) { self.fromChat( e ); }
		function onLive( e ) { self.handleStartLive( e ); }
		function onClose() { self.chatView = null; }
		function onHighlight( e ) { self.handleHighlight(); }
	}
	
	ns.IrcPrivMsg.prototype.handleHighlight = function() {
		const self = this;
		console.log( 'IrcPrivMsg.handleHighlight - not handling highlight lol' );
	}
	
	ns.IrcPrivMsg.prototype.getLog = function() {
		const self = this;
		var askLog = {
			type : 'log',
		};
		self.send( askLog );
	}
	
	ns.IrcPrivMsg.prototype.fromChat = function( msg ) {
		const self = this;
		self.sendMessage( msg );
	}
	
	ns.IrcPrivMsg.prototype.sendCommand = function( msg ) {
		const self = this;
		module = hello.module.get( self.moduleId );
		module.sendCommand( msg );
	}
	
})( library.contact );
