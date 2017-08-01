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
var prefix = 'Hello > ';
var self = this;

var inspectOpt = getInspectOpt();

function toConsole( prefix, args ) {
	if ( typeof args[ 0 ] === 'string' ) {
		log( prefix + args[ 0 ] );
		args.shift();
		if ( args.length )
			logArgs( args );
		
		return true;
	}
	
	log( prefix );
	logArgs( args );
}

function log( str ) {
	console.log( str );
}

function logArgs( args ) {
	logObj.apply( self, args );
}

function logObj( obj, depth, showHidden, color ) {
	if ( typeof depth !== 'undefined' )
		var specialOpt = getInspectOpt( depth, showHidden, color );
	
	var opts = specialOpt || inspectOpt;
	console.log( util.inspect( obj, opts ));
}

function padding( prefix, args ) {
	var now = getTimeString();
	prefix = now + ' : ' + prefix;
	toConsole( prefix, args );
}

module.exports = function( module ) {
	var str = prefix + ( module ? module + ' > ' : '' );
	return function() {
		var args = Array.prototype.slice.call( arguments, 0 );
		padding( str, args );
	}
}

function getTimeString() {
	var now = new Date();
	var year = now.getFullYear();
	var month = now.getMonth() + 1;
	var day = now.getDate();
	var hours = now.getHours();
	var minutes = now.getMinutes();
	var seconds = now.getSeconds();
	var millis = now.getMilliseconds();
	return year
		+ '.' + pad( month )
		+ '.' + pad ( day )
		+ ' ' + pad( hours )
		+ ':' + pad( minutes )
		+ ':' + pad( seconds )
		+ ':' + pad( millis, true );
		
	function pad( arg, millis ) {
		var int = parseInt( arg );
		if ( millis ) {
			if ( int < 10 )
				return '00' + int;
			if ( int < 100 )
				return '0' + int;
		}
		
		if ( int < 10 )
			return '0' + int;
		
		return arg;
	}
}

function getInspectOpt( depth, showHidden, colors ) {
	var inspectObj = {
		depth : depth || 1,
		showHidden : showHidden || true,
		colors : colors || false,
	};
	return inspectObj;
}