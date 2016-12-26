import Vector2 from 'vector2';
import { ICorner, ISegment } from '../state/world';
const { cos, sin } = Math;

const leftOf = (segment: ISegment, point: Vector2): boolean => {
    //let P1toP2 = new Vector2(segment.p2.x - segment.p1.x, segment.p2.y - segment.p1.y);
    //let P1toP  = new Vector2(point.x - segment.p1.x, point.y - segment.p1.y);
    let P1toP2 = segment.p2.clone().sub(segment.p1);
    let P1toP = point.clone().sub(segment.p1);
    let cross = P1toP2.cross(P1toP);

    return cross < 0;
};

const interpolate = (pointA: Vector2, pointB: Vector2, f: number) => {
    return new Vector2(
        pointA.x*(1-f) + pointB.x*f,
        pointA.y*(1-f) + pointB.y*f
    );
};

export const segmentInFrontOf = (s1: ISegment, s2: ISegment, origin: Vector2): boolean => {
    const A1 = leftOf(s1, interpolate(s2.p1, s2.p2, 0.01));
    const A2 = leftOf(s1, interpolate(s2.p2, s2.p1, 0.01));
    const A3 = leftOf(s1, origin);
    const B1 = leftOf(s2, interpolate(s1.p1, s1.p2, 0.01));
    const B2 = leftOf(s2, interpolate(s1.p2, s1.p1, 0.01));
    const B3 = leftOf(s2, origin);

    if (A1 === A2 && A2 === A3) return true;
    if (B1 === B2 && B2 !== B3) return true;

    return false;
};

//let s1 = {p1: new Vector2(200, 200), p2: new Vector2(200, 250)};
//let p = new Vector2(221, 225);
//let res = leftOf(s1, p);
//console.log(res);

export const lineIntersection = (point1: Vector2, point2: Vector2, point3: Vector2, point4: Vector2) => {
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

const getTrianglePoints = (origin, angle1, angle2, segment) => {
    const p1 = origin;
    const p2 = new Vector2(origin.x + cos(angle1), origin.y + sin(angle1));
    const p3 = new Vector2(0, 0);
    const p4 = new Vector2(0, 0);

    if (segment) {
        p3.x = segment.p1.x;
        p3.y = segment.p1.y;
        p4.x = segment.p2.x;
        p4.y = segment.p2.y;
    } else {
        p3.x = origin.x + cos(angle1) * 200;
        p3.y = origin.y + sin(angle1) * 200;
        p4.x = origin.x + cos(angle2) * 200;
        p4.y = origin.y + sin(angle2) * 200;
    }

    const pBegin = lineIntersection(p3, p4, p1, p2);

    p2.x = origin.x + cos(angle2);
    p2.y = origin.y + sin(angle2);

    const pEnd = lineIntersection(p3, p4, p1, p2);

    return [pBegin, pEnd];
};

export const visibility = (origin: Vector2, endpoints: ICorner[]): Vector2[] => {
    let openSegments: ISegment[] = [];
    let output = [];
    let beginAngle = 0;

    let triangles: Vector2[] = [];

    for(let pass = 0; pass < 2; pass += 1) {
        for (let i = 0; i < endpoints.length; i += 1) {
            let endpoint = endpoints[i];
            let openSegment = openSegments[0];

            let segment;
            if (segment = endpoint.ends) {
                let index = openSegments.indexOf(segment)
                if (index > -1) openSegments.splice(index, 1);
            } else if (segment = endpoint.begins) {
                let index = 0
                let openSegment = openSegments[index];
                while (openSegment && segmentInFrontOf(segment, openSegment, origin)) {
                    index += 1;
                    openSegment = openSegments[index]
                }


                if (!openSegment) openSegments.push(segment);
                else openSegments.splice(index, 0, segment);
            };

            if (openSegment !== openSegments[0]) {
                if (pass === 1) {
                    let trianglePoints = getTrianglePoints(origin, beginAngle, endpoint.radians, openSegment);
                    output.push(trianglePoints);
                }
                beginAngle = endpoint.radians;
            }
        }
    }

    return output;
}