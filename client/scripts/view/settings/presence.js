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
