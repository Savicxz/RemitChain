// Auto-generated , DO NOT EDIT
import {Entity, FunctionPropertyNames, FieldsExpression, GetOptions } from "@subql/types-core";
import assert from 'assert';



export type RemittanceProps = Omit<Remittance, NonNullable<FunctionPropertyNames<Remittance>> | '_name'>;

/*
 * Compat types allows for support of alternative `id` types without refactoring the node
 */
type CompatRemittanceProps = Omit<RemittanceProps, 'id'> & { id: string; };
type CompatEntity = Omit<Entity, 'id'> & { id: string; };

export class Remittance implements CompatEntity {

    constructor(
        
        id: string,
        sender: string,
        recipient: string,
        amount: bigint,
        assetId: string,
        corridor: string,
        status: string,
        txHash: string,
        blockNumber: bigint,
        timestamp: Date,
    ) {
        this.id = id;
        this.sender = sender;
        this.recipient = recipient;
        this.amount = amount;
        this.assetId = assetId;
        this.corridor = corridor;
        this.status = status;
        this.txHash = txHash;
        this.blockNumber = blockNumber;
        this.timestamp = timestamp;
        
    }

    public id: string;
    public sender: string;
    public recipient: string;
    public amount: bigint;
    public assetId: string;
    public corridor: string;
    public status: string;
    public txHash: string;
    public blockNumber: bigint;
    public timestamp: Date;
    public cashOutAgent?: string;
    public completedAt?: Date;
    

    get _name(): string {
        return 'Remittance';
    }

    async save(): Promise<void> {
        const id = this.id;
        assert(id !== null, "Cannot save Remittance entity without an ID");
        await store.set('Remittance', id.toString(), this as unknown as CompatRemittanceProps);
    }

    static async remove(id: string): Promise<void> {
        assert(id !== null, "Cannot remove Remittance entity without an ID");
        await store.remove('Remittance', id.toString());
    }

    static async get(id: string): Promise<Remittance | undefined> {
        assert((id !== null && id !== undefined), "Cannot get Remittance entity without an ID");
        const record = await store.get('Remittance', id.toString());
        if (record) {
            return this.create(record as unknown as RemittanceProps);
        } else {
            return;
        }
    }


    /**
     * Gets entities matching the specified filters and options.
     *
     * ⚠️ This function will first search cache data followed by DB data. Please consider this when using order and offset options.⚠️
     * */
    static async getByFields(filter: FieldsExpression<RemittanceProps>[], options: GetOptions<RemittanceProps>): Promise<Remittance[]> {
        const records = await store.getByFields<CompatRemittanceProps>('Remittance', filter  as unknown as FieldsExpression<CompatRemittanceProps>[], options as unknown as GetOptions<CompatRemittanceProps>);
        return records.map(record => this.create(record as unknown as RemittanceProps));
    }

    static create(record: RemittanceProps): Remittance {
        assert(record.id !== undefined && record.id !== null, "id must be provided");
        const entity = new this(
            record.id,
            record.sender,
            record.recipient,
            record.amount,
            record.assetId,
            record.corridor,
            record.status,
            record.txHash,
            record.blockNumber,
            record.timestamp,
        );
        Object.assign(entity,record);
        return entity;
    }
}
