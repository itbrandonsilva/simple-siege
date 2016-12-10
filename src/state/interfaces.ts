import { Map, List, fromJS } from 'immutable';
import { RG_IEvent } from 'redux-gateway';
import { Action } from 'redux';

export interface SS_Map<I> extends Map<any, any> {
    _forceIncompatibilityWithOtherSS_MapsByUtilizingTheGenericParam?: I;

    get<K extends keyof I, T extends I[K]>(key: K, notSetValue?: T): T;
    set<K extends keyof I, T extends I[K]>(key: K, data: T): SS_Map<I>;
    merge(data: SS_Map<I>): SS_Map<I>;
    delete<K extends keyof I>(key: K): SS_Map<I>;
    remove<K extends keyof I>(key: K): SS_Map<I>;
    update(updater: (value: SS_Map<I>) => SS_Map<I>): SS_Map<I>;
    update<K extends keyof I, T extends I[K]>(key: K, updater: (value: T) => T): SS_Map<I>;
}

export interface SS_List<I> extends List<I> {
    map(iterator: (element: I) => I): SS_List<I>;
    push(data: I): SS_List<I>;
}

export function SS_Map<T>(data: T): SS_Map<T> {
    return fromJS(data);
}

export function SS_List<T>(data: Array<T>): SS_List<T> {
    return fromJS(data);
}

export interface SS_MWorld extends SS_Map<SS_IWorld>{}
export interface SS_IWorld {
    walls: SS_List<SS_LWall>
}
export interface SS_LWalls extends SS_List<SS_LWall> {};
export interface SS_LWall extends SS_List<SS_LVector> {};
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
}

export interface SS_MProjectile extends SS_Map<SS_IProjectile> {}
export interface SS_LProjectiles extends SS_List<SS_MProjectile> {}
export interface SS_IProjectile {
    source: string;
    msAlive: number;
    x: number;
    y: number;
    velocity: number;
    direction: SS_LVector;
}
export interface SS_MBullet extends SS_Map<SS_IBullet> {}
export interface SS_IBullet extends SS_IProjectile {
    baseDamage: number;
}
export interface SS_IThrowableProjectile extends SS_MProjectile {

}

export const PLAYER_RADIUS = 20;
export const MOVEMENT_SPEED = 130;
export const BULLET_VELOCITY = 1500;
export enum ACTION_TYPE {
    INIT_STATE,
    TICK
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

export const DEFAULT_STATE: SS_MState = SS_Map<SS_IState>({
    world: SS_Map<SS_IWorld>({
        walls: SS_List<SS_LWall>([
            SS_List<SS_LVector>([
                SS_List<number>([100, 200]),
                SS_List<number>([400, 200])
            ])
        ])
    }),
    players: SS_Map<SS_IPlayers>({}),
    projectiles: SS_List<SS_MProjectile>([])
});