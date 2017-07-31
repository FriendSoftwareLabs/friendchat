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
	ns.CryptWarn = function( fupConf ) {
		if ( !( this instanceof ns.CryptWarn ))
			return new ns.CryptWarn( fupConf );
		
		if ( fupConf )
			console.log( 'view.CryptWarn - fupconf', fupConf );
		
		var self = this;
		self.init();
		
	}
	
	ns.CryptWarn.prototype.init = function() {
		var self = this;
		View.setBody();
		self.view = window.View;
		self.bindEvents();
		
		self.view.on( 'initialize', initialize );
		function initialize( msg ) { self.initialize( msg ); }
		
		self.send({
			type : 'loaded',
		});
	}
	
	ns.CryptWarn.prototype.initialize = function( data ) {
		var self = this;
		console.log( 'view.cryptwarn.initialize', data );
		var cryptoOn = document.getElementById( 'crypto-host' );
		cryptoOn.innerHTML = cryptoOn.innerHTML + data.host;
	}
	
	ns.CryptWarn.prototype.bindEvents = function() {
		var self = this;
		var acceptBtn = document.getElementById( 'accept' );
		var cancelBtn = document.getElementById( 'cancel' );
		acceptBtn.addEventListener( 'click', accept, false );
		cancelBtn.addEventListener( 'click', cancel, false );
		
		function accept( e ) { self.accept( true ); }
		function cancel( e ) { self.accept( false ); }
	}
	
	ns.CryptWarn.prototype.accept = function( accept ) {
		var self = this;
		var acc = {
			type : 'accept',
			data : accept,
		};
		console.log( 'view.cryptwarn', acc );
		self.send( acc );
	}
	
	ns.CryptWarn.prototype.send = function( msg ) {
		var self = this;
		self.view.sendMessage( msg );
	}
	
})( library.view );

window.View.run = run;
function run( fupConf ) {
	window.cryptWarn = new library.view.CryptWarn( fupConf );
}