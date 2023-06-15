# bitfield-encoder

A JavaScript library written in typescript for encoding and decoding data into a single bitfield. The library allows you to define an encoding schema that maps keys to their data types and number of bits, then use that schema to pack and unpack your data into a single number. It makes bitfield storage and manipulation easy.

## Installation

To install bitfield-encoder in your project, run the following command in your terminal:

```bash
npm install bitfield-encoder
```

## Usage

The library exports the class BitfieldEncoder, that you can use to define your encoding schema and perform the encoding and decoding. Here's an example of how you could use the library to pack and unpack some data:

```javascript
const BitfieldEncoder = require('bitfield-encoder');

const schema = {
	a: { type: Boolean },
	b: { type: Number, numBits: 4 },
	c: { type: Number, numBits: 5 },
};

const encoder = new BitfieldEncoder(schema);

const data = { a: true, b: 15, c: 31 };
const packedData = encoder.encode(data);
// 1023

encoder.decode(packedData);
// { a: true, b: 15, c: 31 }

const manipulatedData = encoder.manipulate(packedData, { b: 0, c: 5 });
// 161

encoder.decode(manipulatedData);
// { a: true, b: 0, c: 5 }

encoder.getIndex('b');
// { start: 1, end: 5, numBits: 4, mask: 15, shift: 28, max: 15, min: 0, type: Number }
```

Note that the schema you define should map keys to objects that specify the type (either Boolean or Number) and the numBits for numbers.

You can then use the encode method on the BitfieldEncoder instance to pack your data into a single number, and the decode method to unpack that number back into the original data.

## Limitations

- The maximum number of bits that can be used in one schema is 52.
- A single key can only have a maximum value of 51.
