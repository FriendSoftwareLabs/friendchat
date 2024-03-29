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

window.library = window.library || {};
window.hello = window.hello || {};
window.library.component = window.library.component || {};

/* EVENT EMITTER

For prototype extension. Your object gains the ability to emit events 
to listeners registered through this interface

*/

(function( ns, undefined ) {
	ns.EventEmitter = function( eventSink, debug ) {
		const self = this;
		self._eventSink = eventSink;
		self._eventsDebug = !!debug;
		self.eventToListener = {};
		self.eventListeners = {};
		
		self._eventEmitterInit();
		
		if ( self._eventsDebug ) {
			try {
				throw new Error( 'trace' );
			} catch( ex ) {
				console.log( 'EventEmitter debug trace', ex );
			}
		}
	}
	
	// Added to objects public interface
	
	ns.EventEmitter.prototype.on = function( event, listener ) {
		const self = this;
		const id = friendUP.tool.uid( 'listener' );
		if ( self._eventsDebug )
			console.log( 'EventEmitter.on', {
				id    : id,
				event : event,
			});
		
		const listenerIds = self.eventToListener[ event ];
		if ( !listenerIds ) {
			self.eventToListener[ event ] = [];
		}
		
		self.eventToListener[ event ].push( id );
		self.eventListeners[ id ] = listener;
		
		return id;
	}
	
	ns.EventEmitter.prototype.once = function( event, listener ) {
		const self = this;
		const onceieId = self.on( event, onceie );
		
		function onceie( ...args ) {
			//const args = self._getArgs( arguments );
			listener.apply( null, args );
			self.off( onceieId );
		}
	}
	
	ns.EventEmitter.prototype.off = function( listenerId ) {
		const self = this;
		const listener = self.eventListeners[ listenerId ];
		if ( !listener )
			return;
		
		// remove from listener map
		delete self.eventListeners[ listenerId ];
		
		// remove from events listener id list
		const events = Object.keys( self.eventToListener );
		events.some( searchListenerIdList );
		function searchListenerIdList( event ) {
			const listenerIds = self.eventToListener[ event ];
			const index = listenerIds.indexOf( listenerId );
			if ( index === -1 )
				return false;
			
			removeListener( event, index );
			return true;
		}
		
		function removeListener( event, index ) {
			self.eventToListener[ event ].splice( index, 1 );
		}
	}
	
	ns.EventEmitter.prototype.release = function( type ) {
		const self = this;
		if ( !type )
			all();
		else
			ofType( type );
		
		function all() {
			self.eventListeners = {};
			self.eventToListener = {};
		}
		
		function ofType( type ) {
			const lids = self.eventToListener[ type ];
			if ( !lids || !lids.length )
				return;
			
			lids.forEach( remove );
			delete self.eventToListener[ type ];
			
			function remove( lid ) {
				delete self.eventListeners[ lid ];
			}
		}
	}
	
	// emit can take any number of arguments
	// the first MUST be the event type / listener id
	// all extra arguments will be passed on to the handler
	ns.EventEmitter.prototype.emit = function( ...args ) {
		const self = this;
		//const args = self._getArgs( arguments );
		const event = args.shift();
		const listenerIds = self.eventToListener[ event ];
		let caught = true;
		if ( !listenerIds || !listenerIds.length ) {
			if ( self._eventSink )
				emitOnDefault( event, args );
			
			if ( self._eventsDebug )
				console.log( 'EventEmitter.emit - no listener for', {
					event : event,
					args  : args,
				});
			
			return false;
		}
		
		caught = listenerIds.reduce( emit, true );
		return caught;
		
		function emit( caught, listenerId ) {
			const listener = self.eventListeners[ listenerId ];
			if ( self._eventsDebug )
				console.log( 'EventEmitter.emit - emitting', {
					event    : event,
					args     : args,
					listener : listener,
				});
			
			const used = listener.apply( null, args );
			if ( undefined == used )
				return caught;
			
			return used;
		}
		
		function emitOnDefault( type, args ) {
			args.unshift( type );
			self._eventSink.apply( null, args );
		}
	}
	
	ns.EventEmitter.prototype.closeEventEmitter = function() {
		const self = this;
		self.release();
		delete self._eventSink;
	}
	
	ns.EventEmitter.prototype.close = function() {
		const self = this;
		self.closeEventEmitter();
	}
	
	// Private
	
	ns.EventEmitter.prototype._eventEmitterInit = function() {
		const self = this;
		// dont remove this, js is weird
	}
	
	ns.EventEmitter.prototype._getArgs = function( argObj ) {
		const self = this;
		const args = [];
		let len = argObj.length;
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
		onsend,
		debug
	) {
		const self = this;
		self.type = type || null;
		self.conn = conn || null;
		self.onsend = onsend;
		
		ns.EventEmitter.call( self, eventSink, debug );
		self.initEventNode();
	}
	
	ns.EventNode.prototype = Object.create( ns.EventEmitter.prototype );
	
	// public
	
	// to root
	ns.EventNode.prototype.send = function( event ) {
		const self = this;
		if ( !self.sendEvent ) {
			if ( self._eventsDebug )
				console.log( 'EventNode.send - no sendEvent fun??', event );
			return;
		}
		
		let wrap = null;
		if ( !self.type )
			wrap = event;
		else
			wrap = {
				type : self.type,
				data : event,
			};
		
		if ( self._eventsDebug )
			console.log( 'EventNode.send', {
				event : event,
				wrap  : wrap,
			});
		
		self.sendEvent( wrap );
	}
	
	// insert event, as if its coming from root ( emit to branches )
	ns.EventNode.prototype.handle = function( event ) {
		const self = this;
		return self.emit( event.type, event.data );
	}
	
	ns.EventNode.prototype.closeEventNode = function() {
		const self = this;
		self.closeEventEmitter();
		delete self.sendEvent;
		delete self.onsend;
		
		if ( self.conn )
			self.conn.release( self.type );
		
		delete self.type;
		delete self.conn;
	}
	
	ns.EventNode.prototype.close = function() {
		const self = this;
		self.closeEventNode();
	}
	
	// Private
	
	ns.EventNode.prototype.initEventNode = function() {
		const self = this;
		if ( self._eventsDebug )
			console.log( 'initEventNode', {
				type : self.type,
				conn : self.conn,
			});
		
		if ( self.conn && self.type ) {
			self.conn.on( self.type, handle );
			function handle( ...args ) { self.handle( ...args ); }
		}
		
		if ( self.onsend )
			self.sendEvent = sendOnHandler;
		if ( self.conn )
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


// RequestNode
// ALL HANDLERS ARE EXPECTED TO RETURN PROMISES
// .request( t, d ) returns a Promise
(function( ns, undefined ) {
	ns.RequestNode = function(
		type,
		conn,
		eventSink,
		onSend,
		debug
	) {
		const self = this;
		ns.EventNode.call( self,
			type,
			conn,
			eventSink,
			onSend,
			debug
		);
		
		self._requests = {};
		self.initRequestNode();
	}
	
	ns.RequestNode.prototype = Object.create( ns.EventNode.prototype );
	
	// Public
	
	ns.RequestNode.prototype.request = function( request ) {
		const self = this;
		return new Promise(( resolve, reject ) => {
			const reqId = friendUP.tool.uid( 'req' );
			self._requests[ reqId ] = handleResponse;
			request.requestId = reqId;
			self.send( request );
			
			return;
			const reqWrap = {
				type      : self.type,
				data      : request,
			};
			
			self.sendEvent( reqWrap );
			
			function handleResponse( error, response ) {
				delete self._requests[ reqId ];
				if ( error )
					reject( error );
				else
					resolve( response );
			}
		});
	}
	
	ns.RequestNode.prototype.closeRequestNode = function() {
		const self = this;
		const rIds = Object.keys( self._requests );
		rIds.forEach( rId => {
			const req = self._requests[ rId ];
			delete self._requests[ rId ];
			if ( null == req )
				return;
			
			req( 'ERR_NODE_CLOSED', null );
		});
		
		self.closeEventNode();
		
	}
	
	ns.RequestNode.prototype.close = function() {
		const self = this;
		self.closeRequestNode();
	}
	
	// Private
	
	ns.RequestNode.prototype.initRequestNode = function() {
		const self = this;
	}
	
	ns.RequestNode.prototype.handle = function( event ) {
		const self = this;
		if ( self._eventsDebug )
			console.log( 'RequestNode.handle', event );
		
		const reqId = event.requestId;
		if ( !reqId )
			return self.emit( event.type, event.data );
		
		const isRequest = ( undefined === event.response );
		if ( isRequest )
			return self.handleRequest( event );
		else
			return self.handleResponse( event );
	}
	
	ns.RequestNode.prototype.handleRequest = function( event ) {
		const self = this;
		const reqId = event.requestId;
		const request = event.data;
		try {
			self.callListener( event )
				.then( response )
				.catch( error );
		} catch( ex ) {
			console.trace( 'handleRequest - callListener ex', {
				ex    : ex,
				event : event,
				self  : self,
			});
		}
		
		function response( data ) {
			const res = {
				requestId : reqId,
				response  : data,
				error     : null,
			};
			self.send( res );
		}
		
		function error( err ) {
			console.log( 'error', err );
			const errRes = {
				requestId : reqId,
				response  : null,
				error     : err,
			};
			self.send( errRes );
		}
	}
	
	ns.RequestNode.prototype.handleResponse = function( event ) {
		const self = this
		const reqId = event.requestId
		const err = event.error || null
		const res = err ? null : ( event.response || null )
		const handler = self._requests[ reqId ]
		if ( !handler ) {
			if ( self._eventsDebug ) {
				console.log( 'RequestNode.handleResponse - no handler for', {
					event    : event,
					handlers : self._requests,
				})
			}
			return
		}
		
		handler( err, res )
	}
	
	ns.RequestNode.prototype.callListener = async function( req ) {
		const self = this;
		const type = req.type;
		const data = req.data;
		const listeners = self.eventToListener[ type ];
		if ( self._eventsDebug )
			console.log( 'callListener', {
				req : req,
				sink : self._eventSink,
			});
		
		if ( listeners && listeners.length > 1 )
			throw 'ERR_MULTIPLE_LISTENERS';
		
		if ( !listeners || !listeners.length ) {
			if ( null == self._eventSink )
				throw 'ERR_NO_LISTENER';
			
			return self._eventSink( type, data );
		}
		
		const lId = listeners[ 0 ];
		const listener = self.eventListeners[ lId ];
		return listener( data );
	}
	
})( library.component );

//SubView
(function( ns, undefined ) {
	ns.SubView = function( conf ) {
		if ( !( this instanceof ns.SubView ))
			return new ns.SubView( conf );
		
		const self = this;
		self.parent = conf.parent;
		self.type = conf.type;
		self.onloaded = conf.loaded || null;
		self.onready = conf.ready || null;
		self.subscriber = {};
		
		self.init();
	}
	
	ns.SubView.prototype.init = function() {
		const self = this;
		self.parent.on( self.type, handleMessage );
		
		function handleMessage( msg ) { self.handleMessage( msg ); }
	}
	
	ns.SubView.prototype.on = function( event, handler ) {
		const self = this;
		self.subscriber[ event ] = handler;
	}
	
	ns.SubView.prototype.off = function( event ) {
		const self = this;
		if ( self.subscriber[ event ])
			delete self.subscriber[ event ];
	}
	
	ns.SubView.prototype.allOff = function() {
		const self = this;
		self.subscriber = {};
	}
	
	ns.SubView.prototype.close = function() {
		const self = this;
		if ( self.parent.off )
			self.parent.off( self.type );
		if ( self.parent.release )
			self.parent.release( self.type );
		
		delete self.onloaded;
		delete self.onready;
		delete self.subscriber;
	}
	
	ns.SubView.prototype.handleMessage = function( msg ) {
		const self = this;
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
		const self = this;
		if ( msg.type == 'loaded' && self.onloaded ) {
			self.onloaded( msg.data );
			return;
		}
		
		if ( msg.type == 'ready' && self.onready ) {
			self.onready( msg.data );
			return;
		}
	}
	
	ns.SubView.prototype.send = function( msg ) {
		const self = this;
		var wrap = {
			type : self.type,
			data : msg
		};
		
		self.parent.send( wrap );
	}
})( library.component );


// IDENTITY
(function( ns, undefined ) {
	ns.Identity = function( conf ) {
		const self = this;
		
		self.init( conf );
	}
	
	// Public
	
	ns.Identity.prototype.updateAvatar = function( avatar ) {
		const self = this;
		self.avatar = avatar;
		if ( self.fupConf )
			self.fupConf.Image = avatar;
	}
	
	// Private
	
	ns.Identity.prototype.avatar    = '../gfx/avatar_blue.png';
	ns.Identity.prototype.avatarAlt = '../gfx/avatar_grey.png';
	
	ns.Identity.prototype.init = function( conf ) {
		const self = this;
		let id = null;
		try {
			id = JSON.parse( JSON.stringify( conf ));
		} catch( ex ) {
			console.log( 'Identity.ini - failed to copy id', conf );
			return;
		}
		
		if ( id.UniqueID || id.ID )
			self.fromFCUser( id );
		else
			self.fromIdentity( id );
		
	}
	
	ns.Identity.prototype.fromFCUser = function( conf ) {
		const self = this;
		self.fupConf = conf;
		self.fupId   = conf.ID;
		self.fUserId = conf.UniqueID;
		self.name    = library.tool.htmlDecode( conf.FullName );
		self.alias   = conf.Name;
		self.email   = conf.Email;
		self.avatar  = conf.Image;
		self.level   = conf.Level;
	}
	
	ns.Identity.prototype.fromIdentity = function( conf ) {
		const self = this;
		self.fupConf = {
			ID       : conf.fupId,
			UniqueID : conf.fUserId,
			FullName : conf.name,
			Name     : conf.alias,
			Email    : conf.email,
			Image    : conf.avatar,
			Level    : conf.level,
		};
		
		self.fupId   = conf.fupId;
		self.fUserId = conf.fUserId;
		self.name    = conf.name;
		self.alias   = conf.alias;
		self.email   = conf.email;
		self.avatar  = conf.avatar;
		self.level   = conf.level;
	}
	
})( library.component );

/* Filter */
(function( ns, undefined ) {
	ns.Filter = function() {
		const self = this;
	}
	
	ns.Filter.prototype.filter = function( filter, pool ) {
		const self = this;
		return self.baseFilter( filter, pool );
	}
	
	ns.Filter.prototype.inverseFilter = function( filter, pool ) {
		const self = this;
		return self.baseFilter( filter, pool, true );
	}
	
	// Private
	
	ns.Filter.prototype.baseFilter = function( filter, pool, inverse ) {
		const filterRX = new RegExp( filter, 'i' );
		inverse = inverse || false;
		
		if ( !pool || !pool.length )
			return [];
		
		return pool.filter( item => {
			if ( item.name.match( filterRX ))
				return !inverse;
			
			if ( item.email && item.email.match( filterRX ))
				return !inverse;
			
			if ( item.alias && item.alias.match( filterRX ))
				return !inverse;
			
			return inverse;
		});
	}
	
})( library.component );

/*
	IdCahce
*/
(function( ns, undefined ) {
	ns.IdCache = function( parentConn, identities ) {
		const self = this;
		library.component.EventEmitter.call( self, eSink );
		self.conn = null
		self.ids = {}
		self.fIds = {}
		self.idList = []
		self.fIdList = []
		self.loading = {}
		
		self.init( parentConn, identities );
		
		function eSink( ...args ) {
			console.log( 'IdCache, no handler for', args );
		}
	}
	
	ns.IdCache.prototype = Object.create(
		library.component.EventEmitter.prototype );
	
	// Public
	
	ns.IdCache.prototype.close = function() {
		const self = this;
		self.conn.close();
		delete self.conn;
		delete self.ids;
		delete self.idList;
		self.closeEventEmitter();
	}
	
	ns.IdCache.prototype.get = function( clientId ) {
		const self = this;
		return new Promise(( resolve, reject ) => {
			if ( 'string' != typeof( clientId )) {
				console.trace( 'IdCache.get - invalid clientId', clientId );
				resolve( null );
				return;
			}
			
			let id = self.ids[ clientId ];
			if ( id ) {
				resolve( id );
				return;
			}
			
			let loader = self.loading[ clientId ];
			if ( !loader ) {
				loader = get( clientId );
				self.loading[ clientId ] = loader;
			}
			
			loader
				.then( idBack )
				.catch( idSad );
			
			function get( cId ) {
				const req = {
					type : 'get',
					data : cId,
				};
				return self.conn.request( req );
			}
			
			function idBack( id ) {
				clear( clientId );
				const frozen = self.add( id );
				resolve( frozen );
			}
			
			function idSad( err ) {
				clear( clientId );
				console.log( 'IdCache.get err', err );
				reject( 'ERR_ERR_ERR' );
			}
			
			function clear( cId ) {
				delete self.loading[ cId ];
			}
		});
	}
	
	ns.IdCache.prototype.getList = function( list ) {
		const self = this;
		return new Promise(( resolve, reject ) => {
			if ( !list || !list.length ) {
				resolve([ ]);
				return;
			}
			
			const known = [];
			const unknown = [];
			list.forEach( cId => {
				let id = self.ids[ cId ];
				if ( id )
					known.push( id );
				else
					unknown.push( cId );
			});
			
			if ( known.length === list.length ) {
				resolve( known );
				return;
			}
			
			let loaded = [];
			Promise.all( unknown.map( get ))
				.then( loadBack )
				.catch( e => {
					console.log( 'IdCache.getList, load err', e );
				});
			
			function loadBack( idsBack ) {
				loaded = idsBack.filter( id => !!id );
				const complete = known.concat( loaded );
				resolve( complete );
			}
			
			function get( cId ) {
				return self.get( cId );
			}
			
		});
	}
	
	ns.IdCache.prototype.update = function( update ) {
		const self = this;
		const cId = update.clientId;
		let current = self.ids[ cId ];
		if ( !current ) {
			self.get( cId );
			return;
		}
		
		if ( current.lastUpdate > update.lastUpdate ) {
			return null;
		}
		
		const key = update.key;
		const value = update.value;
		const str = JSON.stringify( current );
		const fresh = JSON.parse( str );
		fresh[ key ] = value;
		const frozen = self.add( fresh );
		self.emit( 'update', frozen, key );
	}
	
	ns.IdCache.prototype.refresh = async function() {
		const self = this;
		const timeMap = {};
		self.idList.forEach( cId => {
			const id = self.ids[ cId ];
			timeMap[ cId ] = id.lastUpdate;
		});
		
		const refresh = {
			type : 'refresh',
			data : timeMap,
		}
		
		let updated = null;
		try {
			updated = await self.conn.request( refresh )
		} catch( ex ) {
			console.log( 'IdCache.refresh - request fail', ex );
			return null;
		}
		
		if ( !updated || !updated.length )
			return;
		
		updated.forEach( id => self.diff( id ));
	}
	
	ns.IdCache.prototype.diff = function( update ) {
		const self = this;
		if ( null == update )
			return;
		
		const cId = update.clientId;
		const curr = self.ids[ cId ];
		if ( !curr ) {
			self.add( update );
			return;
		}
		
		//curr.lastUpdate = update.lastUpdate; // we dont want this one to trigger an update;
		const tests = Object.keys( update );
		const changes = tests.filter( key => {
			if ( 'lastUpdate' == key )
				return false;
			
			if ( 'fLastUpdate' == key )
				return false;
			
			return update[ key ] !== curr[ key ];
		});
		
		if ( !changes.length ) // wat
			return;
		
		const frozen = self.add( update );
		changes.forEach( key => {
			self.emit( 'update', frozen, key );
		});
	}
	
	ns.IdCache.prototype.read = function( clientId ) {
		const self = this;
		return self.ids[ clientId ];
	}
	
	ns.IdCache.prototype.readList = function( clientIdList ) {
		const self = this;
		if ( !clientIdList )
			clientIdList = Object.keys( self.ids );
		
		const idList = clientIdList.map( cId => self.ids[ cId ]);
		return idList;
	}
	
	ns.IdCache.prototype.getByFId = async function( fUserId ) {
		const self = this
		const id = self.fIds[ fUserId ]
		if ( null == id )
			throw 'ERR_NO_ID'
		else
			return id
	}
	
	// Pri<ate
	
	ns.IdCache.prototype.init = function( parentConn, identities ) {
		const self = this;
		self.conn = new library.component.RequestNode( 'identity', parentConn );
		self.conn.on( 'add', e => self.add( e ));
		self.conn.on( 'update', e => self.update( e ));
		
		if ( !identities )
			return;
		
		self.ids = identities;
		self.idList = Object.keys( identities );
	}
	
	ns.IdCache.prototype.add = function( id ) {
		const self = this;
		if ( !id || !id.clientId )
			return;
		
		const frozen = Object.freeze( id )
		const cId = frozen.clientId
		const fId = frozen.fUserId
		if ( !fId )
			console.log( 'IdCache.add - no fid', id )
		
		const inIds = !!self.ids[ cId ]
		if ( !inIds )
			self.idList.push( cId )
		
		const inFIds = !!self.fIds[ fId ]
		if ( !inFIds )
			self.fIdList.push( fId )
		
		self.ids[ cId ] = frozen
		self.fIds[ fId ] = frozen
		
		return frozen
	}
	
	ns.IdCache.prototype.remove = function( cId ) {
		const self = this;
	}
	
})( library.component );


// CallStatus
(function( ns, undefined ) {
	ns.CallStatus = function( containerId ) {
		const self = this;
		self.containerId = containerId;
		self.statusKlass = '';
		library.component.EventEmitter.call( self );
		
		self.init();
	}
	
	ns.CallStatus.prototype = Object.create( 
		library.component.EventEmitter.prototype );
	
	// Public
	
	ns.CallStatus.prototype.setUserLive = function( isLive ) {
		const self = this;
		if ( self.userLive === isLive )
			return;
		
		self.userLive = isLive;
		self.update( 'user' );
	}
	
	ns.CallStatus.prototype.setContactLive = function( isLive ) {
		const self = this;
		if ( self.contactLive === isLive )
			return;
		
		self.contactLive = isLive;
		self.update( 'contact' );
	}
	
	ns.CallStatus.prototype.close = function() {
		const self = this;
		const el = self.el;
		delete self.el;
		if ( el )
			el.parentNode.removeChild( el );
		
		delete self.containerId;
		self.closeEventEmitter();
	}
	
	// Pri>ate
	
	ns.CallStatus.prototype.init = function() {
		const self = this;
		if ( !hello.template )
			throw new Error( 'hello.template not available' );
		
		const parent = document.getElementById( self.containerId );
		if ( !parent )
			throw new Error( 'container not found' );
		
		const elId = friendUP.tool.uid( 'call' );
		const conf = {
			id : elId,
		};
		self.el = hello.template.getElement( 'call-status-tmpl', conf );
		parent.appendChild( self.el );
		self.status = self.el.querySelector( '.call-status' );
		//self.statusIcon = self.status.querySelector( 'i' );
		self.inc = self.el.querySelector( '.call-incoming' );
		self.acceptVideo = self.inc.querySelector( '.accept-video' );
		self.acceptAudio = self.inc.querySelector( '.accept-audio' );
		self.out = self.el.querySelector( '.call-outgoing' );
		self.live = self.el.querySelector( '.call-live' );
		
		self.acceptVideo.addEventListener( 'click', startVideo, false );
		self.acceptAudio.addEventListener( 'click', startAudio, false );
		
		self.current = null;
		
		self.out.addEventListener( 'click', outClick, false );
		
		function outClick( e ) {
			e.preventDefault();
			e.stopPropagation();
			self.emit( 'show' );
		}
		
		function startVideo( e ) {
			e.preventDefault();
			e.stopPropagation();
			self.emit( 'video' );
		}
		
		function startAudio( e ) {
			e.preventDefault();
			e.stopPropagation();
			self.emit( 'audio' );
		}
	}
	
	ns.CallStatus.prototype.update = function( from ) {
		const self = this;
		self.clearCurrent();
		if ( !self.userLive && !self.contactLive ) {
			self.setInactive();
			return;
		}
		
		/*
		if ( self.userLive && self.contactLive ) {
			self.setLive();
			return;
		}
		*/
		
		if ( self.userLive ) {
			self.setOutgoing();
			return;
		}
		
		if ( self.contactLive )
			if ( 'contact' === from )
				self.setIncoming( true );
			else
				self.setIncoming();
	}
	
	ns.CallStatus.prototype.setInactive = function() {
		const self = this;
		self.el.classList.toggle( 'hidden', true );
		//self.status.classList.toggle( 'hidden', true );
	}
	
	ns.CallStatus.prototype.setIncoming = function( notify ) {
		const self = this;
		if ( notify )
			self.emit( 'notify', true );
		
		self.setStatus();
		self.inc.classList.toggle( 'hidden', false );
		self.current = self.inc;
	}
	
	ns.CallStatus.prototype.setOutgoing = function() {
		const self = this;
		self.setStatus();
		self.out.classList.toggle( 'hidden', false );
		self.current = self.out;
	}
	
	ns.CallStatus.prototype.setLive = function() {
		const self = this;
		self.setStatus();
	}
	
	ns.CallStatus.prototype.setStatus = function( status ) {
		const self = this;
		self.el.classList.toggle( 'hidden', false );
	}
	
	ns.CallStatus.prototype.clearCurrent = function() {
		const self = this;
		if ( self.current )
			self.current.classList.toggle( 'hidden', true );
		
		self.current = null;
	}
	
})( library.component );

(function( ns, undefined ) {
	ns.MultiLog = function( opts ) {
		const self = this
		
		self.init( opts )
	}
	
	 // public
	 
	 ns.MultiLog.prototype.log = function( ...inn ) {
	 	const self = this
	 	if ( self.toStrings )
	 		self.chopToStrings( inn )
	 	else
	 		console.log( ...inn )
	 }
	 
	 ns.MultiLog.prototype.trace = function() {
	 	
	 }
	 
	 // private
	
	ns.MultiLog.prototype.init = function( opts ) {
		const self = this
		console.log( 'ML.init', {
			dt   : window.View.deviceType,
			fapp : window.View.friendApp,
		})
		
		const dev = window.View.deviceType || 'DESKTOP'
		self.toStrings = ( dev !== 'DESKTOP' )
		
		if ( opts?.alwaysChop )
			self.toStrings = true
		
		console.log( 'ML.init toStrings', self.toStrings )
	}
	
	ns.MultiLog.prototype.chopToStrings = function( inn ) {
		const self = this
		let firstArg = null
		let open = false
		inn.forEach( arg => {
			console.log( 'chopToStrings', inn )
			if ( null == firstArg ) {
				firstArg = arg
			} else {
				console.group()
				open = true
			}
			
			const isBasic = (( typeof arg == 'string' ) || ( typeof arg == 'number' ))
			if ( isBasic ) {
				self.outputStr( arg )
				return
			}
			
			self.expandItem( arg )
		})
		
		if ( open )
			console.groupEnd()
		
	}
	
	ns.MultiLog.prototype.outputStr = function( arg ) {
		const self = this
		arg = String( arg )
		if ( arg.length < 100 ) {
			console.log( arg )
			return
		}
		
		const out = arg.split( ',' )
		console.group( 'split' )
		console.log( ...out )
		console.groupEnd()
	}
	
	ns.MultiLog.prototype.expandItem = function( item ) {
		const self = this
		console.log( 'expandITem', item )
		if ( 'array' == typeof item )
			self.expandArr( item )
		else
			self.expandObj( item )
	}
	
	ns.MultiLog.prototype.expandArr = function( arr ) {
		const self = this
		//console.log( 'expandArr', arr )
		console.log( '[' )
		console.group( '[' )
		arr.forEach( item => {
			self.expandItem( item )
		})
		console.groupEnd( ']' )
		console.log( ']' )
	}
	
	ns.MultiLog.prototype.expandObj = function( obj ) {
		const self = this
		console.group()
		if ( null == obj ) {
			console.log( 'nullfined' )
			console.groupEnd()
			return
		}
		
		const str = notCirc( obj )
		if ( str )
			self.outputStr( str )
		else {
			const str = objToString( obj )
			console.log( '{' )
			self.outputStr( str )
			console.log( '}' )
		}
		console.groupEnd()
		
		function notCirc( thing ) {
			try {
				str = JSON.stringify( obj )
			} catch( ex ) {
				return false
			}
			
			return str
		}
		
		function objToString ( obj ) {
			let str = ''
			for ( const [ p, val ] of Object.entries( obj )) {
				str += `${p} : ${val}\n`
			}
			return str
		}
	}
	
})( library.component );
