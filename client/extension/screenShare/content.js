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

window.addEventListener( 'message', message );
function message( e ) {
	const msg = e.data;
	if ( !msg || ( 'robotunicorns' !== msg.type ))
		return;
	
	var port = chrome.runtime.connect();
	port.onMessage.addListener( onSource );
	
	var res = msg.things;
	console.log( 'screen - res', res );
	port.postMessage( 'getDeviceId' );
	
	function onSource( sid ) {
		console.log( 'content.onSource', sid );
		res.data.data = sid;
		const str = JSON.stringify( res );
		window.parent.postMessage( str, res.origin );
	}
}