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

/* EVENT EMITTER

For prototype extension. Your object gains the ability to emit events 
to listeners registered through this interface

*/

(function( ns, undefined ) {
	ns.EventEmitter = function( eventSink ) {
		if ( !( this instanceof ns.EventEmitter ))
			return new ns.EventEmitter();
		
		var self = this;
		self._eventSink = eventSink;
		self.eventToListener = {};
		self.eventListeners = {};
		
		self._eventEmitterInit();
	}

	
	// Added to objects public interface
	
	ns.EventEmitter.prototype.on = function( event, listener )
	{
		var self = this;
		var id = friendUP.tool.uid( 'listener' );
		var listenerIds = self.eventToListener[ event ];
		if ( !listenerIds ) {
			self.eventToListener[ event ] = [];
		}
		
		self.eventToListener[ event ].push( id );
		self.eventListeners[ id ] = listener;
		
		return id;
	}
	
	ns.EventEmitter.prototype.once = function( event, listener )
	{
		var self = this;
		var onceieId = self.on( event, onceie );
		
		function onceie( arrrgs ) {
			var args = self._getArgs( arguments );
			listener.apply( null, args );
			self.off( onceieId );
		}
	}
	
	ns.EventEmitter.prototype.off = function( listenerId )
	{
		var self = this;
		var listener = self.eventListeners[ listenerId ];
		if ( !listener )
			return;
		
		// remove from listener map
		delete self.eventListeners[ listenerId ];
		
		// remove from events listener id list
		var events = Object.keys( self.eventToListener );
		events.some( searchListenerIdList );
		function searchListenerIdList( event )
		{
			var listenerIds = self.eventToListener[ event ];
			var index = listenerIds.indexOf( listenerId );
			if ( index === -1 )
				return false;
			
			removeListener( event, index );
			return true;
		}
		
		function removeListener( event, index )
		{
			self.eventToListener[ event ].splice( index, 1 );
		}
	}
	
	ns.EventEmitter.prototype.release = function( type )
	{
		var self = this;
		if ( !type )
			all();
		else
			ofType( type );
		
		function all()
		{
			self.eventListeners = {};
			self.eventToListener = {};
		}
		
		function ofType( type )
		{
			var lids = self.eventToListener[ type ];
			if ( !lids || !lids.length )
				return;
			
			lids.forEach( remove );
			delete self.eventToListener[ type ];
			
			function remove( lid )
			{
				delete self.eventListeners[ lid ];
			}
		}
	}
	
	// emit can take any number of arguments
	// the first MUST be the event type / listener id
	// all extra arguments will be passed on to the handler
	ns.EventEmitter.prototype.emit = function()
	{
		var self = this;
		var args = self._getArgs( arguments );
		var event = args.shift();
		var listenerIds = self.eventToListener[ event ];
		if ( !listenerIds || !listenerIds.length ) {
			if ( self._eventSink )
				emitOnDefault( event, args );
			
			return;
		}
		
		listenerIds.forEach( emit );
		function emit( listenerId )
		{
			var listener = self.eventListeners[ listenerId ];
			if ( 'function' !== typeof( listener )) {
				if ( self._eventSink )
					emitOnDefault( event, args );
				
				return;
			}
			
			listener.apply( null, args );
		}
		
		function emitOnDefault( type, args )
		{
			args.unshift( type );
			self._eventSink.apply( null, args );
		}
	}
	
	ns.EventEmitter.prototype.closeEventEmitter = function()
	{
		var self = this;
		self.release();
		delete self._eventSink;
	}
	
	// Private
	
	ns.EventEmitter.prototype._eventEmitterInit = function()
	{
		var self = this;
		// dont remove this, js is weird
	}
	
	ns.EventEmitter.prototype._getArgs = function( argObj ) {
		var self = this;
		var args = [];
		var len = argObj.length;
		while( len-- )
			args[ len ] = argObj[ len ];
		
		return args;
	}
})( library.component );


/* EventNode

type - event to listen for on conn, and what to wrap in before sending up the tree
conn - root event source
eventSink - events are sent here if there is no handler,
onsend - callback, replaces conn in some usecases
	where a conn does not make sense or is unavailable ( ex: root of event tree )
	
inherits from EventEmitter
*/
(function( ns, undefined ) {
	ns.EventNode = function(
		type,
		conn,
		eventSink,
		onsend
	) {
		var self = this;
		self.type = type || null;
		self.conn = conn || null;
		self.onsend = onsend;
		
		ns.EventEmitter.call( self, eventSink );
		console.log( 'eventNode', self.type );
		self.initEventNode();
	}
	
	ns.EventNode.prototype = Object.create( ns.EventEmitter.prototype );
	
	// public
	
	// to root
	ns.EventNode.prototype.send = function( event ) {
		var self = this;
		if ( !self.sendEvent )
			return;
		
		if ( !self.type )
			wrap = event;
		else
			var wrap = {
				type : self.type,
				data : event,
			};
		
		self.sendEvent( wrap );
	}
	
	// insert event, as if its coming from root ( emit to branches )
	ns.EventNode.prototype.handle = function( event ) {
		var self = this;
		self.emit( event.type, event.data );
	}
	
	ns.EventNode.prototype.close = function() {
		var self = this;
		self.closeEventEmitter();
		delete self.sendEvent;
		delete self.onsend;
		
		if ( self.conn )
			self.conn.release( self.type );
		
		delete self.type;
		delete self.conn;
	}
	
	// Private
	
	ns.EventNode.prototype.initEventNode = function() {
		var self = this;
		if ( self.conn && self.type ) {
			self.conn.on( self.type, handle );
			function handle( e ) { self.handle( e ); }
		}
		
		if ( self.onsend )
			self.sendEvent = sendOnHandler;
		else
			self.sendEvent = sendOnConn;
		
		function sendOnHandler( event ) {
			if ( self.onsend )
				self.onsend( event );
		}
		
		function sendOnConn( event ) {
			if ( self.conn )
				self.conn.send( event );
		}
	}
})( library.component );

//SubView
(function( ns, undefined ) {
	ns.SubView = function( conf ) {
		if ( !( this instanceof ns.SubView ))
			return new ns.SubView( conf );
		
		var self = this;
		self.parent = conf.parent;
		self.type = conf.type;
		self.onloaded = conf.loaded || null;
		self.onready = conf.ready || null;
		self.subscriber = {};
		
		self.init();
	}
	
	ns.SubView.prototype.init = function() {
		var self = this;
		self.parent.on( self.type, handleMessage );
		
		function handleMessage( msg ) { self.handleMessage( msg ); }
	}
	
	ns.SubView.prototype.on = function( event, handler ) {
		var self = this;
		self.subscriber[ event ] = handler;
	}
	
	ns.SubView.prototype.off = function( event ) {
		var self = this;
		if ( self.subscriber[ event ])
			delete self.subscriber[ event ];
	}
	
	ns.SubView.prototype.allOff = function() {
		self = this;
		self.subscriber = {};
	}
	
	ns.SubView.prototype.close = function() {
		var self = this;
		console.log( 'SubView.close', self.type );
		if ( self.parent.off )
			self.parent.off( self.type );
		if ( self.parent.release )
			self.parent.release( self.type );
		
		delete self.onloaded;
		delete self.onready;
		delete self.subscriber;
	}
	
	ns.SubView.prototype.handleMessage = function( msg ) {
		var self = this;
		
		if ( !msg || !msg.type) {
			console.log( 'SubView.handleMessage - invalid: ', msg );
			return;
		}
		
		var handler = self.subscriber[ msg.type ];
		
		if ( !handler ) {
			self.unhandled( msg );
			return;
		}
		
		handler( msg.data || null );
	}
	
	ns.SubView.prototype.unhandled = function( msg ) {
		var self = this;
		if ( msg.type == 'loaded' && self.onloaded ) {
			self.onloaded( msg.data );
			return;
		}
		
		if ( msg.type == 'ready' && self.onready ) {
			self.onready( msg.data );
			return;
		}
		
		console.log( 'subview.' + self.type + '.handleMessage - no handler for', msg );
	}
	
	ns.SubView.prototype.sendMessage = function( msg ) {
		var self = this;
		var wrap = {
			type : self.type,
			data : msg
		};
		
		self.parent.sendMessage( wrap );
	}
})( library.component );


// IDENTITY
(function( ns, undefined ) {
	ns.Identity = function( conf ) {
		if ( !( this instanceof ns.Identity ))
			return new ns.Identity( conf );
		
		var self = this;
		self.init( conf );
	}
	
	// Public
	
	// Private
	
	ns.Identity.prototype.avatar    = '../gfx/avatar_blue.png';
	ns.Identity.prototype.avatarAlt = '../gfx/avatar_grey.png';
	
	ns.Identity.prototype.init = function( conf ) {
		var self = this;
		//console.log( 'Identity.init', conf );
		if ( conf.Name )
			self.fromFCUser( conf );
		else
			self.fromIdentity( conf );
		
	}
	
	ns.Identity.prototype.fromFCUser = function( conf ) {
		var self = this;
		//console.log( 'fromFCUser', conf );
		self.fupConf = conf;
		self.fupId = conf.ID;
		self.name = library.tool.htmlDecode( conf.FullName );
		self.alias = conf.Name;
		self.email = conf.Email;
		self.avatar = conf.Image; // || self.avatar;
		self.level = conf.Level;
		
		console.log( 'identity', self );
	}
	
	ns.Identity.prototype.fromIdentity = function( conf ) {
		var self = this;
		//console.log( 'fromIdentity', conf );
		self.fupConf = {
			ID       : conf.fupId,
			FullName : conf.name,
			Name     : conf.alias,
			Email    : conf.email,
			Image    : conf.avatar, // || self.avatar,
			Level    : conf.level,
		};
		
		self.fupId = conf.fupId;
		self.name = conf.name;
		self.alias = conf.alias;
		self.email = conf.email;
		self.avatar = conf.avatar, // || self.avatar;
		self.level = conf.level;
	}
	
})( library.component );
