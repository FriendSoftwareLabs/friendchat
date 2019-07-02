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

const log = require( './Log' )( 'Telegram' );
const uuid = require( './UuidPrefix' )( 'live' );
const events = require( './Emitter' );
const tls = require( 'tls' );
const util = require( 'util' );
const fs = require( 'fs' );

var ns = {};

ns.Telegram = function( clientConn, clientId ) {
	const self = this;
	self.id = clientId;
	self.type = 'telegram';
	self.client = clientConn;
	
	self.init();
}

// Public

// Private

ns.Telegram.prototype.init = function() {
	const self = this;
	log( 'init *______*' );
	self.client.on( 'connect', connect );
	
	self.client.send({
		type : 'initialize',
	});
	
	function connect( e, sId ) { self.handleConnect( e, sId ); }
}

ns.Telegram.prototype.handleConnect = function( conf, socketId ) {
	const self = this;
	log( 'handleConnect', {
		conf : conf,
		sId  : socketId,
	}, 3 );
}

module.exports = ns.Telegram;
