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
	/*
	res.data.data.deviceId = 'jepppers';
	const str = JSON.stringify( res );
	window.parent.postMessage( str, res.origin );
	*/
	
	function onSource( sid ) {
		console.log( 'content.onSource', sid );
		res.data.data = sid;
		const str = JSON.stringify( res );
		window.parent.postMessage( str, res.origin );
	}
}