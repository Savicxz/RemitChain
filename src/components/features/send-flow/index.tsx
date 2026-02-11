'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Globe, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ASSETS, DEFAULT_ASSET_ID, CORRIDORS, type Asset, type Corridor } from '@/lib/data';
import { signRemittancePayload } from '@/lib/signing';
import { useWalletStore } from '@/store/use-wallet-store';
import { StepCorridor } from './step-corridor';
import { StepAmount } from './step-amount';
import { StepConfirm } from './step-confirm';

const SIGNING_ENABLED = process.env.NEXT_PUBLIC_ENABLE_SIGNING === 'true';
const DEFAULT_DEADLINE_BLOCKS = Number(process.env.NEXT_PUBLIC_DEADLINE_BLOCKS ?? 50);
const SIGNATURE_DEBUG =
  process.env.NEXT_PUBLIC_SIGNATURE_DEBUG === 'true' && process.env.NODE_ENV !== 'production';
const CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID;
const POLL_BASE_MS = 2000;
const POLL_MAX_MS = 10000;
const POLL_TIMEOUT_MS = 2 * 60 * 1000;
const AMOUNT_INPUT_REGEX = /^\d*\.?\d{0,2}$/;

export function SendFlow({
  open,
  close,
  onSent,
}: {
  open: boolean;
  close: () => void;
  onSent: (
    amount: number,
    recipient: string,
    meta?: { id?: string; status?: string; assetId?: string }
  ) => void;
}) {
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState(DEFAULT_ASSET_ID);
  const [selectedCorridor, setSelectedCorridor] = useState<Corridor>(CORRIDORS[0]);
  const [recipient, setRecipient] = useState('');
  const [signingError, setSigningError] = useState<string | null>(null);
  const [signingDebug, setSigningDebug] = useState<Record<string, unknown> | null>(null);
  const [remoteStatus, setRemoteStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const pollTimeoutRef = useRef<number | null>(null);
  const pollStartRef = useRef<number | null>(null);
  const pollAttemptRef = useRef(0);
  const balances = useWalletStore((state) => state.balances);
  const selectedAsset = useMemo<Asset>(() => {
    return ASSETS.find((asset) => asset.id === selectedAssetId) ?? ASSETS[0];
  }, [selectedAssetId]);
  const balance = balances[selectedAssetId] ?? 0;
  const activeAccount = useWalletStore((state) => state.activeAccount);
  const updateTransactionStatus = useWalletStore((state) => state.updateTransactionStatus);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setAmount('');
      setSelectedAssetId(DEFAULT_ASSET_ID);
      setRecipient('');
      setSelectedCorridor(CORRIDORS[0]);
      setSigningError(null);
      setSigningDebug(null);
      setRemoteStatus(null);
      setIsSubmitting(false);
      setIdempotencyKey(null);
      stopPolling();
    }
  }, [open]);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  const numericAmount = amount ? parseFloat(amount) : 0;
  const feeAmount = amount ? numericAmount * (selectedCorridor.fee / 100) : 0;
  const feeDisplay = feeAmount ? feeAmount.toFixed(selectedAsset.decimals) : '0.00';
  const netAmount = Math.max(numericAmount - feeAmount, 0);
  const finalAmount = useMemo(() => {
    if (!amount) return '0.00';
    return (netAmount * selectedCorridor.rate).toLocaleString('en-US', {
      maximumFractionDigits: 2,
    });
  }, [amount, netAmount, selectedCorridor.rate]);
  const amountError = useMemo(() => {
    if (!amount) return 'Enter an amount';
    if (!AMOUNT_INPUT_REGEX.test(amount)) return 'Use up to 2 decimals';
    if (!Number.isFinite(numericAmount)) return 'Enter a valid number';
    if (numericAmount <= 0) return 'Amount must be greater than 0';
    if (numericAmount > balance) return 'Insufficient funds';
    return null;
  }, [amount, balance, numericAmount]);
  const displayAmountError = amount ? amountError : null;
  const canSubmit = !amountError;

  const normalizeStatus = (status?: string | null) => {
    if (!status) return 'PROCESSING';
    return status.toUpperCase();
  };

  const stopPolling = () => {
    if (pollTimeoutRef.current) {
      window.clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    pollStartRef.current = null;
    pollAttemptRef.current = 0;
  };

  const startPolling = (relayerId: string) => {
    stopPolling();
    pollStartRef.current = Date.now();
    const poll = async () => {
      try {
        const response = await fetch(`/api/remittance/status/${relayerId}`);
        if (response.ok) {
          const data = (await response.json()) as { job?: { status?: string } };
          const status = normalizeStatus(data.job?.status);
          setRemoteStatus(status);
          updateTransactionStatus(relayerId, status);

          if (status === 'SUBMITTED' || status === 'FAILED') {
            stopPolling();
            return;
          }
        }
      } catch {
        // ignore polling errors
      }

      const startedAt = pollStartRef.current ?? Date.now();
      const elapsed = Date.now() - startedAt;
      if (elapsed >= POLL_TIMEOUT_MS) {
        const timeoutStatus = 'TIMED_OUT';
        setRemoteStatus(timeoutStatus);
        updateTransactionStatus(relayerId, timeoutStatus);
        stopPolling();
        return;
      }

      pollAttemptRef.current += 1;
      const delay = Math.min(
        Math.round(POLL_BASE_MS * Math.pow(1.4, pollAttemptRef.current)),
        POLL_MAX_MS
      );
      pollTimeoutRef.current = window.setTimeout(poll, delay);
    };

    pollTimeoutRef.current = window.setTimeout(poll, POLL_BASE_MS);
  };

  const ensureIdempotencyKey = () => {
    if (idempotencyKey) return idempotencyKey;
    const key =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `idem_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
    setIdempotencyKey(key);
    return key;
  };

  const handleSend = async () => {
    if (isSubmitting) {
      return;
    }

    if (amountError) {
      return;
    }

    setSigningError(null);
    setIsSubmitting(true);

    let signature: string | undefined;
    let nonce: number | undefined;
    let deadline: number | undefined;

    if (SIGNING_ENABLED) {
      if (!activeAccount) {
        const message = 'Wallet not connected for signing.';
        setSigningError(message);
        if (SIGNATURE_DEBUG) {
          setSigningDebug({ enabled: SIGNING_ENABLED, account: activeAccount, error: message });
        }
        setIsSubmitting(false);
        return;
      }

      try {
        const signed = await signRemittancePayload({
          from: activeAccount,
          to: recipient,
          amount,
          assetId: selectedAsset.id,
          corridor: selectedCorridor.id,
          deadlineBlocks: DEFAULT_DEADLINE_BLOCKS,
          ...(CHAIN_ID ? { chainId: CHAIN_ID } : {}),
        });
        signature = signed.signature;
        nonce = signed.nonce;
        deadline = signed.deadline;

        if (SIGNATURE_DEBUG) {
          setSigningDebug({
            enabled: SIGNING_ENABLED,
            account: activeAccount,
            payload: signed.payload,
            signature,
            nonce,
            deadline,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Signing failed';
        setSigningError(message);
        if (SIGNATURE_DEBUG) {
          setSigningDebug({ enabled: SIGNING_ENABLED, account: activeAccount, error: message });
        }
        setIsSubmitting(false);
        return;
      }
    } else if (SIGNATURE_DEBUG) {
      setSigningDebug({ enabled: SIGNING_ENABLED, account: activeAccount ?? 'walletconnect' });
    }

    setStep(3);

    try {
      const idempotency = ensureIdempotencyKey();
      const data = await fetch('/api/remittance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotency },
        body: JSON.stringify({
          from: activeAccount ?? 'walletconnect',
          to: recipient,
          amount: amount,
          assetId: selectedAsset.id,
          corridor: selectedCorridor.id,
          chainId: CHAIN_ID,
          signature,
          nonce,
          deadline,
        }),
      }).then(async (response) => {
        if (!response.ok) {
          return null;
        }
        return response.json() as Promise<{ relayerId?: string; status?: string }>;
      });

      if (data) {
        const status = normalizeStatus(data.status);
        setRemoteStatus(status);
        if (data.relayerId) {
          onSent(numericAmount, recipient, {
            id: data.relayerId,
            status,
            assetId: selectedAsset.id,
          });
          startPolling(data.relayerId);
        } else {
          onSent(numericAmount, recipient, { status, assetId: selectedAsset.id });
        }
      } else {
        setTimeout(() => onSent(numericAmount, recipient, { assetId: selectedAsset.id }), 2000);
      }
    } catch (err) {
      // Ignore for now; UI simulates success.
      setTimeout(() => onSent(numericAmount, recipient, { assetId: selectedAsset.id }), 2000);
    }

    setIsSubmitting(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={close}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className="relative w-full max-w-md bg-[#09090b] border-l border-zinc-800 shadow-2xl p-8 flex flex-col h-full"
            initial={{ x: 480, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 480, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          >
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-bold tracking-tight">New Transfer</h2>
              <button
                onClick={close}
                className="p-2 hover:bg-zinc-800 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {step === 1 && (
              <div className="flex-1 flex flex-col space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <StepCorridor
                  corridors={CORRIDORS}
                  selected={selectedCorridor}
                  onSelect={setSelectedCorridor}
                />
                <StepAmount
                  amount={amount}
                  setAmount={setAmount}
                  balance={balance}
                  asset={selectedAsset}
                  assets={ASSETS}
                  onAssetChange={setSelectedAssetId}
                  error={displayAmountError}
                />

                <div className="mt-auto">
                  <Button
                    onClick={() => setStep(2)}
                    disabled={!canSubmit}
                    className="w-full h-14 text-lg"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <StepConfirm
                amount={amount}
                fee={feeDisplay}
                finalAmount={finalAmount}
                corridor={selectedCorridor}
                recipient={recipient}
                setRecipient={setRecipient}
                onBack={() => setStep(1)}
                onConfirm={handleSend}
                signingError={signingError}
                isSubmitting={isSubmitting}
                assetSymbol={selectedAsset.symbol}
                canSubmit={canSubmit}
                debug={
                  SIGNATURE_DEBUG && signingDebug ? JSON.stringify(signingDebug, null, 2) : undefined
                }
              />
            )}

            {step === 3 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full border-2 border-zinc-800 flex items-center justify-center">
                    <Globe className="text-zinc-700" size={40} />
                  </div>
                  <div className="absolute inset-0 border-t-2 border-white rounded-full animate-spin" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2 text-white">Settling on Substrate</h3>
                  <p className="text-zinc-500 text-sm max-w-[200px] mx-auto leading-relaxed">
                    Verifying zero-knowledge proofs and finalizing block...
                  </p>
                  {remoteStatus && (
                    <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mt-3">
                      Status: {remoteStatus}
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
