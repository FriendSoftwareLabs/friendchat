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
library.tool = library.tool || {};

(function( ns, undefined ) {
	ns.objectify = function( string ) {
		try {
			return JSON.parse(string);
		} catch (e) {
			return null;
		}
	}
	
	ns.stringify = function( obj ) {
		try {
			return JSON.stringify(obj);
		} catch (e) {
			return obj.toString(); // not a object? probably has .toString() then.. #YOLO 360 NO-SCOPE
		}
	}
	
	ns.getChatTime = function( timestamp ) {
		var time = new Date( timestamp );
		var timeString = '';
		if ( moreThanADayAgo( timestamp ))
			return justDate();
		
		return clockStamp();
		
		function clockStamp() {
			var timeStr = pad( time.getHours() )
			+ ':' + pad( time.getMinutes() )
			+ ':' + pad( time.getSeconds() );
			
			if ( isYesterday())
				timeStr = 'yesterday ' + timeStr;
			
			return timeStr;
		
			function pad( time ) {
				var str = time.toString();
				return str.length !== 1 ? str : '0' + str;
			}
			
			function isYesterday() {
				var now = new Date();
				var today = now.getDate();
				var date = time.getDate();
				return today !== date;
			}
		}
		
		function justDate( timestamp ) {
			var date = time.toLocaleDateString();
			return date;
		}
		
		
		function moreThanADayAgo( timestamp ) {
			var now = Date.now();
			var aDay = 1000 * 60 * 60 * 24;
			return !!(( now - aDay ) > timestamp );
		}
	}
	
	ns.randomNumber = function( length ) {
		return Math.floor( Math.random() * Math.pow( 10, 15 ));
	}
	
	ns.htmlDecode = function( str ) {
		var txt = document.createElement( 'textarea' );
		txt.innerHTML = str;
		return txt.value;
	}
	
	ns.buildDestination = function( protocol, host, port ) {
		protocol = getProtocol( protocol );
		port = getPort( port );
		host = getHost( host, !!port );
		var dest = protocol + host;
		if ( !!port )
			dest += port;
		
		return dest;
		
		function getProtocol( str ) {
			str = tryToString( str );
			if ( !str.length )
				return '';
			
			var found = str.match( /(https|http|wss|ws)/ );
			if ( !found )
				return '';
			
			str = found[ 0 ] + '://';
			return str;
		}
		
		function getHost( str, hasPort ) {
			str = tryToString( str );
			if( !str.length )
				throw new Error( 'buildDestination - invalid host' );
			
			if ( !hasPort )
				return str;
			
			str = str.split( /\/$/ )[ 0 ]; // splitting on / at the end of the string, basically removing it
			return str;
		}
		
		function getPort( str ) {
			str = tryToString( str );
			var parts = str.split( ':' );
			str = parts[ parts.length -1 ];
			if ( !str.length )
				return false;
			
			var isNumerical = str.match( /^[0-9]+$/ );
			if ( isNumerical )
				return ':' + str;
			
			if ( str[ 0 ] === '/' )
				return str;
			
			return '/' + str;
		}
		
		
		function tryToString( str ) {
			try {
				return str.toString();
			} catch ( e ) {
				return '';
			}
		}
		
	}
	
	ns.mergeObjects = function( dest, source ) {
		for ( var key in source )
			merge( dest, source, key );
		
		function merge( dest, source, key ) {
			var value = source[ key ];
			
			if ( !dest[ key ] ) {
				//console.log( 'no conflict, copy', key );
				dest[ key ] = source[ key ];
				return;
			}
			
			// not object ( including array )
			if ( typeof( value ) != 'object' || !value ) {
				//console.log( 'source is not an object:', value );
				dest[ key ] = value;
				return;
			}
			
			// array
			if ( value instanceof Array ) {
				//console.log( 'found array', value );
				dest[ key ] = value;
				return;
			}
			
			// object, transfer properties
			for ( var subKey in value ) {
				merge( dest[ key ], source[ key ], subKey );
			}
		}
	}
	
	ns.asyncRequest = function( config ) {
		var url = config.url;
		var port = config.port;
		var fn = 'XML' + 'Http' + 'Request'; // LOL? nei, spør sokken ( evnt hogne :p ).
		var req = new window[ fn ]();
		req.returned = false;
		req.onreadystatechange = stateChange;
		req.onerror = error;
		req.onload = success;
		req.open( config.verb, url, true );
		
		if( config.verb.toUpperCase() === 'POST' )
			req.setRequestHeader( 'Content-Type', 'application/json' );
		
		req.send( ns.stringify( config.data || {} ));
		return req;
		
		function stateChange( e ) {
			let readyState = e.target.readyState;
			/*
			if ( readyState === 1 )
				console.log( 'readyState 1', e );
			if ( readyState === 2 )
				console.log( 'readyState 2', e );
			if ( readyState === 3 )
				console.log( 'readyState 3', e );
			*/
			if ( readyState === 4 )
				checkResponse( e );
		}
		
		function checkResponse( e ) {
			if ( 200 !== e.target.status )
				error( e.target.status );
		}
		
		function success( res ) {
			if ( req.returned )
				return;
			
			req.returned = true;
			config.success( res.target.response );
		}
		
		function error( err ) {
			if ( req.returned )
				return;
			
			req.returned = true;
			config.error( err );
		}
	}
	
	ns.requestOverlay = function( request, callback, parentElement ) {
		var request = request;
		var callback = callback;
		var element = parentElement;
		
		init();
		
		function init() {
			var html = ns.template.get(
				'hello-request-overlay-tmpl',
				{ message : "¸¸♬·¯·♩¸¸♪·¯·♫¸¸ Loading ¸¸♬·¯·♩¸¸♪·¯·♫¸¸ "
			});
			
			element.insertAdjacentHTML( 'beforeend', html );
			var overlay = element.querySelector( '.request-overlay' );
			var overlayMessage = overlay.querySelector( '.overlay-message' );
			var overlaySpinner = overlay.querySelector( '.overlay-spinner');
			overlay.focus(); // remove possible form focus to prevent further submits from soneone spamming enter
			
			ns.request.send( request, requestHandler );
			
			function requestHandler( response ) {
				if ( !( response.success || response.status == 200 )) {
					var failHtml = getFailHtml( response );
					showMessage( response, failHtml );
					return;
				}
				
				if ( request.holdOnSuccess ) {
					var successHtml = getSuccessHtml( response );
					showMessage( response, successHtml );
					return;
				}
				
				overlay.parentNode.removeChild( overlay );
				callback( response );
			}
			
			function getFailHtml( response ) {
				var conf = {
					type : 'fail',
					message : response.message || 'something derped',
					buttonText : 'try again xoxo'
				};
				return ns.template.get( 'hello-request-message-tmpl', conf );
			}
			
			function getSuccessHtml( response ) {
				var conf = {
					type : 'success',
					message : response.message || 'success!',
					buttonText : 'okidoki'
				};
				return ns.template.get( 'hello-request-message-tmpl', conf );
			}
			
			function showMessage( response, html ) {
				overlayMessage.innerHTML = html;
				var button = overlayMessage.querySelector( 'button' );
				button.addEventListener( 'click', removeOverlay, false );
				function removeOverlay() {
					overlay.parentNode.removeChild( overlay );
					callback( response );
				}
			}
		}
	}
	
	ns.getName = function() {
		const self = this;
		const verb = [
			'fancy',
			'polite',
			'crouching',
			'hidden',
			'tastefull',
			'gorgeous',
			'clever',
			'elegant',
			'left-handed',
			'sudden',
			'post-modern',
			'pointy',
			'prancing',
			'tricky',
			'magic',
			'secure',
		];
		const subject = [
			'carpet',
			'stick',
			'goat',
			'waitinglist',
			'chair',
			'flappy bits',
			'fan',
			'tiger',
			'dragon',
			'camel',
			'trumpet',
			'phone',
			'mushroom',
			'sieve',
		];
		
		const name = getRandom( verb ) + ' ' + getRandom( subject );
		return name;
		
		function getRandom( inArr ) {
			const scale = inArr.length;
			const rn = Math.random();
			const index = Math.floor( rn * scale );
			return inArr[ index ];
		}
	}
	
})( library.tool );