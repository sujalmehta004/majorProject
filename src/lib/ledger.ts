import { db } from './db';

interface LedgerInput {
  partyType: 'WHOLESALER' | 'RETAILER';
  partyId: string;
  oppositePartyName: string;
  type: 'SALE' | 'PURCHASE' | 'RETURN' | 'PAYMENT' | 'ADVANCE_REFUND' | 'ADVANCE_APPLIED';
  debit?: number;
  credit?: number;
  description: string;
  orderId?: string;
}

/**
 * Creates a ledger entry for a transaction.
 * Runs inside a Prisma transaction client (tx) to guarantee consistency.
 */
export async function createLedgerEntry(
  tx: any,
  input: LedgerInput
) {
  const debit = input.debit || 0;
  const credit = input.credit || 0;

  // Retrieve the latest entry to get the previous balance
  const latestEntry = await tx.ledgerEntry.findFirst({
    where: {
      partyType: input.partyType,
      partyId: input.partyId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const prevBalance = latestEntry ? latestEntry.balance : 0;
  const balance = prevBalance + debit - credit;

  return tx.ledgerEntry.create({
    data: {
      partyType: input.partyType,
      partyId: input.partyId,
      oppositePartyName: input.oppositePartyName,
      type: input.type,
      debit,
      credit,
      balance,
      description: input.description,
      orderId: input.orderId,
    },
  });
}
