"use strict";
var redux_1 = require("redux");
var reducer_1 = require("./reducer");
exports.store = redux_1.createStore(reducer_1.reducer);
