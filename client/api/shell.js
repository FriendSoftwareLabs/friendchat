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
		self.ready = false;
		self.sendQeue = [];
		
		self.init();
	}
	
	// Public
	
	ns.Shell.prototype.execute = async function( command ) {
		const self = this;
		return new Promise(( resolve, reject ) => {
			const cbId = self.app.setCallback( execBack );
			const exec = {
				command      : 'execute',
				commandLine  : command,
				callbackId   : cbId,
			};
			
			self.send( exec );
			
			function execBack( res ) {
				console.log( 'execBack', res );
				resolve( res );
			}
			
		});
	}
	
	// Private
	
	ns.Shell.prototype.init = function() {
		const self = this;
		const cbId = self.app.setCallback( ready );
		const init = {
			shellId : cbId,
			args    : {
				applicationId : self.app.id,
				authId        : self.app.authId,
			},
		};
		
		self.ready = true;
		self.send( init );
		self.ready = false;
		
		function ready( shellInit ) {
			self.sessionId = shellInit.shellSession;
			self.num = shellInit.shellNumber;
			self.ready = true;
			self.executeSendQueue();
		}
	}
	
	ns.Shell.prototype.executeSendQueue = function() {
		const self = this;
		self.sendQeue.forEach( e => self.send( e ));
		self.sendQeue = [];
	}
	
	ns.Shell.prototype.send = function( event ) {
		const self = this;
		if ( !self.ready ) {
			self.sendQeue.push( event );
			return;
		}
		
		event.type = 'shell';
		event.shellSession = self.sessionId || undefined;
		
		console.log( 'Shell.send', event );
		self.app.sendWorkspace( event );
	}
	
})( api );
