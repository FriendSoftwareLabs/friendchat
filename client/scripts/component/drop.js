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

var library = window.library || {};
library.component = library.component || {};

(function( ns, undefined ) {
	ns.Drop = function( conf ) {
		if ( !( this instanceof ns.Drop ))
			return new ns.Drop( conf );
		
		var self = this;
		self.targetId = conf.targetId;
		self.ondrop = conf.ondrop;
		
		self.init();
	}
	
	ns.Drop.prototype.init = function() {
		var self = this;
		window.View.eventMap[ 'drop' ] = handleDrop;
		
		function handleDrop( e ) {
			var items = friendUP.tool.objectify( e.data );
			console.log( 'handleDrop', items );
			var event = {
				type : 'drag-n-drop',
				data : items,
			};
			self.ondrop( event );
		}
	}
})( library.component );