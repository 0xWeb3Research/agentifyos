//! AgentifyOS ToolRegistry — anchors a marketplace listing to Casper.
//!
//! A catalog entry lives in our database, which means a listing's price, payout
//! address, or schema could change after an agent decided to trust it. This
//! contract makes that detectable: the publisher writes a hash of the manifest
//! on-chain, and anyone can recompute the hash of what the marketplace is
//! currently serving and compare. A silent edit stops being silent.
//!
//! Deliberately small. It stores a commitment, not the manifest — putting tool
//! schemas on-chain would cost real money per listing and buy nothing, since the
//! hash already proves tampering.
//!
//! Ownership rule: the first account to register a slug owns it, and only that
//! account may update it. Without this, anyone could overwrite a competitor's
//! listing and point its payout address at themselves.

#![no_std]
#![no_main]

extern crate alloc;

// casper-contract's `no-std-helpers` feature is disabled, because the panic
// handler it ships is rejected by modern rustc as an internal language item.
// Supplying our own keeps the build on stable Rust instead of a pinned nightly.
mod runtime_support {
    use core::alloc::{GlobalAlloc, Layout};

    /// A bump allocator. Contract invocations are short-lived and their linear
    /// memory is discarded wholesale when the call returns, so reclaiming
    /// individual allocations would be wasted code size.
    pub struct BumpAlloc;

    const HEAP_SIZE: usize = 64 * 1024;
    static mut HEAP: [u8; HEAP_SIZE] = [0; HEAP_SIZE];
    static mut NEXT: usize = 0;

    unsafe impl GlobalAlloc for BumpAlloc {
        unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
            let align = layout.align();
            let start = (NEXT + align - 1) & !(align - 1);
            let end = start.saturating_add(layout.size());
            if end > HEAP_SIZE {
                return core::ptr::null_mut();
            }
            NEXT = end;
            (core::ptr::addr_of_mut!(HEAP) as *mut u8).add(start)
        }
        unsafe fn dealloc(&self, _ptr: *mut u8, _layout: Layout) {}
    }

    #[global_allocator]
    static ALLOC: BumpAlloc = BumpAlloc;

    #[panic_handler]
    fn panic(_info: &core::panic::PanicInfo) -> ! {
        core::arch::wasm32::unreachable()
    }
}

use alloc::string::String;
use alloc::vec;

use casper_contract::contract_api::{runtime, storage};
use casper_contract::unwrap_or_revert::UnwrapOrRevert;
use casper_types::addressable_entity::{
    EntityEntryPoint, EntryPointAccess, EntryPointPayment, EntryPointType, EntryPoints,
};
use casper_types::contracts::NamedKeys;
use casper_types::{ApiError, CLType, CLValue, Key, Parameter, URef};

/// Dictionary of slug -> manifest hash.
const DICT_MANIFESTS: &str = "manifests";
/// Dictionary of slug -> owning account, so updates can be authorised.
const DICT_OWNERS: &str = "owners";

const ARG_SLUG: &str = "slug";
const ARG_MANIFEST_HASH: &str = "manifest_hash";

const EP_REGISTER: &str = "register_tool";
const EP_GET: &str = "get_manifest_hash";

const CONTRACT_PACKAGE_KEY: &str = "tool_registry_package";
const CONTRACT_ACCESS_KEY: &str = "tool_registry_access";
const CONTRACT_VERSION_KEY: &str = "tool_registry_version";

/// Someone other than the original registrant tried to overwrite a slug.
const ERROR_NOT_OWNER: u16 = 1;
/// A slug was read that was never registered.
const ERROR_UNKNOWN_SLUG: u16 = 2;

fn dict_uref(name: &str) -> URef {
    let key = runtime::get_key(name).unwrap_or_revert();
    *key.as_uref().unwrap_or_revert()
}

/// Register a listing, or update one you already own.
#[no_mangle]
pub extern "C" fn register_tool() {
    let slug: String = runtime::get_named_arg(ARG_SLUG);
    let manifest_hash: String = runtime::get_named_arg(ARG_MANIFEST_HASH);

    let owners = dict_uref(DICT_OWNERS);
    let caller = Key::from(runtime::get_caller());

    // First writer claims the slug; afterwards only they may change it.
    match storage::dictionary_get::<Key>(owners, &slug).unwrap_or_revert() {
        Some(existing) if existing != caller => {
            runtime::revert(ApiError::User(ERROR_NOT_OWNER));
        }
        Some(_) => {}
        None => storage::dictionary_put(owners, &slug, caller),
    }

    storage::dictionary_put(dict_uref(DICT_MANIFESTS), &slug, manifest_hash);
}

/// Read a listing's anchored hash. Reverts if the slug was never registered, so
/// a caller can't mistake "absent" for "matches".
#[no_mangle]
pub extern "C" fn get_manifest_hash() {
    let slug: String = runtime::get_named_arg(ARG_SLUG);
    let stored = storage::dictionary_get::<String>(dict_uref(DICT_MANIFESTS), &slug)
        .unwrap_or_revert()
        .unwrap_or_revert_with(ApiError::User(ERROR_UNKNOWN_SLUG));
    runtime::ret(CLValue::from_t(stored).unwrap_or_revert());
}

#[no_mangle]
pub extern "C" fn call() {
    let mut entry_points = EntryPoints::new();

    entry_points.add_entry_point(EntityEntryPoint::new(
        EP_REGISTER,
        vec![
            Parameter::new(ARG_SLUG, CLType::String),
            Parameter::new(ARG_MANIFEST_HASH, CLType::String),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
        EntryPointPayment::Caller,
    ));

    entry_points.add_entry_point(EntityEntryPoint::new(
        EP_GET,
        vec![Parameter::new(ARG_SLUG, CLType::String)],
        CLType::String,
        EntryPointAccess::Public,
        EntryPointType::Called,
        EntryPointPayment::Caller,
    ));

    // The dictionaries must exist before the first call, so seed them here and
    // hand them to the contract as named keys.
    let manifests = storage::new_dictionary(DICT_MANIFESTS).unwrap_or_revert();
    let owners = storage::new_dictionary(DICT_OWNERS).unwrap_or_revert();

    let mut named_keys = NamedKeys::new();
    named_keys.insert(String::from(DICT_MANIFESTS), manifests.into());
    named_keys.insert(String::from(DICT_OWNERS), owners.into());

    let (contract_hash, contract_version) = storage::new_contract(
        entry_points,
        Some(named_keys),
        Some(String::from(CONTRACT_PACKAGE_KEY)),
        Some(String::from(CONTRACT_ACCESS_KEY)),
        None,
    );

    runtime::put_key(CONTRACT_VERSION_KEY, storage::new_uref(contract_version).into());
    runtime::put_key("tool_registry_contract", Key::from(contract_hash));
}
