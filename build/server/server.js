"use strict";
var reducer_1 = require('./../state/reducer');
var redux_gateway_1 = require('redux-gateway');
var redux_1 = require('redux');
var SSServer = (function () {
    function SSServer() {
        var _this = this;
        this.inputs = {};
        this.server = new redux_gateway_1.StateServer(function () { return _this.store.getState(); }, this.inputHandler.bind(this));
        this.store = redux_1.createStore(reducer_1.reducer, redux_1.applyMiddleware(this.server.reduxMiddleware.bind(this.server)));
        this.server.registerEventHandler(function (event) {
            switch (event.type) {
                case 'CLIENT_DISCONNECT':
                    delete _this.inputs[event.clientId];
                    break;
            }
            return false;
        });
        this.start();
        console.log('Started...');
    }
    SSServer.prototype.inputHandler = function (input) {
        var clientId = input.clientId;
        var inputs = this.inputs[clientId] || (this.inputs[clientId] = { clientId: clientId });
        inputs[input.name] = input.value;
    };
    SSServer.prototype.start = function () {
        var _this = this;
        var ms = new Date().getTime();
        setInterval(function () {
            var now = new Date().getTime();
            ms = now - ms;
            _this.store.dispatch(reducer_1.actionTick(ms, _this.inputs, _this.server.getEvents()));
            _this.server.flush();
            ms = now;
        }, 1000 / 30);
    };
    return SSServer;
}());
exports.SSServer = SSServer;
