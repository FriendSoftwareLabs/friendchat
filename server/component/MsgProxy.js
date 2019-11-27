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

var util = require( 'util' );
var events = require( './Emitter' );
var log = require( './Log')( 'MsgProxy' );

var ns = {};

// Useful for passing into an unsafe environment where you dont want
// to expose the connection object ( like a webscoket )
ns.MsgProxy = function( conf ) {
	if ( !( this instanceof ns.MsgProxy ))
		return new ns.MsgProxy( conf );
	
	const self = this;
	self.moduleId = conf.moduleId;
	events.RequestNode.call( self, conf.moduleId, null );
	self.sendMsg = conf.send;
}

util.inherits( ns.MsgProxy, events.RequestNode );

ns.MsgProxy.prototype.receiveMsg = function( msg, socketId ) {
	const self = this;
	self._handleEvent.apply( self, arguments );
	//self.emit( msg.type, msg.data, socketId );
}

/*
ns.MsgProxy.prototype.send = function( msg, socketId, altId ) {
	const self = this;
	log( 'send', msg );
	if ( !msg.data ) {
		try {
			throw new Error( 'null data' );
		} catch( err ) {
			log( 'null data', msg, 3 );
			log( 'null data trace', err.stack || err );
		}
	}
	
	if ( !self.sendMsg )
		return;
	
	var wrap = null;
	var id = altId || self.moduleId;
	if ( !id )
		wrap = msg;
	else
		wrap = {
			type : id,
			data : msg,
		};
	
	self.sendEvent( wrap, socketId );
}
*/

ns.MsgProxy.prototype.sendEvent = function( e, sId ) {
	const self = this;
	if ( !self.sendMsg )
		return;
	
	self.sendMsg( e, sId );
}

module.exports = ns.MsgProxy;

