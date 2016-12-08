import { StateClient } from 'redux-gateway/build/client';
import * as Rx from 'rxjs';
import { reducer, ACTION_TYPE } from '../state/reducer';
import { createStore} from 'redux';

let store = createStore(reducer);

let client = new StateClient(
    (err, state, clientId) => store.dispatch({type: ACTION_TYPE.INIT_STATE, state}),
    actions => actions.forEach(store.dispatch),
    'localhost'
);

let canvas = document.getElementById('canvas');
let ctx = (<any>canvas).getContext('2d');

store.subscribe(() => {
    ctx.fillStyle = '#e1e1e1';
    ctx.fillRect(0, 0, 600, 600);

    let state = store.getState().toJS();

    for (var clientId in state.players) {
        let player = state.players[clientId];

        ctx.beginPath();
        ctx.fillStyle = 'red';
        ctx.arc(player.x, player.y, 20, 0, Math.PI*2);
        ctx.fill();
    }

    state.map.walls.forEach(wall => {
        ctx.beginPath();
        ctx.moveTo(wall[0][0], wall[0][1]);
        ctx.lineTo(wall[1][0], wall[1][1]);
        ctx.lineWidth = 10;
        ctx.stroke();
    });

    state.projectiles.forEach(projectile => {
        ctx.beginPath();
        ctx.fillStyle = 'yellow';
        ctx.arc(projectile.x, projectile.y, 3, 0, Math.PI*2);
        ctx.fill();
    });
    //console.log(JSON.stringify(store.getState().toJS().players));
});

const KEY_CODES = [87, 65, 83, 68];
const KEY_NAMES = ['up', 'left', 'down', 'right'];

const MOUSE_CODES = [0];
const MOUSE_NAMES = ['lmb'];

document.addEventListener('keydown', e => {
    let index = KEY_CODES.indexOf(e.keyCode);
    index > -1 ? client.sendInput(KEY_NAMES[index], true) : null;
});

document.addEventListener('keyup', e => {
    let index = KEY_CODES.indexOf(e.keyCode);
    index > -1 ? client.sendInput(KEY_NAMES[index], false) : null
});

document.addEventListener('mousedown', e => {
    if (e.button === 0) client.sendInput('lmb', true);
});

document.addEventListener('mouseup', e => {
    if (e.button === 0) client.sendInput('lmb', false);
});

document.addEventListener('mousemove', e => {
    client.sendInput('mouseX', e.clientX);
    client.sendInput('mouseY', e.clientY);
});