#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Env,
};

fn setup() -> (Env, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    let token_sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_address = token_sac.address();
    let token_admin = token::StellarAssetClient::new(&env, &token_address);
    token_admin.mint(&admin, &1_000_000_000_000i128);

    let deposit_sac = env.register_stellar_asset_contract_v2(admin.clone());
    let deposit_address = deposit_sac.address();
    let deposit_admin = token::StellarAssetClient::new(&env, &deposit_address);
    deposit_admin.mint(&admin, &1_000_000_000_000i128);
    deposit_admin.mint(&user1, &1_000_000_000i128);
    deposit_admin.mint(&user2, &1_000_000_000i128);

    let contract_id = env.register(Launchpad, ());
    let launchpad = LaunchpadClient::new(&env, &contract_id);

    launchpad.initialize(
        &admin,
        &token_address,
        &deposit_address,
        &1_000,
        &1_000_000,
        &500_000,
        &100,
        &200,
        &100,
        &500,
    );

    (env, contract_id, admin, user1, user2)
}

fn set_ledger(env: &Env, ts: u64) {
    let mut info = env.ledger().get();
    info.timestamp = ts;
    env.ledger().set(info);
}

#[test]
fn test_initialize() {
    let (_, _, _, _, _) = setup();
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn test_double_initialize() {
    let (env, contract_id, admin, _, _) = setup();
    let launchpad = LaunchpadClient::new(&env, &contract_id);
    launchpad.initialize(
        &admin,
        &Address::generate(&env),
        &Address::generate(&env),
        &1_000,
        &1_000_000,
        &500_000,
        &100,
        &200,
        &100,
        &500,
    );
}

#[test]
fn test_contribute() {
    let (env, id, _, user1, _) = setup();
    let deposit_token_addr = get_deposit_address(&env, &id);
    let deposit_token = token::TokenClient::new(&env, &deposit_token_addr);

    let bal_before: i128 = deposit_token.balance(&id);
    assert_eq!(bal_before, 0);

    set_ledger(&env, 150);

    let launchpad = LaunchpadClient::new(&env, &id);
    launchpad.contribute(&user1, &100);

    let bal_after: i128 = deposit_token.balance(&id);
    assert_eq!(bal_after, 100);

    let contrib = launchpad.get_contributor_info(&user1);
    assert_eq!(contrib.contributed, 100);
    assert_eq!(contrib.tokens_bought, 100_000);
}

#[test]
fn test_claim_after_vesting() {
    let (env, id, admin, user1, _) = setup();
    let token_addr = get_token_address(&env, &id);
    let token_client = token::TokenClient::new(&env, &token_addr);

    set_ledger(&env, 150);

    let launchpad = LaunchpadClient::new(&env, &id);
    launchpad.contribute(&user1, &100);

    let bal_before: i128 = token_client.balance(&user1);
    assert_eq!(bal_before, 0);

    launchpad.fund(&admin, &100_000);

    set_ledger(&env, 900);

    launchpad.claim(&user1);

    let bal_after: i128 = token_client.balance(&user1);
    assert_eq!(bal_after, 100_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_contribute_before_start() {
    let (env, id, _, user1, _) = setup();
    set_ledger(&env, 50);
    LaunchpadClient::new(&env, &id).contribute(&user1, &100);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_withdraw_before_end() {
    let (env, id, admin, _, _) = setup();
    set_ledger(&env, 150);
    LaunchpadClient::new(&env, &id).withdraw_deposits(&admin);
}

#[test]
fn test_cancel_and_refund() {
    let (env, id, admin, user1, _) = setup();
    let deposit_token_addr = get_deposit_address(&env, &id);
    let deposit_token = token::TokenClient::new(&env, &deposit_token_addr);

    set_ledger(&env, 150);

    let launchpad = LaunchpadClient::new(&env, &id);
    launchpad.contribute(&user1, &100);

    let user_bal_before: i128 = deposit_token.balance(&user1);
    let contract_bal_before: i128 = deposit_token.balance(&id);
    assert_eq!(contract_bal_before, 100);

    launchpad.cancel(&admin);
    launchpad.refund(&user1);

    let user_bal_after: i128 = deposit_token.balance(&user1);
    assert_eq!(user_bal_after, user_bal_before + 100);

    let contract_bal_after: i128 = deposit_token.balance(&id);
    assert_eq!(contract_bal_after, 0);
}

#[test]
fn test_get_claimable() {
    let (env, id, _, user1, _) = setup();

    set_ledger(&env, 150);

    let launchpad = LaunchpadClient::new(&env, &id);
    launchpad.contribute(&user1, &100);

    set_ledger(&env, 350);

    let claimable = launchpad.get_claimable(&user1);
    assert!(claimable.vested > 0);
    assert!(claimable.available > 0);
}

#[test]
fn test_withdraw_after_sale_meets_soft_cap() {
    let (env, id, admin, user1, _) = setup();
    let deposit_token_addr = get_deposit_address(&env, &id);
    let deposit_token = token::TokenClient::new(&env, &deposit_token_addr);

    set_ledger(&env, 150);

    let launchpad = LaunchpadClient::new(&env, &id);
    launchpad.contribute(&user1, &600_000);

    let bal_before: i128 = deposit_token.balance(&admin);
    let contract_bal: i128 = deposit_token.balance(&id);
    assert_eq!(contract_bal, 600_000);

    set_ledger(&env, 300);
    launchpad.withdraw_deposits(&admin);

    let bal_after: i128 = deposit_token.balance(&admin);
    assert_eq!(bal_after, bal_before + 600_000);
}

#[test]
fn test_refund_when_soft_cap_not_met() {
    let (env, id, _, user1, _) = setup();
    let deposit_token_addr = get_deposit_address(&env, &id);
    let deposit_token = token::TokenClient::new(&env, &deposit_token_addr);

    set_ledger(&env, 150);

    let launchpad = LaunchpadClient::new(&env, &id);
    launchpad.contribute(&user1, &100);

    let user_bal_before: i128 = deposit_token.balance(&user1);

    set_ledger(&env, 300);

    // Sale ended with 100 raised < 500_000 soft cap → refund allowed
    launchpad.refund(&user1);

    let user_bal_after: i128 = deposit_token.balance(&user1);
    assert_eq!(user_bal_after, user_bal_before + 100);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn test_contribute_beyond_cap() {
    let (env, id, _, user1, user2) = setup();
    let launchpad = LaunchpadClient::new(&env, &id);

    set_ledger(&env, 150);

    // Fill the cap
    launchpad.contribute(&user1, &1_000_000);
    // This should exceed cap
    launchpad.contribute(&user2, &1);
}

#[test]
#[should_panic(expected = "Error(Contract, #12)")]
fn test_contribute_zero_amount() {
    let (env, id, _, user1, _) = setup();
    set_ledger(&env, 150);
    LaunchpadClient::new(&env, &id).contribute(&user1, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn test_claim_before_vesting_starts() {
    let (env, id, admin, user1, _) = setup();
    let launchpad = LaunchpadClient::new(&env, &id);

    set_ledger(&env, 150);
    launchpad.contribute(&user1, &100);
    launchpad.fund(&admin, &100_000);

    // Claim during cliff period → nothing to claim
    set_ledger(&env, 250);
    launchpad.claim(&user1);
}

#[test]
fn test_partial_claim_during_vesting() {
    let (env, id, admin, user1, _) = setup();
    let token_addr = get_token_address(&env, &id);
    let token_client = token::TokenClient::new(&env, &token_addr);

    set_ledger(&env, 150);

    let launchpad = LaunchpadClient::new(&env, &id);
    launchpad.contribute(&user1, &100);
    launchpad.fund(&admin, &100_000);

    // Advance to midway through vesting (end=200, cliff=100, vesting=500)
    // cliff_end = 300, full_end = 800
    set_ledger(&env, 550); // 250s after cliff_end → 50% vested

    launchpad.claim(&user1);
    let claimed: i128 = token_client.balance(&user1);
    assert_eq!(claimed, 50_000); // 50% of 100_000
}

#[test]
fn test_get_claimable_zero_for_non_contributor() {
    let (env, id, _, user1, _) = setup();
    let launchpad = LaunchpadClient::new(&env, &id);

    let claimable = launchpad.get_claimable(&user1);
    assert_eq!(claimable.vested, 0);
    assert_eq!(claimable.available, 0);
}

#[test]
fn test_zero_vesting_releases_immediately() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let token_sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_addr = token_sac.address();
    let token_admin = token::StellarAssetClient::new(&env, &token_addr);
    token_admin.mint(&admin, &1_000_000_000_000i128);

    let deposit_sac = env.register_stellar_asset_contract_v2(admin.clone());
    let deposit_addr = deposit_sac.address();
    let deposit_admin = token::StellarAssetClient::new(&env, &deposit_addr);
    deposit_admin.mint(&admin, &1_000_000_000_000i128);
    deposit_admin.mint(&user, &1_000_000_000i128);

    let contract_id = env.register(Launchpad, ());
    let launchpad = LaunchpadClient::new(&env, &contract_id);

    // No vesting: vesting_duration = 0
    launchpad.initialize(
        &admin,
        &token_addr,
        &deposit_addr,
        &1_000,
        &1_000_000,
        &500_000,
        &100,
        &200,
        &0,
        &0,
    );

    set_ledger(&env, 150);
    launchpad.contribute(&user, &100);
    launchpad.fund(&admin, &100_000);

    // After sale ends, tokens are immediately claimable
    set_ledger(&env, 201);

    let claimable = launchpad.get_claimable(&user);
    assert_eq!(claimable.available, 100_000);
}

fn get_deposit_address(env: &Env, contract_id: &Address) -> Address {
    LaunchpadClient::new(env, contract_id)
        .get_launchpad_info()
        .deposit_token
}

fn get_token_address(env: &Env, contract_id: &Address) -> Address {
    LaunchpadClient::new(env, contract_id)
        .get_launchpad_info()
        .token
}

fn new_deploy(ts: u64) -> (Env, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);

    let token_sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_addr = token_sac.address();

    let deposit_sac = env.register_stellar_asset_contract_v2(admin.clone());
    let deposit_addr = deposit_sac.address();

    let contract_id = env.register(Launchpad, ());
    set_ledger(&env, ts);

    (env, contract_id, admin, token_addr, deposit_addr)
}

#[test]
#[should_panic(expected = "Error(Contract, #13)")]
fn test_initialize_zero_cap() {
    let (env, id, admin, token_addr, deposit_addr) = new_deploy(0);
    LaunchpadClient::new(&env, &id).initialize(
        &admin,
        &token_addr,
        &deposit_addr,
        &1_000,
        &0,
        &0,
        &100,
        &200,
        &0,
        &0,
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #14)")]
fn test_initialize_invalid_timing() {
    let (env, id, admin, token_addr, deposit_addr) = new_deploy(0);
    LaunchpadClient::new(&env, &id).initialize(
        &admin,
        &token_addr,
        &deposit_addr,
        &1_000,
        &1_000_000,
        &500_000,
        &200,
        &100,
        &0,
        &0,
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #15)")]
fn test_initialize_soft_cap_exceeds_cap() {
    let (env, id, admin, token_addr, deposit_addr) = new_deploy(0);
    LaunchpadClient::new(&env, &id).initialize(
        &admin,
        &token_addr,
        &deposit_addr,
        &1_000,
        &100,
        &500,
        &100,
        &200,
        &0,
        &0,
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #16)")]
fn test_initialize_zero_price() {
    let (env, id, admin, token_addr, deposit_addr) = new_deploy(0);
    LaunchpadClient::new(&env, &id).initialize(
        &admin,
        &token_addr,
        &deposit_addr,
        &0,
        &1_000_000,
        &500_000,
        &100,
        &200,
        &0,
        &0,
    );
}
