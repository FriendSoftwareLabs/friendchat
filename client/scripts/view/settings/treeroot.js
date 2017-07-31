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
