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

(function( ns, undefined ) {
	ns.FirstWizard = function( fupConf ) {
		console.log( 'firstWizard', fupConf );
		const self = this;
		self.connecting = null;
		self.error = null;
		self.errorMsg = null;
		self.conn = window.View;
		
		self.init();
	}
	
	ns.FirstWizard.prototype.init = function() {
		const self = this;
		View.setBody();
		self.bind();
	}
	
	ns.FirstWizard.prototype.bind = function() {
		const self = this;
		console.log( 'firstWizard.bind', self );
		const smplBtn = document.getElementById( 'smpl_btn' );
		const advBtn = document.getElementById( 'adv_btn' );
		
		smplBtn.addEventListener( 'click', smplClick, false );
		advBtn.addEventListener( 'click', advClick, false );
		
		function smplClick( e ) { self.choose( false ); }
		function advClick( e ) { self.choose( true ); }
	}
	
	ns.FirstWizard.prototype.choose = function( useAdvancedUI ) {
		const self = this;
		self.send({
			type : 'done',
			data : {
				advancedUI : useAdvancedUI,
			},
		});
	}
	
	ns.FirstWizard.prototype.send = function( msg ) {
		const self = this;
		self.conn.sendMessage( msg );
	}
	
})( library.view );

window.View.run = run;
function run( fupConf ) {
	new library.view.FirstWizard( fupConf );
}