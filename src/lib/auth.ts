import { cryptoWaitReady, signatureVerify } from '@polkadot/util-crypto';
import { stringToU8a } from '@polkadot/util';
import { verifyMessage } from 'ethers';

export type LoginMessageInput = {
  address: string;
  nonce: string;
  issuedAt: Date;
  expiresAt: Date;
};

export function normalizeAddress(address: string) {
  if (address.startsWith('0x') && address.length === 42) {
    return address.toLowerCase();
  }
  return address;
}

export function buildLoginMessage(input: LoginMessageInput) {
  return [
    'RemitChain Login',
    `Address: ${input.address}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt.toISOString()}`,
    `Expires At: ${input.expiresAt.toISOString()}`,
  ].join('\n');
}

export async function verifyWalletSignature(
  address: string,
  signature: string,
  message: string
) {
  if (address.startsWith('0x') && address.length === 42) {
    const recovered = verifyMessage(message, signature);
    return recovered.toLowerCase() === address.toLowerCase();
  }

  await cryptoWaitReady();
  const result = signatureVerify(stringToU8a(message), signature, address);
  return result.isValid;
}
