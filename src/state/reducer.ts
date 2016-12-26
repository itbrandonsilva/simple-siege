import { generateDefaultState } from './default';
import { PLAYER_RADIUS, MOVEMENT_SPEED, BULLET_VELOCITY, THROW_COOLDOWN, ACTION_TYPE } from './constants';
import {
    SS_Map, SS_List,
    SS_MState, SS_ITickInfo, SS_IPlayerInputs, SS_IPlayer, SS_IAction, SS_MPlayer, SS_IBullet, SS_MPlayerInputs, SS_MPlayerInput, SS_MBullet, SS_MProjectile, SS_IPlayerInput, SS_LProjectiles, SS_LWall, SS_MThrowable, SS_IThrowable, SS_LVector
} from './interfaces';
import { Action } from 'redux';
import { RG_IEvent } from 'redux-gateway';
import { Map, List, fromJS } from 'immutable';
import Vector2 from 'vector2';
const V = Vector2;

const { PI, sin } = Math;
const HPI = PI/2;
const PI2 = PI*2;

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
            //return state;
            return generateDefaultState();
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
    let player: SS_IPlayer = {clientId, x: 50, y: 50, lastShot: 0, lastThrow: 0, health: 100};
    return state.update('players', players => players.set(clientId, SS_Map<SS_IPlayer>(player)));
}

export function playerLeave(state: SS_MState, clientId: string) {
    return state.update('players', players => players.delete(clientId));
}

function wallIterator(state, cb: (edges: Vector2[], wallIndex: number, ai: number, bi: number) => void) {
    let world = state.get('world');
    let edges = world.get('edges');

    world.get('walls').forEach((wall: SS_LWall, idx: number) => {
        let a = Vector2.from(edges.get(wall.get(0)).toJS());
        let b = Vector2.from(edges.get(wall.get(1)).toJS());
        cb([a, b], idx, wall.get(0), wall.get(1));
    });
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
                //let wall;

                wallIterator(state, (wall, idx) => {
                    let intersection = Vector2.segmentsIntersection(origin, destination, wall[0], wall[1]);
                    if ( intersection ) intersections.push({p: intersection, w: wall});
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

export function handleRMB(state: SS_MState, clientId: string, input: SS_IPlayerInput, time: number): SS_MState {
    if ( ! input.rmb ) return state;

    let center = new Vector2(input.mouseX, input.mouseY);

    let world = state.get('world');
    let walls = world.get('walls');
    let edges = world.get('edges');
    let wallsCount = walls.size;

    //wallIterator(state, (wall, wallIdx, ai, bi) => {
    for (var wallIdx = 0; wallIdx < wallsCount; ++wallIdx) {
        let wall: number[] = walls.get(wallIdx).toJS();

        let ai = wall[0];
        let bi = wall[1];

        let e1 = Vector2.from(edges.get(ai).toJS());
        let e2 = Vector2.from(edges.get(bi).toJS());

        let result = segmentCircleIntersections(center, 40, [e1, e2]);
        let intersections = result.intersections;
        let count = intersections.length;
        if (result.inside) {
            state = state.update('world', world => {
                return world.update('edges', edges => {
                    return edges
                        .set(ai, SS_List<number>([-10, -10]))
                        .set(bi, SS_List<number>([-10, -10]));
                });
            });
        } else if (count) {
            state = state.update('world', world => {
                return world.update(world => {
                    if (count === 1) {
                        return world.update('edges', edges => {
                            let ei;
                            result.left ? ei = ai : ei = bi;
                            return edges.update(ei, edge => {
                                let int = result.intersections[0];
                                return edge.set(0, int.x).set(1, int.y);
                            });
                        });
                    } else if (count === 2) {
                        let ec = world.get('edges').size;
                        world = world.update('walls', walls => {
                            walls = walls.update(wallIdx, wall => {
                                return wall.set(1, ec);
                            });
                            return walls.push(SS_List<number>([ec+1, bi]));
                        });

                        return world.update('edges', edges => {
                            return edges
                                .push(SS_List<number>(intersections[0].toArray()))
                                .push(SS_List<number>(intersections[1].toArray()));
                        });
                    }
                });
            });
        }
    };

    return state;
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

    //walls.forEach(iwall => {
    wallIterator(state, (wall, idx) => {
        let [a, b] = wall;
        let length = a.distance(b);

        let desiredLocation = new Vector2(nx, ny);
        let f = positionWhereContact(new Vector2(ox, oy), desiredLocation, playerRadius, [a, b]);
        nx = f.x;
        ny = f.y;

        /*let desiredLocation = new Vector2(nx, oy);
        let f = positionWhereContact(new Vector2(ox, oy), desiredLocation, playerRadius, [a, b]);
        nx = f.x;

        desiredLocation = new Vector2(nx, ny);
        f = positionWhereContact(new Vector2(ox, oy), desiredLocation, playerRadius, [a, b]);
        ny = f.y;*/

/*
        // Vector from origin to desired location
        let tv = desiredLocation.clone().sub(a);

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
 */
    });

    return player.set('x', nx).set('y', ny);
}

/*const leftOf = (segment: Vector2[], point: Vector2): boolean => {
    let P1toP2 = segment[1].clone().sub(segment[0]);
    let P1toP = point.clone().sub(segment[0]);
    let cross = P1toP2.cross(P1toP);

    console.log(cross);

    return cross < 0;
};*/

export const lineIntersection = (point1: Vector2, point2: Vector2, point3: Vector2, point4: Vector2): Vector2 => {
    const s = (
        (point4.x - point3.x) * (point1.y - point3.y) -
        (point4.y - point3.y) * (point1.x - point3.x)
    ) / (
        (point4.y - point3.y) * (point2.x - point1.x) -
        (point4.x - point3.x) * (point2.y - point1.y)
    );

    return new Vector2(
        point1.x + s * (point2.x - point1.x),
        point1.y + s * (point2.y - point1.y)
    ).round();
}

function angleBetween(a: Vector2, b: Vector2) {
    let result = Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x);
    //if (result < 0) result += Math.PI*2;

    //result = Math.abs(result);
    //if (result > Math.PI) result = (Math.PI*2) - result;
    if (result > Math.PI) result -= (Math.PI*2);
    if (result < -Math.PI) result += (Math.PI*2);
    return result;
}

function positionWhereContact(origin: Vector2, destination: Vector2, radius: number, segment: Vector2[]): Vector2 {
    if (origin.eql(destination)) return destination.clone();

    let [edgeA, edgeB] = segment;
    let segmentLength = edgeA.distance(edgeB);
    let movementLength = origin.distance(destination);

    let AtoB           = edgeB.clone().sub(edgeA).normalize();
    let AtoOrigin      = origin.clone().sub(edgeA);
    let AtoDestination = destination.clone().sub(edgeA);
    let direction      = destination.clone().sub(origin).normalize();

    let dot = AtoOrigin.dot(AtoB);
    let d1 = AtoB.clone().mul(dot).add(edgeA).distance(origin);

    let intersection = lineIntersection(origin, destination, edgeA, edgeB);
    let sign = origin.distance(intersection) < origin.distance(destination) ? -1 : 1;
    dot = AtoDestination.dot(AtoB);
    let dotContact = AtoB.clone().mul(dot).add(edgeA);
    let d2 = dotContact.distance(destination) * sign;

    // `t` represents how many iterations of movement it would take to reach the point of collision.
    let t = (radius - d1) / (d2 - d1);

    // The number is infinite when our movement is parallel with the segment, meaning no future collision can possibly be found against the segment.
    if (Number.isFinite(t)) {
        // This is the position of our circle where it would first make contact with the segment.
        let collisionPosition = direction.clone().mul(t).add(origin);
        let AtoCollisionPosition = collisionPosition.clone().sub(edgeA);
        let ndot = AtoCollisionPosition.dot(AtoB);
        // Is our point of collision on the segment? 
        if (ndot > 0 && ndot < segmentLength) {
            if ( t > 0 && t < 1 ) return collisionPosition.add(direction.flip());
            // If we are here, then the point of collision is too far.
        }
    }

    // If we are here, colliding against the segment itself is no longer a possibility.

    // Begin checking if there could be a collision on an edge of the segment.
    let edge;
    if (dot <= 0)                   edge = edgeA.clone();
    else if (dot >= segmentLength)  edge = edgeB.clone();

    // `dot` does not lie outside of the segment
    if ( ! edge ) return destination.clone();

    let originToEdge = edge.clone().sub(origin);
    dot = originToEdge.dot(direction);
    // Is the segment edge not in the direction of our movement?
    if (dot < 0) return destination.clone();

    let projectionPoint = direction.clone().mul(dot).add(origin);

    // Use Pyth's to find the position of the circle where it first collides with the edge .
    let a = projectionPoint.distance(edge);
    let c = radius;
    let b = Math.sqrt(c*c - a*a);

    // Could not solve for `b`. There is no collision.
    if (isNaN(b)) return destination.clone();

    let collisionPositionDistance = origin.distance(projectionPoint) - b;
    if (collisionPositionDistance > movementLength) {
        // The collision position is too far into the future. No collision.
        return destination.clone();
    }

    // Our destination collides with the segment edge.
    return direction.clone().setLength(collisionPositionDistance - 0.01).add(origin);
}

//let res = positionWhereContact(new Vector2(0, 0), new Vector2(0, 10), 2, [new Vector2(1, 5), new Vector2(10, 5)]);
//res.log();

interface IResult {
    intersections: Vector2[];
    inside: boolean;
    left: boolean;
}

function segmentCircleIntersections(center: Vector2, radius: number, segment: Vector2[]): IResult {
    let result = {
        intersections: [],
        left: false,
        inside: false
    };

    let [edgeA, edgeB] = segment;
    let segmentLength = edgeA.distance(edgeB);

    let distA = center.distance(edgeA);
    let distB = center.distance(edgeB);
    //center.log();
    //edgeA.log();
    //edgeB.log();
    //console.log(distA, distB);

    // Are both edges inside the circle
    if (distA <= radius && distB <= radius) {
        result.inside = true;
        return result;
    }

    let AtoCenter = center.clone().sub(edgeA);
    let AtoB = edgeB.clone().sub(edgeA).normalize();
    let dot = AtoCenter.dot(AtoB);
    let projectionPoint = AtoB.clone().setLength(dot).add(edgeA);

    let distance = projectionPoint.distance(center);
    // Check if we are simply too far from the line for there to be a collision.
    if (distance > radius) return result;

    // If the dot doesn't lie on the segment, we check if we are close enough to an edge for there to be any intersections.
    //console.log('DOT: ', dot);
    if (dot < 0) {
        if (distA >= radius) return result;
    } else if (dot > segmentLength) {
        if (distB >= radius) return result;
    }

    let a = Math.sqrt(radius*radius - distance*distance);

    let sign = dot < 0 ? -1 : 1;
    distance = projectionPoint.distance(edgeA) * sign;

    let d1 = distance - a;
    let i1 = AtoB.clone().setLength(d1);
    //let tdot = i1.clone().sub(edgeA).dot(AtoB);
    if (d1 > 0 && d1 < segmentLength) result.intersections.push(i1.add(edgeA));

    let d2 = distance + a;
    let i2 = AtoB.clone().setLength(d2);
    //tdot = i2.clone().sub(edgeA).dot(AtoB);
    if (d2 > 0 && d2 < segmentLength) result.intersections.push(i2.add(edgeA));

    if (result.intersections.length === 1) {
        let intersection = result.intersections[0];
        result.left = dot < segmentLength/2;
    }
    return result;
}

//let res = segmentCircleIntersections(new Vector2(2, 2), 3, [new Vector2(0, 2), new Vector2(0, 15)]);
//console.log(res);

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
        state = handleRMB(state, input.clientId, input, tickInfo.time);
        state = handleSpace(state, clientId, input, tickInfo.time);
    }

    return state;
}

export function actionTick(ms: number, inputs: SS_IPlayerInputs, events: RG_IEvent[]): SS_IAction {
    return {type: ACTION_TYPE.TICK, ms, inputs, events};
}