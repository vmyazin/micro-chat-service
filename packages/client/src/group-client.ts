import type { GroupId, UserId } from '@microchat/shared';

export interface GroupListItem {
  groupId: GroupId;
  encryptedName: string;
  memberCount: number;
  lastActivity: string;
  memberNames: string[];
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
  leafIndex?: number;
}

export interface GroupMember {
  userId: UserId;
  displayName: string;
  joinedAt: string;
  isOwner: boolean;
}

export interface GroupMembersResult {
  members: GroupMember[];
  ownerId: UserId;
}

export class GroupClient {
  constructor(private baseUrl: string) {}

  async listGroups(): Promise<GroupListItem[]> {
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

  async createGroup(encryptedName: string): Promise<CreateGroupResult> {
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

  async createInvite(groupId: GroupId): Promise<InviteResult> {
    const response = await fetch(
      `${this.baseUrl}/api/groups/${groupId}/invites`,
      {
        method: 'POST',
        credentials: 'include',
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create invite');
    }

    return response.json();
  }

  async acceptInvite(code: string): Promise<AcceptInviteResult> {
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

  async removeMember(groupId: GroupId, userId: UserId): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/groups/${groupId}/members/${userId}`,
      {
        method: 'DELETE',
        credentials: 'include',
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to remove member');
    }
  }

  async getMembers(groupId: GroupId): Promise<GroupMembersResult> {
    const response = await fetch(
      `${this.baseUrl}/api/groups/${groupId}/members`,
      {
        method: 'GET',
        credentials: 'include',
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get members');
    }

    return response.json();
  }

  async joinGroup(groupId: GroupId): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/groups/${groupId}/join`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to join group');
    }
  }

  async leaveGroup(groupId: GroupId): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/groups/${groupId}/leave`,
      {
        method: 'POST',
        credentials: 'include',
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to leave group');
    }
  }

  async deleteGroup(groupId: GroupId): Promise<void> {
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
