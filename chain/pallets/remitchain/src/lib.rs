#![cfg_attr(not(feature = "std"), no_std)]

extern crate alloc;

use alloc::vec::Vec;
use frame::prelude::*;
use polkadot_sdk::polkadot_sdk_frame as frame;
use polkadot_sdk::frame_system::pallet_prelude::BlockNumberFor;

pub use pallet::*;

#[frame::pallet]
pub mod pallet {
	use super::*;

	#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub struct RemittanceRecord<AccountId, AssetId, Corridor, Amount, BlockNumber> {
		pub sender: AccountId,
		pub recipient: AccountId,
		pub asset_id: AssetId,
		pub amount: Amount,
		pub corridor: Corridor,
		pub nonce: u64,
		pub deadline: BlockNumber,
		pub chain_id: u64,
	}

	#[pallet::config]
	pub trait Config: polkadot_sdk::frame_system::Config {
		#[pallet::constant]
		type MaxAssetIdLen: Get<u32>;
		#[pallet::constant]
		type MaxCorridorLen: Get<u32>;
		#[pallet::constant]
		type MaxAmountLen: Get<u32>;
		#[pallet::constant]
		type MaxDisputeTypeLen: Get<u32>;
		#[pallet::constant]
		type MaxEvidenceHashLen: Get<u32>;
		#[pallet::constant]
		type ChainId: Get<u64>;
	}

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	type AssetIdOf<T> = BoundedVec<u8, <T as Config>::MaxAssetIdLen>;
	type CorridorOf<T> = BoundedVec<u8, <T as Config>::MaxCorridorLen>;
	type AmountOf<T> = BoundedVec<u8, <T as Config>::MaxAmountLen>;
	type DisputeTypeOf<T> = BoundedVec<u8, <T as Config>::MaxDisputeTypeLen>;
	type EvidenceHashOf<T> = BoundedVec<u8, <T as Config>::MaxEvidenceHashLen>;
	type RemittanceIdOf<T> = <T as frame_system::Config>::Hash;
	type BlockNumberOf<T> = BlockNumberFor<T>;
	type RemittanceOf<T> = RemittanceRecord<
		<T as frame_system::Config>::AccountId,
		AssetIdOf<T>,
		CorridorOf<T>,
		AmountOf<T>,
		BlockNumberOf<T>,
	>;

	#[pallet::storage]
	#[pallet::getter(fn relayer_nonce)]
	pub type RelayerNonces<T: Config> =
		StorageMap<_, Blake2_128Concat, T::AccountId, u64, ValueQuery>;

	#[pallet::storage]
	#[pallet::getter(fn remittance)]
	pub type Remittances<T: Config> =
		StorageMap<_, Blake2_128Concat, RemittanceIdOf<T>, RemittanceOf<T>>;

	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		/// Remittance was accepted. [remittance_id, sender, recipient, amount, asset_id, corridor]
		RemittanceSent(
			RemittanceIdOf<T>,
			T::AccountId,
			T::AccountId,
			AmountOf<T>,
			AssetIdOf<T>,
			CorridorOf<T>,
		),
		/// Cash out requested by an agent. [remittance_id, agent, timeout_block]
		CashOutRequested(RemittanceIdOf<T>, T::AccountId, BlockNumberOf<T>),
		/// Cash out completed by an agent. [remittance_id, agent]
		CashOutCompleted(RemittanceIdOf<T>, T::AccountId),
		/// Dispute opened. [remittance_id, opened_by, dispute_type, evidence_hash]
		DisputeOpened(RemittanceIdOf<T>, T::AccountId, DisputeTypeOf<T>, EvidenceHashOf<T>),
	}

	#[pallet::error]
	pub enum Error<T> {
		InvalidNonce,
		DeadlineExpired,
		InvalidChainId,
		RemittanceNotFound,
	}

	#[pallet::call]
	impl<T: Config> Pallet<T> {
		#[pallet::weight(10_000)]
		pub fn send_remittance_gasless(
			origin: OriginFor<T>,
			sender: T::AccountId,
			_signature: Vec<u8>,
			asset_id: AssetIdOf<T>,
			recipient: T::AccountId,
			amount: AmountOf<T>,
			corridor: CorridorOf<T>,
			nonce: u64,
			deadline: BlockNumberOf<T>,
			chain_id: u64,
		) -> DispatchResult {
			let _relayer = ensure_signed(origin)?;

			ensure!(chain_id == T::ChainId::get(), Error::<T>::InvalidChainId);
			let now = <polkadot_sdk::frame_system::Pallet<T>>::block_number();
			ensure!(deadline >= now, Error::<T>::DeadlineExpired);

			let current_nonce = RelayerNonces::<T>::get(&sender);
			ensure!(nonce > current_nonce, Error::<T>::InvalidNonce);
			RelayerNonces::<T>::insert(&sender, nonce);

			let remittance_id = T::Hashing::hash_of(&(
				sender.clone(),
				recipient.clone(),
				amount.clone(),
				asset_id.clone(),
				corridor.clone(),
				nonce,
				deadline,
				chain_id,
			));

			let record = RemittanceRecord {
				sender: sender.clone(),
				recipient: recipient.clone(),
				asset_id: asset_id.clone(),
				amount: amount.clone(),
				corridor: corridor.clone(),
				nonce,
				deadline,
				chain_id,
			};

			Remittances::<T>::insert(remittance_id, record);

			Self::deposit_event(Event::RemittanceSent(
				remittance_id,
				sender,
				recipient,
				amount,
				asset_id,
				corridor,
			));
			Ok(())
		}

		#[pallet::weight(10_000)]
		pub fn request_cash_out(
			origin: OriginFor<T>,
			remittance_id: RemittanceIdOf<T>,
			agent: T::AccountId,
			timeout_block: BlockNumberOf<T>,
		) -> DispatchResult {
			let _who = ensure_signed(origin)?;
			ensure!(Remittances::<T>::contains_key(remittance_id), Error::<T>::RemittanceNotFound);
			Self::deposit_event(Event::CashOutRequested(remittance_id, agent, timeout_block));
			Ok(())
		}

		#[pallet::weight(10_000)]
		pub fn complete_cash_out(
			origin: OriginFor<T>,
			remittance_id: RemittanceIdOf<T>,
			agent: T::AccountId,
		) -> DispatchResult {
			let _who = ensure_signed(origin)?;
			ensure!(Remittances::<T>::contains_key(remittance_id), Error::<T>::RemittanceNotFound);
			Self::deposit_event(Event::CashOutCompleted(remittance_id, agent));
			Ok(())
		}

		#[pallet::weight(10_000)]
		pub fn open_dispute(
			origin: OriginFor<T>,
			remittance_id: RemittanceIdOf<T>,
			opened_by: T::AccountId,
			dispute_type: DisputeTypeOf<T>,
			evidence_hash: EvidenceHashOf<T>,
		) -> DispatchResult {
			let _who = ensure_signed(origin)?;
			ensure!(Remittances::<T>::contains_key(remittance_id), Error::<T>::RemittanceNotFound);
			Self::deposit_event(Event::DisputeOpened(
				remittance_id,
				opened_by,
				dispute_type,
				evidence_hash,
			));
			Ok(())
		}
	}
}
