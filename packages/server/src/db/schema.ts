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
  epoch: number;
}

export interface GroupTreeStateTable {
  group_id: GroupId;
  epoch: number;
  tree_data: string;
  updated_at: string;
}

export interface GroupMembersTable {
  id: string;
  group_id: GroupId;
  user_id: UserId;
  joined_at: string;
  /** Base64 raw P-256 ECDH public key for TreeKEM Welcome generation */
  identity_key: string | null;
}

export interface MessagesTable {
  id: string;
  group_id: GroupId;
  sender_id: UserId | null;
  encrypted_payload: string;
  nonce: string;
  created_at: string;
  deleted_at: string | null;
  deleted_by: UserId | null;
  /** Encrypted sender identity for Sealed Sender messages */
  sealed_sender: string | null;
}

export interface SenderTokensTable {
  id: string;
  group_id: GroupId;
  token_hash: string;
  used: number;
  expires_at: string;
  created_at: string;
  used_at: string | null;
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

export interface ImageAttachmentsTable {
  id: string;
  message_id: string;
  group_id: GroupId;
  r2_key: string;
  created_at: string;
}

export interface PendingWelcomesTable {
  group_id: GroupId;
  user_id: UserId;
  welcome_json: string;
  created_at: string;
}

export interface DatabaseSchema {
  users: UsersTable;
  sessions: SessionsTable;
  credentials: CredentialsTable;
  groups: GroupsTable;
  group_members: GroupMembersTable;
  messages: MessagesTable;
  sender_tokens: SenderTokensTable;
  invites: InvitesTable;
  delivery_receipts: DeliveryReceiptsTable;
  image_attachments: ImageAttachmentsTable;
  group_tree_state: GroupTreeStateTable;
  pending_welcomes: PendingWelcomesTable;
}
