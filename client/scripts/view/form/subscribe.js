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

// SUBSCRIBE
(function( ns, undefined ) {
	ns.Subscribe = function() {
		if ( !( this instanceof ns.Subscribe ))
			return new ns.Subscribe();
		
		const self = this;
		self.tmplId = 'form-treeroot-subscribe-tmpl';
		library.view.BaseFormView.call( self );
		
		self.init();
	}
	
	ns.Subscribe.prototype = Object.create( library.view.BaseFormView.prototype );
	
	ns.Subscribe.prototype.init= function() {
		var self = this;
		console.log( 'view.Subscribe.init' );
	}
	
	ns.Subscribe.prototype.setInputValues = function() {
		var self = this;
		console.log( 'view.Subscribe.setInputValue', self.inputMap );
		self.setSelectOptions( 'type' );
	}
	
})( library.view );

if ( !window.View )
	throw new Error( 'window.View is not defined, rabble rabble rabble' );

window.View.run = fun;
function fun() {
	window.subscribe = new library.view.Subscribe();
}