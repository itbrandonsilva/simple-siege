let x1 = -1;
let y1 = 0;

let x2 = -1;
let y2 = 2;

let dot = x1*x2 + y1*y2;
let det = x1*y2 + y1*x2;

let degrees = Math.atan2(dot, det) * (180/Math.PI);
//console.log(degrees);

degrees = Math.atan2(y2, x2) - Math.atan2(y1, x1);
degrees *= (180/Math.PI);
if (degrees < 0) degrees += 360;
console.log(degrees);
