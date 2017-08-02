chrome.runtime.onConnect.addListener( connection );
function connection( port ) {
	console.log( 'background.connection' );
	port.onMessage.addListener( onMessage );
	
	function onMessage( e ) {
		console.log( 'background.onMessage', e );
		chrome.desktopCapture.chooseDesktopMedia(
			[ 'window', 'screen' ],
			port.sender.tab,
			onSource
		);
	}
	
	function onSource( sourceId, opts ) {
		console.log( 'background.onSource', sourceId );
		port.postMessage({
			sid  : sourceId,
			opts : opts,
		});
	}
}