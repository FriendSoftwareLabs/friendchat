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

var friendUP = window.friendUP || {};
var api = window.api || {}; // use stuff on this object
var fupLocal = {}; // internals
var friend = window.friend || {}; // already instanced stuff

(function( ns, undefined ) {
	ns.Shell = function( app ) {
		const self = this;
		self.app = app;
		self.shellId = null;
		
		self.init();
	}
	
	// Public
	
	ns.Shell.prototype.execute = async function( appName, filePath ) {
		const self = this;
		console.log( 'Shell.execute', [ appName, filePath ]);
	}
	
	// Private
	
	ns.Shell.prototype.init = function() {
		const self = this;
		console.log( 'Shell.init', self );
	}
	
	ns.Shell.prototype.send = function( event ) {
		const self = this;
		event.type = 'shell';
		event.shellSession = self.shellSession;
		
		self.app.sendBase( event );
	}
	
})( api );
