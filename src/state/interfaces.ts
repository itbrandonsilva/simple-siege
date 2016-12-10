import { Map, List, fromJS } from 'immutable';
import { Event, Input } from 'redux-gateway';
import { Action } from 'redux';

//type Mapper<I> extends SS_Imap<I> = {
    //[P in keyof I]: I[P];
//}

export interface SS_IMap<I> extends Map<any, any> {
    _forceIncompatibilityWithOtherSS_IMapsByUtilizingTheGenericParam?: I;

    get<K extends keyof I, T extends I[K]>(key: K, notSetValue?: T): T;
    set<K extends keyof I, T extends I[K]>(key: K, data: T): SS_IMap<I>;
    merge(data: SS_IMap<I>): SS_IMap<I>;
    delete<K extends keyof I>(key: K): SS_IMap<I>;
    remove<K extends keyof I>(key: K): SS_IMap<I>;
    update(updater: (value: SS_IMap<I>) => SS_IMap<I>): SS_IMap<I>;
    update<K extends keyof I, T extends I[K]>(key: K, updater: (value: T) => T): SS_IMap<I>;
}

export interface SS_IList<I> extends List<I> {
    map(iterator: (element: I) => I): SS_IList<I>;
    push(data: I): SS_IList<I>;
}

export function SS_IMap<T>(data: T): SS_IMap<T> {
    return fromJS(data);
}

export function SS_IList<T>(data: Array<T>): SS_IList<T> {
    return fromJS(data);
}

export interface SS_MWorld extends SS_IMap<SS_IWorld>{}
export interface SS_IWorld {
    walls: SS_IList<SS_LWall>
}
export interface SS_LWalls extends SS_IList<SS_LWall> {};
export interface SS_LWall extends SS_IList<SS_LVector> {};
export interface SS_LVector extends SS_IList<number> {};

export interface SS_IPlayers {
    [clientId: string] : SS_MPlayer;
};
export interface SS_MPlayers extends SS_IMap<SS_IPlayers> {}
export interface SS_MPlayer extends SS_IMap<SS_IPlayer> {}
export interface SS_IPlayer {
    clientId: string;
    health: number;
    x: number;
    y: number;
    lastShot: number;
}

export interface SS_MProjectile extends SS_IMap<SS_IProjectile> {}
export interface SS_LProjectiles extends SS_IList<SS_MProjectile> {}
export interface SS_IProjectile {
    source: string;
    msAlive: number;
    x: number;
    y: number;
    velocity: number;
    direction: SS_LVector;
}
export interface SS_MBullet extends SS_IMap<SS_IBullet> {}
export interface SS_IBullet extends SS_IProjectile {
    baseDamage: number;
}
export interface SS_IThrowableProjectile extends SS_MProjectile {

}

export const PLAYER_RADIUS = 20;
export const MOVEMENT_SPEED = 130;
export enum ACTION_TYPE {
    INIT_STATE,
    TICK
}

export interface SS_IPlayerInputs {
    [clientId: string] : SS_IPlayerInput;
};
export interface SS_MPlayerInputs extends Map<string, SS_MPlayerInput> {};
export interface SS_MPlayerInput extends SS_IMap<SS_IPlayerInput> {};
export interface SS_IPlayerInput {
    clientId: string;
    left?: boolean;
    right?: boolean;
    up?: boolean;
    down?: boolean;
    mouseX?: number;
    mouseY?: number;
    lmb?: boolean;
}

export interface SS_ITickInfo {
    time: number;
    inputs: SS_IPlayerInputs;
    events: SS_IEvents;
}

export interface SS_IEvents extends Array<Event> {};
export interface SS_IAction extends Action {
    type: ACTION_TYPE;

    state?: any;

    ms?: number;
    inputs?: SS_IPlayerInputs;
    events?: SS_IEvents;

    clientId?: string;
}

export interface SS_MState extends SS_IMap<SS_IState> {}
export interface SS_IState {
    world: SS_MWorld;
    players: SS_MPlayers;
    projectiles: SS_LProjectiles;
}

export const DEFAULT_STATE: SS_MState = SS_IMap<SS_IState>({
    world: SS_IMap<SS_IWorld>({
        walls: SS_IList<SS_LWall>([
            SS_IList<SS_LVector>([
                SS_IList<number>([100, 200]),
                SS_IList<number>([400, 200])
            ])
        ])
    }),
    players: SS_IMap<SS_IPlayers>({}),
    projectiles: SS_IList<SS_MProjectile>([])
});