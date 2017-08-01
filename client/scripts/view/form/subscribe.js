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