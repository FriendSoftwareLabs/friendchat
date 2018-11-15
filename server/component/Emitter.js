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

/*
	Emitter, general event emitter class.
	So i dont have to use the node one ( my interface is superior :)))))))
	
	constructor arguments: 
	
	eventSink - function, optional - this is a default handler where all events
		that do not have handlers will be sent, but with the event type as first
		argument.
	
	Provides this interface:
	.on( eventTypeStr, listenerFn ), returns idStr for use in .off
		Listen for event of type
		
	.once( eventTypeStr, listenerFn ), no return value
		Listen for one event of type, then the listener is released
		
	.off( idStr ), return successBool
		Stop listening for event. idStr is the return value from .on
		
	.release( type ), type of event listeners to release - no return value
		Remove all listeners registered on the object, or specify listener type
		
	.emit( type, arguments... ), returns null if event was emitted,
		otherwise returns a object with 'type' and arguments[]
		Arguments are applied to all registered listeners of the specified type.
*/

const util = require( 'util' );

const log = require( './Log' )( 'Emitter' );
const uuid = require( './UuidPrefix' )( 'listener' );

const ns = {};

ns.Emitter = function( eventSink ) {
	if ( !( this instanceof ns.Emitter ))
		return new ns.Emitter( eventSink );
	
	const self = this;
	self._emitterEvent2ListenerId = {};
	self._emitterListeners = {};
	self._emitterEventSink = eventSink;
}

// first argument must be the event type, a string,
// send as many extra arguments as you wish, they will be passed to the handler
// no in args, you say? its voodoo magic, aka 'arguments' object
ns.Emitter.prototype.emit = function() {
	const self = this;
	var args = self._getArgs( arguments );
	const event = args.shift(); // first arguments passed to .emit()
	const handlerArgs = args;
		// as an array that will be .apply to the listener
	
	const listenerIds = self._emitterEvent2ListenerId[ event ];
	if ( !listenerIds || !listenerIds.length ) {
		if ( self._emitterEventSink )
			self._emitterEventSink.apply( arguments );
		
		const unknownEvent = {
			type : event,
			arguments : handlerArgs,
		}
		return unknownEvent;
	}
	
	listenerIds.forEach( sendOnListener );
	return null;
	function sendOnListener( id ) {
		var listener = self._emitterListeners[ id ];
		if ( !listener )
			return;
		
		listener.apply( self, handlerArgs );
	}
}

ns.Emitter.prototype.on = function( event, listener ) {
	const self = this;
	var id = uuid.v4();
	var eventListenerIds = self._emitterEvent2ListenerId[ event ];
	if ( !eventListenerIds ) {
		eventListenerIds = [];
		self._emitterEvent2ListenerId[ event ] = eventListenerIds;
	}
	
	eventListenerIds.push( id );
	self._emitterListeners[ id ] = listener;
	
	return id;
}

ns.Emitter.prototype.once = function( event, listener ) {
	const self = this;
	var onceieId = self.on( event, onceie );
	
	function onceie( eventData ) {
		listener( eventData );
		self.off( onceieId );
	}
}

ns.Emitter.prototype.off = function( removeListenerId ) {
	const self = this;
	var events = Object.keys( self._emitterEvent2ListenerId );
	events.forEach( search );
	
	function search( event ) {
		let listenerIdArr = self._emitterEvent2ListenerId[ event ];
		let listenerIdIndex = listenerIdArr.indexOf( removeListenerId );
		if ( listenerIdIndex === -1 )
			return false;
		
		self._emitterEvent2ListenerId[ event ].splice( listenerIdIndex, 1 );
		delete self._emitterListeners[ removeListenerId ];
		return true;
	}
}

ns.Emitter.prototype.release = function( eventName ) {
	const self = this;
	if ( !eventName )
		releaseAll();
	else
		releaseAllOfType( eventName );
	
	function releaseAll() {
		self._emitterEvent2ListenerId = {};
		self._emitterListeners = {};
	}
	
	function releaseAllOfType( name ) {
		var idArr = self._emitterEvent2ListenerId[ name ];
		if ( !idArr || !idArr.length )
			return;
		
		idArr.forEach( remove );
		delete self._emitterEvent2ListenerId[ name ];
		
		function remove( id ) {
			delete self._emitterListeners[ id ];
		}
	}
}

ns.Emitter.prototype._getArgs = function( argObj ) {
	const self = this;
	const args = [];
	var len = argObj.length;
	while( len-- )
		args[ len ] = argObj[ len ];
	
	return args;
}

ns.Emitter.prototype.emitterClose = function() {
	const self = this;
	self.release();
	delete self._emitterEventSink;
}

/* EventNode

- write things here
- later

*/

const nLog = require( './Log' )( 'EventNode' );
ns.EventNode = function( type, conn, sink, proxyType ) {
	const self = this;
	self._eventNodeType = type;
	self._eventNodeConn = conn;
	self._eventNodeProxyType = proxyType;
	//self._eventNodeSink = sink;
	ns.Emitter.call( self, sink );
	
	self._eventNodeInit();
}

util.inherits( ns.EventNode, ns.Emitter );

// Public

ns.EventNode.prototype.send = function( event, sourceId, altType ) {
	const self = this;
	var wrap = null;
	if ( self._eventNodeProxyType )
		wrap = event;
	else
		wrap = {
		type : altType || self._eventNodeType,
		data : event,
	};
	self._eventNodeConn.send( wrap, sourceId, self._eventNodeProxyType );
}

ns.EventNode.prototype.handle = function( event, sourceId ) {
	const self = this;
	self._handleEvent.apply( self, arguments );
}

ns.EventNode.prototype.close = function() {
	const self = this;
	self.emitterClose();
	self._eventNodeConn.release( self._eventNodeType );
	delete self._eventNodeConn;
	delete self._eventNodeType;
}

// Private

ns.EventNode.prototype._eventNodeInit = function() {
	const self = this;
	self._eventNodeConn.on( self._eventNodeType, rcvEvent );
	function rcvEvent() {
		//const args = Array.prototype.slice.call( arguments );
		self._handleEvent.apply( self, arguments );
	}
}

ns.EventNode.prototype._handleEvent = function() {
	const self = this;
	var args = self._getArgs( arguments );
	const event = args.shift();
	args.unshift( event.data );
	args.unshift( event.type );
	self.emit.apply( self, args );
}

/* RequestNode

- Write things here aswell
- also later

*/

ns.RequestNode = function( conn, eventSink ) {
	const self = this;
	ns.EventNode.call( self,
		'request',
		conn,
		eventSink,
		null,
	);
	
	self._requests = {};
	self._requestNodeInit();
}

util.inherits( ns.RequestNode, ns.EventNode );

ns.RequestNode.prototype.request = async function( type, data ) {
	const self = this;
	return new Promise(( resolve, reject ) => {
		function sendRequest( type, data ) {
			const reqId = uuid.get( 'req' );
			self._requests[ reqId ] = handleResponse;
			const reqWrap = {
				requestId : reqId,
				request   : {
					type    : type,
					data    : data,
				},
			};
			
			self.send( reqWrap );
		}
		
		function handleResponse( error, response ) {
			delete self._requests[ reqId ];
			if ( error ) {
				reject( error );
				return;
			} else {
				resolve( response );
			}
		}
	});
}

// Private

ns.RequestNode.prototype._requestNodeInit = function() {
	const self = this;
}

ns.RequestNode.prototype._handleEvent = async function( req, sourceId ) {
	const self = this;
	if ( 'response' === req.type ) {
		self._handleResponse( req.data, sourceId );
		return;
	}
	
	const reqId = req.requestId;
	const request = req.request;
	let response = null;
	let error = null;
	try {
		response = await self._callListener( request )
	} catch( err ) {
		error = err;
	}
	
	const res = {
		type : 'response',
		data : {
			requestId : reqId,
			error     : error,
			response  : response,
		},
	};
	self.send( res, sourceId );
}

ns.RequestNode.prototype._handleResponse = function( res, sourceId ) {
	const self = this;
	log( '_handleResponse - NYI', res );
}

ns.RequestNode.prototype._callListener = async function( req ) {
	const self = this;
	const type = req.type;
	const listeners = self._emitterEvent2ListenerId[ type ];
	if ( !listeners )
		throw new Error( 'ERR_NO_LISTENER' );
	
	if ( 1 !== listeners.length )
		throw new Error( 'ERR_MULTIPLE_LISTENERS' );
	
	const lId = listeners[ 0 ];
	const listener = self._emitterListeners[ lId ];
	try {
		return listener( req.data );
	} catch( err ) {
		throw new Error( err );
	}
}

module.exports = ns;
