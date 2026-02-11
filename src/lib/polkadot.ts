export type PolkadotAccount = {
  address: string;
  name?: string;
  source?: string;
};

export type WalletConnection = {
  accounts: PolkadotAccount[];
  activeAccount?: PolkadotAccount;
  hasExtension: boolean;
};

export async function connectPolkadotWallet(
  appName: string = 'RemitChain'
): Promise<WalletConnection> {
  const { web3Accounts, web3Enable } = await import('@polkadot/extension-dapp');
  const extensions = await web3Enable(appName);
  if (!extensions || extensions.length === 0) {
    return { accounts: [], hasExtension: false };
  }

  const accounts = await web3Accounts();
  const formatted = accounts.map((account) => ({
    address: account.address,
    name: account.meta.name,
    source: account.meta.source,
  }));

  return {
    accounts: formatted,
    activeAccount: formatted[0],
    hasExtension: true,
  };
}
