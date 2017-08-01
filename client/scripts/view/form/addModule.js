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