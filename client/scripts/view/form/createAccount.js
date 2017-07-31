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

// CreateAccount
(function( ns, undefined ) {
	ns.CreateAccount = function() {
		if ( !( this instanceof ns.CreateAccount ))
			return new ns.CreateAccount();
		
		const self = this;
		self.tmplId = 'form-create-account-tmpl';
		
		library.view.ComponentForm.call( self );
	}
	
	ns.CreateAccount.prototype = Object.create( library.view.ComponentForm.prototype );
	
	ns.CreateAccount.prototype.setup = function() {
		var self = this;
		console.log( 'view.CreateAccount.init' );
		
		var name = {
			type : 'text',
			data : {
				name : 'name',
				label : 'Name',
				required : true,
			},
		};
		
		var passphrase = {
			type : 'secure-confirmed',
			data : {
				name : 'password',
				label : 'Passphrase',
			},
		};
		
		self.buildMap = [
			name,
			passphrase,
		];
	}
	
})( library.view );

if ( !window.View )
	throw new Error( 'view.CreateAccount - window.View is not defined' );

window.View.run = run;
function run() {
	window.form = new library.view.CreateAccount();
}