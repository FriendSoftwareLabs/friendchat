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
		key : self.keyUpdate || self.keyCurr,
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