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

export async function signPolkadotMessage(
  address: string,
  message: string,
  appName: string = 'RemitChain'
): Promise<string> {
  const { web3Accounts, web3Enable, web3FromSource } = await import(
    '@polkadot/extension-dapp'
  );
  const extensions = await web3Enable(appName);
  if (!extensions || extensions.length === 0) {
    throw new Error('No Polkadot extension available');
  }

  const accounts = await web3Accounts();
  const account = accounts.find((acc) => acc.address === address);
  if (!account) {
    throw new Error('Account not found in extension');
  }

  const injector = await web3FromSource(account.meta.source);
  if (!injector?.signer?.signRaw) {
    throw new Error('Signer is not available for this account');
  }

  const { stringToHex } = await import('@polkadot/util');
  const result = await injector.signer.signRaw({
    address,
    data: stringToHex(message),
    type: 'bytes',
  });

  return result.signature;
}
