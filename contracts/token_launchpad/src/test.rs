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
#[should_panic(expected = "already initialized")]
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
#[should_panic(expected = "sale not active")]
fn test_contribute_before_start() {
    let (env, id, _, user1, _) = setup();
    set_ledger(&env, 50);
    LaunchpadClient::new(&env, &id).contribute(&user1, &100);
}

#[test]
#[should_panic(expected = "sale not ended")]
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
