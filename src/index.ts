interface Index {
    start: number;
    end: number;
    numBits: number;
    mask: number;
    shift: number;
    max: number;
    min: number;
    type: NumberConstructor | BooleanConstructor;
}

interface SchemaItem {
    type: NumberConstructor | BooleanConstructor;
    numBits?: number;
}

type Schema = Record<string, SchemaItem>;

type DataItem<TSchemaItem extends SchemaItem> = TSchemaItem['type'] extends NumberConstructor
    ? number
    : TSchemaItem['type'] extends BooleanConstructor
    ? boolean
    : never;

class ExtendTypeError extends TypeError {
    constructor(message: string, replacements: string[]) {
        let replaced = message;
        for (let i = 0; i < replacements.length; i++) {
            replaced = replaced.replace(`{${i + 1}}`, replacements[i]);
        }
        super(replaced);
    }
}

/**
 * @description Class for encoding, decoding and manipulating data in a bitfield
 */
class BitfieldEncoder<TSchema extends Schema> {
    encodingSchema: TSchema;

    constructor(encodingSchema: TSchema) {
        if (typeof encodingSchema !== 'object') {
            throw new TypeError('Encoding schema must be an object');
        }

        let totalNumBits = 0;
        for (const [key, { type, numBits }] of Object.entries(encodingSchema)) {
            if (type !== Boolean && type !== Number) {
                throw new ExtendTypeError('Type for key "{1}" must be a boolean or number', [key]);
            }
            if (type === Number) {
                if (typeof numBits !== 'number') {
                    throw new ExtendTypeError(`Number of bits for key "{1}" must be specified`, [key]);
                }
                if (numBits <= 0 || numBits > 51) {
                    throw new ExtendTypeError(`Number of bits for key "{1}" must be between 1 and 51`, [key]);
                }
                if (numBits % 1 !== 0) {
                    throw new ExtendTypeError(`Number of bits for key "{1}" must be an integer`, [key]);
                }
            }
            if (type === Boolean && numBits) {
                throw new ExtendTypeError(`Number of bits for key "{1}" must not be specified for boolean types`, [
                    key,
                ]);
            }
            totalNumBits += numBits || 1;
        }
        if (totalNumBits > 52) {
            throw new Error(`Total number of bits must not exceed 52`);
        }

        this.encodingSchema = encodingSchema;
    }

    /**
     * @description Encodes the given data into a single bitfield
     */
    encode<KSchema extends keyof TSchema>(data: { [P in KSchema]: DataItem<TSchema[P]> }): number {
        if (typeof data !== 'object') {
            throw new TypeError('Data must be an object');
        }

        let result = 0;
        let offset = 0;
        for (const [key, { type, numBits = type === Boolean ? 1 : 0 }] of Object.entries(this.encodingSchema)) {
            if (!(key in data)) {
                throw new ExtendTypeError(`Data is missing key "{1}"`, [key]);
            }
            if (typeof data[key as KSchema] !== 'boolean' && typeof data[key as KSchema] !== 'number') {
                throw new ExtendTypeError(`Value for key "{1}" must be a boolean or number`, [key]);
            }

            const currentValue = data[key as KSchema];
            let value: number;
            if (type === Boolean) {
                if (typeof currentValue !== 'boolean') {
                    throw new ExtendTypeError(`Value for key "{1}" must be a boolean`, [key]);
                }
                value = currentValue ? 1 : 0;
            } else if (type === Number) {
                if (typeof currentValue !== 'number') {
                    throw new ExtendTypeError(`Value for key "{1}" must be a number`, [key]);
                }
                if (
                    (type === Number && (data[key as KSchema] as number) >= 1 << numBits) ||
                    (data[key as KSchema] as number) < 0
                ) {
                    throw new ExtendTypeError(`Value for key "{1}" is outside of allowed range [0, {2}]`, [
                        key,
                        String((1 << numBits) - 1),
                    ]);
                }
                value = currentValue;
            } else {
                throw new ExtendTypeError(`Unsupported data type "{1}" for key "{2}"`, [type.name, key]);
            }

            result |= value << offset;
            offset += numBits;
        }
        return result;
    }

    /**
     * @description Decodes the given packed data into an object
     */
    decode<KSchema extends keyof TSchema>(packedData: number): { [P in KSchema]: DataItem<TSchema[P]> } {
        if (typeof packedData !== 'number') {
            throw new TypeError('Packed data must be a number');
        }

        const result = {} as { [P in KSchema]: DataItem<TSchema[P]> };
        let offset = 0;
        for (const [key, { type, numBits = type === Boolean ? 1 : 0 }] of Object.entries(this.encodingSchema)) {
            let value: number | boolean = (packedData >> offset) & ((1 << numBits) - 1);
            if (type === Boolean) {
                value = value !== 0;
            }
            result[key as KSchema] = value as DataItem<TSchema[KSchema]>;
            offset += numBits;
        }
        return result;
    }

    /**
     * @description Manipulates packed data with an object of partial data
     */
    manipulate<KSchema extends keyof TSchema>(
        packedData: number,
        data: { [P in KSchema]: DataItem<TSchema[P]> },
    ): number {
        const unpackedData = this.decode(packedData);

        return this.encode({ ...unpackedData, ...data });
    }

    /**
     * @description Returns metadata about the given key
     */
    getIndex(key: string): Index {
        if (typeof key !== 'string') {
            throw new TypeError('Key must be a string');
        }
        if (!(key in this.encodingSchema)) {
            throw new ExtendTypeError(`Key "{1}" is not in the encoding schema`, [key]);
        }

        const { type, numBits = type === Boolean ? 1 : 0 } = this.encodingSchema[key];
        let start = 0;
        for (const [
            otherKey,
            { type: otherType, numBits: otherNumBits = otherType === Boolean ? 1 : 0 },
        ] of Object.entries(this.encodingSchema)) {
            if (otherKey === key) {
                break;
            }
            start += otherNumBits;
        }

        return {
            start,
            end: start + numBits,
            numBits,
            mask: (1 << numBits) - 1,
            shift: 52 - numBits,
            max: (1 << numBits) - 1,
            min: 0,
            type,
        };
    }
}

export default BitfieldEncoder;
