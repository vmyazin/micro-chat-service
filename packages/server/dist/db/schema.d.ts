import type { GroupId, UserId } from '@microchat/shared';
export interface UsersTable {
    id: UserId;
    display_name: string;
    created_at: string;
}
export interface SessionsTable {
    id: string;
    user_id: UserId;
    expires_at: string;
    device_info: string;
    created_at: string;
}
export interface CredentialsTable {
    id: string;
    user_id: UserId;
    credential_id: string;
    public_key: string;
    created_at: string;
    last_used_at: string | null;
}
export interface GroupsTable {
    id: GroupId;
    encrypted_name: string;
    owner_id: UserId;
    created_at: string;
    last_activity_at: string;
}
export interface GroupMembersTable {
    id: string;
    group_id: GroupId;
    user_id: UserId;
    joined_at: string;
}
export interface MessagesTable {
    id: string;
    group_id: GroupId;
    sender_id: UserId;
    encrypted_payload: string;
    nonce: string;
    created_at: string;
    deleted_at: string | null;
    deleted_by: UserId | null;
}
export interface InvitesTable {
    id: string;
    group_id: GroupId;
    created_by: UserId;
    expires_at: string;
    used: number;
    used_by: UserId | null;
    used_at: string | null;
}
export interface DeliveryReceiptsTable {
    id: string;
    message_id: string;
    user_id: UserId;
    delivered_at: string;
    read_at: string | null;
}
export interface DatabaseSchema {
    users: UsersTable;
    sessions: SessionsTable;
    credentials: CredentialsTable;
    groups: GroupsTable;
    group_members: GroupMembersTable;
    messages: MessagesTable;
    invites: InvitesTable;
    delivery_receipts: DeliveryReceiptsTable;
}
//# sourceMappingURL=schema.d.ts.map