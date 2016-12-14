import * as PIXI from 'pixi.js';
import Vector2 from 'vector2';

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
let position = new Vector2(100, 700);
let positionConverted = new Vector2(100, 1000-100);
let mousePosition = new Vector2(500, 500);
let direction = mousePosition.clone().sub(position);
let fovRoot = new Vector2(50, 50);

let corners: Vector2[] = [
    new Vector2(0   , 0   ),
    new Vector2(1000, 0   ),
    new Vector2(1000, 1000),
    new Vector2(0   , 1000),

    new Vector2(300, 200),
    new Vector2(600, 200),
    new Vector2(600, 600),
    new Vector2(300, 600),
];

let _walls = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
];

class Walls {
    private index: {[vi: number]: Vector2[]} = {};
    constructor(private _corners: Vector2[], private _walls: number[][]) {
        this._walls.forEach((wall, wi) => {
            wall.forEach((vi, i) => {
                let refs = this.index[vi] = this.index[vi] || [];
                for (var x = 0; x < wall.length-1; ++x) {
                    let n = (i+1+x) % wall.length;
                    refs.push(this._corners[wall[n]]);
                }
            });
        });

        //console.log(JSON.stringify(this.index, null, 2));
    }

    //each(cb: (wall: any, refs: any) => any) {
        //this.walls.forEach((wall, wi) => cb(wall, this.refs));
    //}

    each(cb: (w: Vector2[], wi: number, vis: number[]) => void) {
        this._walls.forEach((wall, wi) => {
            let points = wall.map(vi => {
                return this._corners[vi].clone();
            });
            cb(points, wi, wall);
        });
    }

    sortedPoints(origin: Vector2) {
        let mapped = this._corners.map((c, i) => {
            return {p: c, i: i};
        });
        mapped.sort((a, b) => {
            let ac = a.p.clone();
            let bc = b.p.clone();
            ac.sub(origin);
            bc.sub(origin);

            let aa = angle(ac);
            let bb = angle(bc);
            //return b.angle() - a.angle();
            //angle(a) === angle(b)
            if (aa === bb) {

                return -1;
            }
            return aa - bb;

            let refs = this.refs(vi);
            //let refsMapped = refs.map(vi => this._corners[vi]);
            cb(point.clone(), refs, vi);
        });
    }

    refs(vi: number) {
        return this.index[vi];
    }
}

let walls = new Walls(corners, _walls);

let radius = 40;
let fov = (30 * (Math.PI/180))/2;;
let aoc = Math.PI;
let simpleShader = new PIXI.Filter('', shaderCode);
simpleShader.uniforms.radius = radius;
simpleShader.uniforms.fov = fov;
simpleShader.uniforms.aoc = aoc;
simpleShader.uniforms.position = new Float32Array([100, 1000-100]);
simpleShader.uniforms.fovRoot = new Float32Array(fovRoot.toArray());

//stage.filters = [simpleShader, new PIXI.filters.FXAAFilter()];
//let fxaa = new PIXI.filters.FXAAFilter();

//stage.filters = [simpleShader];

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

document.addEventListener('keydown', e => {
    switch (e.key) {
        case 'w':
            position.addY(-100); break;
        case 'a':
            position.addX(-100); break;
        case 's':
            position.addY( 100); break;
        case 'd':
            position.addX( 100); break;
    }

    positionConverted.read(position);
    positionConverted.y = 1000 - positionConverted.y;

    simpleShader.uniforms.position = new Float32Array(positionConverted.toArray());
    updateUniforms();
});

document.addEventListener('mousemove', (e) => {
    mousePosition = new Vector2(e.clientX, 1000-e.clientY);
    updateUniforms();
});

function angle(v: Vector2): number {
    return Math.atan2(v.y, v.x) * (180/Math.PI); 
}

function animate() {

    let points: Vector2[] = [];
    let triangles = [];
    walls.points((point, refs) => {
        //points.forEach(point => {
            //console.log('------------------');
            //point.log();

            visionMask.moveTo(position.x, position.y);
            let direction = point.clone().sub(position);
            let end = direction.clone().setLength(99999).add(position);

            visionMask.lineStyle(8, 0xffffff, 1.0);
            visionMask.lineTo(end.x, end.y);
            direction.normalize();

            let corners = {};

            let intersections: Vector2[] = [];
            walls.each(wall => {
                visionMask.lineStyle(2, 0x00ff00, 1.0);
                visionMask.moveTo(wall[0].x, wall[0].y);
                visionMask.lineTo(wall[1].x, wall[1].y);

                //if ( wallCheck === wall ) return;
                let intersection = Vector2.segmentsIntersection(position, end, wall[0], wall[1]) || Vector2.segmentsIntersection(position, end, wall[1], wall[0]);
                //console.log('-----');
                //wall[0].log();
                //wall[1].log();
                if (intersection) {
                    //console.log("INT"); intersection.log();
                    intersection.round();
                    //intersection.log();
                }
                //if ( intersection && !intersection.eql(wallCheck[0]) && !intersection.eql(wallCheck[1]) ) return true;

                if (intersection) {
                    if (point.eql(intersection)) {
                        //console.log('SIMILAR');
                        let left = false;
                        let right = false;
                        refs.forEach(ref => {
                            let normd = ref.clone().subtract(position).normalize();
                            let angle = angleBetween(normd, direction);
                            /*console.log('--');
                            point.log();
                            ref.log();
                            direction.log();
                            normd.log();
                            console.log(angle);*/
                            if (angle <= 0) left = true;
                            else if(angle > 0) right = true;
                        });
                        //console.log(left, right);

                        if ( left && right ) intersections.push(intersection);
                        else {
                            corners[points.length] = true;
                            (<any>intersection).EDGE = true;
                            points.push(intersection);
                        }
                    } else intersections.push(intersection);
                }
                //intersections.push(intersection);
                //points.push(wall[0]);
            });

            if ( ! intersections.length ) return points.push(point);

            let d;
            let int;
            intersections.forEach(i => {
                if ( int ) {
                    let cd = i.distance(position);
                    if (cd < d) {
                        d = cd;
                        int = i;
                    }
                }
                else {
                    d = i.distance(position);
                    int = i;
                }
            });

            if ( int ) points.push(int);
        //});
        //});
    });

    /*points.sort((a, b) => {
        let ac = a.clone().sub(position);
        let bc = b.clone().sub(position);
        let aa = angle(ac);
        let bb = angle(bc);
        //return b.angle() - a.angle();
        //angle(a) === angle(b)
        if (aa === bb) {

            return -1;
        }
        return aa - bb;
        //return angleBetween(a, position) - angleBetween(b, position);
    });*/

    points = points.filter((p, i) => {
        //let last = points[i - 1];
        let slice = points.slice(i+1);
        let dup = slice.some((p2, i2) => {
            if (p2.eql(p)) return true;
        });
        if (dup) return false;
        return true;
    });

    points.forEach(p => {
        p = p.clone().sub(position);
        //console.log(angle(p));
    });
    //console.log(JSON.stringify(points, null, 2));

    points.forEach(p => {
        visionMask.beginFill(0x0000ff);
        visionMask.drawCircle(p.x, p.y, 10);
        visionMask.endFill();
    })

    let pp = points.map(p => {
        return new PIXI.Point(p.x, p.y);
    });


    //visionMask.clear();
    visionMask.lineStyle(3, 0x000000, 1.0);
    pp.forEach((p, i) => {
        //if (i === pp.length-1) return;
        //if (i > 0) return;
        let pos = new PIXI.Point(position.x, position.y);
        let ppp: PIXI.Point[] = [ pos, p, pp[(i+1)%pp.length] ];
        visionMask.moveTo(ppp[0].x, ppp[0].y);
        visionMask.lineTo(ppp[1].x, ppp[1].y);
        visionMask.lineTo(ppp[2].x, ppp[2].y);
        visionMask.lineTo(ppp[0].x, ppp[0].y);
        //console.log(ppp);
        //visionMask.drawPolygon(ppp);
    });
    visionMask.endFill();

    //position.log();

    //requestAnimationFrame(animate);
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