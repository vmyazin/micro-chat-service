// TODO: Integrate with OpenMLS or mls-rs library
// See: https://github.com/openmls/openmls

export interface MLSClient {
  createGroup(groupId: string): Promise<GroupState>;
  joinGroup(welcome: Uint8Array): Promise<GroupState>;
  addMember(groupState: GroupState, keyPackage: Uint8Array): Promise<Commit>;
  removeMember(groupState: GroupState, memberId: string): Promise<Commit>;
  encrypt(groupState: GroupState, plaintext: Uint8Array): Promise<Uint8Array>;
  decrypt(groupState: GroupState, ciphertext: Uint8Array): Promise<Uint8Array>;
}

export interface GroupState {
  groupId: string;
  epoch: number;
  members: string[];
}

export interface Commit {
  data: Uint8Array;
  welcome?: Uint8Array;
}
