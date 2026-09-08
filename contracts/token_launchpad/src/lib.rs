#![no_std]
#![allow(clippy::too_many_arguments)]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env, Map,
    Symbol,
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

#[contracterror]
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
    SaleSucceeded = 11,
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
    ) -> Result<(), ContractError> {
        if env.storage().instance().has(&LAUNCHPAD) {
            return Err(ContractError::AlreadyInitialized);
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
        Ok(())
    }

    pub fn contribute(env: Env, caller: Address, amount: u64) -> Result<(), ContractError> {
        caller.require_auth();

        let mut info: LaunchpadInfo = env
            .storage()
            .instance()
            .get(&LAUNCHPAD)
            .ok_or(ContractError::NotInitialized)?;
        if info.cancelled {
            return Err(ContractError::Cancelled);
        }
        let now = env.ledger().timestamp();
        if now < info.start || now > info.end {
            return Err(ContractError::SaleNotActive);
        }
        if info.total_raised + amount > info.cap {
            return Err(ContractError::CapReached);
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
        Ok(())
    }

    pub fn claim(env: Env, caller: Address) -> Result<(), ContractError> {
        caller.require_auth();

        let info: LaunchpadInfo = env
            .storage()
            .instance()
            .get(&LAUNCHPAD)
            .ok_or(ContractError::NotInitialized)?;
        let now = env.ledger().timestamp();

        let mut map: Map<Address, ContributorInfo> = env
            .storage()
            .instance()
            .get(&CONTRIBUTORS)
            .unwrap_or(Map::new(&env));
        let mut contrib = map
            .get(caller.clone())
            .ok_or(ContractError::NoContribution)?;

        let available = Self::compute_available(&info, &contrib, now);
        if available == 0 {
            return Err(ContractError::NothingToClaim);
        }

        contrib.tokens_claimed += available;
        map.set(caller.clone(), contrib);
        env.storage().instance().set(&CONTRIBUTORS, &map);

        let token_client = token::TokenClient::new(&env, &info.token);
        let contract_addr = env.current_contract_address();
        token_client.transfer(&contract_addr, &caller, &(available as i128));
        Ok(())
    }

    pub fn withdraw_deposits(env: Env, admin: Address) -> Result<(), ContractError> {
        admin.require_auth();

        let info: LaunchpadInfo = env
            .storage()
            .instance()
            .get(&LAUNCHPAD)
            .ok_or(ContractError::NotInitialized)?;
        if admin != info.admin {
            return Err(ContractError::NotAdmin);
        }

        let now = env.ledger().timestamp();
        if now <= info.end && !info.cancelled {
            return Err(ContractError::SaleNotEnded);
        }
        if !info.cancelled && info.total_raised < info.soft_cap {
            return Err(ContractError::BelowSoftCap);
        }

        let deposit = token::TokenClient::new(&env, &info.deposit_token);
        let contract_addr = env.current_contract_address();
        let balance = deposit.balance(&contract_addr);
        if balance > 0 {
            deposit.transfer(&contract_addr, &admin, &balance);
        }
        Ok(())
    }

    pub fn cancel(env: Env, admin: Address) -> Result<(), ContractError> {
        admin.require_auth();

        let mut info: LaunchpadInfo = env
            .storage()
            .instance()
            .get(&LAUNCHPAD)
            .ok_or(ContractError::NotInitialized)?;
        if admin != info.admin {
            return Err(ContractError::NotAdmin);
        }
        info.cancelled = true;
        env.storage().instance().set(&LAUNCHPAD, &info);
        Ok(())
    }

    pub fn refund(env: Env, caller: Address) -> Result<(), ContractError> {
        caller.require_auth();

        let info: LaunchpadInfo = env
            .storage()
            .instance()
            .get(&LAUNCHPAD)
            .ok_or(ContractError::NotInitialized)?;
        if !info.cancelled && info.total_raised >= info.soft_cap {
            return Err(ContractError::SaleSucceeded);
        }

        let mut map: Map<Address, ContributorInfo> = env
            .storage()
            .instance()
            .get(&CONTRIBUTORS)
            .unwrap_or(Map::new(&env));
        let contrib = map
            .get(caller.clone())
            .ok_or(ContractError::NoContribution)?;

        let deposit = token::TokenClient::new(&env, &info.deposit_token);
        let contract_addr = env.current_contract_address();
        deposit.transfer(&contract_addr, &caller, &(contrib.contributed as i128));

        map.remove(caller.clone());
        env.storage().instance().set(&CONTRIBUTORS, &map);
        Ok(())
    }

    pub fn fund(env: Env, admin: Address, amount: u64) -> Result<(), ContractError> {
        admin.require_auth();

        let info: LaunchpadInfo = env
            .storage()
            .instance()
            .get(&LAUNCHPAD)
            .ok_or(ContractError::NotInitialized)?;
        if admin != info.admin {
            return Err(ContractError::NotAdmin);
        }

        let token_client = token::TokenClient::new(&env, &info.token);
        let contract_addr = env.current_contract_address();
        token_client.transfer(&admin, &contract_addr, &(amount as i128));
        Ok(())
    }

    pub fn get_launchpad_info(env: Env) -> Result<LaunchpadInfo, ContractError> {
        env.storage()
            .instance()
            .get(&LAUNCHPAD)
            .ok_or(ContractError::NotInitialized)
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
        let info = match env
            .storage()
            .instance()
            .get::<Symbol, LaunchpadInfo>(&LAUNCHPAD)
        {
            Some(i) => i,
            None => {
                return ClaimableAmount {
                    vested: 0,
                    available: 0,
                }
            }
        };
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
        let vested = Self::compute_vested(&info, total, now);
        ClaimableAmount {
            vested,
            available: vested.saturating_sub(already),
        }
    }

    fn compute_vested(info: &LaunchpadInfo, total_tokens: u64, now: u64) -> u64 {
        if info.vesting_duration == 0 {
            return total_tokens;
        }
        let cliff_end = info.end + info.cliff;
        let full_end = cliff_end + info.vesting_duration;
        if now >= full_end {
            total_tokens
        } else if now <= cliff_end {
            0
        } else {
            let elapsed = now - cliff_end;
            (total_tokens as u128 * elapsed as u128 / info.vesting_duration as u128) as u64
        }
    }

    fn compute_available(info: &LaunchpadInfo, contrib: &ContributorInfo, now: u64) -> u64 {
        let vested = Self::compute_vested(info, contrib.tokens_bought, now);
        vested.saturating_sub(contrib.tokens_claimed)
    }
}

mod test;
