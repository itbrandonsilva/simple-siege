const chai = require('chai');
chai.should();
const expect = chai.expect;
const Immutable = require('immutable');
const { playerJoin, playerLeave } = require('../build/state/reducer');

describe('reducer', () => {
    let state;
    beforeEach(() => {
        state = Immutable.fromJS({
            players: {
                "5": {clientId: '5', x: 100, y: 100, lastShot: 0}
            }
        });
    });

    it('can handle when a player leaves', () => {
        state = playerLeave(state, '5');
        expect(state.getIn(['players', '5'])).to.equal(undefined);
    });
});