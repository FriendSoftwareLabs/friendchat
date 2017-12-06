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

var library = window.library || {};
var friendUP = window.friendUP || {};
var hello = window.hello || {};

/*
    main
*/
(function( ns, undefined ) {
    ns.Main.prototype.addMenu = function() {
        var self = this;
        var modules = {
            type : 'folder',
            id : 'modules',
            name : View.i18n('i18n_modules'),
            faIcon : 'fa-folder-o',
        };
        
        var settingsItem = {
            type   : 'item',
            id     : 'account-settings',
            name   : View.i18n('i18n_account_settings'),
            faIcon : 'fa-cog',
        };
        
        var liveItem = {
            type   : 'item',
            id     : 'start-live',
            name   : View.i18n('i18n_start_live_session'),
            faIcon : 'fa-video-camera',
        };
        
        var aboutItem = {
            type   : 'item',
            id     : 'about',
            name   : View.i18n('i18n_about'),
            faIcon : 'fa-info',
        };
        
        var logoutItem = {
            type   : 'item',
            id     : 'logout',
            name   : View.i18n('i18n_log_out'),
            faIcon : 'fa-sign-out',
        };
        
        var quitItem = {
            type   : 'item',
            id     : 'quit',
            name   : View.i18n('i18n_quit'),
            faIcon : 'fa-close',
        };
        
        var menuItems = [
            modules,
            liveItem,
            settingsItem,
            aboutItem,
            logoutItem,
            quitItem,
        ];
        
        var conf = {
            id              : friendUP.tool.uid( 'menu' ),
            parentId        : 'main-menu',
            templateManager : hello.template,
            content         : menuItems,
            onnolistener    : onNoListener,
            onhide          : onHide,
            onclose         : onClose,
        };
        
        self.menu = new library.component.Menu( conf );
        function onNoListener( e ) { console.log( 'menu - no listener for event', e ); }
        function onHide( e ) { self.mainMenuContainer.classList.toggle( 'hidden', true ); }
        function onClose( e ) { console.log( 'menu was.. closed?' ); }
        
        self.menu.on( 'start-live', handleStartLive );
        self.menu.on( 'account-settings', handleAccountSettings );
        self.menu.on( 'about', handleAbout );
        self.menu.on( 'logout', handleLogout );
        self.menu.on( 'quit', handleQuit );
        
        function handleStartLive( e ) { self.view.sendMessage({ type : 'live' }); }
        function handleAccountSettings( e ) { self.account.showSettings(); }
        function handleAbout( e ) { self.view.sendMessage({ type : 'about' }); }
        function handleLogout( e ) { self.view.sendMessage({ type : 'logout' }); }
        function handleQuit( e ) { self.view.sendMessage({ type : 'quit' }); }
    }
})( library.view );

/*
    module control
*/
(function( ns, undefined ) {
    ns.ModuleControl.prototype.add = function( data ) {
        const self = this;
        if ( !data || !data.module ) {
            console.log( 'ModuleControl.add - invalid data', data );
            return;
        }
        
        const type = data.module.type;
        if ( 'presence' !== type && 'treeroot' !== type ) {
            console.log( 'ModuleControl.add - not a valid module for simple view', data );
            return;
        }
        
        self.addModule( data );
    }
})( library.view );

/* 
    base module
*/
(function( ns, undefined ) {
    ns.BaseModule.prototype.setCss = function() { return; }
    ns.BaseModule.prototype.initFoldit = function() { return; }
    ns.BaseModule.prototype.initStatus = function() {
        const self = this;
        self.connectionState = new library.component.StatusIndicator({
            containerId : self.connectionState,
            type        : 'icon',
            cssClass    : 'fa-circle',
            statusMap   : {
                offline    : 'Off',
                online     : 'On',
                open       : 'Warning',
                connecting : 'Notify',
                error      : 'Alert',
            },
        });
    }
    
})( library.view );

/*
    presence
*/
(function( ns, undefined ) {
    ns.Presence.prototype.getTitleString = function() {
        const self = this;
        return 'Conference rooms';
    }
    
    ns.Presence.prototype.buildElement = function() {
        const self = this;
        const title = self.getTitleString();
        const tmplId = 'simple-presence-module-tmpl';
        const conf = {
            clientId     : self.clientId,
            title        : title,
            connStateId  : self.connectionState,
            createRoomId : self.createRoomId,
            optionId     : self.optionMenu,
            contactsId   : self.contactsId,
        };
        const el = hello.template.getElement(  tmplId, conf );
        const cont = document.getElementById( self.containerId );
        cont.appendChild( el );
    }

})( library.view );


/*
    treeroot
*/
(function( ns, undefined ) {
    ns.Treeroot.prototype.getTitleString = function() {
        const self = this;
        return 'Contacts';
    }
    
    ns.Treeroot.prototype.buildElement = function() {
        const self = this;
        const title = self.getTitleString();
        const tmplId = 'simple-treeroot-module-tmpl';
        const conf = {
            clientId          : self.clientId,
            moduleTitle       : title,
            connectionStateId : self.connectionState,
            optionId          : self.optionMenu,
            contactsId        : self.contactsId,
            activeId          : self.activeId,
            inactiveId        : self.inactiveId,
        };
        
        const el = hello.template.getElement( tmplId, conf );
        const cont = document.getElementById( self.containerId );
        cont.appendChild( el );
    }
    
    
    ns.Treeroot.prototype.addMenu = function() {
        const self = this;
        const settingsId = friendUP.tool.uid( 'settings' );
        const settingsItem = {
            type : 'item',
            id : settingsId,
            name : 'Settings',
            faIcon : 'fa-cog',
        };
        
        const reconnectId = friendUP.tool.uid( 'reconnect' );
        const reconnectItem = {
            type : 'item',
            id : reconnectId,
            name : 'Reconnect',
            faIcon : 'fa-refresh',
        };
        
        self.menuId = friendUP.tool.uid( 'menu' );
        const folder = {
            type : 'folder',
            id : self.menuId,
            name : 'module',
            faIcon : 'fa-folder-o',
            items : [
                settingsItem,
                reconnectItem,
            ],
        };
        
        main.menu.add( folder, 'modules' );
        
        main.menu.on( settingsId, showSettings );
        main.menu.on( reconnectId, doReconnect );
        
        function showSettings() { self.optionSettings(); }
        function doReconnect() { self.optionReconnect(); }
    }
    
    ns.Treeroot.prototype.setCss = function() { return; }
    ns.Treeroot.prototype.initFoldit = function() { return; }
    
})( library.view );
