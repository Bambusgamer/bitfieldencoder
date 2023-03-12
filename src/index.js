/**
 * Class for encoding and decoding data into a single bitfield
 * @param {Object} encodingSchema - An object that defines the encoding schema, mapping keys to their data types and number of bits
 * @property {Object} encodingSchema - The encoding schema
 */
class BitfieldEncoder {
    constructor(encodingSchema) {
        if (typeof encodingSchema !== "object") {
            throw new TypeError("Encoding schema must be an object");
        };

        let totalNumBits = 0;
        for (const [key, { type, numBits }] of Object.entries(encodingSchema)) {
            if (type !== Boolean && type !== Number) {
                throw new TypeError(`Type for key "${key}" must be a boolean or number`);
            };
            if (type === Number && !numBits) {
                throw new Error(`Number of bits for key "${key}" must be specified`);
            };
            if (type === Number && (numBits < 0 || numBits > 32)) {
                throw new Error(`Number of bits for key "${key}" must be between 0 and 32`);
            };
            if (type === Number && (numBits % 1 !== 0)) {
                throw new Error(`Number of bits for key "${key}" must be an integer`);
            };
            if (type === Boolean && numBits) {
                throw new Error(`Number of bits for key "${key}" must not be specified for boolean types`);
            };
            totalNumBits += numBits || 1;
        };
        if (totalNumBits > 32) {
            throw new Error(`Total number of bits must not exceed 32`);
        };

        this.encodingSchema = encodingSchema;
    }

    /**
     * Encodes the given data into a single bitfield
     * @param {Object} data - An object whose keys match the keys in the encoding schema and whose values are of the corresponding types
     * @returns {number} - The packed data as a number
     */
    encode(data) {
        if (typeof data !== "object") {
            throw new TypeError("Data must be an object");
        };

        let result = 0;
        let offset = 0;
        for (const [key, { type, numBits = type === Boolean ? 1 : 0 }] of Object.entries(this.encodingSchema)) {
            if (!(key in data)) {
                throw new Error(`Data is missing key "${key}"`);
            };

            let value = data[key];
            if (type === Boolean) {
                if (typeof value !== "boolean") {
                    throw new TypeError(`Value for key "${key}" must be a boolean`);
                };
                value = value ? 1 : 0;
            } else if (type === Number) {
                if (typeof value !== "number") {
                    throw new TypeError(`Value for key "${key}" must be a number`);
                };
                if (value < 0 || value >= (1 << numBits)) {
                    throw new Error(`Value for key "${key}" is outside of allowed range [0, ${(1 << numBits) - 1}]`);
                };
            } else {
                throw new Error(`Unsupported data type "${type.name}" for key "${key}"`);
            };

            result |= value << offset;
            offset += numBits;
        };
        return result;
    }

    /**
     * Decodes the given packed data into an object
     * @param {number} packedData - The packed data as a number
     * @returns {Object} - An object whose keys match the keys in the encoding schema and whose values are of the corresponding types
     */
    decode(packedData) {
        if (typeof packedData !== "number") {
            throw new TypeError("Packed data must be a number");
        };

        let result = {};
        let offset = 0;
        for (const [key, { type, numBits = type === Boolean ? 1 : 0 }] of Object.entries(this.encodingSchema)) {
            let value = (packedData >> offset) & ((1 << numBits) - 1);
            if (type === Boolean) {
                value = value !== 0;
            };
            result[key] = value;
            offset += numBits;
        };
        return result;
    }

    /**
     * @typedef {Object} BitfieldEncoder~Index
     * @property {number} start - The start index of the data
     * @property {number} end - The end index of the data
     * @property {number} numBits - The number of bits of the data
     * @property {number} mask - The mask for the data
     * @property {number} shift - The shift for the data
     * @property {number} max - The maximum value for the data
     * @property {number} min - The minimum value for the data
     * @property {type} type - The type of the data
     */

    /**
     * Returns the index for where the given key's data starts and ends in the packed data
     * @param {string} key - The key to get the index for
     * @returns {Object} - An object with the start and end indices
     */
    getIndex(key) {
        if (typeof key !== "string") {
            throw new TypeError("Key must be a string");
        };
        if (!(key in this.encodingSchema)) {
            throw new Error(`Key "${key}" is not in the encoding schema`);
        };

        const { type, numBits = type === Boolean ? 1 : 0 } = this.encodingSchema[key];
        let start = 0;
        for (const [otherKey, { type: otherType, numBits: otherNumBits = otherType === Boolean ? 1 : 0 }] of Object.entries(this.encodingSchema)) {
            if (otherKey === key) {
                break;
            };
            start += otherNumBits;
        };

        return {
            start,
            end: start + numBits,
            numBits,
            mask: (1 << numBits) - 1,
            shift: 32 - numBits,
            max: (1 << numBits) - 1,
            min: 0,
            type
        };
    }
}

module.exports = BitfieldEncoder;