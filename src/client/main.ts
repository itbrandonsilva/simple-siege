import { corners } from './../state/world';
import { visibility } from './visibility';
import { SS_IProjectile } from './../state/interfaces';
import { StateClient } from 'redux-gateway/build/client';
import * as Rx from 'rxjs';
import { reducer } from '../state/reducer';
import { ACTION_TYPE } from '../state/constants';
import { createStore} from 'redux';
import Vector2 from 'vector2';

let store = createStore(reducer);

//const HOST = 'localhost';
const HOST = '74.101.153.92';

let client = new StateClient(
    (err, state, clientId) => store.dispatch({type: ACTION_TYPE.INIT_STATE, state}),
    actions => actions.forEach(store.dispatch),
    HOST
);

let canvas = <HTMLCanvasElement>(document.getElementById('canvas'));
let ctx = canvas.getContext('2d');

            //ctx.save();
            //ctx.beginPath();
            //ctx.arc(100, 100, 300, 0, 2 * Math.PI, false);
            //ctx.clip();

ctx.save();

store.subscribe(() => {
    ctx.fillStyle = '#e1e1e1';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let state = store.getState().toJS();

    let origin;
    for (var clientId in state.players) {
        let player = state.players[clientId];
        if ( ! origin ) origin = new Vector2(player.x, player.y);

        if (origin) {
            ctx.restore();
            let structure = corners(origin.toArray(), state.world.edges, state.world.walls);
            let triangles = visibility(origin, structure);

            triangles.forEach((t, i) => {
                ctx.beginPath();
                ctx.strokeStyle = "#000";
                ctx.fillStyle = 'black';
                ctx.lineWidth = 2;
                ctx.moveTo(origin.x, origin.y);
                ctx.lineTo(t[0].x, t[0].y);
                ctx.lineTo(t[1].x, t[1].y);
                ctx.stroke();
                ctx.fill();
            })
            //ctx.closePath();
            //ctx.clip();
        }

        ctx.beginPath();
        ctx.fillStyle = 'red';
        ctx.arc(player.x, player.y, 20, 0, Math.PI*2);
        ctx.fill();
    }

    state.world.walls.forEach(wall => {
        ctx.strokeStyle = 'grey';
        ctx.lineWidth = 10;
        let a = Vector2.from(state.world.edges[wall[0]]);
        let b = Vector2.from(state.world.edges[wall[1]]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
    });

    state.projectiles.forEach((projectile: SS_IProjectile) => {
        ctx.beginPath();
        if (projectile.type === 'bullet') ctx.fillStyle = 'yellow';
        else ctx.fillStyle = 'green';
        ctx.arc(projectile.x, projectile.y, 3, 0, Math.PI*2);
        ctx.fill();
    });
});

const KEY_CODES = [87, 65, 83, 68, 32];
const KEY_NAMES = ['up', 'left', 'down', 'right', 'space'];

const MB_CODES = [0, 2];
const MB_NAMES = ['lmb', 'rmb'];

document.addEventListener('keydown', e => {
    let index = KEY_CODES.indexOf(e.keyCode);
    if (index > -1) {
        e.preventDefault();
        client.sendInput(KEY_NAMES[index], true);
    }
});

document.addEventListener('keyup', e => {
    let index = KEY_CODES.indexOf(e.keyCode);
    if (index > -1) client.sendInput(KEY_NAMES[index], false);
});

document.addEventListener('contextmenu', e => {
    e.preventDefault();
});

document.addEventListener('mousedown', e => {
    let index = MB_CODES.indexOf(e.button);
    if (index > -1) client.sendInput(MB_NAMES[index], true);
});

document.addEventListener('mouseup', e => {
    let index = MB_CODES.indexOf(e.button);
    if (index > -1) client.sendInput(MB_NAMES[index], false);
});

document.addEventListener('mousemove', e => {
    client.sendInput('mouseX', e.clientX);
    client.sendInput('mouseY', e.clientY);
});