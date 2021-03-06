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
        this.on('stateChange', this.onStateChange.bind(this));
    }

    createStateObjectsFromSummary(summary){
	this.log.debug("start creating objects");
	const promises = [];
	Object.entries(summary.network).forEach( (networkAttr) => {
	    var key = networkAttr[0];
	    var val = networkAttr[1];
	    this.log.debug("creating network object "+summary.network.name+'.'+key);
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
	scope.log.debug("start polling from server. interval " + intsecs + " seconds.");
	scope.blinkapi.setupSystem().then(() => {
	    scope.log.debug("connection set up");
            scope.blinkapi.getSummary().then((summary) => {
		scope.log.debug("processing summary");
		let promises = scope.createStateObjectsFromSummary(summary);
		Promise.all(promises).then(() => {
                    scope.log.debug("update states from summary");
		    scope.updateStatesFromSummary(summary);
	            scope.log.debug("updated states, setting timer in "+intsecs+" seconds");
	            setTimeout(scope.pollStatusFromBlinkServers, intsecs * 1000, scope, intsecs);
		    scope.log.debug("timer set, all is done");
	        }).catch((err) => {
		    scope.log.error("error: " + err);
		    setTimeout(scope.pollStatusFromBlinkServers, intsecs * 1000, scope, intsecs);
		});
	    },function(error){
	        scope.log.error(error);
		setTimeout(scope.pollStatusFromBlinkServers, intsecs * 1000, scope, intsecs);
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
        this.log.debug('config URL: ' + this.config.url);
        this.log.debug('config Username: ' + this.config.username);
        this.log.debug('config Password: ' + this.config.password);
	this.log.debug('config Interval: ' + this.config.interval);

	this.blinkapi = new blinkclass(this.config.username, this.config.password);
	this._authtoken = '';

        // in this template all states changes inside the adapters namespace are subscribed
        this.subscribeStates('*');
        this.pollStatusFromBlinkServers(this, this.config.interval);
    }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            if(state.ack === true){
                return;
	    }
	    this.log.debug(`state ${id} was changed from outside to: ${state.val}`);
	    var idsplit = id.split('.');
	    var statename = idsplit[idsplit.length-1];
	    if(idsplit.length == 4 && statename == 'armed'){
		var networkname = idsplit[idsplit.length-2];
		if(state.val === true) {
		    var statetext = 'armed'
                } else {
		    var statetext = 'disarmed'
		}
		this.log.info('someone '+statetext+' ('+state.val+') the network '+networkname);
		this.blinkapi.setupSystem(networkname).then(() => {
		    this.blinkapi.setArmed(state.val);
		},function(error){
                    this.log.error(error);
                })
	    }
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }

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
