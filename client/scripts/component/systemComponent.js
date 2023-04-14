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
var hello = window.hello || {};
window.library.component = window.library.component || {};

// EventHandler
(function( ns, undefined ) {
	ns.EventHandler = function( source ) {
		if ( !( this instanceof ns.Event ))
			return new ns.Event( app );
		
		const self = this;
		self.source = source;
		self.subscriber = {};
		
		self.eventInit();
	}
	
	ns.EventHandler.prototype.eventInit = function() {
		const self = this;
		self.source.receiveMessage = receiveEvent;
		
		function receiveEvent( event ) { self.receiveEvent( event ); }
	}
	
	ns.EventHandler.prototype.receiveEvent = function( msg ) {
		const self = this;
		var handler = self.subscriber[ msg.type ];
		
		if ( !handler ) {
			console.log( 'Hello.Event.receiveEvent > no handler for ', msg );
			return;
		}
		
		self.subscriber[ msg.type ]( msg );
	}
	
	ns.EventHandler.prototype.on = function( id, callback ) {
		const self = this;
		if ( self.subscriber[ id ] )
			console.log( 'Event.add > event already exists, overwriting', id );
		
		self.subscriber[ id ] = callback;
	}
	
	ns.EventHandler.prototype.off = function( id ) {
		const self = this;
		if ( self.subscriber[ id ] )
			delete self.subscriber[ id ];
		else
			console.log( 'Event.remove > invalid id', id );
	}
	
})( library.component );


// Status
( function( ns, undefined ) {
	ns.Status = function( initialState ) {
		if ( !( this instanceof ns.Status ))
			return new ns.Status( initialState );
		
		const self = this;
		self.subscriber = {};
		self.state = initialState || 'no-pants';
		self.data = null;
	}
	
	ns.Status.prototype.init = function() {
		const self = this;
	}
	
	ns.Status.prototype.set = function( state, data ) {
		const self = this;
		self.state = state;
		self.data = data;
		var wrap = {
			type : state,
			data : data,
		};
		for ( id in self.subscriber ) {
			self.subscriber[ id ]( wrap );
		}
	}
	
	ns.Status.prototype.get = function( ) {
		const self = this;
		var wrap = {
			type : self.state,
			data  : self.data,
		};
		return Wrap;
	}
	
	ns.Status.prototype.subscribe = function( id, callback ) {
		const self = this;
		if ( self.subscriber[ id ]) {
			console.log( 'OVERWRITING - component.Status.listen - id already exists - OVERWRITING', id );
		}
		
		self.subscriber[ id ] = callback;
		callback( self.state );
	}
	
	ns.Status.prototype.unsubscribe = function( id ) {
		const self = this;
		if ( self.subscriber[ id ])
			delete self.subscriber[ id ];
	}
	
})( library.component );



// AVAILABILITY
(function( ns, undefined ) {
	ns.Availability = function( conf ) {
		if ( !( this instanceof ns.Availability ))
			return new ns.Availability( elementId );
		
		const self = this;
		self.statusMap = conf.statusMap;
		self.containerId = conf.containerId;
		self.availability = null;
		self.optionsContainer = null;
		self.button = null;
		self.statusString = null;
		self.status = null;
		self.subscribers = {};
		
		init();
		
		function init() {
			self.statusMap = self.statusMap.map( addId );
			function addId( option ) {
				option.id = ns.tools.getId( 'availability-' );
				return option;
			}
			self.status = self.statusMap[ 0 ];
			var availabilityHtml = ns.template.get(
				'hello-availability-base-tmpl',
				{
					id : self.status.id,
					statusString : self.status.string
				}
			);
			
			var container = ge( self.containerId );
			container.insertAdjacentHTML( 'beforeend', availabilityHtml );
			self.availability = ge( self.status.id );
			self.button = container.querySelector( '.button' );
			self.button.addEventListener( 'click', self.showOptions.bind( self ), false );
			self.statusString = container.querySelector( '.status-string' );
			
			self.optionsContainer = container.querySelector( '.availability-options' );
			self.statusMap.forEach( buildOptionHtml );
			function buildOptionHtml( option ) {
				var imagePath = ns.config.imagePath + option.image;
				var html = ns.template.get(
					'hello-availability-option-tmpl',
					{
						id : option.id,
						statusString : option.string,
						imagePath : imagePath
					}
				);
				self.optionsContainer.insertAdjacentHTML( 'beforeend', html );
				var thisOption = ge( option.id + '-option' );
				thisOption.addEventListener( 'click', changeStatus, false );
				function changeStatus( e ) {
					e.preventDefault();
					e.stopPropagation();
					self.set( option );
				}
			}
		}
	}
	
	ns.Availability.prototype.showOptions = function( e ) {
		if ( e ) {
			e.preventDefault();
			e.stopPropagation();
		}
		
		const self = this;
		self.button.blur();
		self.optionsContainer.classList.add( 'show' );
		ns.app._window.addEventListener( 'click', hideOptions, false );
		function hideOptions( e ) {
			e.preventDefault();
			e.stopPropagation();
			self.optionsContainer.classList.remove( 'show' );
			//ns.app._window.removeEventListener( 'click', arguments.callee );
		}
	}
	
	ns.Availability.prototype.set = function( option ) {
		const self = this;
		
		self.status = option;
		self.availability.id = option.id;
		self.statusString.innerHTML = self.status.string;
		self.optionsContainer.classList.remove( 'show' );
		
		var subKeys = Object.keys( self.subscribers );
		subKeys.forEach( emitStatus );
		function emitStatus( subKey ) {
			self.subscribers[ subKey ]( option );
		}
	}
	
	ns.Availability.prototype.get = function() {
		return this.status;
	}
	
	ns.Availability.prototype.on = function( id, fn ) {
		const self = this;
		self.subscribers[ id ] = fn;
	}
	
	ns.Availability.prototype.off = function( id ) {
		const self = this;
		if( self.subscribers[ id ])
			delete self.subscribers[ id ];
	}
})( library.component );


// INFO ( overlay )

(function( ns, undefined ) {
	ns.Info = function( parentId ) {
		if ( !( this instanceof ns.Info ))
			return new ns.Info( parentId );
		
		const self = this;
		self.parentId = parentId;
		
		self.setup();
	}
	
	ns.Info.prototype.setSuccess = function( str ) {
		const self = this;
		self.setText( str );
		self.border.classList.remove( 'fail' );
		self.border.classList.add( 'success' );
		self.show();
	}
	
	ns.Info.prototype.setFail = function( str ) {
		const self = this;
		self.setText( str );
		self.border.classList.remove( 'success' );
		self.border.classList.add( 'fail' );
		self.show();
	}
	
	ns.Info.prototype.hide = function( str ) {
		const self = this;
		self.screen.classList.add( 'hidden' );
	}
	
	ns.Info.prototype.show = function() {
		const self = this;
		self.screen.classList.remove( 'hidden' );
	}
	
	ns.Info.prototype.setText = function( str ) {
		const self = this;
		self.text.textContent = str;
	}
	
	ns.Info.prototype.setup = function() {
		const self = this;
		var html = ns.template.get( 'hello-infoscreen-tmpl' );
		var container = document.getElementById( self.parentId );
		container.insertAdjacentHTML( 'beforeend', html );
		self.screen = document.getElementById( 'hello-infoscreen' );
		self.text = self.screen.querySelector( '.content' );
		self.border = self.screen.querySelector( '.contentContainer' );
	}
	
})( library.component );

(function( ns, undefined ) {
	ns.Droppings = function( conf ) {
		if ( !( this instanceof ns.Droppings ))
			return new ns.Droppings( conf );
		
		const self = this;
		self.roomId = conf.roomId;
		self.toView = conf.toView;
		self.toChat = conf.toChat;
		
		self.init();
	}
	
	// Public
	
	ns.Droppings.prototype.handle = function( items ) {
		const self = this;
		items.forEach( jajajaja );
		function jajajaja( item ) {
			var handler = self.typeMap[ item.type || item.Type ];
			if ( !handler ) {
				console.log( 'Droppings.handle - no handler for', item );
				return;
			}
			
			handler( item );
		}
	}
	
	// Private
	
	ns.Droppings.prototype.init = function() {
		const self = this;
		self.typeMap = {
			'File'          : handleFile,
			'CalendarEvent' : handleCalendar,
			'Executable'    : handleExec,
		};
		
		function handleFile( e ) { self.handleFile( e ); }
		function handleCalendar( e ) { self.handleCalendar( e ); }
		function handleExec( e ) { self.handleExecutable( e ); }
	}
	
	ns.Droppings.prototype.handleFile = async function( item ) {
		const self = this;
		const file = new api.File( item.path || item.Path );
		let link = null;
		try {
			link = await file.expose( self.roomId );
		} catch( ex ) {
			console.log( 'Dropping.handlefile expose ex', ex );
			return;
		}
		
		const success = !!link;
		const msg = {
			type : 'link',
			data : {
				success  : success,
				'public' : link,
			},
		};
		self.toView( msg );
		if ( success )
			self.toChat( link );
	}
	
	ns.Droppings.prototype.handleCalendar = function( item ) {
		const self = this;
		var event = {
			type : 'calendar-event',
			data : item,
		};
		var res = hello.intercept.buildJSON( event );
		self.toChat( res.intercept );
	}
	
	ns.Droppings.prototype.handleExecutable = function( item ) {
		const self = this;
		const app = {
			type : 'nested-app',
			data : item,
		};
		self.toView( app );
	}
	
	ns.Droppings.prototype.close = function() {
		const self = this;
		delete self.toView;
		delete self.send;
	}
	
})( library.component );

// PresenceService
(function( ns, undefined ) {
	ns.PresenceService = function( presence ) {
		const self = this;
		self.presence = presence;
		self.dormantEvents = {};
		/*
		self.oninvite = conf.oninvite;
		self.onidentity = conf.onidentity;
		*/
		
		library.component.EventEmitter.call( self );
		
		self.init();
	}
	
	ns.PresenceService.prototype = Object.create(
		library.component.EventEmitter.prototype );
	
	// Public
	
	ns.PresenceService.prototype.getHost = function() {
		const self = this;
		if ( !self.presence )
			return;
		
		return self.presence.getHost();
	}
	
	ns.PresenceService.prototype.getRoomInfo = function( roomId ) {
		const self = this;
		if ( !self.presence )
			return;
		
		return self.presence.serviceGetRoomInfo( roomId );
	}
	
	ns.PresenceService.prototype.getRoom = function( action, conf ) {
		const self = this;
		if ( !self.presence )
			return;
		
		self.presence.serviceGetRoom( action, conf );
	}
	
	ns.PresenceService.prototype.getIdentity = function() {
		const self = this;
		if ( !self.presence )
			return;
		
		return self.presence.identity;
	}
	
	ns.PresenceService.prototype.invite = function( conf, roomId ) {
		const self = this;
		if ( !self.presence )
			return;
		
		self.presence.serviceLiveInvite( conf, roomId );
	}
	
	ns.PresenceService.prototype.setAccountSetting = async function( key, value ) {
		const self = this;
		return await self.presence.setAccountSetting( key, value );
	}
	
	ns.PresenceService.prototype.setIsLive = function( isLive ) {
		const self = this;
		self.presence.setIsLive( isLive );
	}
	
	ns.PresenceService.prototype.sendMsgToFID = function( uId, message, open ) {
		const self = this;
		if ( '--open' === open )
			open = true;
		else
			open = false;
		
		return new Promise(( resolve, reject ) => {
			if ( !self.presence ) {
				reject( 'ERR_SERVICE_NOT_AVAILABLE' );
				return;
			}
			
			self.presence.getFriendContact( uId )
				.then( idBack )
				.catch( idFail );
			
			function idBack( identity ) {
				//console.log( 'PresenceService.sendMsgToFID - idBack', identity );
				//self.sendMessage
				if ( !identity )
					resolve( false );
				
				self.presence.sendMessage( identity.clientId, message, open )
					.then( sendOk )
					.catch( reject );
				//resolve( identity );
				
				function sendOk( res ) {
					//console.log( 'PresenceService.prototype.sendMsgToFID - sendOk', res );
					resolve( true );
				}
			}
			
			function idFail( err ) {
				console.log( 'PresenceService.sendMsgToFID - idFail', err );
				reject( err );
			}
		});
	}
	
	ns.PresenceService.prototype.handleNotification = function( extra, view ) {
		const self = this;
		const roomId = extra.roomId;
		const msgId = extra.msgId;
		if ( !roomId ) {
			console.log( 'PresenceService.handleNotification - missing room id', extra );
			return;
		}
		
		const conf = {
			id : roomId,
		};
		
		self.presence.openChat(
			conf,
			true,
			view
		);
	}
	
	ns.PresenceService.prototype.send = function( event ) {
		const self = this;
		if ( !self.presence )
			return;
		
		self.presence.handleServiceEvent( event );
	}
	
	ns.PresenceService.prototype.emitEvent = function( event, data ) {
		const self = this;
		const dormantHandler = self.dormantEvents[ event ];
		if ( null == dormantHandler ) {
			console.log( 'PresenceService.emitEvent - no handler for', [ event, data ]);
			return;
		}
		
		dormantHandler.emit( data );
	}
	
	ns.PresenceService.prototype.close = function() {
		const self = this;
		delete self.service;
		self.closeEventEmitter();
	}
	
	// Private
	
	ns.PresenceService.prototype.init = function() {
		const self = this;
		self.setupDormant();
	}
	
	ns.PresenceService.prototype.setupDormant = function() {
		const self = this;
		if ( !hello.dormant || !hello.dormant.allowWrite )
			return;
		
		const msgToFID = new api.DoorFun({
			title   : 'SendMessageToFriendID',
			execute : sendMsgToFID,
		}, 'Functions/' );
		
		const listRooms = new api.DoorFun({
			title   : 'ListRooms',
			execute : listRoomsFun,
		}, 'Functions/' );
		
		const openRoom = new api.DoorFun({
			title   : 'OpenRoom',
			execute : openRoomFun,
		}, 'Functions/' );
		
		const createRoom = new api.DoorFun({
			title   : 'CreateRoom',
			execute : createRoomFun,
		}, 'Functions/' )
		
		const leaveRoom = new api.DoorFun({
			title   : 'LeaveRoom',
			execute : leaveRoomFun,
		}, 'Functions/' )
		
		const openLive = new api.DoorFun({
			title   : 'OpenLive',
			execute : openLiveFun,
		}, 'Functions/' )
		
		const closeLive = new api.DoorFun({
			title   : 'CloseLive',
			execute : closeLiveFun,
		}, 'Functions/' )
		
		const addUserToRoom = new api.DoorFun({
			title   : 'AddUsersToRoom',
			execute : addUsersToRoomFun,
		}, 'Functions/' )
		
		const openSettings = new api.DoorFun({
			title   : 'OpenSettings',
			execute : openSettingsFun,
		}, 'Functions/' )
		
		const openRoomSettings = new api.DoorFun({
			title   : 'OpenRoomSettings',
			execute : openRoomSettingsFun,
		}, 'Functions/' )
		
		/*
		const addUserToRoom = new api.DoorFun({
			title   : 'AddUserToRoom',
			execute : addUserToRoomFun,
		}, 'Functions/' );
		*/
		
		const roomAdd = new api.DoorEvent({
			title : 'RoomAdd',
		}, 'Events/' );
		
		const roomRemove = new api.DoorEvent({
			title : 'RoomRemove',
		}, 'Events/' );
		
		const roomUpdate = new api.DoorEvent({
			title : 'RoomUpdate',
		}, 'Events/' );
		
		const roomInviteClose = new api.DoorEvent({
			title : 'RoomInviteClose',
		}, 'Events/' );
		
		const getIdentity = new api.DoorFun({
			title   : 'GetIdentity',
			execute : getIdentityFun,
		}, 'Functions/' );
		
		const getActivity = new api.DoorFun({
			title   : 'GetActivity',
			execute : getActivityFun,
		}, 'Functions/' )
		
		const openChat = new api.DoorFun({
			title   : 'OpenChat',
			execute : openChatFun,
		}, 'Functions/' );
		
		const userUpdate = new api.DoorEvent({
			title : 'UserUpdate',
		}, 'Events/' );
		
		const roomUnread = new api.DoorEvent({
			title : 'RoomUnread',
		}, 'Events/' );
		
		const roomMentions = new api.DoorEvent({
			title : 'RoomMentions',
		}, 'Events/' );
		
		const roomActivity = new api.DoorEvent({
			title : 'RoomActivity',
		}, 'Events/' )
		
		const roomViewOpen = new api.DoorEvent({
			title : 'RoomViewOpen',
		}, 'Events/' );
		
		const roomViewClosed = new api.DoorEvent({
			title : 'RoomViewClosed',
		}, 'Events/' );
		
		const roomLiveState = new api.DoorEvent({
			title : 'RoomLiveState',
		}, 'Events/' );
		
		const liveHasFocus = new api.DoorEvent({
			title : 'LiveHasFocus',
		},	'Events/' );
		
		hello.dormant.addFun( msgToFID )
		hello.dormant.addFun( listRooms )
		hello.dormant.addFun( openRoom )
		hello.dormant.addFun( createRoom )
		hello.dormant.addFun( leaveRoom )
		hello.dormant.addFun( openLive )
		hello.dormant.addFun( closeLive )
		hello.dormant.addFun( addUserToRoom )
		hello.dormant.addFun( openChat )
		hello.dormant.addFun( getIdentity )
		hello.dormant.addFun( getActivity )
		hello.dormant.addFun( openSettings )
		hello.dormant.addFun( openRoomSettings )
		
		hello.dormant.addEvent( roomAdd )
		hello.dormant.addEvent( roomRemove )
		hello.dormant.addEvent( roomUpdate )
		hello.dormant.addEvent( roomInviteClose )
		hello.dormant.addEvent( roomViewOpen )
		hello.dormant.addEvent( roomViewClosed )
		hello.dormant.addEvent( roomLiveState )
		hello.dormant.addEvent( userUpdate )
		hello.dormant.addEvent( roomUnread )
		hello.dormant.addEvent( liveHasFocus )
		hello.dormant.addEvent( roomMentions )
		hello.dormant.addEvent( roomActivity )
		
		self.dormantEvents = {
			'roomAdd'         : roomAdd,
			'roomRemove'      : roomRemove,
			'roomUpdate'      : roomUpdate,
			'roomInviteClose' : roomInviteClose,
			'viewOpen'        : roomViewOpen,
			'viewClosed'      : roomViewClosed,
			'roomUnread'      : roomUnread,
			'roomMentions'    : roomMentions,
			'roomActivity'    : roomActivity,
			'roomLiveState'   : roomLiveState,
			'liveHasFocus'    : liveHasFocus,
			'identityUpdate'  : userUpdate,
		};
		
		function sendMsgToFID( fId, message, open ) {
			return new Promise(( resolve, reject ) => {
				if ( !self.presence ) {
					reject( 'ERR_NO_SERVICE' );
					return;
				}
				
				hello.service.sendMsgToFID(
					fId,
					message,
					open
				).then( msgSent )
				.catch( msgFail );
				
				function msgSent( res ) {
					resolve( res );
				}
				
				function msgFail( err ) {
					console.log( 'sendMsgToFID - msgFail', err );
					reject( err );
				}
			});
		}
		
		function listRoomsFun() {
			return new Promise(( resolve, reject ) => {
				if ( !self.presence ) {
					reject( 'ERR_NO_SERVICE' );
					return;
				}
				
				const rooms = self.presence.listRoomsDormant();
				resolve( rooms );
			});
		}
		
		async function openRoomFun( roomId ) {
			if ( null == self.presence )
				throw new Error( 'ERR_NO_SERVICE' );
			
			return await self.presence.openChat({ 
				id : roomId,
			});
		}
		
		async function createRoomFun( roomName ) {
			if ( null == self.presence )
				throw new Error( 'ERR_NO_SERVICE' );
			
			const room = await self.presence.createRoom({ name : roomName });
			return room;
		}
		
		async function leaveRoomFun( roomId ) {
			if ( null == self.presence )
				throw new Error( 'ERR_NO_SERVICE' );
			
			const room = await self.presence.leaveRoom( roomId );
			return roomId;
		}
		
		async function openLiveFun( roomId ) {
			if ( null == self.presence )
				throw new Error( 'ERR_NO_SERVICE' );
			
			return self.presence.openLive( roomId );
		}
		
		async function closeLiveFun( roomId ) {
			if ( null == self.presence )
				throw new Error( 'ERR_NO_SERVICE' );
			
			return self.presence.closeLive( roomId );
		}
		
		async function addUsersToRoomFun( roomId, conf ) {
			if ( null == self.presence )
				throw new Error( 'ERR_NO_SERVICE' );
			
			return await self.presence.showInviterFor( roomId, conf );
		}
		
		async function openChatFun( fUserId ) {
			console.log( 'openChatFun - NYI', fUserId );
			throw new Error( 'NYI_LOL' );
			
		}
		
		async function getIdentityFun( fUserId ) {
			if ( null == self.presence )
				throw new Error( 'ERR_NO_SERVICE' )
			
			return await self.presence.getFriendContact( fUserId )
		}
		
		async function getActivityFun( fUserId ) {
			if ( null == self.presence )
				throw new Error( 'ERR_NO_SERVICE' )
			
			
			return await self.presence.getFriendContactActivity( fUserId )
		}
		
		async function openSettingsFun() {
			hello.account.getSettings();
		}
		
		async function openRoomSettingsFun( roomId ) {
			if ( null == self.presence )
				throw new Error( 'ERR_NO_SERVICE' )
			
			return await self.presence.openRoomSettings( roomId )
		}
		
	}
	
	ns.PresenceService.prototype.handle = function( event ) {
		const self = this;
		self.emit( event.type, event.data );
	}
	
})( library.component );
