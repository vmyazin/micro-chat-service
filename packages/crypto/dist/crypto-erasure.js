"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoErasureService = exports.CryptoErasureError = void 0;
class CryptoErasureError extends Error {
    groupId;
    constructor(groupId, message = `Keys for group ${groupId} have been erased`) {
        super(message);
        this.groupId = groupId;
        this.name = 'CryptoErasureError';
    }
}
exports.CryptoErasureError = CryptoErasureError;
class CryptoErasureService {
    keyStore;
    erasedGroups = new Set();
    constructor(keyStore) {
        this.keyStore = keyStore;
    }
    async eraseGroup(groupId) {
        const keyCount = await this.keyStore.deleteAllGroupKeys(groupId);
        this.erasedGroups.add(groupId);
        const auditEntry = {
            groupId,
            timestamp: new Date(),
            keyCount,
        };
        console.log(`[CryptoErasure] Erased ${keyCount} keys for group ${groupId} at ${auditEntry.timestamp.toISOString()}`);
        return auditEntry;
    }
    isErased(groupId) {
        return this.erasedGroups.has(groupId);
    }
    assertNotErased(groupId) {
        if (this.erasedGroups.has(groupId)) {
            throw new CryptoErasureError(groupId);
        }
    }
}
exports.CryptoErasureService = CryptoErasureService;
//# sourceMappingURL=crypto-erasure.js.map