"use strict";
var client_1 = require('redux-gateway/build/client');
var reducer_1 = require('../state/reducer');
var redux_1 = require('redux');
var store = redux_1.createStore(reducer_1.reducer);
var client = new client_1.StateClient(function (err, state, clientId) { return store.dispatch({ type: reducer_1.ACTION_TYPE.INIT_STATE, state: state }); }, function (actions) { return actions.forEach(store.dispatch); }, '74.101.153.92');
var canvas = document.getElementById('canvas');
var ctx = canvas.getContext('2d');
store.subscribe(function () {
    ctx.fillStyle = '#e1e1e1';
    ctx.fillRect(0, 0, 600, 600);
    var state = store.getState().toJS();
    for (var clientId in state.players) {
        var player = state.players[clientId];
        ctx.beginPath();
        ctx.fillStyle = 'red';
        ctx.arc(player.x, player.y, 20, 0, Math.PI * 2);
        ctx.fill();
    }
    state.map.walls.forEach(function (wall) {
        ctx.beginPath();
        ctx.moveTo(wall[0][0], wall[0][1]);
        ctx.lineTo(wall[1][0], wall[1][1]);
        ctx.lineWidth = 10;
        ctx.stroke();
    });
    state.projectiles.forEach(function (projectile) {
        ctx.beginPath();
        ctx.fillStyle = 'yellow';
        ctx.arc(projectile.x, projectile.y, 3, 0, Math.PI * 2);
        ctx.fill();
    });
    //console.log(JSON.stringify(store.getState().toJS().players));
});
var KEY_CODES = [87, 65, 83, 68];
var KEY_NAMES = ['up', 'left', 'down', 'right'];
var MOUSE_CODES = [0];
var MOUSE_NAMES = ['lmb'];
document.addEventListener('keydown', function (e) {
    var index = KEY_CODES.indexOf(e.keyCode);
    index > -1 ? client.sendInput(KEY_NAMES[index], true) : null;
});
document.addEventListener('keyup', function (e) {
    var index = KEY_CODES.indexOf(e.keyCode);
    index > -1 ? client.sendInput(KEY_NAMES[index], false) : null;
});
document.addEventListener('mousedown', function (e) {
    if (e.button === 0)
        client.sendInput('lmb', true);
});
document.addEventListener('mouseup', function (e) {
    if (e.button === 0)
        client.sendInput('lmb', false);
});
document.addEventListener('mousemove', function (e) {
    client.sendInput('mouseX', e.clientX);
    client.sendInput('mouseY', e.clientY);
});
