import type { GroupId, UserId } from '@microchat/shared';
export interface GroupListItem {
    groupId: GroupId;
    encryptedName: string;
    memberCount: number;
    lastActivity: string;
}
export interface CreateGroupResult {
    groupId: GroupId;
    epoch: number;
}
export interface InviteResult {
    code: string;
    expiresAt: string;
}
export interface AcceptInviteResult {
    groupId: GroupId;
    encryptedName: string;
    ownerId: UserId;
}
export declare class GroupClient {
    private baseUrl;
    constructor(baseUrl: string);
    listGroups(): Promise<GroupListItem[]>;
    createGroup(encryptedName: string): Promise<CreateGroupResult>;
    createInvite(groupId: GroupId): Promise<InviteResult>;
    acceptInvite(code: string): Promise<AcceptInviteResult>;
    removeMember(groupId: GroupId, userId: UserId): Promise<void>;
}
//# sourceMappingURL=group-client.d.ts.map