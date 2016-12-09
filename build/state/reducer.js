"use strict";
var Immutable = require('immutable');
var vector2_1 = require('vector2');
var V = vector2_1.default;
(function (ACTION_TYPE) {
    ACTION_TYPE[ACTION_TYPE["INIT_STATE"] = 0] = "INIT_STATE";
    ACTION_TYPE[ACTION_TYPE["TICK"] = 1] = "TICK";
})(exports.ACTION_TYPE || (exports.ACTION_TYPE = {}));
var ACTION_TYPE = exports.ACTION_TYPE;
function dot(x1, y1, x2, y2) {
    return x1 * x2 + y1 * y2;
}
var DEFAULT = Immutable.fromJS({
    bulletVelocity: 550,
    playerRadius: 20,
    movementSpeed: 130,
    map: {
        walls: [
            [[100, 200], [400, 200]]
        ],
    },
    players: {},
    projectiles: [],
});
exports.reducer = function (state, action) {
    switch (action.type) {
        case ACTION_TYPE.TICK:
            return tick(state, action.ms, action.inputs, action.events);
        case ACTION_TYPE.INIT_STATE:
            return Immutable.fromJS(action.state);
        default:
            return DEFAULT;
    }
};
function playerJoin(state, clientId) {
    return state.update('players', function (players) { return players.set(clientId, Immutable.fromJS({ clientId: clientId, x: 100, y: 100, lastShot: 0 })); });
}
exports.playerJoin = playerJoin;
function playerLeave(state, clientId) {
    return state.update('players', function (players) { return players.delete(clientId); });
}
exports.playerLeave = playerLeave;
function handleShot(projectiles, player, mouseX, mouseY, ms) {
    console.log('HE SHOOTIN');
    var direction = new V(mouseX, mouseY).sub(new V(player.get('x'), player.get('y'))).normalize().toArray();
    return projectiles.push(Immutable.fromJS({ source: player.get('clientId'), direction: direction, x: player.get('x'), y: player.get('y') }));
}
exports.handleShot = handleShot;
function tick(state, ms, inputs, events) {
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
    var frac = ms / 1000;
    state = state.update('projectiles', function (projectiles) {
        var vel = state.get('bulletVelocity') * (ms / 1000);
        return projectiles.map(function (projectile) {
            var direction = projectile.get('direction');
            var d = new V(direction.get(0), direction.get(1)).setLength(vel);
            return projectile.update('x', function (x) { return x + d.x; }).update('y', function (y) { return y + d.y; });
        });
    });
    var projectiles = state.get('projectiles');
    var _loop_1 = function(clientId) {
        var input = inputs[clientId];
        state = state.updateIn(['players', clientId], function (player) {
            if (!player)
                return;
            var ox = player.get('x');
            var oy = player.get('y');
            var nx = ox;
            var ny = oy;
            player = player.update('lastShot', function (lastShot) { return Math.max(0, lastShot - ms); });
            if (input.lmb) {
                var lastShot = player.get('lastShot');
                if (lastShot === 0) {
                    player = player.set('lastShot', 100);
                    projectiles = handleShot(projectiles, player, input.mouseX, input.mouseY, ms);
                }
            }
            var speed = state.get('movementSpeed');
            if (input.left)
                nx += -speed * frac;
            if (input.right)
                nx += speed * frac;
            if (input.up)
                ny += -speed * frac;
            if (input.down)
                ny += speed * frac;
            var direction = new V(nx, ny).sub(new V(ox, oy)).normalize();
            var walls = state.getIn(['map', 'walls']);
            var playerRadius = state.get('playerRadius');
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
        });
    };
    for (var clientId in inputs) {
        _loop_1(clientId);
    }
    state = state.set('projectiles', projectiles);
    return state;
}
exports.tick = tick;
function actionTick(ms, inputs, events) {
    return { type: ACTION_TYPE.TICK, ms: ms, inputs: inputs, events: events };
}
exports.actionTick = actionTick;
