import {
    SS_IMap, SS_IList, DEFAULT_STATE, PLAYER_RADIUS, MOVEMENT_SPEED, ACTION_TYPE,
    SS_MState, SS_ITickInfo, SS_IPlayerInputs, SS_IPlayer, SS_IAction, SS_MPlayer, SS_IBullet, SS_MPlayerInputs, SS_MPlayerInput, SS_MBullet, SS_MProjectile, SS_IPlayerInput, SS_LProjectiles
} from './interfaces';
import { Action } from 'redux';
import { Event, Input } from 'redux-gateway';
import { Map, List, fromJS } from 'immutable';
import Vector2 from 'vector2';

const V = Vector2;

function dot(x1, y1, x2, y2) {
    return x1 * x2 + y1 * y2;  
}

export const reducer = function (state: SS_MState, action: SS_IAction): SS_MState {
    switch (action.type) {
        case ACTION_TYPE.TICK:
            return tick(state, {time: action.ms/1000, inputs: action.inputs, events: action.events});
        case ACTION_TYPE.INIT_STATE:
            return fromJS(action.state);
        default:
            return DEFAULT_STATE;
    }
}

export function tick(state: SS_MState, tickInfo: SS_ITickInfo): SS_MState {
    let time = tickInfo.time;
    let inputs = tickInfo.inputs;
    let events = tickInfo.events;

    events.forEach(event => {
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

export function playerJoin(state: SS_MState, clientId: string) {
    let player: SS_IPlayer = {clientId, x: 100, y: 100, lastShot: 0, health: 100};
    return state.update('players', players => players.set(clientId, SS_IMap<SS_IPlayer>(player)));
}

export function playerLeave(state: SS_MState, clientId: string) {
    return state.update('players', players => players.delete(clientId));
}

export function updateProjectiles(state: SS_MState, tickInfo: SS_ITickInfo): SS_MState {
    return state.update('projectiles', projectiles => {
        return projectiles.map(function (projectile) {
            let direction = projectile.get('direction');
            let velocity = projectile.get('velocity') * (tickInfo.time);
            let vector = new Vector2(direction.get(0), direction.get(1)).setLength(velocity);
            return projectile.update('x', x => x + vector.x).update('y', y => y + vector.y);
        });
    });
}

export function handleLMB(state: SS_MState, clientId: string, input: SS_IPlayerInput, time: number): SS_MState {
    let bulletWasFired = false;

    let player = state.get('players').get(clientId);

    state = state.update('projectiles', projectiles => {
        let lastShot = player.get('lastShot');
        if (lastShot === 0) {
            bulletWasFired = true;
            projectiles = handleShot(projectiles, player, input, time);
        }
        return projectiles;
    });

    if (bulletWasFired) state = state.update('players', players => {
        return players.update(player.get('clientId'), player => {
            return player.set('lastShot', 100/1000);
        });
    });

    return state;
}

export function handleShot(projectiles: SS_LProjectiles, player: SS_MPlayer, input: SS_IPlayerInput, ms: number): SS_LProjectiles {
    let direction = SS_IList<number>(
        new V(input.mouseX, input.mouseY)
            .sub(new V(player.get('x'), player.get('y')))
            .normalize().toArray()
    );

    let bullet: SS_MBullet = SS_IMap<SS_IBullet>({
        baseDamage: 15,
        source: player.get('clientId'),
        msAlive: 0,
        x: player.get('x'),
        y: player.get('y'),
        velocity: 1100,
        direction: direction,
    });
    return projectiles.push(bullet);
}

export function updatePlayerMovement(state: SS_MState, player: SS_MPlayer, input: SS_IPlayerInput, tickInfo: SS_ITickInfo): SS_MPlayer {
    let time = tickInfo.time;

    let ox = player.get('x');
    let oy = player.get('y');

    let nx = ox;
    let ny = oy;

    let playerRadius = PLAYER_RADIUS;
    let speed = MOVEMENT_SPEED;

    if (input.left)   nx += -speed * time;
    if (input.right)  nx +=  speed * time;
    if (input.up)     ny += -speed * time;
    if (input.down)   ny +=  speed * time;

    let world = state.get('world');
    let walls = world.get('walls');

    walls.forEach(iwall => {
        let wall = iwall.toJS();
        let a = new V(wall[0][0], wall[0][1]);
        let b = new V(wall[1][0], wall[1][1]);
        let length = a.distance(b);

        // Vector from origin to desired location
        let tv = new V(nx, ny).sub(a);

        // Unit vector of the wall
        let unit = b.clone().sub(a).setLength(1);

        // Dot product between player desired destination and the given wall
        let dp = dot(tv.x, tv.y, unit.x, unit.y);

        // If the dp is too small or too large, then there will be no collision at the players desired location
        if (dp < 0 - playerRadius || dp > length + playerRadius) {}
        else {
            // Repurpose the wall unit vector to be the point of contact with the wall
            unit.setLength(dp);
            unit.add(a);

            // v becomes the vector/segment between the desired location and the point of contact, pointing away from the point of contact
            let v = new V(nx, ny).sub(unit);

            // distance between the desired location and the point of contact
            let dist = v.getLength();

            // if the distance is greater than the player radius, then the player is safe to move
            if (dist > playerRadius) { }
            else {
                // Place the player as close to the wall as possible without colliding
                unit.add(v.setLength(playerRadius+1));
                nx = unit.x;
                ny = unit.y;
            }
        }
    });

    return player.set('x', nx).set('y', ny);
}

export function updatePlayers(state: SS_MState, tickInfo: SS_ITickInfo): SS_MState {
    let inputs = tickInfo.inputs;

    for (let clientId in inputs) {
        let input = inputs[clientId];
        state = state.update('players', players => {
            players = players.update(clientId, player => {
                if ( ! player ) return player;

                player = player.update('lastShot', lastShot => Math.max(0, lastShot - tickInfo.time));
                player = updatePlayerMovement(state, player, input, tickInfo);
                return player;
            });
            return players;
        });
        if (input.lmb) state = handleLMB(state, input.clientId, input, tickInfo.time);
    }

    return state;
}

export function actionTick(ms: number, inputs: SS_IPlayerInputs, events: Event[]): SS_IAction {
    return {type: ACTION_TYPE.TICK, ms, inputs, events};
}