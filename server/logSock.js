#!/usr/bin/env node

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

const fs = require( 'fs' );
const fork = require( 'child_process' ).fork;
const log = require( './component/Log' )( 'LogSokk' );
const logEvent = require( './component/Log' )( 'log' );
const WSS = require( './component/WebSocketServer' );
const uuid = require( './component/UuidPrefix' )();

const conf = require( './component/Config' ); // not really bothering with saving the obj,
                                              // it writes itself to global.config

if ( conf.server.dev )
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

//application state
const state = {
	clients : {},
};

state.config = global.config.get();

setup();
async function setup() {
	log( 'load certs' );
	const tls = await loadCert( state.config.server.tls );
	const logPort = 12321;
	
	log( 'start ws server' );
	const wssConf = {
		port : logPort,
		tls  : tls,
	};
	const wss = new WSS( wssConf );
	wss.on( 'connection', handleClient );
	
	log( 'listening..' );
}

function handleClient( conn ) {
	const id = uuid.get( 'client' );
	log( 'handleClient', id );
	state.clients[ id ] = conn;
	
	conn.on( 'error', e => {});
	conn.on( 'close', e => closeClient( id ));
	conn.on( 'message', handleClientEvent );
	
}

function closeClient( connId ) {
	log( 'closeClient', connId );
	const conn = state.clients[ connId ];
	delete state.clients[ connId ];
	if ( !conn )
		return;
	
	conn.removeAllListeners( 'message' );
	conn.removeAllListeners( 'error' );
	conn.removeAllListeners( 'close' );
}

function handleClientEvent( eventStr ) {
	let event = null;
	try {
		event = JSON.parse( eventStr );
	} catch( ex ) {
		log( 'handleClientEvent - could not parse', eventStr );
		return;
	}
	
	if ( 'log' === event.type ) {
		logEvent( ...event.data );
		return;
	}
}

async function loadCert( paths ) {
	log( 'loadCert', paths );
	const opt = { encoding : 'ascii' };
	return new Promise(( resolve, reject ) => {
		const tls = {};
		tls.key = fs.readFileSync( paths.keyPath, opt );
		tls.cert = fs.readFileSync( paths.certPath, opt );
		if ( !tls.key || !tls.cert ) {
			reject( tls );
			return;
		}
		
		resolve( tls );
	});
}