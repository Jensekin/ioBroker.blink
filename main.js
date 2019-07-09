'use strict';

/*
 * Created with @iobroker/create-adapter v1.15.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const blinkclass = require('node-blink-security');

// Load your modules here, e.g.:
// const fs = require("fs");

class Blink extends utils.Adapter {

    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'blink',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('objectChange', this.onObjectChange.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    createStateObjectsFromSummary(summary){
	this.log.info("start creating objects");
	const promises = [];
	Object.entries(summary.network).forEach( (networkAttr) => {
	    var key = networkAttr[0];
	    var val = networkAttr[1];
	    this.log.info("creating network object "+summary.network.name+'.'+key);
	    promises.push(this.setObjectNotExistsAsync(summary.network.name+'.'+key, {
                type: 'state',
                common: {
                    name: key,
                    type: typeof val,
                    role: 'indicator',
                    read: true,
                    write: false
                },
                native: {
                    id: summary.network.name+'.'+key
                }
            }));
	});
	summary.devices.forEach( (device) => {
	    Object.entries(device).forEach( (deviceAttr) => {
                var key = deviceAttr[0];
                var val = deviceAttr[1];
		promises.push(this.setObjectNotExistsAsync(summary.network.name+'.'+device.name+'.'+key, {
                    type: 'state',
                    common: {
                        name: key,
                        type: typeof val,
                        role: 'indicator',
                        read: true,
                        write: false
                    },
                    native: {
                        id: summary.network.name+'.'+device.name+'.'+key
                    }
                 }));
	    });
	});
	return promises;
    }

    updateStatesFromSummary(summary){
        Object.entries(summary.network).forEach( (networkAttr) => {
	    var key = networkAttr[0];
            var val = networkAttr[1];
            this.setState(summary.network.name+'.'+key, val, true);
        });
        summary.devices.forEach( (device) => {
            Object.entries(device).forEach( (deviceAttr) => {
                var key = deviceAttr[0];
                var val = deviceAttr[1];
		this.setState(summary.network.name+'.'+device.name+'.'+key, val, true);
            });
	})
    }

    pollStatusFromBlinkServers(scope, intsecs){
	scope.log.info("start polling from server. interval " + intsecs + " seconds.");
	scope.blinkapi.setupSystem().then(() => {
	    scope.log.info("connection set up");
            scope.blinkapi.getSummary().then((summary) => {
		scope.log.info("processing summary");
		let promises = scope.createStateObjectsFromSummary(summary);
		Promise.all(promises).then(() => {
                    scope.log.info("update states from summary");
		    scope.updateStatesFromSummary(summary);
	            scope.log.info("updated states, setting timer in "+intsecs+" seconds");
	            setTimeout(scope.pollStatusFromBlinkServers, intsecs * 1000, scope, intsecs);
		    scope.log.info("timer set, all is done");
	        }).catch((err) => {
		    scope.log.error("error: " + err);
		    //this.timeout = setTimeout(pollStatusFromBlinkServers(interval), interval * 60000);
		});
	    },function(error){
	        scope.log.error(error);
		//this.timeout = setTimeout(pollStatusFromBlinkServers(interval), interval * 60000);
	    })
	})
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        this.log.info('config URL: ' + this.config.url);
        this.log.info('config Username: ' + this.config.username);
        this.log.info('config Password: ' + this.config.password);
	this.log.info('config Interval: ' + this.config.interval);

	this.blinkapi = new blinkclass(this.config.username, this.config.password);
	this._authtoken = '';

        // in this template all states changes inside the adapters namespace are subscribed
        this.subscribeStates('*');
        this.pollStatusFromBlinkServers(this, this.config.interval);
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            this.log.info('cleaned everything up...');
            callback();
        } catch (e) {
            callback();
        }
    }

    /**
     * Is called if a subscribed object changes
     * @param {string} id
     * @param {ioBroker.Object | null | undefined} obj
     */
    onObjectChange(id, obj) {
        if (obj) {
            // The object was changed
            this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
        } else {
            // The object was deleted
            this.log.info(`object ${id} deleted`);
        }
    }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            if(state.ack === false){
                this.log.info(`state ${id} was changed from outside to: ${state.val} (ack = ${state.ack})`);
	    }
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }

    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires "common.message" property to be set to true in io-package.json
    //  * @param {ioBroker.Message} obj
    //  */
    // onMessage(obj) {
    // 	if (typeof obj === 'object' && obj.message) {
    // 		if (obj.command === 'send') {
    // 			// e.g. send email or pushover or whatever
    // 			this.log.info('send command');

    // 			// Send response in callback if required
    // 			if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
    // 		}
    // 	}
    // }

}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new Blink(options);
} else {
    // otherwise start the instance directly
    new Blink();
}
