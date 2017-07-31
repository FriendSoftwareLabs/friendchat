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
	ns.AddImage = function() {
		if ( !( this instanceof ns.AddImage ))
			return new ns.AddImage();
		
		var self = this;
		self.view = window.View;
		
		self.init();
	}
	
	ns.AddImage.prototype.init = function() {
		var self = this;
		self.bindView();
		self.bindEvents();
		
		self.view.sendMessage({
			type : 'loaded',
		});
	}
	
	ns.AddImage.prototype.bindView = function() {
		var self = this;
		self.view.on( 'initialize', initialize );
		
		function initialize( msg ) { self.initialize( msg ); }
	}
	
	ns.AddImage.prototype.initialize = function( data ) {
		var self = this;
		console.log( 'view.AddImage.initialize', data );
		
		self.view.sendMessage({
			type : 'ready',
		});
	}
	
	ns.AddImage.prototype.bindEvents = function() {
		var self = this;
		var form = document.getElementById( 'form' );
		var cancelBtn = document.getElementById( 'cancel' );
		var selectCamshotBtn = document.getElementById( 'selectCamshotBtn' );
		var camshot = document.getElementById( 'camshot' );
		
		form.addEventListener( 'submit', submit, false );
		cancelBtn.addEventListener( 'click', cancel, false );
		
		selectCamshotBtn.addEventListener( 'click', selectCamshot );
		
		function submit( e ) { self.submit( e ); }
		function cancel( e ) { self.cancel( e ); }
		function selectCamshot( e ) { self.selectCamshot(); }
	}
	
	ns.AddImage.prototype.submit = function( e ) {
		var self = this;
		e.preventDefault();
		self.sendImage( 'qwed"#RASDFASD' );
	}
	ns.AddImage.prototype.cancel = function( e ) {
		var self = this;
		e.preventDefault();
		self.sendImage( null );
	}
	
	ns.AddImage.prototype.sendImage = function( data ) {
		var self = this;
		self.view.sendMessage({
			type : 'image',
			data : data,
		});
	}
	
	ns.AddImage.prototype.selectCamshot = function() {
		var self = this;
		console.log( 'select camshot' );
	}
	
})( library.view );

if ( !window.View )
	throw new Error( 'view.AddImage - window.View not defined' );

window.View.run = run;
function run() {
	window.camshot = new library.view.AddImage();
}