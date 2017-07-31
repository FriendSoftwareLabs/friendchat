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
	ns.Loading = function() {
		console.log( 'loading..' );
		var self = this;
		self.connecting = null;
		self.error = null;
		self.errorMsg = null;
		self.view = window.View;
		
		self.init();
	}
	
	ns.Loading.prototype.init = function() {
		var self = this;
		View.setBody();
		self.connecting = document.getElementById( 'connecting' );
		self.error = document.getElementById( 'error' );
		self.errorMsg = document.getElementById( 'error-message' );
		
		self.view.on( 'error', showErr );
		function showErr( e ) { self.showError( e ); }
	}
	
	ns.Loading.prototype.showError = function( event ) {
		var self = this;
		console.log( 'Loading.showError', event );
		self.connecting.classList.toggle( 'hidden', true );
		self.error.classList.toggle( 'hidden', false );
		self.errorMsg.textContent = event;
	}
})( library.view );

window.View.run = run;
function run( fupConf ) {
	new library.view.Loading( fupConf );
}