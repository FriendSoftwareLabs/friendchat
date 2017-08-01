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
library.component = library.component || {};

// EventHandler
(function( ns, undefined ) {
	ns.EventHandler = function( source ) {
		if ( !( this instanceof ns.Event ))
			return new ns.Event( app );
		
		var self = this;
		self.source = source;
		self.subscriber = {};
		
		self.eventInit();
	}
	
	ns.EventHandler.prototype.eventInit = function() {
		var self = this;
		self.source.receiveMessage = receiveEvent;
		
		function receiveEvent( event ) { self.receiveEvent( event ); }
	}
	
	ns.EventHandler.prototype.receiveEvent = function( msg ) {
		var self = this;
		var handler = self.subscriber[ msg.type ];
		
		if ( !handler ) {
			console.log( 'Hello.Event.receiveEvent > no handler for ', msg );
			return;
		}
		
		self.subscriber[ msg.type ]( msg );
	}
	
	ns.EventHandler.prototype.on = function( id, callback ) {
		var self = this;
		if ( self.subscriber[ id ] )
			console.log( 'Event.add > event already exists, overwriting', id );
		
		self.subscriber[ id ] = callback;
	}
	
	ns.EventHandler.prototype.off = function( id ) {
		var self = this;
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
		
		var self = this;
		self.subscriber = {};
		self.state = initialState || 'no-pants';
		self.data = null;
	}
	
	ns.Status.prototype.init = function() {
		var self = this;
	}
	
	ns.Status.prototype.set = function( state, data ) {
		var self = this;
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
		var self = this;
		var wrap = {
			type : self.state,
			data  : self.data,
		};
		return Wrap;
	}
	
	ns.Status.prototype.subscribe = function( id, callback ) {
		var self = this;
		if ( self.subscriber[ id ]) {
			console.log( 'OVERWRITING - component.Status.listen - id already exists - OVERWRITING', id );
		}
		
		self.subscriber[ id ] = callback;
		callback( self.state );
	}
	
	ns.Status.prototype.unsubscribe = function( id ) {
		var self = this;
		if ( self.subscriber[ id ])
			delete self.subscriber[ id ];
	}
	
})( library.component );



// AVAILABILITY
(function( ns, undefined ) {
	ns.Availability = function( conf ) {
		if ( !( this instanceof ns.Availability ))
			return new ns.Availability( elementId );
		
		var self = this;
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
		
		var self = this;
		self.button.blur();
		self.optionsContainer.classList.add( 'show' );
		ns.app._window.addEventListener( 'click', hideOptions, false );
		function hideOptions( e ) {
			e.preventDefault();
			e.stopPropagation();
			self.optionsContainer.classList.remove( 'show' );
			ns.app._window.removeEventListener( 'click', arguments.callee );
		}
	}
	
	ns.Availability.prototype.set = function( option ) {
		var self = this;
		
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
		var self = this;
		self.subscribers[ id ] = fn;
	}
	
	ns.Availability.prototype.off = function( id ) {
		var self = this;
		if( self.subscribers[ id ])
			delete self.subscribers[ id ];
	}
})( library.component );


// INFO ( overlay )

(function( ns, undefined ) {
	ns.Info = function( parentId ) {
		if ( !( this instanceof ns.Info ))
			return new ns.Info( parentId );
		
		var self = this;
		self.parentId = parentId;
		
		self.setup();
	}
	
	ns.Info.prototype.setSuccess = function( str ) {
		var self = this;
		self.setText( str );
		self.border.classList.remove( 'fail' );
		self.border.classList.add( 'success' );
		self.show();
	}
	
	ns.Info.prototype.setFail = function( str ) {
		var self = this;
		self.setText( str );
		self.border.classList.remove( 'success' );
		self.border.classList.add( 'fail' );
		self.show();
	}
	
	ns.Info.prototype.hide = function( str ) {
		var self = this;
		self.screen.classList.add( 'hidden' );
	}
	
	ns.Info.prototype.show = function() {
		var self = this;
		self.screen.classList.remove( 'hidden' );
	}
	
	ns.Info.prototype.setText = function( str ) {
		var self = this;
		self.text.textContent = str;
	}
	
	ns.Info.prototype.setup = function() {
		var self = this;
		var html = ns.template.get( 'hello-infoscreen-tmpl' );
		var container = ge( self.parentId );
		container.insertAdjacentHTML( 'beforeend', html );
		self.screen = ge( 'hello-infoscreen' );
		self.text = self.screen.querySelector( '.content' );
		self.border = self.screen.querySelector( '.contentContainer' );
	}
	
})( library.component );

(function( ns, undefined ) {
	ns.Droppings = function( conf ) {
		if ( !( this instanceof ns.Droppings ))
			return new ns.Droppings( conf );
		
		console.log( 'Droppings', conf );
		var self = this;
		self.toView = conf.toView;
		self.toChat = conf.toChat;
		
		self.init();
	}
	
	// Public
	
	ns.Droppings.prototype.handle = function( items ) {
		var self = this;
		console.log( 'Droppings.handle', items );
		items.forEach( jajajaja );
		function jajajaja( item ) {
			var handler = self.typeMap[ item.Type ];
			if ( !handler ) {
				console.log( 'Droppings.handle - no handler for', item );
				return;
			}
			
			handler( item );
		}
	}
	
	// Private
	
	ns.Droppings.prototype.init = function() {
		var self = this;
		self.typeMap = {
			'File'          : handleFile,
			'CalendarEvent' : handleCalendar,
			'Executable'    : handleExec,
		};
		
		function handleFile( e ) { self.handleFile( e ); }
		function handleCalendar( e ) { self.handleCalendar( e ); }
		function handleExec( e ) { self.handleExecutable( e ); }
	}
	
	ns.Droppings.prototype.handleFile = function( item ) {
		var self = this;
		console.log( 'shareFile', item );
		var file = new api.File( item.Path );
		file.expose( back );
		function back( res ) {
			console.log( 'shareFile res', res );
			var success = !!res;
			var msg = {
				type : 'link',
				data : {
					success : success,
					'public' : res,
				},
			};
			self.toView( msg );
			if ( success )
				self.toChat( res );
		}
	}
	
	ns.Droppings.prototype.handleCalendar = function( item ) {
		var self = this;
		console.log( 'handleCalendar', item );
		var event = {
			type : 'calendar-event',
			data : item,
		};
		var dataEvent = hello.intercept.buildJSON( event );
		console.log( 'dataEvent', dataEvent );
		self.toChat( dataEvent );
	
	}
	
	ns.Droppings.prototype.handleExecutable = function( item ) {
		const self = this;
		const app = {
			type : 'nested-app',
			data : item,
		};
		console.log( 'handleExec', app );
		self.toView( app );
	}
	
	ns.Droppings.prototype.close = function() {
		var self = this;
		delete self.toView;
		delete self.send;
	}
	
})( library.component );

// RTCService
(function( ns, undefined ) {
	ns.RTCService = function( conf ) {
		var self = this;
		self.onhost = conf.onhost;
		self.onroom = conf.onroom;
		self.onevent = conf.onevent;
		self.onclose = conf.onclose;
		self.oninvite = conf.oninvite;
		self.onidentity = conf.onidentity;
		
		library.component.EventEmitter.call( self );
		
		self.init();
	}
	
	ns.RTCService.prototype = Object.create(
		library.component.EventEmitter.prototype );
	
	// Public
	
	ns.RTCService.prototype.getHost = function() {
		const self = this;
		return self.onhost();
	}
	
	ns.RTCService.prototype.getRoom = function( req ) {
		var self = this;
		if ( !self.onroom ) {
			console.log( 'RTCService.getRoom - no handler', req );
			return;
		}
		
		self.onroom( req );
	}
	
	ns.RTCService.prototype.getIdentity = function() {
		const self = this;
		return self.onidentity(); // small i
	}
	
	
	ns.RTCService.prototype.invite = function( contact ) {
		const self = this;
		self.oninvite( contact );
	}
	
	ns.RTCService.prototype.send = function( event ) {
		var self = this;
		if ( self.onevent ) {
			console.log( 'RTCService.send - no onevent', event );
			return;
		}
		
		self.onevent( event );
	}
	
	ns.RTCService.prototype.close = function() {
		var self = this;
		delete self.onroom;
		delete self.onevent;
		delete self.onclose;
		delete self.oninvite;
	}
	
	// Private
	
	ns.RTCService.prototype.init = function() {
		var self = this;
		console.log( 'RTCService.init' );
	}
	
	ns.RTCService.prototype.handle = function( event ) {
		var self = this;
		console.log( 'RTCService.handle', event );
		self.emit( event.type, event.data );
	}
	
})( library.component );
