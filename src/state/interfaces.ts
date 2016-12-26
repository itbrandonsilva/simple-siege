import { Map, List, fromJS } from 'immutable';
import { RG_IEvent } from 'redux-gateway';
import { Action } from 'redux';
import { ACTION_TYPE } from './constants';

export interface SS_Map<I> extends Map<any, any> {
    _forceIncompatibilityWithOtherSS_MapsByUtilizingTheGenericParam?: I;

    get<K extends keyof I, T extends I[K]>(key: K, notSetValue?: T): T;
    set<K extends keyof I, T extends I[K]>(key: K, value: T): SS_Map<I>;
    merge(data: SS_Map<I>): SS_Map<I>;
    delete<K extends keyof I>(key: K): SS_Map<I>;
    remove<K extends keyof I>(key: K): SS_Map<I>;
    update(updater: (value: SS_Map<I>) => SS_Map<I>): SS_Map<I>;
    update<K extends keyof I, T extends I[K]>(key: K, updater: (value: T) => T): SS_Map<I>;  
}

export interface SS_List<I> extends List<I> {
    set(index: number, value: I): SS_List<I>;
    get(index: number): I;
    map<M>(mapper: (value: I, key: number, iter: SS_List<I>) => M, context?: any): SS_List<M>;
    push(data: I): SS_List<I>;
    filter(predicate: (value: I, key?: number, iter?: SS_List<I>) => boolean, context?: any): SS_List<I>;
    forEach(sideEffect: (value: I, key?: number, iter?: SS_List<I>) => any, context?: any): number;
    reduce<R>(reducer: (reduction: R, value: I, key: number, iter: SS_List<I>) => R, initialReduction?: R, context?: any): R;
    update(updater: (value: SS_List<I>) => SS_List<I>): SS_List<I>;
    update(index: number, updater: (value: I) => I): SS_List<I>;
    update(index: number, notSetValue: I, updater: (value: I) => I): SS_List<I>;
    delete(index: number): SS_List<I>;
}

export function SS_Map<T>(data: T): SS_Map<T> {
    return fromJS(data);
}

export function SS_List<T>(data: Array<T>): SS_List<T> {
    return fromJS(data);
}

export interface SS_MWorld extends SS_Map<SS_IWorld>{}
export interface SS_IWorld {
    walls: SS_List<SS_LWall>;
    edges: SS_List<SS_LVector>;
}
export interface SS_LWall extends SS_List<number> {};
export interface SS_LVector extends SS_List<number> {};

export interface SS_IPlayers {
    [clientId: string] : SS_MPlayer;
};
export interface SS_MPlayers extends SS_Map<SS_IPlayers> {}
export interface SS_MPlayer extends SS_Map<SS_IPlayer> {}
export interface SS_IPlayer {
    clientId: string;
    health: number;
    x: number;
    y: number;
    lastShot: number;
    lastThrow: number;
}

export interface SS_MProjectile extends SS_Map<SS_IProjectile> {}
export interface SS_LProjectiles extends SS_List<SS_MProjectile> {}
export interface SS_IProjectile {
    type: string;
    destroy?: boolean;
    source: string;
    msAlive: number;
    msAliveMax: number;
    x: number;
    y: number;
    velocity: number;
    direction: SS_LVector;
}
export interface SS_MBullet extends SS_Map<SS_IBullet> {}
export interface SS_IBullet extends SS_IProjectile {
    baseDamage: number;
}
export interface SS_MThrowable extends SS_Map<SS_IThrowable> {};
export interface SS_IThrowable extends SS_IProjectile {
    deceleration: number;
}

export interface SS_IPlayerInputs {
    [clientId: string] : SS_IPlayerInput;
};
export interface SS_MPlayerInputs extends Map<string, SS_MPlayerInput> {};
export interface SS_MPlayerInput extends SS_Map<SS_IPlayerInput> {};
export interface SS_IPlayerInput {
    clientId: string;
    left?: boolean;
    right?: boolean;
    up?: boolean;
    down?: boolean;
    mouseX?: number;
    mouseY?: number;
    lmb?: boolean;
    rmb?: boolean;
    space?: boolean;
}

export interface SS_ITickInfo {
    time: number;
    inputs: SS_IPlayerInputs;
    events: SS_IEvents;
}

export interface SS_IEvents extends Array<RG_IEvent> {};
export interface SS_IAction extends Action {
    type: ACTION_TYPE;

    state?: any;

    ms?: number;
    inputs?: SS_IPlayerInputs;
    events?: SS_IEvents;

    clientId?: string;
}

export interface SS_MState extends SS_Map<SS_IState> {}
export interface SS_IState {
    world: SS_MWorld;
    players: SS_MPlayers;
    projectiles: SS_LProjectiles;
}