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
	ns.Treeroot = function( fupConf ) {
		if ( !( this instanceof ns.Treeroot ))
			return new ns.Treeroot( fupConf );
		
		library.view.Settings.call( this );
	}
	
	ns.Treeroot.prototype = Object.create( library.view.Settings.prototype );
	
	ns.Treeroot.prototype.setup = function() {
		var self = this;
		self.validKeys = [
			'host',
			'login',
			//'password',
			//'onlyOneClient',
			'logLimit',
			'msgCrypto',
			//'msgAlert',
		];
		
		self.displayOrder = self.validKeys;
		self.labelMap = {
			host : 'Host',
			login : 'Email',
			//password : 'Password',
			//onlyOneClient : 'Logout old clients',
			logLimit : View.i18n('i18n_history_length'),
			msgCrypto : View.i18n('i18n_encrypt_messages'),
			msgAlert : View.i18n('i18n_message_alert'),
		};
		
		self.buildMap = {
			host : textInput,
			login : textInput,
			//password : secureInput,
			//onlyOneClient : singleCheck,
			logLimit : numberInput,
			msgCrypto : singleCheck,
			msgAlert : singleCheck,
		};
		
		function textInput( setting ) { self.setTextInput( setting ); }
		//function secureInput( setting ) { self.setSecureInput( setting ); }
		function singleCheck( setting ) { self.singleCheck( setting ); }
		function numberInput( setting ) { self.setNumberInput( setting ); }
	}
	
})( library.view );


window.View.run = walk;
function walk( fupConf ) {
	window.settings = new library.view.Treeroot( fupConf );
}
