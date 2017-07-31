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

// TreerootRegister
(function( ns, undefined ) {
	ns.TreerootRegister = function() {
		if ( !( this instanceof ns.TreerootRegister ))
			return new ns.TreerootRegister();
		const self = this;
		self.tmplId = 'form-treeroot-register-tmpl';
		library.view.ComponentForm.call( self );
		
	}
	
	ns.TreerootRegister.prototype = Object.create( library.view.ComponentForm.prototype );
	
	ns.TreerootRegister.prototype.setup = function() {
		var self = this;
		console.log( 'view.TreerootRegister.init' );
		
		var email = {
			type : 'email',
			data : {
				name : 'Email',
				required : true,
			}
		};
		
		var username = {
			type : 'text',
			data : {
				name : View.i18n('i18n_username'),
				required : true,
			}
		};
		
		var passphrase = {
			type : 'secure-confirmed',
			data : {
				name : View.i18n('i18n_passphrase'),
			},
		};
		
		var requiredInput = [
			email,
			username,
			passphrase,
		];
		
		var firstname = {
			type : 'text',
			data : {
				name : 'Firstname',
				label : View.i18n('i18n_first_name'),
			},
		};
		
		var middlename = {
			type : 'text',
			data : {
				name : 'Middlename',
				label : View.i18n('i18n_middle_name'),
			},
		};
		
		var lastname = {
			type : 'text',
			data : {
				name : 'Lastname',
				label : View.i18n('i18n_last_name'),
			},
		};
		
		var gender = {
			type : 'text',
			data : {
				name : View.i18n('i18n_gender'),
			},
		};
		
		var mobile = {
			type : 'text',
			data : {
				name : 'Mobile',
				label : View.i18n('i18n_phone_number'),
			},
		};
		
		var optionalInput = [
			firstname,
			middlename,
			lastname,
			gender,
			mobile,
		];
		
		self.buildMap = [
			{
				type : 'container',
				data : {
					name : View.i18n('i18n_required'),
					content : requiredInput,
				},
			},
			{
				type : 'container',
				data : {
					name : View.i18n('i18n_optional'),
					content : optionalInput,
				}
			}
		];
	}
	
})( library.view );

if ( !window.View )
	throw new Error( 'view.TreerootRegister - window.View is not defined' );

window.View.run = run;
function run() {
	window.form = new library.view.TreerootRegister();
}