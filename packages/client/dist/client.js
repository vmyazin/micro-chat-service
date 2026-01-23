"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MicroChatClient = void 0;
const auth_client_1 = require("./auth-client");
const group_client_1 = require("./group-client");
const message_client_1 = require("./message-client");
const websocket_client_1 = require("./websocket-client");
class MicroChatClient {
    authClient;
    groupClient;
    messageClient;
    wsClient;
    constructor(options) {
        this.authClient = new auth_client_1.AuthClient(options.baseUrl);
        this.groupClient = new group_client_1.GroupClient(options.baseUrl);
        this.messageClient = new message_client_1.MessageClient(options.baseUrl);
        this.wsClient = new websocket_client_1.WebSocketClient(options.baseUrl);
    }
    // Auth methods
    getRegisterOptions(displayName) {
        return this.authClient.getRegisterOptions(displayName);
    }
    verifyRegistration(response, challenge) {
        return this.authClient.verifyRegistration(response, challenge);
    }
    getLoginOptions(username) {
        return this.authClient.getLoginOptions(username);
    }
    verifyLogin(response, challenge) {
        return this.authClient.verifyLogin(response, challenge);
    }
    // Group methods
    listGroups() {
        return this.groupClient.listGroups();
    }
    createGroup(encryptedName) {
        return this.groupClient.createGroup(encryptedName);
    }
    createInvite(groupId) {
        return this.groupClient.createInvite(groupId);
    }
    acceptInvite(code) {
        return this.groupClient.acceptInvite(code);
    }
    removeMember(groupId, userId) {
        return this.groupClient.removeMember(groupId, userId);
    }
    // Message methods
    getMessages(groupId, limit, before) {
        return this.messageClient.getMessages(groupId, limit, before);
    }
    sendMessage(groupId, encryptedContent) {
        return this.messageClient.sendMessage(groupId, encryptedContent);
    }
    deleteMessage(groupId, messageId) {
        return this.messageClient.deleteMessage(groupId, messageId);
    }
    // WebSocket methods
    connect() {
        this.wsClient.connect();
    }
    disconnect() {
        this.wsClient.disconnect();
    }
    subscribe(groupId) {
        this.wsClient.subscribe(groupId);
    }
    unsubscribe(groupId) {
        this.wsClient.unsubscribe(groupId);
    }
    onEvent(handler) {
        return this.wsClient.onEvent(handler);
    }
}
exports.MicroChatClient = MicroChatClient;
exports.default = MicroChatClient;
//# sourceMappingURL=client.js.map