import { reducer, actionTick, PlayerInput } from './../state/reducer';
import { StateServer, Input, EventHandler } from 'redux-gateway';
import { createStore, Store, applyMiddleware } from 'redux';

export class SSServer {
    private store: Store<any>;
    private server: StateServer;
    private inputs = {};

    constructor() {
        this.server = new StateServer(() => this.store.getState(), this.inputHandler.bind(this));
        this.store = createStore(reducer, applyMiddleware(this.server.reduxMiddleware.bind(this.server)));

        this.server.registerEventHandler((event) => {
            switch(event.type) {
                case 'CLIENT_DISCONNECT':
                    delete this.inputs[event.clientId];
                    break;
            }
            return false;
        });

        this.start();
        console.log('Started...');
    }

    inputHandler(input: Input) {
        let { clientId } = input;
        let inputs: PlayerInput = this.inputs[clientId] || (this.inputs[clientId] = {clientId});
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
        }, 1000/30);
    }
}