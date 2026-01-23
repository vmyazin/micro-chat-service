"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InviteConfig = exports.RetentionPolicy = void 0;
var RetentionPolicy;
(function (RetentionPolicy) {
    RetentionPolicy["SEVEN_DAYS"] = "7_DAYS";
    RetentionPolicy["GROUP_DISBAND"] = "GROUP_DISBAND";
})(RetentionPolicy || (exports.RetentionPolicy = RetentionPolicy = {}));
exports.InviteConfig = {
    MAX_AGE_DAYS: 7,
    SINGLE_USE: true,
};
//# sourceMappingURL=types.js.map