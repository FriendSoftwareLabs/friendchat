chrome.runtime.onConnect.addListener( connection );
function connection( port ) {
	console.log( 'background.connection' );
	port.onMessage.addListener( onMessage );
	
	function onMessage( e ) {
		console.log( 'background.onMessage', e );
		chrome.desktopCapture.chooseDesktopMedia(
			[ 'screen', 'window' ],
			port.sender.tab,
			onSource
		);
	}
	
	function onSource( sourceId ) {
		console.log( 'background.onSource', sourceId );
		port.postMessage({ sid : sourceId });
	}
}