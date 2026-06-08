#![no_std]
#![allow(clippy::too_many_arguments)]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, Map, Symbol,
};

const LAUNCHPAD: Symbol = symbol_short!("launchpad");
const CONTRIBUTORS: Symbol = symbol_short!("contribs");

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LaunchpadInfo {
    pub admin: Address,
    pub token: Address,
    pub deposit_token: Address,
    pub price: u64,
    pub cap: u64,
    pub soft_cap: u64,
    pub start: u64,
    pub end: u64,
    pub cliff: u64,
    pub vesting_duration: u64,
    pub total_raised: u64,
    pub total_tokens_sold: u64,
    pub cancelled: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContributorInfo {
    pub contributed: u64,
    pub tokens_bought: u64,
    pub tokens_claimed: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ClaimableAmount {
    pub vested: u64,
    pub available: u64,
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotAdmin = 3,
    SaleNotActive = 4,
    SaleNotEnded = 5,
    CapReached = 6,
    BelowSoftCap = 7,
    NoContribution = 8,
    NothingToClaim = 9,
    Cancelled = 10,
}

#[contract]
pub struct Launchpad;

#[contractimpl]
impl Launchpad {
    pub fn initialize(
        env: Env,
        admin: Address,
        token: Address,
        deposit_token: Address,
        price: u64,
        cap: u64,
        soft_cap: u64,
        start: u64,
        end: u64,
        cliff: u64,
        vesting_duration: u64,
    ) {
        if env.storage().instance().has(&LAUNCHPAD) {
            panic!("already initialized");
        }
        admin.require_auth();

        let info = LaunchpadInfo {
            admin,
            token,
            deposit_token,
            price,
            cap,
            soft_cap,
            start,
            end,
            cliff,
            vesting_duration,
            total_raised: 0,
            total_tokens_sold: 0,
            cancelled: false,
        };
        env.storage().instance().set(&LAUNCHPAD, &info);
    }

    pub fn contribute(env: Env, caller: Address, amount: u64) {
        caller.require_auth();

        let mut info: LaunchpadInfo = env
            .storage()
            .instance()
            .get(&LAUNCHPAD)
            .expect("not initialized");
        if info.cancelled {
            panic!("cancelled");
        }
        let now = env.ledger().timestamp();
        if now < info.start || now > info.end {
            panic!("sale not active");
        }
        if info.total_raised + amount > info.cap {
            panic!("cap reached");
        }

        let deposit = token::TokenClient::new(&env, &info.deposit_token);
        let contract_addr = env.current_contract_address();
        deposit.transfer(&caller, &contract_addr, &(amount as i128));
        let tokens = (amount as u128 * info.price as u128) as u64;

        let mut map: Map<Address, ContributorInfo> = env
            .storage()
            .instance()
            .get(&CONTRIBUTORS)
            .unwrap_or(Map::new(&env));

        let mut contrib = map.get(caller.clone()).unwrap_or(ContributorInfo {
            contributed: 0,
            tokens_bought: 0,
            tokens_claimed: 0,
        });
        contrib.contributed += amount;
        contrib.tokens_bought += tokens;
        map.set(caller.clone(), contrib);
        env.storage().instance().set(&CONTRIBUTORS, &map);

        info.total_raised += amount;
        info.total_tokens_sold += tokens;
        env.storage().instance().set(&LAUNCHPAD, &info);
    }

    pub fn claim(env: Env, caller: Address) {
        caller.require_auth();

        let info: LaunchpadInfo = env
            .storage()
            .instance()
            .get(&LAUNCHPAD)
            .expect("not initialized");
        let now = env.ledger().timestamp();

        let mut map: Map<Address, ContributorInfo> = env
            .storage()
            .instance()
            .get(&CONTRIBUTORS)
            .unwrap_or(Map::new(&env));
        let mut contrib = map.get(caller.clone()).expect("no contribution");

        let available = Self::compute_available(&info, &contrib, now);
        if available == 0 {
            panic!("nothing to claim");
        }

        contrib.tokens_claimed += available;
        map.set(caller.clone(), contrib);
        env.storage().instance().set(&CONTRIBUTORS, &map);

        let token_client = token::TokenClient::new(&env, &info.token);
        let contract_addr = env.current_contract_address();
        token_client.transfer(
            &contract_addr,
            &caller,
            &(available as i128),
        );
    }

    pub fn withdraw_deposits(env: Env, admin: Address) {
        admin.require_auth();

        let info: LaunchpadInfo = env
            .storage()
            .instance()
            .get(&LAUNCHPAD)
            .expect("not initialized");
        if admin != info.admin {
            panic!("not admin");
        }

        let now = env.ledger().timestamp();
        if now <= info.end && !info.cancelled {
            panic!("sale not ended");
        }
        if !info.cancelled && info.total_raised < info.soft_cap {
            panic!("below soft cap");
        }

        let deposit = token::TokenClient::new(&env, &info.deposit_token);
        let contract_addr = env.current_contract_address();
        let balance = deposit.balance(&contract_addr);
        if balance > 0 {
            deposit.transfer(&contract_addr, &admin, &balance);
        }
    }

    pub fn cancel(env: Env, admin: Address) {
        admin.require_auth();

        let mut info: LaunchpadInfo = env
            .storage()
            .instance()
            .get(&LAUNCHPAD)
            .expect("not initialized");
        if admin != info.admin {
            panic!("not admin");
        }
        info.cancelled = true;
        env.storage().instance().set(&LAUNCHPAD, &info);
    }

    pub fn refund(env: Env, caller: Address) {
        caller.require_auth();

        let info: LaunchpadInfo = env
            .storage()
            .instance()
            .get(&LAUNCHPAD)
            .expect("not initialized");
        if !info.cancelled && info.total_raised >= info.soft_cap {
            panic!("sale succeeded, no refunds");
        }

        let mut map: Map<Address, ContributorInfo> = env
            .storage()
            .instance()
            .get(&CONTRIBUTORS)
            .unwrap_or(Map::new(&env));
        let contrib = map.get(caller.clone()).expect("no contribution");

        let deposit = token::TokenClient::new(&env, &info.deposit_token);
        let contract_addr = env.current_contract_address();
        deposit.transfer(
            &contract_addr,
            &caller,
            &(contrib.contributed as i128),
        );

        map.remove(caller.clone());
        env.storage().instance().set(&CONTRIBUTORS, &map);
    }

    pub fn fund(env: Env, admin: Address, amount: u64) {
        admin.require_auth();

        let info: LaunchpadInfo = env
            .storage()
            .instance()
            .get(&LAUNCHPAD)
            .expect("not initialized");
        if admin != info.admin {
            panic!("not admin");
        }

        let token_client = token::TokenClient::new(&env, &info.token);
        let contract_addr = env.current_contract_address();
        token_client.transfer(&admin, &contract_addr, &(amount as i128));
    }

    pub fn get_launchpad_info(env: Env) -> LaunchpadInfo {
        env.storage()
            .instance()
            .get(&LAUNCHPAD)
            .expect("not initialized")
    }

    pub fn get_contributor_info(env: Env, address: Address) -> ContributorInfo {
        let map: Map<Address, ContributorInfo> = env
            .storage()
            .instance()
            .get(&CONTRIBUTORS)
            .unwrap_or(Map::new(&env));
        map.get(address.clone()).unwrap_or(ContributorInfo {
            contributed: 0,
            tokens_bought: 0,
            tokens_claimed: 0,
        })
    }

    pub fn get_claimable(env: Env, address: Address) -> ClaimableAmount {
        let info: LaunchpadInfo = env
            .storage()
            .instance()
            .get(&LAUNCHPAD)
            .expect("not initialized");
        let map: Map<Address, ContributorInfo> = env
            .storage()
            .instance()
            .get(&CONTRIBUTORS)
            .unwrap_or(Map::new(&env));
        let contrib = match map.get(address.clone()) {
            Some(c) => c,
            None => {
                return ClaimableAmount {
                    vested: 0,
                    available: 0,
                }
            }
        };
        let now = env.ledger().timestamp();
        let total = contrib.tokens_bought;
        let already = contrib.tokens_claimed;
        let vested = if info.vesting_duration == 0 {
            total
        } else {
            let cliff_end = info.end + info.cliff;
            let full_end = cliff_end + info.vesting_duration;
            if now >= full_end {
                total
            } else if now <= cliff_end {
                0
            } else {
                let elapsed = now - cliff_end;
                (total as u128 * elapsed as u128 / info.vesting_duration as u128) as u64
            }
        };
        ClaimableAmount {
            vested,
            available: vested.saturating_sub(already),
        }
    }

    fn compute_available(info: &LaunchpadInfo, contrib: &ContributorInfo, now: u64) -> u64 {
        if info.vesting_duration == 0 {
            return contrib.tokens_bought.saturating_sub(contrib.tokens_claimed);
        }
        let cliff_end = info.end + info.cliff;
        let full_end = cliff_end + info.vesting_duration;
        let vested = if now >= full_end {
            contrib.tokens_bought
        } else if now <= cliff_end {
            0
        } else {
            let elapsed = now - cliff_end;
            (contrib.tokens_bought as u128 * elapsed as u128 / info.vesting_duration as u128) as u64
        };
        vested.saturating_sub(contrib.tokens_claimed)
    }
}

mod test;
