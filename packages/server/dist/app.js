"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const hono_1 = require("hono");
const app = new hono_1.Hono();
exports.app = app;
app.get('/health', (c) => {
    return c.json({ status: 'ok' });
});
//# sourceMappingURL=app.js.map