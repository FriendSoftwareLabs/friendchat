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

'user strict';

// available modules TODO : define in config or read from filessytem
const Presence = require( './Presence' );
const Treeroot = require( './Treeroot' );
const IRC = require( './IRC' );
const Telegram = require( './Telegram' );

const log = require( './Log' )( 'ModCtrl' );
const modLog = require( './Log' )( 'ModuleProxy' );
const DbModule = require( './DbModule' );
const MsgProxy = require( './MsgProxy' );
const util = require( 'util' );

var ns = {};
ns.ModCtrl = function( conf ) {
	if ( !( this instanceof ns.ModCtrl ))
		return new ns.ModCtrl( conf );
	
	const self = this;
	self.db = conf.db;
	self.accountId = conf.accountId;
	self.allowAdvanced = conf.allowAdvanced;
	self.onsend = conf.onsend;
	
	self.modules = {};
	self.eventMap = null;
	self.init();
}

// Public

ns.ModCtrl.prototype.initializeModules = function() {
	const self = this;
	self.load( modsBack );
	function modsBack( modules ) {
		modules = self.sortModules( modules );
		var hasPresenceModule = modules.some( isPresence );
		if ( !hasPresenceModule ) {
			const pres = {
				type     : 'presence',
				settings : {
					
				},
			};
			self.create( pres );
		}
		
		modules.forEach( start );
	}
	function start( module ) { self.start( module ); }
	function isPresence( module ) { return !!( 'presence' === module.type ); }
}

ns.ModCtrl.prototype.initializeClient = function( sessionId ) {
	const self = this;
	self.load( modsBack );
	function modsBack( modules ) {
		modules = self.sortModules( modules );
		if ( !modules.length ) {
			sendToClient( null );
			return;
		}
		
		modules.forEach( sendToClient );
	}
	
	function sendToClient( modConf ) {
		var msg = {
			type : 'add',
			data : modConf,
		};
		self.sendMod( msg, sessionId );
	}
}

ns.ModCtrl.prototype.addDefaultModules = function( modules, defaultUsername ) {
	const self = this;
	let modConfs = modules.map( buildConf );
	log( 'modConfs', modConfs );
	modConfs = modConfs.filter( mod => null != mod );
	modConfs = self.sortModules( modConfs );
	modConfs.forEach( create );
	
	function buildConf( mod ) {
		let MOD = self.available[ mod ];
		if ( !MOD )
			return null;
		
		let conf = self.getModuleDefaultConf( mod );
		conf = MOD.prototype.getSetup( conf, defaultUsername );
		conf.type = mod;
		conf.settings = conf.settings || {};
		return conf;
	}
	
	function create( modConf ) {
		log( 'create', modConf );
		self.create( modConf )
	}
}

ns.ModCtrl.prototype.receiveMsg = function( e, sid ) {
	const self = this;
	var mod = self.modules[ e.type ];
	if ( mod ) {
		mod.receiveMsg( e.data, sid );
		return null;
	}
	
	var handler = self.eventMap[ e.type ];
	if ( handler ) {
		handler( e.data, sid );
		return null;
	}
	
	//log( 'receiveMessage - unknown event', e );
	return e;
}

ns.ModCtrl.prototype.close = function() {
	const self = this;
	killRunning();
	
	delete self.accountId;
	delete self.db;
	delete self.onsend;
	
	function killRunning() {
		for ( var cid in self.modules )
			self.modules[ cid ].kill();
		
	}
}


// Pirvate

ns.ModCtrl.prototype.init = function() {
	const self = this;
	// these ( Presence, Tree.., etc ) are loaded/require at the top ^^^
	self.available = {
		'presence' : Presence,
		'treeroot' : Treeroot,
		'irc'      : IRC,
		'telegram' : Telegram,
	};
	
	self.eventMap = {
		'create' : create,
		'remove' : remove,
	};
	
	function create( e, sid ) { self.create( e, sid ); }
	function remove( e, sid ) { self.remove( e, sid ); }
}

ns.ModCtrl.prototype.create = function( modConf, sessionId, callback ) {
	const self = this;
	var dbSet = new DbModule( self.db, self.accountId );
	var dbGet = null;
	
	dbSet.once( 'ready', setReady );
	function setReady() {
		dbSet.set( modConf, setBack );
	}
	function setBack( modId ) {
		if ( !modId ) {
			done( false );
			return;
		}
		
		done( modId );
		loadMod( modId );
	}
	
	function loadMod( modId ) {
		dbGet = new DbModule( self.db, self.accountId, modId );
		dbGet.once( 'ready', getReady );
	}
	function getReady() {
		dbGet.get( getBack );
	}
	function getBack( mod ) {
		self.add( mod );
		dbGet.conn.release();
	}
	
	function done( res ) {
		if ( dbSet )
			dbSet.conn.release();
		
		var res = {
			type : 'create',
			data : res,
		};
		self.sendMod( res, sessionId );
		
		if ( callback )
			callback( res );
	}
}

ns.ModCtrl.prototype.sortModules = function( modList ) {
	const self = this;
	if ( !self.allowAdvanced )
		modList = getSimpleList( modList );
	
	modList.sort( presenceFirst );
	return modList;
	
	function presenceFirst( a, b ) {
		if ( 'presence' === a.type )
			return -1;
		
		if ( 'presence' === b.type )
			return 1;
		
		return 0;
	}
	
	function getSimpleList( mods ) {
		let simpleList = [];
		let hasTreeroot = false;
		let treerootConf = self.getModuleDefaultConf( 'treeroot' );
		log( 'treerootconf', treerootConf );
		mods.forEach( isAllowed );
		return simpleList;
		
		function isAllowed( mod ) {
			log( 'isAllowed', mod );
			if ( 'presence' === mod.type ) {
				simpleList.push( mod );
				return;
			}
			
			if ( 'treeroot' !== mod.type )
				return;
			
			if ( hasTreeroot )
				return;
			
			if ( mod.host !== treerootConf.host )
				return;
			
			hasTreeroot = true;
			simpleList.push( mod );
		}
	}
}

ns.ModCtrl.prototype.add = function( module ) {
	const self = this;
	self.start( module );
	var addEvent = {
		type : 'module',
		data : {
			type : 'add',
			data : module,
		},
	};
	self.send( addEvent );
}

ns.ModCtrl.prototype.remove = function( moduleId ) {
	const self = this;
	var module = self.modules[ moduleId ];
	if ( !module ) {
		log( 'ModCtrl.remove - no such module', {
			mid : moduleId,
			mods : self.modules,
		});
		done( false );
		return;
	}
	
	module.kill( killBack );
	function killBack() {
		delete self.modules[ moduleId ];
		initDB();
		done( true );
	}
	
	function initDB() {
		var dbModule = new DbModule( self.db, self.accountId );
		dbModule.once( 'ready', dbRemove );
		function dbRemove() {
			dbModule.remove( moduleId, remBack );
		}
		
		function remBack( res ) {
			dbModule.conn.release();
			done( !!res );
		}
	}
	
	function done( success ) {
		if ( success )
			sendRemove();
	}
	
	function sendRemove() {
		var removeEvent = {
			type : 'module',
			data : {
				type : 'remove',
				data : moduleId,
			},
		};
		self.send( removeEvent );
	}
}

ns.ModCtrl.prototype.load = function( callback ) {
	const self = this;
	var dbModule = new DbModule( self.db, self.accountId );
	dbModule.once( 'ready', dbReady );
	function dbReady() { dbModule.get( modsBack ); }
	function modsBack( modules ) {
		dbModule.conn.release();
		callback( modules );
	}
}

ns.ModCtrl.prototype.start = function( mod ) {
	const self = this;
	var clientId = mod.clientId;
	var conn = self.modules[ clientId ];
	if ( conn ) {
		log( 'module already initialized????', { mod : mod, mods : self.modules });
		return false;
	}
	
	conn = new ns.ModuleProxy({
		moduleId       : clientId,
		send           : toClient,
		persistSetting : persistSetting,
		getSettings    : getSettings,
	});
	
	var Module = self.available[ mod.type ];
	if ( !Module ) {
		log( 'startModule - no constructor for', mod );
		return;
	}
	
	new Module( conn, clientId );
	self.modules[ clientId ] = conn;
	const conf = self.getModuleDefaultConf( mod.type );
	if ( !conf )
		throw new Error( 'start - module does not have default conf:' + mod.type );
	
	const init = {
		mod  : mod,
		conf : conf,
	};
	conn.connect( init );
	
	function toClient( msg, sessionId ) {
		self.send( msg, sessionId );
	}
	function persistSetting( pair, callback ) {
		self.persistSetting( clientId, pair, callback );
	}
	function getSettings( callback ) {
		return self.getSettings( clientId, callback  );
	}
}

ns.ModCtrl.prototype.stop = function( moduleId ) {
	const self = this;
	var _module = self.modules[ moduleId ];
	if ( !_module.kill ) {
		log( 'module has no end, cannot', _module );
		return;
	}
	
	self.modules[ moduleId ].kill();
	delete self.modules[ moduleId ];
}

ns.ModCtrl.prototype.getModuleDefaultConf = function( modType ) {
	const self = this;
	return global.config.server.defaults.module[ modType ] || null;
}


ns.ModCtrl.prototype.persistSetting = function( moduleId, pair, callback ) {
	const self = this;
	var dbModule = new DbModule( self.db, self.accountId, moduleId );
	dbModule.once( 'ready', dbReady );
	function dbReady( err ) {
		if ( err ) {
			log( 'persistSetting - db error', err );
			done( false );
			return;
		}
		
		dbModule.updateSetting( pair, updateBack );
	}
	
	function updateBack( success ) {
		if ( !success )
			log( 'persistSetting - failed to update', pair );
		
		done( success );
	}
	
	function done( success ) {
		dbModule.conn.release();
		if ( !callback )
			throw new Error( 'therse hould be a callback here, surely?' );
		pair.success = success;
		callback( pair );
	}
}

ns.ModCtrl.prototype.getSettings = function( moduleId, callback ) {
	const self = this;
	var dbModule = new DbModule( self.db, self.accountId, moduleId );
	dbModule.once( 'ready', dbReady );
	function dbReady() {
		dbModule.get( getBack );
	}
	
	function getBack( module ) {
		done( module );
	}
	
	function done( module ) {
		if ( dbModule )
			dbModule.conn.release();
		
		callback( module );
	}
}

ns.ModCtrl.prototype.sendMod = function( msg, sid ) {
	const self = this;
	var wrap = {
		type : 'module',
		data : msg,
	};
	self.send( wrap, sid );
}

ns.ModCtrl.prototype.send = function( data, sid ) {
	const self = this;
	if ( !self.onsend )
		return;
	
	self.onsend( data, sid );
}


// MODULE PROXY
ns.ModuleProxy = function( conf ) {
	if ( !( this instanceof ns.ModuleProxy ))
		return new ns.ModuleProxy( conf );
	
	MsgProxy.call( this, conf );
	const self = this;
	self.moduleId = conf.moduleId;
	self.persistModuleSetting = conf.persistSetting;
	self.getModuleSettings = conf.getSettings;
	self.state = {
		type : 'offline',
		data : {},
	};
	
	self.persistQueue = [];
	self.doingPersist = false;
	
	self.moduleProxyInit();
}

util.inherits( ns.ModuleProxy, MsgProxy );

// PUBLIC ( use in module )

// Emits a 'connection' event to the client
ns.ModuleProxy.prototype.setState = function( type, data ) {
	const self = this;
	if ( !type ) {
		self.emitState();
		return;
	}
	
	if ( 'string' !== typeof( type ))
		self.state = type;
	else
		self.state = {
			type : type,
			data : data || Date.now(),
		};
	
	self.emitState();
}

ns.ModuleProxy.prototype.getState = function() {
	const self = this;
	return self.state;
}

// set a value in the db
ns.ModuleProxy.prototype.persistSetting = function( msg, callback ) {
	const self = this;
	if ( !self.persistModuleSetting ) {
		callback( null );
		return;
	}
	
	if ( self.doingPersist ) {
		self.queuePersist( msg, callback );
		return;
	}
	
	self.doingPersist = true;
	self.persistModuleSetting( msg, persistDone );
	
	function persistDone( res ) {
		self.doingPersist = false;
		self.checkPersistQueue();
		callback( res );
	}
}

// read settings from db
ns.ModuleProxy.prototype.getSettings = function( callback ) {
	const self = this;
	if ( !self.getModuleSettings ) {
		callback( null );
		return;
	}
	
	return self.getModuleSettings( callback );
}

ns.ModuleProxy.prototype.close = function() {
	const self = this;
	self.release();
}

// Pirvate ( calling these means you are doing it wrong )

ns.ModuleProxy.prototype.moduleProxyInit = function() {
	const self = this;
}



ns.ModuleProxy.prototype.emitState = function( sessionId ) {
	const self = this;
	var stateEvent = {
		type : 'connection',
		data : self.state,
	};
	self.send( stateEvent, sessionId );
}

ns.ModuleProxy.prototype.connect = function( conf ) {
	const self = this;
	self.emit( 'connect', conf );
}

ns.ModuleProxy.prototype.kill = function( callback ) {
	const self = this;
	delete self.toClient;
	delete self.persistModuleSetting;
	delete self.getModuleSettings;
	
	if ( self.persistQueue.length )
		returnPersistQueue();
	
	self.persistQueue = [];
	
	self.emit( 'kill', killBack );
	
	function killBack() {
		delete self.state;
		
		self.release();
		if ( callback )
			callback();
	}
	
	function returnPersistQueue() {
		self.persistQueue.forEach( nullCallback );
		function nullCallback( item ) {
			item.callback( null );
		}
	}
}

ns.ModuleProxy.prototype.handle = function( event, data ) {
	const self = this;
	log( 'MP.handle', event );
	self.emit( event, data );
}

ns.ModuleProxy.prototype.queuePersist = function( msg, callback ) {
	const self = this;
	var data = {
		msg : msg,
		callback : callback,
	};
	self.persistQueue.push( data );
}

ns.ModuleProxy.prototype.checkPersistQueue = function() {
	const self = this;
	if ( !self.persistQueue.length )
		return;
	
	var next = self.persistQueue.pop();
	self.persistSetting( next.msg, next.callback );
}

module.exports = ns.ModCtrl;