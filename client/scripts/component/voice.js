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

var api = window.api || {};

// Say
(function( ns, undefined ) {
	ns.Say = function( toSay, langCode ) {
		if ( !window.speechSynthesis ) {
			console.log( 'api.Say - speechSynthesis is not available', { s : toSay, l : langCode });
			return;
		}
		
		var defaultLanguage = 'en-GR';
		var availableVoices = window.speechSynthesis.getVoices();
		var utterance = new window.SpeechSynthesisUtterance( toSay );
		//console.log( 'availableVoices', availableVoices );
		availableVoices.forEach( matchPreference );
		
		utterance.lang = defaultLanguage;
		window.speechSynthesis.speak( utterance );
		
		function matchPreference( voice, index ) {
			//console.log( 'voice', { l: voice, i: index });
		}
	}
})( api );
