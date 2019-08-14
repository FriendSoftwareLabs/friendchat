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

chrome.runtime.onConnect.addListener( connection );
function connection( port ) {
	port.onMessage.addListener( onMessage );
	
	function onMessage( msg ) {
		console.log( 'background.onMessage', msg );
		let event = null;
		try {
			event = JSON.parse( msg );
		} catch( ex ) {}
		
		let sources = null;
		if ( !event || !event.data )
			sources = [ 'screen', 'window' ];
		else {
			const data = event.data;
			sources = data.sources;
		}
		
		chrome.desktopCapture.chooseDesktopMedia(
			sources,
			port.sender.tab,
			onSource
		);
	}
	
	function onSource( sourceId, opts ) {
		console.log( 'background.onSource', sourceId );
		port.postMessage({
			type : 'sourceId',
			data : {
				sid  : sourceId,
				opts : opts,
			},
		});
	}
}

chrome.runtime.onInstalled.addListener( installed );
function installed( e ) {
	console.log( 'background.js - on installed', e );
	chrome.tabs.query( {}, tabsBack );
	function tabsBack( tabs ) {
		console.log( 'tabs', tabs );
		tabs.forEach( inject );
	}
	
	function inject( tab ) {
		chrome.tabs.executeScript( tab.id, {
			file : 'content.js',
		});
	}
}

chrome.runtime.onUpdateAvailable.addListener( hasUpdate );
function hasUpdate( e ) {
	console.log( 'hasUpdate', e );
	chrome.runtime.reload();
}
