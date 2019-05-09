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

var fs = require( 'fs' );
var log = require( './Log' )( 'TLSWatch' );

var ns = {};
ns.TLSWatch = function( conf ) {
	var self = this;
	self.keyPath = conf.keyPath;
	self.certPath = conf.certPath;
	self.onchange = conf.onchange;
	self.onerr = conf.onerr;
	
	self.keyCurr = null;
	self.certCurr = null;
	self.keyUpdate = false;
	self.certUpdate = false;
	
	self.init();
}

// 'Public'

ns.TLSWatch.prototype.acceptUpdate = function() {
	var self = this;
	self.keyCurr = self.keyUpdate || self.keyCurr;
	self.keyUpdate = null;
	
	self.certCurr = self.certUpdate || self.certCurr;
	self.certUpdate = null;
}

ns.TLSWatch.prototype.denyUpdate = function() {
	var self = this;
	self.keyUpdate = null;
	self.certUpdate = null;
	self.emitChange();
}

ns.TLSWatch.prototype.close = function() {
	var self = this;
	self.endWatch();
	
	self.keyCurr = null;
	self.certCurr = null;
	
	delete self.keyPath;
	delete self.certPath;
	delete self.onchange;
	delete self.onerr;
}

// Private

ns.TLSWatch.prototype.init = function() {
	var self = this;
	self.loadFile( self.keyPath, keyBack );
	function keyBack( data ) {
		self.keyUpdate = data;
		self.loadFile( self.certPath, certBack );
	}
	function certBack( data ) {
		self.certUpdate = data;
		if ( !self.keyUpdate || !self.certUpdate ) {
			self.emitError( 'missing cert or key' );
			return;
		}
		
		self.emitChange();
		self.startWatch();
	}
}

ns.TLSWatch.prototype.startWatch = function() {
	var self = this;
	self.keyWatch = fs.watch( self.keyPath, keyChange );
	self.certWatch = fs.watch( self.certPath, certChange );
	
	function keyChange( type, file ) {
		self.loadFile( self.keyPath, keyBack );
		function keyBack( data ) {
			if ( self.keyCurr === data )
				return;
			
			self.keyUpdate = data;
			self.emitChange();
		}
	}
	
	function certChange( type, file ) {
		self.loadFile( self.certPath, certBack );
		function certBack( data ) {
			if ( self.certCurr === data )
				return;
			
			self.certUpdate = data;
			self.emitChange();
		}
	}
}

ns.TLSWatch.prototype.endWatch = function() {
	var self = this;
}

ns.TLSWatch.prototype.emitChange = function() {
	var self = this;
	if ( !!self.keyUpdate !== !!self.certUpdate ) {
		log( 'emitChange - missing update, waiting' );
		return;
	}
	
	var bundle = {
		key  : self.keyUpdate || self.keyCurr,
		cert : self.certUpdate || self.certCurr,
	};
	self.onchange( bundle );
}

ns.TLSWatch.prototype.emitError = function( err ) {
	var self = this;
	self.onerr( err );
}

ns.TLSWatch.prototype.loadFile = function( path, callback ) {
	var self = this;
	var opt = { encoding : 'ascii' };
	fs.readFile( path, opt, fileBack );
	function fileBack( err, content ) {
		if ( err ) {
			log( 'fileBack - err', err );
			self.emitError( err );
			callback( false );
			return;
		}
		
		callback( content );
	}
}

module.exports = ns.TLSWatch;