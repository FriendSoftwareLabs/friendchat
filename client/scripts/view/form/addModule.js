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

'use strict';

var library = window.library || {};
var friendUP = window.friendUP || {};
var hello = window.hello || {};

library.view = library.view || {};

// AddModule
(function( ns, undefined ) {
	ns.AddModule = function() {
		if ( !( this instanceof ns.AddModule ))
			return new ns.AddModule();
		
		const self = this;
		self.tmplId = 'form-module-tmpl';
		
		library.view.BaseFormView.call( self );
		
		self.init();
	}
	
	ns.AddModule.prototype = Object.create( library.view.BaseFormView.prototype );
	
	ns.AddModule.prototype.init = function() {
		var self = this;
		console.log( 'view.AddModule.init' );
	}
	
	ns.AddModule.prototype.setInputValues = function() {
		var self = this;
		console.log( 'view.AddModule.setInputValues', self.inputMap );
		self.setSelectOptions( 'type' );
	}
	
})( library.view );

window.View.run = run;
function run() {
	window.createModule = new library.view.AddModule();
}