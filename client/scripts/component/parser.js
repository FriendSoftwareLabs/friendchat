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
var friendUP = window.friendUP || {};
var hello = window.hello || {};

library.component = library.component || {};
library.component.parse = library.component.parse || {};


// LEXER
(function( ns, undefined ) {
	ns.Lexer = function() {
		if ( !( this instanceof ns.Lexer ))
			return new ns.Lexer();
		
		var self = this;
		self.init();
	}
	
	ns.Lexer.prototype.init = function() {
		var self = this;
		if ( window.marked )
			window.marked.setOptions({
				sanitize : true,
			});
	}
	
})( library.component.parse );


// PARSER
(function( ns, undefined) {
	ns.Parser = function() {
		if( !( this instanceof ns.Parser ))
			return new ns.Parser();
		
		var self = this;
		self.parser = {};
		self.parseOrder = [];
		
		self.init();
	}
	
	ns.Parser.prototype.work = function( str ) {
		var self  = this;
		if ( !self.parseOrder.length ) {
			console.log( 'no parsers registered' );
			return;
		}
		
		if ( 'number' === typeof( str))
			str = str.toString();
		
		if ( 'string' !== typeof( str ))
			return;
		
		//
		str = breakTags( str );
		
		// do the actual thing
		var parts = str.match( /(\S+|\s+)/g );
		var result = '';
		if( parts )
		{
			result = parts.map( parse );
			result = result.join( '' );
		}
		
		
		// markdown ?
		if ( window.marked ) {
			console.log( 'marked found' );
			result = window.marked( result );
		}
		
		return result;
		
		function parse( part ) {
			var parsed = null;
			var parseOrderIndex = 0;
			
			do {
				var parserId = self.parseOrder[ parseOrderIndex ];
				if ( !parserId )
					break;
				
				var parser = self.parser[ parserId ];
				parsed = parser.process( part );
				parseOrderIndex++;
			} while ( !parsed );
			
			return parsed || part;
		}
		
		function breakTags( str ) {
			str = str.replace( /</g, '&lt;' );
			str = str.replace( />/g, '&gt;' );
			return str;
		}
	}
	
	ns.Parser.prototype.moveParserForward = function( id ) {
		var self = this;
		var currentIndex = self.parseOrder.indexOf( id );
		if ( currentIndex === -1 ) {
			console.log( 'parser.moveForward - invalid id' );
			return;
		}
		
		self.parseOrder.splice( currentIndex, 1 );
		self.parseOrder.splice( currentIndex - 1, 0, id );
	}
	
	ns.Parser.prototype.moveParserBack = function( id ) {
		var self = this;
		console.log( 'parser.moveBack - NYI' );
	}
	
	ns.Parser.prototype.use = function( id, conf ) {
		var self = this;
		var constructor = library.component.parse[ id ];
		if ( !constructor ) {
			console.log( 'could not use, invalid parser id: ', id );
			return;
		}
		
		var newParser = new constructor( conf );
		newParser.id = id;
		
		self.parser[ id ] = newParser;
		self.parseOrder.push( id );
	}
	
	ns.Parser.prototype.remove = function( id ) {
		var self = this;
		var idIndex = self.parseOrder.indexOf( id );
		if ( idIndex === -1 ) {
			console.log( 'cannot remove, invalid parser id', id );
			return;
		}
		
		self.parseOrder = self.parseOrder.splice( idIndex, 1 );
	}
	
	ns.Parser.prototype.init = function() {
		var self = this;
		
	}
	
})( library.component.parse );


// PARSE base model
(function( ns, undefined ) {
	ns.Parse = function() {
		if ( !( this instanceof ns.Parse ) )
			return new ns.Parse();
		
		var self = this;
		self.id = null; // text string to identify the parser
	}
	
	ns.Parse.prototype.process = function( str ) {
		var self = this;
		console.log( 'basemodel.Parse - please implement - ' + str );
		return str;
	}
	
	ns.Parse.prototype.escape = function( str ) {
		return str.replace( /[-\/\\^$*+?.()|[\]{}]/g, "\\$&" );
	}
	
})( library.component.parse );

// WsToEntity
// whitespace to html entity conversion
(function( ns, undefined ) {
	ns.WsToEntity = function() {
		if ( !( this instanceof ns.WsToEntity ))
			return new ns.WsToEntity();
		
		var self = this;
		ns.Parse.call( self );
		
		self.id = 'WsToEntity';
		self.init();
	}
	
	ns.WsToEntity.prototype = Object.create( ns.Parse.prototype );
	
	ns.WsToEntity.prototype.init = function() {
		var self = this;
		self.spRX = new RegExp( '\x20', 'g' );
		self.rnRX = new RegExp( '(\\r\\n|\\r|\\n)', 'g' );
		self.tabRX = new RegExp( '\x09', 'g' );
		self.matchRX = new RegExp( '(\x20|\x09|\\r\\n|\\r|\\n)', '' );
	}
	
	ns.WsToEntity.prototype.process = function( str ) {
		var self = this;
		var match = self.matchRX.exec( str );
		if ( !match )
			return null;
		
		str = str.replace( self.rnRX, '<br>' );
		str = str.replace( self.spRX, '&thinsp;' );
		str = str.replace( self.tabRX, '&emsp;' );
		return str;
	}
	
})( library.component.parse );


// LINKSTD - simple url linkifier
(function( ns, undefined ) {
	ns.LinkStd = function() {
		if ( !( this instanceof ns.LinkStd ))
			return new ns.LinkStd();
		
		ns.Parse.call( this );
		var self = this;
		
		self.id = 'LinkStd';
		self.urlRX = null;
		self.prefixRX = null;
		
		self.init();
	}
	
	ns.LinkStd.prototype = Object.create( ns.Parse.prototype );
	
	ns.LinkStd.prototype.init = function() {
		var self = this;
		self.buildUrlRX();
		self.buildPrefixRX();
	}
	
	ns.LinkStd.prototype.process = function( str ) {
		var self = this;
		var match = self.urlRX.exec( str );
		if ( match )
			return makeLink( match[ 0 ]);
		
		return null;
		
		function makeLink( url ) {
			var link = document.createElement( 'a' );
			link.innerText = url;
			link.href = makeAbsoluteUrl( url );
			link.target = '_blank';
			return link.outerHTML;
		}
		
		function makeAbsoluteUrl( url ) {
			var match = url.match( self.prefixRX );
			if ( !match ) {
				url = 'https://' + url;
			}
			
			return url;
		}
	}
	
	ns.LinkStd.prototype.buildUrlRX = function() {
		var self = this;
		// taken from
		// https://gist.github.com/dperini/729294
		// MIT license
		// modified to suit me special needs
		self.urlRX = new RegExp(
			"^(" +
			// protocol identifier
			"(?:(?:https?|ftp|wss?)://)?" +
			// user:pass authentication
			"(?:\\S+(?::\\S*)?@)?" +
			"(?:" +
			// IP address exclusion
			// private & local networks
			"(?!(?:10|127)(?:\\.\\d{1,3}){3})" +
			"(?!(?:169\\.254|192\\.168)(?:\\.\\d{1,3}){2})" +
			"(?!172\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.\\d{1,3}){2})" +
			// IP address dotted notation octets
			// excludes loopback network 0.0.0.0
			// excludes reserved space >= 224.0.0.0
			// excludes network & broacast addresses
			// (first & last IP address of each class)
			"(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])" +
			"(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}" +
			"(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))" +
			"|" +
			// host name
			"(?:(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)" +
			// domain name
			"(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*" +
			// TLD identifier
			"(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))" +
			")" +
			// port number
			"(?::\\d{2,5})?" +
			// resource path
			"(?:/\\S*)?" +
			")$"
			, "i"
		);
	}
	
	ns.LinkStd.prototype.buildPrefixRX = function() {
		var self = this;
		self.prefixRX = new RegExp( '(^https?://)', 'ig' );
	}
	
})( library.component.parse );


// NL2BR
// DEPRECATED - use WsToEntity instead, unless you have special needs
(function( ns, undefined ) {
	ns.NL2BR = function() {
		if ( !( this instanceof ns.NL2BR ))
			return new ns.EsacpeHTMLTags();
		
		ns.Parse.call( this );
		
		var self = this;
		self.id = 'NL2BR';
		self.rx = null;
		self.init();
	}
	
	ns.NL2BR.prototype = Object.create( ns.Parse.prototype );
	
	ns.NL2BR.prototype.process = function( str ) {
		var self = this;
		
		if ( !str || !str.length || 'string' !== typeof( str ))
			return null;
		
		if ( !str.match( self.rx ))
			return null;
			
		str = str.replace( self.rx, '<br>' );
		return str;
	}
	
	ns.NL2BR.prototype.init = function() {
		var self = this;
		self.buildRX();
	}
	
	ns.NL2BR.prototype.buildRX = function() {
		var self = this;
		self.rx = new RegExp( '(\\r\\n|\\r|\\n)', 'ig' );
	}
	
})( library.component.parse );


// BREAK LONG STRINGS
(function( ns, undefined ) {
	ns.BreakLongStrings = function( maxLength ) {
		if ( !( this instanceof ns.BreakLongStrings ))
			return new ns.BreakLongStrings( maxLength );
		
		var self = this;
		self.id = 'breakLongStrings';
		self.maxLength = maxLength || 10;
		self.partLength = null;
		self.RX = null;
		
		self.init();
	}
	
	ns.BreakLongStrings.prototype.init = function() {
		var self = this;
		self.partLength = Math.ceil( self.maxLength / 2 );
		self.RX = self.buildRX();
	}
	
	ns.BreakLongStrings.prototype.buildRX = function() {
		var self = this;
		// /([^\\s-]{n})([^\\s-]{n})/g
		var rxString = '([^\\s-]{' + self.partLength + '})([^\\s-]{' + self.partLength + '})';
		return new RegExp( rxString, '' );
	}
	
	ns.BreakLongStrings.prototype.process = function( str ) {
		var self = this;
		return String( str ).replace( self.RX, '$1&shy;$2' ).toString();
	}
	
})( library.component.parse );


// EMOJII parser
(function( ns, undefined ) {
	ns.Emojii = function( emojiiMap ) {
		if ( !( this instanceof ns.Emojii ))
			return new ns.Emojii( emojiiMap );
		
		ns.Parse.call( this );
		var self = this;
		self.emojiiMap = emojiiMap;
		
		self.init();
	}
	
	ns.Emojii.prototype = Object.create( ns.Parse.prototype );
	
	ns.Emojii.prototype.init = function() {
		var self = this;
		self.id = 'Emojii';
		self.transformMap();
		self.buildRX();
	}
	
	ns.Emojii.prototype.transformMap = function() {
		var self = this;
		var notEyesRX = /(:.*:)/;
		var emoKeys = Object.keys( self.emojiiMap );
		emoKeys.forEach( escapeThings );
		//emoKeys.forEach( addNose );
		
		function escapeThings( emoKey ) {
			var escapeKey = escaped( emoKey );
			self.emojiiMap[ escapeKey ] = self.emojiiMap[ emoKey ];
			
			function escaped( str ) {
				var lookup = {
					'>' : '&gt;',
					'<' : '&lt;'
				};
				
				for ( var escKey in lookup )
					str = str.split( escKey ).join( lookup[ escKey ]);
				
				return str;
			}
		}
		
		function addNose( key ) {
			if ( key.match( notEyesRX ))
				return;
			
			var withNose = key.split(':').join(':-');
			self.emojiiMap[ withNose ] = self.emojiiMap[ key ];
		}
	}
	
	ns.Emojii.prototype.buildRX = function() {
		var self = this;
		var emoKeys = Object.keys( self.emojiiMap );
		emoKeys.sort( byLength );
		emoKeys = emoKeys.map( self.escape );
		var flags = 'i';
		var start = '^(';
		var end = ')$';
		var search = emoKeys.join( '|' );
		self.RX = new RegExp( start + search + end, flags );
		
		function byLength( a, b ) {
			return b.length - a.length;
		}
	}
	
	ns.Emojii.prototype.process = function( str ) {
		var self = this;
		str = str.toString();
		var match = self.RX.exec( str );
		
		if( !match )
			return null;
		
		return replace( match[ 0 ] );
		
		function replace( match ) {
			var key = match;
			var emoClass = self.emojiiMap[ key ]
				|| self.emojiiMap[ key.toLowerCase() ]
				|| self.emojiiMap[ key.toUpperCase() ];
				
			var container = document.createElement( 'i' );
			container.classList.add( 'pictograph' );
			container.classList.add( emoClass );
			const color = getRandColor();
			trySetColor( container, color );
			
			function trySetColor( el, color ) {
				try {
					el.style.color = '#' + color;
				} catch ( e ) {
					console.log( 'failed to set style on emoji', {
						el : el,
						ex : e });
				}
			}
			
			return container.outerHTML;
		}
		
		function getRandColor() {
			var parts = [ 'b5', '00' ];
			var rand = Math.random() * 256;
			rand = Math.floor( rand );
			rand = rand.toString( 16 ); // .toString() is magic
			if ( 1 === rand.length )
				rand = '0' + rand;
			
			parts.push( rand );
			const color = parts.reduce( randSide );
			return color;
			
			function randSide( a, b ) {
				var left = !!( Math.random() < 0.5 );
				if ( left )
					return a + b;
				else
					return b + a;
			}
		}
	}
	
})( library.component.parse );
