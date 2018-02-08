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

console.log( 'content.js loaded' );

ScreenShare = function() {
	const self = this;
	self.webReturn = null;
	self.webEventMap = null;
	self.bgEventMap = null;
	
	self.init();
}

ScreenShare.prototype.init = function() {
	const self = this;
	console.log( 'ext.ScreenShare.init' );
	self.webEventMap = {
		init      : init,
		ready     : isReady,
		getSource : getSource,
	};
	
	function init( event, request ) {
		console.log( 'ext.ScreenShare - init msg', {
			event : event,
			request : request,
		});
		
		self.sendToWeb( true, request );
	}
	function isReady( e, r ) { self.handleIsReady( e, r ); }
	function getSource( e, r ) { self.handleGetSource( e, r ); }
	
	self.bgEventMap = {
		installed : isInstalled,
		sourceId  : sourceId,
	};
	
	function sourceId( e ) { self.handleSourceId( e ); }
	function isInstalled( e ) { self.handleIsInstalled( e ); }
	
	window.addEventListener( 'message', webMessage );
	function webMessage( e ) {
		const msg = e.data;
		if ( !msg || 'robotunicorns' !== msg.type )
			return;
		
		self.handleWebMsg( msg.data );
	}
	
	self.port = chrome.runtime.connect();
	self.port.onMessage.addListener( onSource );
	function onSource( e ) { self.handleBackgroundMsg( e ); }
}

ScreenShare.prototype.handleWebMsg = function( msg ) {
	const self = this;
	console.log( 'handleWebMsg', msg );
	if ( !msg )
		return;
	
	let request = msg.request;
	let event = msg.event;
	const handler = self.webEventMap[ event.type ];
	if ( !handler ) {
		console.log( 'handleWebMsg - no handler for event', event );
		return;
	}
	
	handler( event.data, request );
}

ScreenShare.prototype.handleIsReady = function( event, request ) {
	const self = this;
	console.log( 'handleIsReady', {
		event  : event,
		req    : request,
	});
	
	self.sendToWeb( true, request );
}

ScreenShare.prototype.handleGetSource = function( e, request ) {
	const self = this;
	self.sourceReq = request;
	const getSource = {
		type : 'getSource',
	};
	self.sendToBackground( getSource );
}

ScreenShare.prototype.handleBackgroundMsg = function( event ) {
	const self = this;
	console.log( 'handleBackgroundMsg', event );
	const handler = self.bgEventMap[ event.type ];
	if ( !handler ) {
		console.log( 'ext.ScreenShare.handleBackgorundMsg - no handler for', event );
		return;
	}
	
	handler( event.data );
}

ScreenShare.prototype.handleSourceId = function( sid ) {
	const self = this;
	console.log( 'ext.ScreenShare.handleSourceId', sid );
	if ( !self.sourceReq )
		return;
	
	let request = self.sourceReq;
	self.sendToWeb( sid, request );
	self.sourceReq = null;
}

ScreenShare.prototype.sendToWeb = function( result, request ) {
	const self = this;
	console.log( 'sendToWeb', {
		result : result,
		request : request,
	});
	
	request.data.data.data = result;
	const str = JSON.stringify( request );
	window.parent.postMessage( str, request.origin );
}

ScreenShare.prototype.sendToBackground = function( event ) {
	const self = this;
	console.log( 'sendToBackground', event );
	if ( !event )
		return;
	
	self.port.postMessage( event );
}

window.screenShare = new ScreenShare();
