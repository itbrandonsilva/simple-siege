import { SS_Map, SS_List, SS_LWall, SS_LVector, SS_MProjectile, SS_IPlayers, SS_IState, SS_IWorld } from './interfaces';
import { addWalls } from './world';

export const generateDefaultState = function () {
    let flatWalls = [
        [0, 1], [0, 2], [3, 4], [4, 5], [6, 7],
    ];

    let flatEdges = [
        [200, 150],
        [400, 150],
        [200, 400],
        [100, 100],
        [100, 500],
        [500, 500],
        [500, 50],
        [600, 700],
    ];

    addWalls(flatEdges, flatWalls, 0, 0, 1000, 1000);

    let finalWalls = [];
    let finalEdges = [];
    flatWalls.forEach((wall, idx) => {
        finalWalls.push([idx*2, (idx*2)+1]);
        finalEdges.push(flatEdges[wall[0]].slice(), flatEdges[wall[1]].slice());
    });

    let walls = SS_List<SS_LWall>(finalWalls.map(wall => {
        return SS_List<number>(wall);
    }));

    let edges = SS_List<SS_LVector>(finalEdges.map(edge => {
        return SS_List<number>(edge);
    }));

    return SS_Map<SS_IState>({
        world: SS_Map<SS_IWorld>({ walls, edges }),
        players: SS_Map<SS_IPlayers>({}),
        projectiles: SS_List<SS_MProjectile>([])
    });
}