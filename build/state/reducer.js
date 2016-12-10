"use strict";
var interfaces_1 = require("./interfaces");
var immutable_1 = require("immutable");
var vector2_1 = require("vector2");
var V = vector2_1.default;
function dot(x1, y1, x2, y2) {
    return x1 * x2 + y1 * y2;
}
exports.reducer = function (state, action) {
    switch (action.type) {
        case interfaces_1.ACTION_TYPE.TICK:
            return tick(state, { time: action.ms / 1000, inputs: action.inputs, events: action.events });
        case interfaces_1.ACTION_TYPE.INIT_STATE:
            return immutable_1.fromJS(action.state);
        default:
            return interfaces_1.DEFAULT_STATE;
    }
};
function tick(state, tickInfo) {
    var time = tickInfo.time;
    var inputs = tickInfo.inputs;
    var events = tickInfo.events;
    events.forEach(function (event) {
        switch (event.type) {
            case 'CLIENT_DISCONNECT':
                state = playerLeave(state, event.clientId);
                break;
            case 'CLIENT_CONNECT':
                state = playerJoin(state, event.clientId);
                break;
        }
    });
    state = updatePlayers(state, tickInfo);
    state = updateProjectiles(state, tickInfo);
    return state;
}
exports.tick = tick;
function playerJoin(state, clientId) {
    var player = { clientId: clientId, x: 100, y: 100, lastShot: 0, health: 100 };
    return state.update('players', function (players) { return players.set(clientId, interfaces_1.SS_Map(player)); });
}
exports.playerJoin = playerJoin;
function playerLeave(state, clientId) {
    return state.update('players', function (players) { return players.delete(clientId); });
}
exports.playerLeave = playerLeave;
function updateProjectiles(state, tickInfo) {
    return state.update('projectiles', function (projectiles) {
        return projectiles.map(function (projectile) {
            var direction = projectile.get('direction');
            var velocity = projectile.get('velocity') * (tickInfo.time);
            var vector = new vector2_1.default(direction.get(0), direction.get(1)).setLength(velocity);
            return projectile.update('x', function (x) { return x + vector.x; }).update('y', function (y) { return y + vector.y; });
        });
    });
}
exports.updateProjectiles = updateProjectiles;
function handleLMB(state, clientId, input, time) {
    var bulletWasFired = false;
    var player = state.get('players').get(clientId);
    state = state.update('projectiles', function (projectiles) {
        var lastShot = player.get('lastShot');
        if (lastShot === 0) {
            bulletWasFired = true;
            projectiles = handleShot(projectiles, player, input, time);
        }
        return projectiles;
    });
    if (bulletWasFired)
        state = state.update('players', function (players) {
            return players.update(player.get('clientId'), function (player) {
                return player.set('lastShot', 100 / 1000);
            });
        });
    return state;
}
exports.handleLMB = handleLMB;
function handleShot(projectiles, player, input, ms) {
    var direction = interfaces_1.SS_List(new V(input.mouseX, input.mouseY)
        .sub(new V(player.get('x'), player.get('y')))
        .normalize().toArray());
    var bullet = interfaces_1.SS_Map({
        baseDamage: 15,
        source: player.get('clientId'),
        msAlive: 0,
        x: player.get('x'),
        y: player.get('y'),
        velocity: interfaces_1.BULLET_VELOCITY,
        direction: direction,
    });
    return projectiles.push(bullet);
}
exports.handleShot = handleShot;
function updatePlayerMovement(state, player, input, tickInfo) {
    var time = tickInfo.time;
    var ox = player.get('x');
    var oy = player.get('y');
    var nx = ox;
    var ny = oy;
    var playerRadius = interfaces_1.PLAYER_RADIUS;
    var speed = interfaces_1.MOVEMENT_SPEED;
    if (input.left)
        nx += -speed * time;
    if (input.right)
        nx += speed * time;
    if (input.up)
        ny += -speed * time;
    if (input.down)
        ny += speed * time;
    var world = state.get('world');
    var walls = world.get('walls');
    walls.forEach(function (iwall) {
        var wall = iwall.toJS();
        var a = new V(wall[0][0], wall[0][1]);
        var b = new V(wall[1][0], wall[1][1]);
        var length = a.distance(b);
        // Vector from origin to desired location
        var tv = new V(nx, ny).sub(a);
        // Unit vector of the wall
        var unit = b.clone().sub(a).setLength(1);
        // Dot product between player desired destination and the given wall
        var dp = dot(tv.x, tv.y, unit.x, unit.y);
        // If the dp is too small or too large, then there will be no collision at the players desired location
        if (dp < 0 - playerRadius || dp > length + playerRadius) { }
        else {
            // Repurpose the wall unit vector to be the point of contact with the wall
            unit.setLength(dp);
            unit.add(a);
            // v becomes the vector/segment between the desired location and the point of contact, pointing away from the point of contact
            var v = new V(nx, ny).sub(unit);
            // distance between the desired location and the point of contact
            var dist = v.getLength();
            // if the distance is greater than the player radius, then the player is safe to move
            if (dist > playerRadius) { }
            else {
                // Place the player as close to the wall as possible without colliding
                unit.add(v.setLength(playerRadius + 1));
                nx = unit.x;
                ny = unit.y;
            }
        }
    });
    return player.set('x', nx).set('y', ny);
}
exports.updatePlayerMovement = updatePlayerMovement;
function updatePlayers(state, tickInfo) {
    var inputs = tickInfo.inputs;
    var _loop_1 = function (clientId) {
        var input = inputs[clientId];
        state = state.update('players', function (players) {
            players = players.update(clientId, function (player) {
                if (!player)
                    return player;
                player = player.update('lastShot', function (lastShot) { return Math.max(0, lastShot - tickInfo.time); });
                player = updatePlayerMovement(state, player, input, tickInfo);
                return player;
            });
            return players;
        });
        if (input.lmb)
            state = handleLMB(state, input.clientId, input, tickInfo.time);
    };
    for (var clientId in inputs) {
        _loop_1(clientId);
    }
    return state;
}
exports.updatePlayers = updatePlayers;
function actionTick(ms, inputs, events) {
    return { type: interfaces_1.ACTION_TYPE.TICK, ms: ms, inputs: inputs, events: events };
}
exports.actionTick = actionTick;
