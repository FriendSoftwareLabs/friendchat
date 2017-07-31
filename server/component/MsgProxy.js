'use strict';

/*©agpl*************************************************************************
*                                                                              *
* Friend Unifying Platform                                                     *
* ------------------------                                                     *
*                                                                              *
* Copyright 2014-2016 Friend Software Labs AS, all rights reserved.            *
* Hillevaagsveien 14, 4016 Stavanger, Norway                                   *
* Tel.: (+47) 40 72 96 56                                                      *
* Mail: info@friendos.com                                                      *
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
	
	var self = this;
	events.Emitter.call( self );
	self.sendMsg = conf.send;
}

util.inherits( ns.MsgProxy, events.Emitter );

ns.MsgProxy.prototype.receiveMsg = function( msg, socketId ) {
	var self = this;
	self.emit( msg.type, msg.data, socketId );
}

ns.MsgProxy.prototype.send = function( msg, socketId, altId ) {
	var self = this;
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
	
	self.sendMsg( wrap, socketId );
}

module.exports = ns.MsgProxy;

