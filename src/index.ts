type obj<T = unknown | any> = Record<string | unknown | any, T>;

interface BitfieldEncoderSchemaItem {
    type: NumberConstructor | BooleanConstructor;
    numBits?: number;
}

type DataItem = number | boolean;

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

/**
 * Class for encoding and decoding data into a single bitfield
 */
class BitfieldEncoder {
    encodingSchema: obj<BitfieldEncoderSchemaItem>;

    constructor(encodingSchema: obj<BitfieldEncoderSchemaItem>) {
        if (typeof encodingSchema !== 'object') {
            throw new TypeError('Encoding schema must be an object');
        }

        let totalNumBits = 0;
        for (const [key, { type, numBits }] of Object.entries(encodingSchema)) {
            if (type !== Boolean && type !== Number) {
                throw new TypeError(`Type for key "${key}" must be a boolean or number`);
            }
            if (type === Number && !numBits) {
                throw new Error(`Number of bits for key "${key}" must be specified`);
            }
            if (type === Number && numBits && (numBits < 0 || numBits > 51)) {
                throw new Error(`Number of bits for key "${key}" must be between 1 and 51`);
            }
            if (type === Number && numBits && numBits % 1 !== 0) {
                throw new Error(`Number of bits for key "${key}" must be an integer`);
            }
            if (type === Boolean && numBits) {
                throw new Error(`Number of bits for key "${key}" must not be specified for boolean types`);
            }
            totalNumBits += numBits || 1;
        }
        if (totalNumBits > 52) {
            throw new Error(`Total number of bits must not exceed 52`);
        }

        this.encodingSchema = encodingSchema;
    }

    /**
     * Encodes the given data into a single bitfield
     */
    encode(data: obj<DataItem>): number {
        if (typeof data !== 'object') {
            throw new TypeError('Data must be an object');
        }

        let result = 0;
        let offset = 0;
        for (const [key, { type, numBits = type === Boolean ? 1 : 0 }] of Object.entries(this.encodingSchema)) {
            if (!(key in data)) {
                throw new Error(`Data is missing key "${key}"`);
            }

            let value = data[key];
            if (type === Boolean) {
                if (typeof value !== 'boolean') {
                    throw new TypeError(`Value for key "${key}" must be a boolean`);
                }
                value = value ? 1 : 0;
            } else if (type === Number) {
                if (typeof value !== 'number') {
                    throw new TypeError(`Value for key "${key}" must be a number`);
                }
                if (value < 0 || value >= 1 << numBits) {
                    throw new Error(`Value for key "${key}" is outside of allowed range [0, ${(1 << numBits) - 1}]`);
                }
            } else {
                throw new Error(`Unsupported data type "${type.name}" for key "${key}"`);
            }

            result |= value << offset;
            offset += numBits;
        }
        return result;
    }

    /**
     * Decodes the given packed data into an object
     * @param {number} packedData - The packed data as a number
     * @returns {Object} - An object whose keys match the keys in the encoding schema and whose values are of the corresponding types
     */
    decode(packedData: number): obj<DataItem> {
        if (typeof packedData !== 'number') {
            throw new TypeError('Packed data must be a number');
        }

        const result: obj<DataItem> = {};
        let offset = 0;
        for (const [key, { type, numBits = type === Boolean ? 1 : 0 }] of Object.entries(this.encodingSchema)) {
            let value: number | boolean = (packedData >> offset) & ((1 << numBits) - 1);
            if (type === Boolean) {
                value = value !== 0;
            }
            result[key] = value;
            offset += numBits;
        }
        return result;
    }

    /**
     * Manipulates packed data with an object of keys and values
     */
    manipulate(packedData: number, data: obj<DataItem>): number {
        if (typeof packedData !== 'number') {
            throw new TypeError('Packed data must be a number');
        }

        let newPackedData = packedData;
        let offset = 0;
        for (const [key, { type, numBits = type === Boolean ? 1 : 0 }] of Object.entries(this.encodingSchema)) {
            if (!(key in data)) {
                offset += numBits;
                continue;
            }

            let value = data[key];
            if (type === Boolean) {
                if (typeof value !== 'boolean') {
                    throw new TypeError(`Value for key "${key}" must be a boolean`);
                }
                value = value ? 1 : 0;
            } else if (type === Number) {
                if (typeof value !== 'number') {
                    throw new TypeError(`Value for key "${key}" must be a number`);
                }
                if (value < 0 || value >= 1 << numBits) {
                    throw new Error(`Value for key "${key}" is outside of allowed range [0, ${(1 << numBits) - 1}]`);
                }
            } else {
                throw new Error(`Unsupported data type "${type.name}" for key "${key}"`);
            }

            const mask = ((1 << numBits) - 1) << offset;
            newPackedData &= ~mask; // Clear the bits to be replaced
            newPackedData |= value << offset; // Set the new bits
            offset += numBits;
        }
        return newPackedData;
    }

    /**
     * Returns the index for where the given key's data starts and ends in the packed data
     */
    getIndex(key: string): Index {
        if (typeof key !== 'string') {
            throw new TypeError('Key must be a string');
        }
        if (!(key in this.encodingSchema)) {
            throw new Error(`Key "${key}" is not in the encoding schema`);
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
