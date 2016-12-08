import { Action } from 'redux';
import { Event, Input } from 'redux-gateway';
import * as Immutable from 'immutable';
import Vector2 from 'vector2';

const V = Vector2;

export enum ACTION_TYPE {
    INIT_STATE,
    TICK
}

function dot(x1, y1, x2, y2) {
    return x1 * x2 + y1 * y2;  
}

const DEFAULT = Immutable.fromJS({
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

type GState = any;
type PlayerInputs = any;

export interface PlayerInput {
    clientId: string;
    left?: boolean;
    right?: boolean;
    up?: boolean;
    down?: boolean;
    mouseX?: number;
    mouseY?: number;
    lmb?: boolean;
}

interface GAction extends Action {
    state?: Object;

    ms?: number;
    inputs?: PlayerInputs;
    events?: Event[];

    clientId?: string;
}

export const reducer = function (state: GState, action: GAction): GState {
    switch (action.type) {
        case ACTION_TYPE.TICK:
            return tick(state, action.ms, action.inputs, action.events);
        case ACTION_TYPE.INIT_STATE:
            return Immutable.fromJS(action.state);
        default:
            return DEFAULT;
    }
}

function playerJoin(state: GState, clientId: string) {
    return state.update('players', players => players.set(clientId, Immutable.fromJS({clientId, x: 100, y: 100, lastShot: 0})));
}

function playerLeave(state: GState, clientId: string) {
    return state.update('players', players => players.delete(clientId));
}

function handleShot(projectiles, player, mouseX, mouseY, ms) {
    console.log('HE SHOOTIN');
    let direction = new V(mouseX, mouseY).sub(new V(player.get('x'), player.get('y'))).normalize().toArray();
    return projectiles.push(Immutable.fromJS({source: player.get('clientId'), direction, x: player.get('x'), y: player.get('y')}));
}

function tick(state: GState, ms: number, inputs: PlayerInputs, events: Event[]): GState {
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

    let frac = ms/1000;

    state = state.update('projectiles', projectiles => {
        let vel = state.get('bulletVelocity') * (ms/1000);
        return projectiles.map(projectile => {
            let direction = projectile.get('direction');
            let d = new V(direction.get(0), direction.get(1)).setLength(vel);
            return projectile.update('x', x => x + d.x).update('y', y => y + d.y);
        });
    });

    let projectiles = state.get('projectiles');

    for (let clientId in inputs) {
        let input = inputs[clientId];

        state = state.updateIn(['players', clientId], player => {
            if ( ! player ) return;

            let ox = player.get('x');
            let oy = player.get('y');

            let nx = ox;
            let ny = oy;

            player = player.update('lastShot', lastShot => Math.max(0, lastShot - ms));
            if (input.lmb) {
                let lastShot = player.get('lastShot');
                if (lastShot === 0) {
                    player = player.set('lastShot', 100);
                    projectiles = handleShot(projectiles, player, input.mouseX, input.mouseY, ms);
                }
            }

            let speed = state.get('movementSpeed');

            if (input.left)   nx += -speed * frac;
            if (input.right)  nx +=  speed * frac;
            if (input.up)     ny += -speed * frac;
            if (input.down)   ny +=  speed * frac;

            let direction = new V(nx, ny).sub(new V(ox, oy)).normalize();

            let walls = state.getIn(['map', 'walls']);
            let playerRadius = state.get('playerRadius');
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
        });
    }

    state = state.set('projectiles', projectiles);

    return state;
}

export function actionTick(ms: number, inputs: PlayerInputs, events: Event[]) {
    return {type: ACTION_TYPE.TICK, ms, inputs, events};
}