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

var friendUP = window.friendUP || {};
var library = window.library || {};
var hello = window.hello || {};

library.view = library.view || {};

(function( ns, undefined ) {
	ns.Conference = function( fupConf ) {
		if ( !( this instanceof ns.Conference ))
			return new ns.Conference( fupConf );
		
		library.view.Settings.call( this, fupConf );
		console.log( 'conference settings view' );
	}
	
	ns.Conference.prototype = Object.create( library.view.Settings.prototype );
	
	ns.Conference.prototype.setup = function() {
		var self = this;
		self.validKeys = [
			'topic',
			'mode',
		];
		self.labelMap = {
			topic : 'Topic',
			mode : View.i18n('i18n_channel_modes'),
		};
		self.buildMap = {
			topic : textInput,
			mode : checkbox,
		};
		
		function textInput( setting ) { self.setTextInput( setting ); }
		function checkbox( setting ) { self.setCheckbox( setting ); }
	}
	
	ns.Conference.prototype.buildView = function() {
		const self = this;
		const tmplId = 'settings-conference-tmpl';
		const el = hello.template.getElement( tmplId, {});
		el.innerHTML = View.i18nReplaceInString( el.innerHTML );
		document.body.appendChild( el );
	}
	
	
})( library.view );

window.View.run = initView;
function initView( fupCOnf ) {
	window.confSettings = new library.view.Conference( fupCOnf );
}