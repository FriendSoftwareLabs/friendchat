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

library.view = library.view || {};

(function( ns, undefined ) {
	ns.Presence = function( fupConf ) {
		if ( !( this instanceof ns.Presence ))
			return new ns.Presence( fupConf );
		
		library.view.Settings.call( this );
	}
	
	ns.Presence.prototype = Object.create( library.view.Settings.prototype );
	
	ns.Presence.prototype.setup = function() {
		var self = this;
		self.validKeys = [
			//'host',
			//'port',
			//'login',
			//'password',
			//'msgAlert',
		];
		
		self.displayOrder = self.validKeys;
		self.labelMap = {
			host     : View.i18n('i18n_host'),
			port     : View.i18n('i18n_port'),
			login    : View.i18n('i18n_login'),
			password : View.i18n('i18n_passphrase'),
		};
		
		self.buildMap = {
			host     : textInput,
			port     : numberInput,
			login    : textInput,
			password : secureInput,
			/*
			//onlyOneClient : singleCheck,
			logLimit : numberInput,
			msgCrypto : singleCheck,
			msgAlert : singleCheck,
			*/
		};
		
		function textInput( setting ) { self.setTextInput( setting ); }
		function secureInput( setting ) { self.setSecureInput( setting ); }
		//function singleCheck( setting ) { self.singleCheck( setting ); }
		function numberInput( setting ) { self.setNumberInput( setting ); }
	}
	
})( library.view );


window.View.run = walk;
function walk( fupConf ) {
	window.settings = new library.view.Presence( fupConf );
}
