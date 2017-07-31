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
	ns.Confirm = function() {
		if ( !( this instanceof ns.Confirm ))
			return new ns.Confirm();
		
		var self = this;
		self.view = window.View;
		
		self.init();
	}
	
	ns.Confirm.prototype.init = function() {
		var self = this;
		View.setBody();
		self.bindView();
		self.bindEvents();
		
		self.view.sendMessage({
			type : 'loaded',
		});
	}
	
	ns.Confirm.prototype.bindView = function() {
		var self = this;
		self.view.on( 'initialize', initialize );
		self.view.on( 'close', close );
		
		function initialize( msg ) { self.initialize( msg ); }
		function close( msg ) { self.close( msg ); }
	}
	
	ns.Confirm.prototype.initialize = function( data ) {
		var self = this;
		console.log( 'view.Confirm.initialize', data );
		
		var title = document.getElementById( 'title' );
		var message = document.getElementById( 'message' );
		
		title.innerHTML = data.title;
		message.innerHTML = data.message;
		
		self.view.sendMessage({
			type : 'ready',
		});
	}
	
	ns.Confirm.prototype.close = function() {
		self = this;
		console.log( 'view.Confirm.close' );
		self.view.close();
	}
	
	ns.Confirm.prototype.bindEvents = function() {
		var self = this;
		var form = document.getElementById( 'form' );
		var denyBtn = document.getElementById( 'deny' );
		
		form.addEventListener( 'submit', confirm, false );
		denyBtn.addEventListener( 'click', deny, false );
		
		function confirm( e ) { self.confirm( e ); }
		function deny( e ) { self.deny( e ); }
	}
	
	ns.Confirm.prototype.confirm = function( e ) {
		var self = this;
		e.preventDefault();
		self.response( 'confirm' );
	}
	ns.Confirm.prototype.deny = function( e ) {
		var self = this;
		e.preventDefault();
		self.response( 'deny' );
	}
	
	ns.Confirm.prototype.response = function( msg ) {
		var self = this;
		self.view.sendMessage({
			type : 'response',
			data : msg,
		});
	}
	
})( library.view );

if ( !window.View )
	throw new Error( 'view.Confirm - window.View not defined' );

window.View.run = run;
function run() {
	window.confirm = new library.view.Confirm();
}