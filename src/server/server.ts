import { reducer, actionTick } from '../state/reducer';
import { SS_IPlayerInputs, SS_IPlayerInput } from '../state/interfaces';
import { StateServer, RG_IInput } from 'redux-gateway';
import { createStore, Store, applyMiddleware } from 'redux';

export class SSServer {
    private store: Store<any>;
    private server: StateServer;
    private inputs: SS_IPlayerInputs = {};

    constructor() {
        this.server = new StateServer(() => this.store.getState(), this.inputHandler.bind(this));
        this.store = createStore(reducer, applyMiddleware(this.server.reduxMiddleware.bind(this.server)));

        this.server.registerEventHandler((event) => {
            switch(event.type) {
                case 'CLIENT_CONNECT':
                    console.log('Client connected...');
                    break;
                case 'CLIENT_DISCONNECT':
                    delete this.inputs[event.clientId];
                    break;
            }
            return false;
        });

        this.start();
        console.log('Started...');
    }

    inputHandler(input: RG_IInput) {
        let { clientId } = input;
        let inputs: SS_IPlayerInput = this.inputs[clientId] || (this.inputs[clientId] = {clientId});
        inputs[input.name] = input.value;
    }

    start() {
        let ms = new Date().getTime();
        setInterval(() => {
            let now = new Date().getTime()
            ms = now - ms; 
            this.store.dispatch(actionTick(ms, this.inputs, this.server.getEvents()));
            this.server.flush();
            ms = now;
        }, 1000/60);
    }
}