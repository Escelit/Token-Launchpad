import type { Buffer } from "buffer";
import type {
  AssembledTransaction,
  MethodOptions,
  ClientOptions,
} from "@stellar/stellar-sdk/contract";
import {
  Client as ContractClient,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";

export interface LaunchpadInfo {
  admin: string;
  cancelled: boolean;
  cap: bigint;
  cliff: bigint;
  deposit_token: string;
  end: bigint;
  price: bigint;
  soft_cap: bigint;
  start: bigint;
  token: string;
  total_raised: bigint;
  total_tokens_sold: bigint;
  vesting_duration: bigint;
}

export interface ClaimableAmount {
  available: bigint;
  vested: bigint;
}

export interface ContributorInfo {
  contributed: bigint;
  tokens_bought: bigint;
  tokens_claimed: bigint;
}

export interface Client {
  fund: ({admin, amount}: {admin: string, amount: bigint}, options?: MethodOptions) => Promise<AssembledTransaction<null>>
  claim: ({caller}: {caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>
  cancel: ({admin}: {admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>
  refund: ({caller}: {caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>
  contribute: ({caller, amount}: {caller: string, amount: bigint}, options?: MethodOptions) => Promise<AssembledTransaction<null>>
  initialize: ({admin, token, deposit_token, price, cap, soft_cap, start, end, cliff, vesting_duration}: {admin: string, token: string, deposit_token: string, price: bigint, cap: bigint, soft_cap: bigint, start: bigint, end: bigint, cliff: bigint, vesting_duration: bigint}, options?: MethodOptions) => Promise<AssembledTransaction<null>>
  get_claimable: ({address}: {address: string}, options?: MethodOptions) => Promise<AssembledTransaction<ClaimableAmount>>
  withdraw_deposits: ({admin}: {admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>
  get_launchpad_info: (options?: MethodOptions) => Promise<AssembledTransaction<LaunchpadInfo>>
  get_contributor_info: ({address}: {address: string}, options?: MethodOptions) => Promise<AssembledTransaction<ContributorInfo>>
}

export class Client extends ContractClient {
  static async deploy<T = Client>(
    options: MethodOptions &
      Omit<ClientOptions, "contractId"> & {
        wasmHash: Buffer | string;
        salt?: Buffer | Uint8Array;
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAAAAAAAAEZnVuZAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAAGAAAAAA==",
        "AAAAAAAAAAAAAAAFY2xhaW0AAAAAAAABAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAA",
        "AAAAAAAAAAAAAAAGY2FuY2VsAAAAAAABAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAA",
        "AAAAAAAAAAAAAAAGcmVmdW5kAAAAAAABAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAA",
        "AAAAAAAAAAAAAAAKY29udHJpYnV0ZQAAAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAYAAAAA",
        "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAACgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAV0b2tlbgAAAAAAABMAAAAAAAAADWRlcG9zaXRfdG9rZW4AAAAAAAATAAAAAAAAAAVwcmljZQAAAAAAAAYAAAAAAAAAA2NhcAAAAAAGAAAAAAAAAAhzb2Z0X2NhcAAAAAYAAAAAAAAABXN0YXJ0AAAAAAAABgAAAAAAAAADZW5kAAAAAAYAAAAAAAAABWNsaWZmAAAAAAAABgAAAAAAAAAQdmVzdGluZ19kdXJhdGlvbgAAAAYAAAAA",
        "AAAAAwAAAAAAAAAAAAAADUNvbnRyYWN0RXJyb3IAAAAAAAAKAAAAAAAAABJBbHJlYWR5SW5pdGlhbGl6ZWQAAAAAAAEAAAAAAAAADk5vdEluaXRpYWxpemVkAAAAAAACAAAAAAAAAAhOb3RBZG1pbgAAAAMAAAAAAAAADVNhbGVOb3RBY3RpdmUAAAAAAAAEAAAAAAAAAAxTYWxlTm90RW5kZWQAAAAFAAAAAAAAAApDYXBSZWFjaGVkAAAAAAAGAAAAAAAAAAxCZWxvd1NvZnRDYXAAAAAHAAAAAAAAAA5Ob0NvbnRyaWJ1dGlvbgAAAAAACAAAAAAAAAAOTm90aGluZ1RvQ2xhaW0AAAAAAAkAAAAAAAAACUNhbmNlbGxlZAAAAAAAAAo=",
        "AAAAAQAAAAAAAAAAAAAADUxhdW5jaHBhZEluZm8AAAAAAAANAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAACWNhbmNlbGxlZAAAAAAAAAEAAAAAAAAAA2NhcAAAAAAGAAAAAAAAAAVjbGlmZgAAAAAAAAYAAAAAAAAADWRlcG9zaXRfdG9rZW4AAAAAAAATAAAAAAAAAANlbmQAAAAABgAAAAAAAAAFcHJpY2UAAAAAAAAGAAAAAAAAAAhzb2Z0X2NhcAAAAAYAAAAAAAAABXN0YXJ0AAAAAAAABgAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAAAAAAx0b3RhbF9yYWlzZWQAAAAGAAAAAAAAABF0b3RhbF90b2tlbnNfc29sZAAAAAAAAAYAAAAAAAAAEHZlc3RpbmdfZHVyYXRpb24AAAAG",
        "AAAAAQAAAAAAAAAAAAAAD0NsYWltYWJsZUFtb3VudAAAAAACAAAAAAAAAAlhdmFpbGFibGUAAAAAAAAGAAAAAAAAAAZ2ZXN0ZWQAAAAAAAY=",
        "AAAAAQAAAAAAAAAAAAAAD0NvbnRyaWJ1dG9ySW5mbwAAAAADAAAAAAAAAAtjb250cmlidXRlZAAAAAAGAAAAAAAAAA10b2tlbnNfYm91Z2h0AAAAAAAABgAAAAAAAAAOdG9rZW5zX2NsYWltZWQAAAAAAAY=",
        "AAAAAAAAAAAAAAANZ2V0X2NsYWltYWJsZQAAAAAAAAEAAAAAAAAAB2FkZHJlc3MAAAAAEwAAAAEAAAfQAAAAD0NsYWltYWJsZUFtb3VudAA=",
        "AAAAAAAAAAAAAAARd2l0aGRyYXdfZGVwb3NpdHMAAAAAAAABAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAA",
        "AAAAAAAAAAAAAAASZ2V0X2xhdW5jaHBhZF9pbmZvAAAAAAAAAAAAAQAAB9AAAAANTGF1bmNocGFkSW5mbwAAAA==",
        "AAAAAAAAAAAAAAAUZ2V0X2NvbnRyaWJ1dG9yX2luZm8AAAABAAAAAAAAAAdhZGRyZXNzAAAAABMAAAABAAAH0AAAAA9Db250cmlidXRvckluZm8A" ]),
      options
    )
  }
  public readonly fromJSON = {
    fund: this.txFromJSON<null>,
        claim: this.txFromJSON<null>,
        cancel: this.txFromJSON<null>,
        refund: this.txFromJSON<null>,
        contribute: this.txFromJSON<null>,
        initialize: this.txFromJSON<null>,
        get_claimable: this.txFromJSON<ClaimableAmount>,
        withdraw_deposits: this.txFromJSON<null>,
        get_launchpad_info: this.txFromJSON<LaunchpadInfo>,
        get_contributor_info: this.txFromJSON<ContributorInfo>
  }
}
