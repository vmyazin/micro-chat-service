"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupClient = void 0;
class GroupClient {
    baseUrl;
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }
    async listGroups() {
        const response = await fetch(`${this.baseUrl}/api/groups`, {
            method: 'GET',
            credentials: 'include',
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to list groups');
        }
        return response.json();
    }
    async createGroup(encryptedName) {
        const response = await fetch(`${this.baseUrl}/api/groups`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ encryptedName }),
            credentials: 'include',
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create group');
        }
        return response.json();
    }
    async createInvite(groupId) {
        const response = await fetch(`${this.baseUrl}/api/groups/${groupId}/invites`, {
            method: 'POST',
            credentials: 'include',
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create invite');
        }
        return response.json();
    }
    async acceptInvite(code) {
        const response = await fetch(`${this.baseUrl}/api/invites/${code}/accept`, {
            method: 'POST',
            credentials: 'include',
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to accept invite');
        }
        return response.json();
    }
    async removeMember(groupId, userId) {
        const response = await fetch(`${this.baseUrl}/api/groups/${groupId}/members/${userId}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to remove member');
        }
    }
    async getMembers(groupId) {
        const response = await fetch(`${this.baseUrl}/api/groups/${groupId}/members`, {
            method: 'GET',
            credentials: 'include',
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get members');
        }
        return response.json();
    }
    async leaveGroup(groupId) {
        const response = await fetch(`${this.baseUrl}/api/groups/${groupId}/leave`, {
            method: 'POST',
            credentials: 'include',
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to leave group');
        }
    }
    async deleteGroup(groupId) {
        const response = await fetch(`${this.baseUrl}/api/groups/${groupId}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete group');
        }
    }
}
exports.GroupClient = GroupClient;
//# sourceMappingURL=group-client.js.map