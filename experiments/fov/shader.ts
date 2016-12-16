import * as PIXI from 'pixi.js';
import Vector2 from 'vector2';
const V = Vector2;

const renderer = new PIXI.WebGLRenderer(1000, 1000, {antialias: true, transparent: true});
const stage = new PIXI.Container();
document.getElementById('game').appendChild(renderer.view);

// PIXI can only mask something it knows about
let background = new PIXI.Graphics();
background.beginFill(0xff0000);
background.drawRect(0, 0, 1000, 1000);
background.endFill();
stage.addChild(background);

let visionMask = new PIXI.Graphics();
stage.addChild(visionMask);
//stage.mask = visionMask;

let shaderCode = document.getElementById('shader').innerHTML;
let position = new Vector2(900, 200);
let positionConverted = new Vector2(100, 1000-100);
let mousePosition = new Vector2(500, 500);
let direction = mousePosition.clone().sub(position);
let fovRoot = new Vector2(50, 50);

let radius = 40;
let fov = (70 * (Math.PI/180))/2;;
let aoc = Math.PI;
let simpleShader = new PIXI.Filter('', shaderCode);
simpleShader.uniforms.radius = radius;
simpleShader.uniforms.fov = fov;
simpleShader.uniforms.aoc = aoc;
simpleShader.uniforms.position = new Float32Array([100, 1000-100]);
simpleShader.uniforms.fovRoot = new Float32Array(fovRoot.toArray());

//stage.filters = [simpleShader, new PIXI.filters.FXAAFilter()];
//let fxaa = new PIXI.filters.FXAAFilter();

stage.filters = [simpleShader];

function updateUniforms() {
    let finalAngle = Math.PI - (fov + (Math.PI/2));
    aoc = Math.PI - finalAngle;
    let bisectorLength = ((radius*Math.sin(Math.PI/2))/Math.sin(fov));
    direction = mousePosition.clone().sub(positionConverted).normalize();
    fovRoot = positionConverted.clone().sub( direction.clone().mul(bisectorLength) );

    simpleShader.uniforms.fovRoot = new Float32Array(fovRoot.toArray());
    simpleShader.uniforms.direction = new Float32Array(direction.normalize().toArray());
    simpleShader.uniforms.aoc = aoc;
}

let keyState: any = {};
function handleKey(key: string, down: boolean) {
    switch (key) {
        case 'w':
        case 'a':
        case 's':
        case 'd':
            keyState[key] = down;
    }
}

document.addEventListener('keydown', (e) => handleKey(e.key, true));
document.addEventListener('keyup', (e) => handleKey(e.key, false));

document.addEventListener('mousemove', (e) => {
    mousePosition = new Vector2(e.clientX, 1000-e.clientY);
    updateUniforms();
});

function angle(v: Vector2): number {
    return Math.atan2(v.y, v.x) * (180/Math.PI); 
}

type MIntersection = {wall: Wall, point: Vector2, isEdge?: boolean, left?: boolean, right?: boolean};

function buildIntersection(intersection: Vector2, wall: Wall, position: Vector2, direction: Vector2, edge: Corner): MIntersection {
    let left = false;
    let right = false;
    if (edge) edge.neighbors.forEach((p: Corner) => {
        if ( p.vector.eql(intersection) ) return;
        let posToCorner = p.vector.clone().subtract(position);
        let angle = angleBetween(posToCorner, direction);
        if (angle < 0) left = true;
        else if(angle > 0) right = true;
    });
    return {wall, point: intersection, isEdge: !!edge, left, right};
}


let corners: Vector2[] = [
    new Vector2(0   , 0   ),
    new Vector2(1000, 0   ),
    new Vector2(1000, 1000),
    new Vector2(0   , 1000),

    new Vector2(200, 200),
    new Vector2(400, 200),
    new Vector2(400, 400),
    new Vector2(200, 400),

    new Vector2(600, 500),
    new Vector2(700, 500),
    new Vector2(700, 600),
    new Vector2(600, 600)
];

let _walls = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [8, 9], [9, 10], [10, 11], [11, 8],
];

interface Corner {
    index: number;
    readonly vector: Vector2;
    walls: Wall[];
    neighbors: Corner[];
}

interface Wall {
    index: number;
    corners: Corner[];
}

class Walls {
    private _corners: Corner[];
    private _walls: Wall[];

    constructor(corners: Vector2[], walls: number[][]) {
        this._corners = corners.map((corner, idx) => {
            let mapped: Corner = {
                index: idx,
                vector: corner.clone(),
                walls: [],
                neighbors: []
            };
            return mapped;
        });

        this._walls = walls.map((wall, idx) => {
            let c1 = this._corners[wall[0]];
            let c2 = this._corners[wall[1]];

            let mapped: Wall = {
                index: idx,
                corners: [c1, c2]
            };

            c1.walls.push(mapped);
            c2.walls.push(mapped);

            c1.neighbors.push(c2);
            c2.neighbors.push(c1);
            return mapped;
        });
    }

    each(cb: (wall: Wall) => void) {
        this._walls.forEach(cb);
    }

    points(origin: Vector2) {
        let sliced = this._corners.slice();
        sliced.sort((a, b) => {
            let ac = a.vector.clone();
            let bc = b.vector.clone();
            ac.sub(origin);
            bc.sub(origin);

            let aa = angle(ac);
            let bb = angle(bc);
            return aa - bb;
        });

        return sliced;
    }
}

let walls = new Walls(corners, _walls);

let ms = new Date().getTime();
function animate() {
    let interp = new Date().getTime() - ms;
    ms = new Date().getTime();

    let speed = 500 * (interp/1000);

    if (keyState.a) position.addX(-speed);
    if (keyState.d) position.addX(speed);
    if (keyState.w) position.addY(-speed);
    if (keyState.s) position.addY(speed);

    positionConverted.read(position);
    positionConverted.y = 1000 - positionConverted.y;

    simpleShader.uniforms.position = new Float32Array(positionConverted.toArray());
    updateUniforms();

    visionMask.clear();

    let finalP: Vector2[] = [];

    let points = walls.points(position);
    points.forEach((po) => {
        let point = po.vector;
        let direction = point.clone().sub(position);
        direction.normalize();
        if (direction.eql(new Vector2(0, 0))) return;


        let end = direction.clone().setLength(99999).add(position);

        let corners = {};

        let intersections: MIntersection[] = [];


            intersections.push(buildIntersection(po.vector, null, position, direction, po));
            walls.each(wall => {
                let intersection = Vector2.segmentsIntersection(position, end, wall.corners[0].vector, wall.corners[1].vector) 
                                || Vector2.segmentsIntersection(position, end, wall.corners[1].vector, wall.corners[0].vector) 

                if (intersection) {
                    intersection.round();
                    if (intersection.eql(po.vector)) return;

                    let left = false;
                    let right = false;

                    let edge;
                    if (intersection.eql(wall.corners[0].vector)) edge = wall.corners[0];
                    else if (intersection.eql(wall.corners[1].vector)) edge = wall.corners[1];

                    let metaintersection = buildIntersection(intersection, wall, position, direction, edge);
                    intersections.push(metaintersection);
                }
            });

            intersections.sort((a, b) => {
                return a.point.distance(position) - b.point.distance(position);
            });
 
            let left = false;
            let right = false;

            let edge;
            let poi: {wall: Wall, point: Vector2, corner?: Corner, isEdge?: boolean, left?: boolean, right?: boolean};
            intersections.some(i => {
                if ( ! i.isEdge || (i.left && i.right)) {
                    poi = i;
                    return true;
                }

                if ( ! i.left && ! i.right ) return false;

                if (i.left) {
                    if (right) {
                        poi = i;
                        return true;
                    } else if (left) {
                        edge = edge || i;
                    } else {
                        edge = edge || i;
                        left = true;
                    }
                }

                if (i.right) {
                    if (left) {
                        poi = i;
                        return true;
                    } else if (right) {
                        edge = edge || i;
                    } else {
                        edge = edge || i;
                        right = true;
                    }
                }

                return false;
            });

            if ( ! edge ) finalP.push(poi.point);
            else {
                if (right) {
                    finalP.push(poi.point);
                    finalP.push(edge.point);
                } else {
                    finalP.push(edge.point);
                    finalP.push(poi.point);
                }
            }
    });

    let pos = new PIXI.Point(position.x, position.y);
    finalP.forEach((v, i) => {
        let v2 = new PIXI.Point(v.x, v.y);
        let _v = finalP[(i+1)%finalP.length];
        let v3 = new PIXI.Point(_v.x, _v.y);

        visionMask.beginFill(0x000000);
        visionMask.drawPolygon([pos, v2, v3]);
        visionMask.endFill();
    });

    requestAnimationFrame(animate);
    renderer.render(stage);
}
animate();

function angleBetween(a: Vector2, b: Vector2) {
    let result = Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x);
    //if (result < 0) result += Math.PI*2;

    //result = Math.abs(result);
    //if (result > Math.PI) result = (Math.PI*2) - result;
    if (result > Math.PI) result -= (Math.PI*2);
    if (result < -Math.PI) result += (Math.PI*2);
    return result;
}