// Auto-generated , DO NOT EDIT
import {Entity, FunctionPropertyNames, FieldsExpression, GetOptions } from "@subql/types-core";
import assert from 'assert';



export type DisputeProps = Omit<Dispute, NonNullable<FunctionPropertyNames<Dispute>> | '_name'>;

/*
 * Compat types allows for support of alternative `id` types without refactoring the node
 */
type CompatDisputeProps = Omit<DisputeProps, 'id'> & { id: string; };
type CompatEntity = Omit<Entity, 'id'> & { id: string; };

export class Dispute implements CompatEntity {

    constructor(
        
        id: string,
        remittanceId: string,
        openedBy: string,
        disputeType: string,
        evidenceHash: string,
        openedAt: bigint,
        status: string,
    ) {
        this.id = id;
        this.remittanceId = remittanceId;
        this.openedBy = openedBy;
        this.disputeType = disputeType;
        this.evidenceHash = evidenceHash;
        this.openedAt = openedAt;
        this.status = status;
        
    }

    public id: string;
    public remittanceId: string;
    public openedBy: string;
    public disputeType: string;
    public evidenceHash: string;
    public openedAt: bigint;
    public status: string;
    

    get _name(): string {
        return 'Dispute';
    }

    async save(): Promise<void> {
        const id = this.id;
        assert(id !== null, "Cannot save Dispute entity without an ID");
        await store.set('Dispute', id.toString(), this as unknown as CompatDisputeProps);
    }

    static async remove(id: string): Promise<void> {
        assert(id !== null, "Cannot remove Dispute entity without an ID");
        await store.remove('Dispute', id.toString());
    }

    static async get(id: string): Promise<Dispute | undefined> {
        assert((id !== null && id !== undefined), "Cannot get Dispute entity without an ID");
        const record = await store.get('Dispute', id.toString());
        if (record) {
            return this.create(record as unknown as DisputeProps);
        } else {
            return;
        }
    }


    /**
     * Gets entities matching the specified filters and options.
     *
     * ⚠️ This function will first search cache data followed by DB data. Please consider this when using order and offset options.⚠️
     * */
    static async getByFields(filter: FieldsExpression<DisputeProps>[], options: GetOptions<DisputeProps>): Promise<Dispute[]> {
        const records = await store.getByFields<CompatDisputeProps>('Dispute', filter  as unknown as FieldsExpression<CompatDisputeProps>[], options as unknown as GetOptions<CompatDisputeProps>);
        return records.map(record => this.create(record as unknown as DisputeProps));
    }

    static create(record: DisputeProps): Dispute {
        assert(record.id !== undefined && record.id !== null, "id must be provided");
        const entity = new this(
            record.id,
            record.remittanceId,
            record.openedBy,
            record.disputeType,
            record.evidenceHash,
            record.openedAt,
            record.status,
        );
        Object.assign(entity,record);
        return entity;
    }
}
