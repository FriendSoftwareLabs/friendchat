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