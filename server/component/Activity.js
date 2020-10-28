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
var log = require( './Log' )( 'Activity' );
//var DbAccount = require( './DbActivity' );
var events = require( './Emitter' );

var ns = {};

ns.Activity = function( onSend, db ) {
	const self = this;
	self.onSend = onSend;
	self.db = db;
	
	self.items = null;
	self.itemState = {};
	
	self.init();
}

// Public

ns.Activity.prototype.handle = function( ...args ) {
	const self = this;
	self.client.handle( ...args );
}

ns.Activity.prototype.close = function() {
	const self = this;
	if ( self.client )
		self.client.close();
	
	delete self.client;
	delete self.onSend;
	delete self.db;
	
}

// Privat3

ns.Activity.prototype.init = function() {
	const self = this;
	self.client = new events.RequestNode(
		'activity',
		self.onSend,
		aSink,
		null
	);
	
	self.loadHistory();
	
	self.client.on( 'load'    , ( ...args ) => self.handleLoad(    ...args ));
	self.client.on( 'message' , ( ...args ) => self.handleMessage( ...args ));
	self.client.on( 'live'    , ( ...args ) => self.handleLive(    ...args ));
	self.client.on( 'request' , ( ...args ) => self.handleRequest( ...args ));
	self.client.on( 'update'  , ( ...args ) => self.handleUpdate(  ...args ));
	self.client.on( 'remove'  , ( ...args ) => self.handleRemove(  ...args ));
	
	function aSink( ...args ) {
		log( 'aSink', args, 3 );
	}
}

ns.Activity.prototype.loadHistory = async function() {
	const self = this;
	const items = await self.db.getActivity();
	if ( null == items )
		self.items = {};
	else
		self.items = items;
}

ns.Activity.prototype.handleLoad = async function( req ) {
	const self = this;
	const res = {
		items : self.items,
		state : self.itemState,
	};
	return res;
}

ns.Activity.prototype.handleMessage = async function( msg, sourceId ) {
	const self = this;
	return await self.handleRoomEvent( 'message', msg, sourceId );
}

ns.Activity.prototype.handleLive = async function( live, sourceId ) {
	const self = this;
	return await self.handleRoomEvent( 'live', live, sourceId );
}

ns.Activity.prototype.handleRoomEvent = async function( type, event, sourceId ) {
	const self = this;
	//const opts = event.options;
	const fresh = self.checkIsFresh( event );
	if ( !fresh )
		return false;
	
	const wrap = {
		type : type,
		data : event,
	};
	const res = await self.setItem( wrap );
	if ( null == res )
		return false;
	
	self.client.send( res );
	return true;
}

ns.Activity.prototype.handleRequest = async function( req, sourceId ) {
	const self = this;
	const fresh = self.checkIsFresh( req );
	const id = req.id;
	
	const wrap = {
		type : 'request',
		data : req,
	};
	let res = await self.setItem( wrap );
	if ( null == res )
		return false;
	
	self.client.send( res );
	return id;
}

ns.Activity.prototype.handleResponse = async function( res, sourceId ) {
	const self = this;
	log( 'handleResponse', [ res, sourceId ]);
}

ns.Activity.prototype.handleUpdate = async function( uptd, sourceId ) {
	const self = this;
	const id = uptd.id;
	const opts = uptd.options;
	const unread = self.updateOptionNum( id, 'unread', opts );
	const mentions = self.updateOptionNum( id, 'mentions', opts );
	
	const res = {
		type : 'update',
		data : uptd,
	};
	self.client.send( res );
	return true;
}

ns.Activity.prototype.handleRemove = async function( itemId, sourceId ) {
	const self = this;
	const removed = await self.removeItem( itemId );
	if ( !removed )
		return null;
	
	const remove = {
		type : 'remove',
		data : itemId,
	};
	self.client.send( remove );
	return true;
}

ns.Activity.prototype.setItem = async function( event ) {
	const self = this;
	const type = event.type;
	const conf = event.data;
	const id = conf.id;
	const time = conf.timestamp;
	delete conf.options;
	delete conf.identity;
	self.items[ id ] = event;
	const eventStr = await self.db.setActivity( id, time, event );
	if ( !eventStr )
		return null;
	
	const freshEvent = JSON.parse( eventStr );
	return freshEvent;
}

ns.Activity.prototype.removeItem = async function( itemId ) {
	const self = this;
	const item = self.items[ itemId ];
	if ( null == item )
		return false;
	
	delete self.items[ itemId ];
	await self.db.removeActivity( itemId );
	return true;
}

ns.Activity.prototype.checkIsFresh = function( event ) {
	const self = this;
	const id = event.id;
	const ts = event.timestamp;
	const item = self.items[ id ];
	if ( null == item )
		return true;
	
	const conf = item.data;
	if ( ts > conf.timestamp )
		return true;
	
	return false;
}

ns.Activity.prototype.updateUnread = function( id, opts ) {
	const self = this;
	return self.updateOptionNum( id, 'unread', opts );
}

ns.Activity.prototype.updateMentions = function( id, opts ) {
	const self = this;
	return self.updateOptionNum( id, 'mentions', opts );
}

ns.Activity.prototype.updateOptionNum = function( id, key, opts ) {
	const self = this;
	const fresh = opts[ key ];
	if ( null == fresh )
		return null;
	
	let state = self.itemState[ id ];
	if ( null == state ) {
		state = {};
		self.itemState[ id ] = state;
	}
	
	const curr = state[ key ];
	
	if ( null == curr ) {
		state[ key ] = fresh;
		return 'broadcast';
	}
	
	if ( curr === fresh )
		return false;
	
	if ( 0 === fresh ) {
		state[ key ] = 0;
		return 'broadcast';
	}
	
	if ( curr < fresh ) {
		state[ key ] = fresh;
		return 'broadcast';
	}
	
	if ( curr > fresh ) {
		opts[ key ] = curr;
		return 'sender';
	}
	
}

module.exports = ns.Activity;
