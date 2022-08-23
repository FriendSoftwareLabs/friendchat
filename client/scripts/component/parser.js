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

/*

Parser - takes a string as input, applies a predefined 
set of parsing units ( PU ) and returns the upated string.
Events can also be emitted, these happen after the
parser has returned.

Each PU is self contained, and can be enabled, disabled or 
updated through the Parser interface. It is identified 
with a unique string, these are the ones currently available:

- Emojii           : converts certain text into image elements
- LinkStd          : discovers links and converts them into <a> elements
- FriendPath       : discovers friend disk paths and converts them into <fp> elements
- WsToEntity       : Converts various whitespace to html
- NL2BR            : Replaces \r\n with a <br>
- BreakLongStrings : Splits long strings by inserting a tiny whitespace

Any new PU should be extended from the base 'Parse' object, to get some
functionality for free and ensure a consistent interface. Any new PU must be
defined in the library.component.parse namespace.

The order in wich the PUs are registered during runtime determines the order
in wich they are given the working string. PUs can be registered to receive
the full working string, or by default, they will be given one piece at a time,
split on whitespace.

PUs registered with the full length option run before the working string
is split and give the rest of the PUs. Any part of the string that is modified
by a PU is not passed to any following PU. When a PU modifies a piece it
returns the modified string. A PU that does nothing with the piece it was 
given must return null.

A PU can choose to emit an event for a given piece. This is an async operation
and happens after the Parser has returned. Register a listener with
the PUs type to receive events from it. Type can be some default or set
through PU config.

*/
(function( ns, undefined) {
	ns.Parser = function() {
		const self = this;
		library.component.EventEmitter.call( self );
		self.parsers = {};
		self.pieceOrder = [];
		self.fullOrder = [];
		
		self.init();
	}
	
	ns.Parser.prototype =
		Object.create( library.component.EventEmitter.prototype );
	
	// Public
	
	/* Listening to events
	
	Parser inherits the EventEmitter interface
	The TYPE of event to listen for must be set in the PU
	as a default or through config
	
	.on( type, handler ) to listen for all events of type
	.once( type, handler ) to listen for only the first event of type
	.release( type ) to stop listening for this type of events
	
	the handler will receive whatever data the PU emits
	
	*/
	
	/* use
	
	Register PUs to be used, in order. All full-length PUs run before
	the rest.
	
	id - <string> id of PU
	conf - optional. Any configuration the PU need to operate
	isFullLength - optional. When true, the PU will receive the full string.
	
	*/
	ns.Parser.prototype.use = function( id, conf, isFullLength ) {
		const self = this;
		const ParsyBoi = library.component.parse[ id ];
		if ( !ParsyBoi ) {
			console.log( 'could not use, invalid parser id: ', id );
			return;
		}
		
		const pId = friendUP.tool.uid( 'parser' );
		const newParser = new ParsyBoi( conf, emitEvent );
		newParser.id = pId;
		const type = newParser.type || 'string';
		
		function emitEvent( event ) {
			self.emit( type, event );
		}
		
		self.parsers[ pId ] = newParser;
		if ( isFullLength )
			self.fullOrder.push( pId );
		else
			self.pieceOrder.push( pId );
		
		return pId;
	}
	
	/* update
	
	Update a PUs configuration
	
	id - <string> id of PU
	conf - Configuration passed to PU
	
	*/
	ns.Parser.prototype.update = function( id, conf ) {
		const self = this;
		const parsyBoi = self.parsers[ id ];
		if ( !parsyBoi ) {
			console.log( 'Parser.update - no parsyBoi for id', {
				id      : id,
				conf    : conf,
				parsers : self.parsers,
			});
			return;
		}
		
		parsyBoi.update( conf );
	}
	
	/* remove
	
	stop using this PU
	
	id - <string> id of PU
	
	*/
	ns.Parser.prototype.remove = function( id ) {
		const self = this;
		const idIndex = self.pieceOrder.indexOf( id );
		if ( idIndex === -1 ) {
			console.log( 'cannot remove, invalid parser id', id );
			return;
		}
		
		self.pieceOrder = self.pieceOrder.splice( idIndex, 1 );
		const parser = self.parsers[ id ];
		delete self.parsers[ id ];
		const type = parser.type;
		if ( null != type )
			self.release( type );
		
		parser.close();
	}
	
	/* work
	
	Takes a string and runs it through all registered PUs.
	Returns the modified string.
	
	First the full string is passed to PUs registered with the 
	full-length option. If one PU modifies the full string, the
	string is split and the sub slices are considered full length
	and passed to the next full-length PU.
	
	Then the ( rest of ) the string is split on whitespace, and
	each piece is run through the remaining PUs. Any piece that
	is modified by a PU is not passed to the PUs after it.
	
	str - <string> to be checked
	isLog - <bool> optional, is passed to the PU
	
	returns <string>
	
	*/
	ns.Parser.prototype.work = function( str, isLog ) {
		const self  = this;
		str = breakTags( str );
		
		if ( !self.pieceOrder.length && !self.fullOrder.length ) {
			console.log( 'Parser - no parsers registered' );
			return str;
		}
		
		if ( 'number' === typeof( str ))
			str = str.toString();
		
		if ( 'string' !== typeof( str ))
			return str;
		
		let tokens = self.fullLengthParser( str, isLog );
		tokens = tokens.map( piece => {
			if ( 'string' != piece.type )
				return piece;
			
			piece.data = self.pieceParser( piece.data, isLog );
			return piece;
		});
		
		if ( 1 == tokens.length )
			return tokens[ 0 ].data;
		
		const strung = tokens.reduce(( a, b ) => {
			return {
				data : a.data + b.data
			};
		});
		
		return strung.data;
		
		function breakTags( str ) {
			str = str.replace( /</g, '&lt;' );
			str = str.replace( />/g, '&gt;' );
			return str;
		}
	}
	
	/* close
	
	Cleans up registered PUs and closes the Parser
	
	*/
	ns.Parser.prototype.close = function() {
		const self = this;
		self.pieceOrder.forEach( id => {
			const parser = self.parsers[ id ];
			if ( !parser )
				return;
			
			delete self.parsers[ id ];
			parser.close();
		});
		
		self.pieceOrder = [];
		self.parsers = {};
		
		self.closeEventEmitter();
	}
	
	/* moveParserForward
	
	Move a PU forward in the parse order
	
	id - <string> id of PU
	
	*/
	ns.Parser.prototype.moveParserForward = function( id ) {
		const self = this;
		var currentIndex = self.pieceOrder.indexOf( id );
		if ( currentIndex === -1 ) {
			console.log( 'parser.moveForward - invalid id' );
			return;
		}
		
		self.pieceOrder.splice( currentIndex, 1 );
		self.pieceOrder.splice( currentIndex - 1, 0, id );
	}
	
	/* moveParserBack
	
	Move a PU back in parse order
	
	id - <string> id of PU
	
	*/
	ns.Parser.prototype.moveParserBack = function( id ) {
		const self = this;
		console.log( 'parser.moveBack - NYI' );
	}
	
	// Private
	
	ns.Parser.prototype.init = function() {
		const self = this;
		
	}
	
	ns.Parser.prototype.pieceParser = function( str, isLog ) {
		const self = this;
		// do the actual thing
		if ( !str || !str.length )
			return;
		
		const parts = str.match( /(\S+|\s+)/g );
		let result = '';
		if( parts ) {
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
			let parsed = null;
			let parseOrderIndex = 0;
			
			do {
				let parserId = self.pieceOrder[ parseOrderIndex ];
				if ( !parserId )
					break;
				
				let parser = self.parsers[ parserId ];
				parsed = parser.process( part, isLog );
				parseOrderIndex++;
			} while ( !parsed );
			
			return parsed || part;
		}
	}
	
	ns.Parser.prototype.fullLengthParser = function( str, isLog ) {
		const self = this;
		const piece = {
			type : 'string',
			data : str,
		};
		let tokens = [ piece ];
		let toks = tokens.slice();
		self.fullOrder.forEach( id => {
			const parser = self.parsers[ id ];
			let i = tokens.length;
			while( i ) {
				--i;
				const p = tokens[ i ];
				if ( 'string' != p.type )
					continue;
				
				const cuts = parse(
					parser,
					p.data,
					isLog
				);
				if ( cuts.length )
					toks.splice( i, 1, ...cuts );
				
			}
			
			tokens = toks;
		});
		
		return tokens;
		
		function parse( parser, str, isLog ) {
			let tmp = str;
			const cuts = [];
			while( tmp.length ) {
				const cut = parser.process( tmp, isLog );
				if ( !cut ) {
					const p = {
						type : 'string',
						data : tmp,
					};
					cuts.push( p );
					break;
				}
				
				if ( 0 != cut.start ) {
					const before = tmp.slice( 0, cut.start );
					const pre = {
						type : 'string',
						data : before,
					};
					cuts.push( pre );
				}
				
				const parsed = {
					type : parser.type,
					data : cut.replacement,
				};
				cuts.push( parsed );
				tmp = tmp.slice( cut.end );
			}
			
			return cuts;
		}
	}
	
})( library.component.parse );



/* Parse

Parse is the base model to inherit from when building a new PU.
It defines a interface that is used by Parser 
and provides some basic functionality

emitEvent - <function> passed in by Parser. Sends events back to Parser to be emitted
	with the PUs TYPE. The PU must have a .type set

*/
(function( ns, undefined ) {
	ns.Parse = function( emitEvent ) {
		const self = this;
		self.emit = emitEvent;
		
		self.id = null; // text string to identify the parser. Set in Implementation, required
		self.type = null; // type of events this PU emits. Set in implementation, optional
	}
	
	/* process
	
	This is how the PU receives work from Parser
	
	str - <string> string to check. return the modified string or null
		if no modification was made
	isLog - <bool> passed through from Parser.work(). It may be useful to
		the PU to know if this piece is from a log or a real time message
	
	*/
	ns.Parse.prototype.process = function( str, isLog ) {
		const self = this;
		console.log( 'basemodel Parse.process - please implement in ' + self.id, str );
		return str;
	}
	
	/* update
	
	Handle a configuration update for the PU
	
	conf - whatever the configuration for the PU needs to be.
	
	*/
	ns.Parse.prototype.update = function( conf ) {
		const self = this;
		console.log( 'basemodel Parse.update - please implement in ' + self.id, conf );
	}
	
	/* queueEvent
	
	Helper for the PU to emit an event. The setTimeout ensures the event is emitted
	after the Parser has returned
	
	 event - data to be emitted
	
	*/
	ns.Parse.prototype.queueEvent = function( event ) {
		const self = this;
		window.setTimeout(() => self.emit( event ), 1 );
	}
	
	/* escape
	
	Helper, escape some special characters
	
	*/
	ns.Parse.prototype.escape = function( str ) {
		return str.replace( /[-\/\\^$*+?.()|[\]{}]/g, "\\$&" );
	}
	
	/* close
	
	cleans up the PU. re-implement if needed
	
	*/
	ns.Parse.prototype.close = function() {
		const self = this;
		delete self.emit;
	}
	
})( library.component.parse );

// WsToEntity
// whitespace to html entity conversion
(function( ns, undefined ) {
	ns.WsToEntity = function() {
		if ( !( this instanceof ns.WsToEntity ))
			return new ns.WsToEntity();
		
		const self = this;
		ns.Parse.call( self );
		
		self.id = 'WsToEntity';
		self.init();
	}
	
	ns.WsToEntity.prototype = Object.create( ns.Parse.prototype );
	
	ns.WsToEntity.prototype.init = function() {
		const self = this;
		self.spRX = new RegExp( '\x20', 'g' );
		self.rnRX = new RegExp( '(\\r\\n|\\r|\\n)', 'g' );
		self.tabRX = new RegExp( '\x09', 'g' );
		self.matchRX = new RegExp( '(\x20|\x09|\\r\\n|\\r|\\n)', '' );
	}
	
	ns.WsToEntity.prototype.process = function( str, isLog ) {
		const self = this;
		var match = self.matchRX.exec( str );
		if ( !match )
			return null;
		
		str = str.replace( self.rnRX, '<br>' );
		str = str.replace( self.spRX, '&thinsp;' );
		str = str.replace( self.tabRX, '&emsp;' );
		return str;
	}
	
})( library.component.parse );


/* LinkStd - simple url linkifier

Turns text belived to be urls into <a> tags
Post processing/expansion can be done by passing the msg
element to the LinkExpander

*/
(function( ns, undefined ) {
	ns.LinkStd = function() {
		ns.Parse.call( this );
		const self = this;
		
		self.id = 'LinkStd';
		self.urlRX = null;
		self.prefixRX = null;
		
		self.init();
	}
	
	ns.LinkStd.prototype = Object.create( ns.Parse.prototype );
	
	ns.LinkStd.prototype.process = function( str, isLog ) {
		const self = this;
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
	
	ns.LinkStd.prototype.init = function() {
		const self = this;
		self.buildUrlRX();
		self.buildPrefixRX();
	}
	
	ns.LinkStd.prototype.buildUrlRX = function() {
		const self = this;
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
		const self = this;
		self.prefixRX = new RegExp( '(^https?://)', 'ig' );
	}
	
})( library.component.parse );

/* FriendPath

turns text belived to be friend disk paths into <fp> tags
these will need post-procsessing by PathExpand

*/
(function( ns, undefined ) {
	ns.FriendPath = function() {
		ns.Parse.call( this );
		const self = this;
		self.id = 'FriendPath';
		
		self.init();
	}
	
	// Pubies
	
	ns.FriendPath.prototype.process = function( str, isLog ) {
		const self = this;
		const match = self.pathRX.exec( str );
		console.log( 'FriendPath', [ str, match ]);
		if ( match )
			return makeLink( match[ 0 ]);
		
		return null;
		
		function makeLink( path ) {
			const link = document.createElement( 'fp' );
			link.innerText = path;
			link.href = path; //makeAbsoluteUrl( path );
			link.target = '_blank';
			console.log( 'flink', link );
			return link.outerHTML;
		}
		
		/*
		function makeAbsoluteUrl( path ) {
			var match = path.match( self.prefixRX );
			if ( !match ) {
				path = 'https://' + path;
			}
			
			return path;
		}
		*/
	}
	
	// Privies
	
	ns.FriendPath.prototype.init = function() {
		const self = this;
		self.buildPathRX();
	}
	
	ns.FriendPath.prototype.buildPathRX = function() {
		const self = this;
		const allowed = '_\\-a-z\\u00a1-\\uffff0-9';
		self.pathRX = new RegExp(
			// volume
			"^([" + allowed + "]+:)" +
			// path
			"((?:[" + allowed + "]+\\/)+)*" +
			// file
			"([" + allowed + "]+\\.[" + allowed + "]+$)"
			, "i"
		);
		console.log( 'pathRX', self.pathRX );
	}
	
})( library.component.parse );

// NL2BR
// DEPRECATED - use WsToEntity instead probably i guess
(function( ns, undefined ) {
	ns.NL2BR = function() {
		ns.Parse.call( this );
		
		const self = this;
		self.id = 'NL2BR';
		self.rx = null;
		
		self.init();
	}
	
	ns.NL2BR.prototype = Object.create( ns.Parse.prototype );
	
	ns.NL2BR.prototype.process = function( str, isLog ) {
		const self = this;
		
		if ( !str || !str.length || 'string' !== typeof( str ))
			return null;
		
		if ( !str.match( self.rx ))
			return null;
			
		str = str.replace( self.rx, '<br>' );
		return str;
	}
	
	ns.NL2BR.prototype.init = function() {
		const self = this;
		self.buildRX();
	}
	
	ns.NL2BR.prototype.buildRX = function() {
		const self = this;
		self.rx = new RegExp( '(\\r\\n|\\r|\\n)', 'ig' );
	}
	
})( library.component.parse );


// BREAK LONG STRINGS - probably also old and not really used
(function( ns, undefined ) {
	ns.BreakLongStrings = function( maxLength ) {
		const self = this;
		self.id = 'BreakLongStrings';
		self.maxLength = maxLength || 10;
		self.partLength = null;
		self.RX = null;
		
		self.init();
	}
	
	ns.BreakLongStrings.prototype.init = function() {
		const self = this;
		self.partLength = Math.ceil( self.maxLength / 2 );
		self.RX = self.buildRX();
	}
	
	ns.BreakLongStrings.prototype.buildRX = function() {
		const self = this;
		// /([^\\s-]{n})([^\\s-]{n})/g
		var rxString = '([^\\s-]{' + self.partLength + '})([^\\s-]{' + self.partLength + '})';
		return new RegExp( rxString, '' );
	}
	
	ns.BreakLongStrings.prototype.process = function( str, isLog ) {
		const self = this;
		return String( str ).replace( self.RX, '$1&shy;$2' ).toString();
	}
	
})( library.component.parse );


/* Emojii

Looks for text tags like :smile: or :) and replace them with emojiis
in a <i> element to gives them a bit of a bump in font size

*/
(function( ns, undefined ) {
	ns.Emojii = function( emojiiMap ) {
		ns.Parse.call( this );
		const self = this;
		self.id = 'Emojii';
		self.emojiiMap = emojiiMap;
		
		self.init();
	}
	
	ns.Emojii.prototype = Object.create( ns.Parse.prototype );
	
	ns.Emojii.prototype.init = function() {
		const self = this;
		self.transformMap();
		self.buildRX();
	}
	
	ns.Emojii.prototype.transformMap = function() {
		const self = this;
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
		const self = this;
		let emoKeys = Object.keys( self.emojiiMap );
		emoKeys.sort( byLength );
		emoKeys = emoKeys.map(  e => self.escape( e ));
		const flags = 'i';
		const start = '^(';
		const end = ')$';
		const search = emoKeys.join( '|' );
		self.RX = new RegExp( start + search + end, flags );
		
		function byLength( a, b ) {
			return b.length - a.length;
		}
	}
	
	ns.Emojii.prototype.process = function( str, isLog ) {
		const self = this;
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

/* AtThings

looks for predefined @strings and replace them wit a <span> and
some css styling

Will also emit events on a match when configured for it

*/
(function( ns, undefined ) {
	ns.AtThings = function( conf, emitEvent ) {
		const self = this;
		ns.Parse.call( self, emitEvent );
		
		self.id = 'AtThings';
		self.type = conf.type || 'mention';
		self.special = conf.atStrings || [];
		self.cssKlass = conf.cssKlass;
		self.onlyEmit = conf.onlyEmit || false;
		
		self.RX = null;
		
		self.init();
	}
	
	ns.AtThings.prototype = Object.create( ns.Parse.prototype );
	
	ns.AtThings.prototype.process = function( str, isLog ) {
		const self = this;
		if ( !self.RX )
			return null;
		
		if ( !str || !str.length )
			return null;
		
		const match = self.RX.exec( str );
		if ( !match )
			return null;
		
		const part = match[ 0 ];
		if ( self.onlyEmit ) {
			if ( !isLog )
				self.queueEvent( part );
				//window.setTimeout( emit, 1 );
			
			return null;
		}
		
		const start = match.index;
		const end = start + part.length;
		const container = document.createElement( 'span' );
		container.innerText = part;
		container.classList.toggle( 'at-things', true );
		container.classList.toggle( self.cssKlass, true );
		const replacement = container.outerHTML;
		const cut = {
			start       : start,
			end         : start + part.length,
			replacement : replacement,
		};
		
		return cut;
		
		function emit() {
			self.emit( part );
		}
	}
	
	ns.AtThings.prototype.update = function( conf ) {
		const self = this;
		if ( conf.atStrings != null ) {
			self.special = conf.atStrings;
			self.buildStrings();
		}
		
		if ( conf.cssKlass != null )
			self.cssKlass = conf.cssKlass;
		
		if ( conf.onlyEmit != null )
			self.onlyEmit = conf.onlyEmit;
	}
	
	ns.AtThings.prototype.init = function() {
		const self = this;
		self.buildStrings();
	}
	
	ns.AtThings.prototype.buildStrings = function() {
		const self = this;
		const valid = self.special
			.map( str => {
				if ( !str || !str.length || 'string' !== typeof( str ))
					return null;
				
				const res = str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
				return res;
			})
			.filter( s => !!s );
		
		if ( !valid.length ) {
			self.RX = null;
			return;
		}
		
		const tests = valid.map( str => {
			//str = str.toLowerCase();
			const t = '@' + str;
			return t;
		});
		
		const flags = '';
		const test = tests.join( '|' );
		self.RX = new RegExp( '\\B(' + test + ')\\b', flags );
	}
	
})( library.component.parse );
