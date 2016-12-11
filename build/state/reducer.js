"use strict";
var interfaces_1 = require("./interfaces");
var immutable_1 = require("immutable");
var vector2_1 = require("vector2");
var V = vector2_1.default;
//function dot(x1, y1, x2, y2) {
//    return x1 * x2 + y1 * y2;  
//}
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
    var player = { clientId: clientId, x: 100, y: 100, lastShot: 0, lastThrow: 0, health: 100 };
    return state.update('players', function (players) { return players.set(clientId, interfaces_1.SS_Map(player)); });
}
exports.playerJoin = playerJoin;
function playerLeave(state, clientId) {
    return state.update('players', function (players) { return players.delete(clientId); });
}
exports.playerLeave = playerLeave;
function updateProjectiles(state, tickInfo) {
    return state.update('projectiles', function (projectiles) {
        projectiles = projectiles.map(function (projectile, index) {
            var final;
            var type = projectile.get('type');
            var origin = new vector2_1.default(projectile.get('x'), projectile.get('y'));
            var direction = vector2_1.default.from(projectile.get('direction').toJS());
            var velocity = projectile.get('velocity');
            var travel = velocity * tickInfo.time;
            var _loop_1 = function () {
                var destination = origin.clone().add(direction.clone().setLength(travel));
                var intersections = [];
                var wall = void 0;
                state.get('world').get('walls').forEach(function (wall) {
                    var a = vector2_1.default.from(wall.get(0).toJS());
                    var b = vector2_1.default.from(wall.get(1).toJS());
                    var intersection = vector2_1.default.segmentsIntersection(origin, destination, a, b);
                    if (intersection)
                        intersections.push({ p: intersection, w: [a, b] });
                });
                var shortest = destination.distance(origin);
                var intersection = intersections.reduce(function (destination, intersection) {
                    var dist = intersection.p.distance(origin);
                    if (dist < shortest) {
                        shortest = dist;
                        return intersection;
                    }
                    else
                        return destination;
                }, { p: destination, w: null });
                final = intersection.p;
                if (!final.eql(destination)) {
                    if (type === 'bullet') {
                        projectile = projectile.set('destroy', true);
                        return "break";
                    }
                    else {
                        //projectile = projectile.set('destroy', true);
                        var travelled = origin.distance(final);
                        travel -= travelled;
                        if (travel <= 0.001) {
                            return "break";
                        }
                        var wallVector = intersection.w[1].clone().sub(intersection.w[0]).normalize();
                        var v = origin.clone().sub(intersection.w[0]);
                        var dot = v.dot(wallVector);
                        wallVector.setLength(dot);
                        wallVector.add(intersection.w[0]);
                        direction = origin.clone().add(wallVector.clone().sub(origin).mul(2)).sub(final).normalize().rotate180();
                        origin = origin.add(final.clone().sub(origin).mul(0.99));
                    }
                }
                else
                    return "break";
            };
            while (true) {
                var state_1 = _loop_1();
                if (state_1 === "break")
                    break;
            }
            if (type === 'throwable') {
                projectile = projectile
                    .set('velocity', Math.max(0, velocity - (projectile.get('deceleration') * tickInfo.time)))
                    .set('direction', interfaces_1.SS_List(direction.toArray()));
            }
            return projectile
                .update('x', function (x) { return final.x; })
                .update('y', function (y) { return final.y; })
                .update('msAlive', function (ms) { return ms + tickInfo.time; });
        });
        projectiles = projectiles.filter(function (projectile) {
            if (projectile.get('destroy'))
                return false;
            var x = projectile.get('x');
            if (x < 0 || x > 2000)
                return false;
            var y = projectile.get('y');
            if (y < 0 || y > 2000)
                return false;
            var ms = projectile.get('msAlive');
            var max = projectile.get('msAliveMax');
            if (ms > max)
                return false;
            return true;
        });
        return projectiles;
    });
}
exports.updateProjectiles = updateProjectiles;
function handleSpace(state, clientId, input, time) {
    if (!input.space)
        return state;
    var player = state.get('players').get(clientId);
    if (player.get('lastThrow') !== 0)
        return state;
    state = handleThrow(state, clientId, input, time);
    return state.update('players', function (players) {
        return players.update(clientId, function (player) {
            return player.set('lastThrow', interfaces_1.THROW_COOLDOWN);
        });
    });
}
exports.handleSpace = handleSpace;
function handleLMB(state, clientId, input, time) {
    if (!input.lmb)
        return state;
    var player = state.get('players').get(clientId);
    if (player.get('lastShot') !== 0)
        return state;
    state = handleShot(state, clientId, input, time);
    return state.update('players', function (players) {
        return players.update(clientId, function (player) {
            return player.set('lastShot', 100 / 1000);
        });
    });
}
exports.handleLMB = handleLMB;
function handleThrow(state, clientId, input, ms) {
    var player = state.get('players').get(clientId);
    var direction = interfaces_1.SS_List(new V(input.mouseX, input.mouseY)
        .sub(new V(player.get('x'), player.get('y')))
        .normalize().toArray());
    var bullet = interfaces_1.SS_Map({
        type: 'throwable',
        deceleration: 450,
        source: clientId,
        msAlive: 0,
        msAliveMax: 1.3,
        x: player.get('x'),
        y: player.get('y'),
        velocity: 500,
        direction: direction,
    });
    return state.update('projectiles', function (projectiles) { return projectiles.push(bullet); });
}
exports.handleThrow = handleThrow;
function handleShot(state, clientId, input, ms) {
    var player = state.get('players').get(clientId);
    var direction = interfaces_1.SS_List(new V(input.mouseX, input.mouseY)
        .sub(new V(player.get('x'), player.get('y')))
        .normalize().toArray());
    var bullet = interfaces_1.SS_Map({
        type: 'bullet',
        baseDamage: 15,
        source: clientId,
        msAlive: 0,
        msAliveMax: 5,
        x: player.get('x'),
        y: player.get('y'),
        velocity: interfaces_1.BULLET_VELOCITY,
        direction: direction,
    });
    return state.update('projectiles', function (projectiles) { return projectiles.push(bullet); });
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
        var a = vector2_1.default.from(wall[0]);
        var b = vector2_1.default.from(wall[1]);
        var length = a.distance(b);
        // Vector from origin to desired location
        var tv = new V(nx, ny).sub(a);
        // Unit vector of the wall
        var unit = b.clone().sub(a).setLength(1);
        // Dot product between player desired destination and the given wall
        var dp = tv.dot(unit);
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
    var _loop_2 = function (clientId) {
        var input = inputs[clientId];
        state = state.update('players', function (players) {
            players = players.update(clientId, function (player) {
                if (!player)
                    return player;
                player = player.update('lastShot', function (lastShot) { return Math.max(0, lastShot - tickInfo.time); });
                player = player.update('lastThrow', function (lastThrow) { return Math.max(0, lastThrow - tickInfo.time); });
                player = updatePlayerMovement(state, player, input, tickInfo);
                return player;
            });
            return players;
        });
        state = handleLMB(state, input.clientId, input, tickInfo.time);
        state = handleSpace(state, clientId, input, tickInfo.time);
    };
    for (var clientId in inputs) {
        _loop_2(clientId);
    }
    return state;
}
exports.updatePlayers = updatePlayers;
function actionTick(ms, inputs, events) {
    return { type: interfaces_1.ACTION_TYPE.TICK, ms: ms, inputs: inputs, events: events };
}
exports.actionTick = actionTick;
