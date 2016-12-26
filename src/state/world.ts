import Vector2 from 'vector2';


type IWall = number[];
type IFlatVector = number[];

export interface ISegment {
    p1: ICorner;
    p2: ICorner;
};

export interface ICorner extends Vector2 {
    begins?: ISegment;
    ends?: ISegment;
    radians?: number;
};

const { PI } = Math;
const PI2 = PI*2;

function angle(v: Vector2): number {
    return Math.atan2(v.y, v.x);
}

export const addWalls = (corners: Array<number[]>, walls: Array<number[]>, top: number, left: number, width: number, height: number) => {
    let next = corners.length;

    corners.push(
        [left, top],
        [width, top],
        [width, height],
        [left, height],
    );

    walls.push(
        [next, next+1],
        [next+1, next+2],
        [next+2, next+3],
        [next+3, next],
    );
};

function toICorner(c: number[], origin: number[]): ICorner {
    let nc: any = Vector2.from(c);
    nc.radians = angle(nc.clone().subtract(Vector2.from(origin)));
    nc.begins = null;
    nc.ends = null;
    return nc;
}

export const corners = (origin: number[], corners: Array<number[]>, walls: Array<number[]>): ICorner[] => {
    let edges = [];
    walls.forEach((indices, idx) => {
        let p1 = toICorner(corners[indices[0]], origin);
        let p2 = toICorner(corners[indices[1]], origin);
        edges.push(p1, p2);

        let wall: ISegment = { p1, p2 };

        let diff = p2.radians - p1.radians;
        if (diff >  PI) diff -= PI2;
        if (diff < -PI) diff += PI2;

        if (diff > 0) {
            p1.begins = wall;
            p2.ends = wall;
        } else {
            p1.ends = wall;
            p2.begins = wall;
        }
    });


    edges.sort((a, b) => {
        if (a.radians > b.radians) return 1;
        if (a.radians < b.radians) return -1;

        if (!a.begins && b.begins) return 1;
        if (a.begins && !b.begins) return -1;
        return 0;
    });

    return edges;
};