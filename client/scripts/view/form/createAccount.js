'use strict';

/*©agpl*************************************************************************
*                                                                              *
* This file is part of FRIEND UNIFYING PLATFORM.                               *
*                                                                              *
* This program is free software: you can redistribute it and/or modify         *
* it under the terms of the GNU Affero General Public License as published by  *
* the Free Software Foundation, either version 3 of the License, or            *
* (at your option) any later version.                                          *
*                                                                              *
* This program is distributed in the hope that it will be useful,              *
* but WITHOUT ANY WARRANTY; without even the implied warranty of               *
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the                 *
* GNU Affero General Public License for more details.                          *
*                                                                              *
* You should have received a copy of the GNU Affero General Public License     *
* along with this program.  If not, see <http://www.gnu.org/licenses/>.        *
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