"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
// MicroChat Server Entry Point
var app_1 = require("./app");
Object.defineProperty(exports, "app", { enumerable: true, get: function () { return app_1.app; } });
const app_2 = require("./app");
const retention_1 = require("./jobs/retention");
exports.default = {
    fetch: app_2.app.fetch,
    async scheduled(event, env, ctx) {
        ctx.waitUntil((0, retention_1.handleScheduled)(env));
    },
};
//# sourceMappingURL=index.js.map