import {
    SS_Map, SS_List, DEFAULT_STATE, PLAYER_RADIUS, MOVEMENT_SPEED, ACTION_TYPE, BULLET_VELOCITY, THROW_COOLDOWN,
    SS_MState, SS_ITickInfo, SS_IPlayerInputs, SS_IPlayer, SS_IAction, SS_MPlayer, SS_IBullet, SS_MPlayerInputs, SS_MPlayerInput, SS_MBullet, SS_MProjectile, SS_IPlayerInput, SS_LProjectiles, SS_LWall, SS_MThrowable, SS_IThrowable
} from './interfaces';
import { Action } from 'redux';
import { RG_IEvent } from 'redux-gateway';
import { Map, List, fromJS } from 'immutable';
import Vector2 from 'vector2';
const V = Vector2;

//function dot(x1, y1, x2, y2) {
//    return x1 * x2 + y1 * y2;  
//}

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
    let player: SS_IPlayer = {clientId, x: 100, y: 100, lastShot: 0, lastThrow: 0, health: 100};
    return state.update('players', players => players.set(clientId, SS_Map<SS_IPlayer>(player)));
}

export function playerLeave(state: SS_MState, clientId: string) {
    return state.update('players', players => players.delete(clientId));
}

export function updateProjectiles(state: SS_MState, tickInfo: SS_ITickInfo): SS_MState {
    return state.update('projectiles', projectiles => {

        projectiles = projectiles.map((projectile, index) => {
            let final: Vector2;

            let type = projectile.get('type');
            let origin = new Vector2(projectile.get('x'), projectile.get('y'));
            let direction = Vector2.from(projectile.get('direction').toJS());
            let velocity = projectile.get('velocity');
            let travel = velocity * tickInfo.time;
            
            while(true) {
                let destination = origin.clone().add(direction.clone().setLength(travel));

                let intersections: Array<{p: Vector2, w: Vector2[]}> = [];
                let wall;
                state.get('world').get('walls').forEach((wall: SS_LWall) => {
                    let a = Vector2.from(wall.get(0).toJS());
                    let b = Vector2.from(wall.get(1).toJS());

                    let intersection = Vector2.segmentsIntersection(origin, destination, a, b);
                    if ( intersection ) intersections.push({p: intersection, w: [a, b]});
                });

                let shortest = destination.distance(origin);
                let intersection = intersections.reduce((destination, intersection) => {
                    let dist = intersection.p.distance(origin);
                    if (dist < shortest) {
                        shortest = dist;
                        return intersection;
                    } else return destination;
                }, {p: destination, w: null});

                final = intersection.p;

                if ( ! final.eql(destination) ) {
                    if (type === 'bullet') {
                        projectile = projectile.set('destroy', true);
                        break;
                    } else {
                        //projectile = projectile.set('destroy', true);
                        let travelled = origin.distance(final);
                        travel -= travelled;
                        if (travel <= 0.001) {
                            break;
                        }
                        let wallVector = intersection.w[1].clone().sub(intersection.w[0]).normalize();
                        let v = origin.clone().sub(intersection.w[0]);
                        let dot = v.dot(wallVector);
                        wallVector.setLength(dot);
                        wallVector.add(intersection.w[0]);
                        direction = origin.clone().add(wallVector.clone().sub(origin).mul(2)).sub(final).normalize().rotate180();
                        origin = origin.add(final.clone().sub(origin).mul(0.99));
                    }
                } else break;
            }

            if (type === 'throwable') {
                projectile = projectile
                    .set('velocity', Math.max(0, velocity - ((<SS_MThrowable>projectile).get('deceleration') * tickInfo.time)))
                    .set('direction', SS_List<number>(direction.toArray()));
            }

            return projectile
                .update('x', x => final.x)
                .update('y', y => final.y)
                .update('msAlive', ms => ms + tickInfo.time);
        });

        projectiles = projectiles.filter((projectile) => {
            if (projectile.get('destroy')) return false;

            let x = projectile.get('x');
            if (x < 0 || x > 2000) return false;

            let y = projectile.get('y');
            if (y < 0 || y > 2000) return false;

            let ms = projectile.get('msAlive');
            let max = projectile.get('msAliveMax');
            if (ms > max) return false;
            return true;
        });

        return projectiles;
    });
}

export function handleSpace(state: SS_MState, clientId: string, input: SS_IPlayerInput, time: number): SS_MState {
    if ( ! input.space ) return state;
    let player = state.get('players').get(clientId);
    if (player.get('lastThrow') !== 0) return state;

    state = handleThrow(state, clientId, input, time);
    return state.update('players', players => {
        return players.update(clientId, player => {
            return player.set('lastThrow', THROW_COOLDOWN);
        });
    });
}

export function handleLMB(state: SS_MState, clientId: string, input: SS_IPlayerInput, time: number): SS_MState {
    if ( ! input.lmb ) return state;

    let player = state.get('players').get(clientId);
    if ( player.get('lastShot') !== 0 ) return state;

    state = handleShot(state, clientId, input, time);
    return state.update('players', players => {
        return players.update(clientId, player => {
            return player.set('lastShot', 100/1000);
        });
    });
}

export function handleThrow(state: SS_MState, clientId: string, input: SS_IPlayerInput, ms: number): SS_MState {
    let player = state.get('players').get(clientId);
    let direction = SS_List<number>(
        new V(input.mouseX, input.mouseY)
            .sub(new V(player.get('x'), player.get('y')))
            .normalize().toArray()
    );

    let bullet: SS_MThrowable = SS_Map<SS_IThrowable>({
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
    return state.update('projectiles', projectiles => projectiles.push(bullet));
}

export function handleShot(state: SS_MState, clientId: string, input: SS_IPlayerInput, ms: number): SS_MState {
    let player = state.get('players').get(clientId);
    let direction = SS_List<number>(
        new V(input.mouseX, input.mouseY)
            .sub(new V(player.get('x'), player.get('y')))
            .normalize().toArray()
    );

    let bullet: SS_MBullet = SS_Map<SS_IBullet>({
        type: 'bullet',
        baseDamage: 15,
        source: clientId,
        msAlive: 0,
        msAliveMax: 5,
        x: player.get('x'),
        y: player.get('y'),
        velocity: BULLET_VELOCITY,
        direction: direction,
    });
    return state.update('projectiles', projectiles => projectiles.push(bullet));
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
        let a = Vector2.from(wall[0]);
        let b = Vector2.from(wall[1]);
        let length = a.distance(b);

        // Vector from origin to desired location
        let tv = new V(nx, ny).sub(a);

        // Unit vector of the wall
        let unit = b.clone().sub(a).setLength(1);

        // Dot product between player desired destination and the given wall
        let dp = tv.dot(unit);

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
                player = player.update('lastThrow', lastThrow => Math.max(0, lastThrow - tickInfo.time));
                player = updatePlayerMovement(state, player, input, tickInfo);
                return player;
            });
            return players;
        });
        state = handleLMB(state, input.clientId, input, tickInfo.time);
        state = handleSpace(state, clientId, input, tickInfo.time);
    }

    return state;
}

export function actionTick(ms: number, inputs: SS_IPlayerInputs, events: RG_IEvent[]): SS_IAction {
    return {type: ACTION_TYPE.TICK, ms, inputs, events};
}