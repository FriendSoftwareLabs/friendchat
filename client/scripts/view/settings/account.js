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
			'skipPass',
			'popupChat',
			'msgAlert',
			'inAppMenu',
			'onNewScreen',
		];
		self.displayOrder = self.validKeys;
		self.labelMap = {
			'skipPass'    : View.i18n('i18n_autologin'),
			'popupChat'   : View.i18n('i18n_pop_up_new_chat'),
			'msgAlert'    : View.i18n('i18n_message_beep'),
			'inAppMenu'   : View.i18n('i18n_in_app_menu'),
			'onNewScreen' : View.i18n('i18n_open_on_new_screen'),
		};
		self.defaultMap = {};
		self.buildMap = {
			'skipPass'    : singleCheck,
			'popupChat'   : singleCheck,
			'msgAlert'    : singleCheck,
			'inAppMenu'   : singleCheck,
			'onNewScreen' : singleCheck,
		};
		
		function singleCheck( setting ) { self.singleCheck( setting ); }
	}
	
})( library.view );

window.View.run = run;
function run( fupConf ) {
	window.account = new library.view.Account( fupConf );
}