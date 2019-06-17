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

var friendUP = window.friendUP || {};
var library = window.library || {};
var hello = window.hello || {};

library.view = library.view || {};

(function( ns, undefined ) {
	ns.Account = function( fupConf ) {
		if ( !( this instanceof ns.Account ))
			return new ns.Account( fupConf );
		
		library.view.Settings.call( this );
	}
	
	ns.Account.prototype = Object.create( library.view.Settings.prototype );
	
	ns.Account.prototype.setup = function() {
		var self = this;
		self.validKeys = [
			//'skipPass',
			'popupChat',
			'roomAlert',
			'privateAlert',
			'inAppMenu',
			//'onNewScreen',
			//'minimalUI',
			//'advancedUI',
			'compactChat',
		];
		self.displayOrder = self.validKeys;
		self.labelMap = {
			'skipPass'     : View.i18n( 'i18n_autologin' ),
			'popupChat'    : View.i18n( 'i18n_pop_up_new_chat' ),
			'roomAlert'    : View.i18n( 'i18n_room_msg_beep' ),
			'privateAlert' : View.i18n( 'i18n_private_msg_beep' ),
			'inAppMenu'    : View.i18n( 'i18n_in_app_menu' ),
			'onNewScreen'  : View.i18n( 'i18n_open_on_new_screen' ),
			'minimalUI'    : View.i18n( 'i18n_minimal_ui' ),
			'advancedUI'   : View.i18n( 'i18n_advanced_ui' ),
			'compactChat'  : View.i18n( 'i18n_compact_chat' ),
		};
		self.defaultMap = {};
		self.buildMap = {
			'skipPass'     : singleCheck,
			'popupChat'    : singleCheck,
			'roomAlert'    : singleCheck,
			'privateAlert' : singleCheck,
			'inAppMenu'    : singleCheck,
			'onNewScreen'  : singleCheck,
			'minimalUI'    : singleCheck,
			'advancedUI'   : singleCheck,
			'compactChat'  : singleCheck,
		};
		
		function singleCheck( setting ) { self.singleCheck( setting ); }
	}
	
})( library.view );

window.View.run = run;
function run( fupConf ) {
	window.account = new library.view.Account( fupConf );
}