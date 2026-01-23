"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const hono_1 = require("hono");
const auth_1 = require("./routes/auth");
const groups_1 = require("./routes/groups");
const app = new hono_1.Hono();
exports.app = app;
app.get('/health', (c) => {
    return c.json({ status: 'ok' });
});
app.route('', auth_1.authRouter);
app.route('', groups_1.groupsRouter);
//# sourceMappingURL=app.js.map