import { BufferReader } from "./BufferReader.js";
import { BufferWriter } from "./BufferWriter.js";

var LENGTH = 16,
    SIGNATURE = 0x08074b50; // "PK\007\008"

export class ZipDataDescriptor {

    constructor() {

        this.crc32 = 0;
        this.compressedSize = 0;
        this.size = 0;
    }

    get headerSize() { return LENGTH; }
    get variableSize() { return 0; }

    write(buffer) {

        if (buffer === void 0)
            buffer = new Buffer(this.headerSize);
        else if (buffer.length < this.headerSize)
            throw new Error("Insufficient buffer");

        var w = new BufferWriter(buffer);

        w.writeUInt32LE(SIGNATURE);
        w.writeUInt32LE(this.crc32);
        w.writeUInt32LE(this.compressedSize);
        w.writeUInt32LE(this.size);

        return buffer;
    }

    static get LENGTH() { return LENGTH; }

    static get SIGNATURE() { return SIGNATURE; }

    static fromBuffer(buffer) {

        var r = new BufferReader(buffer);

        if (r.readUInt32LE() !== SIGNATURE)
            throw new Error("Invalid EXT header");

        var h = new this();
        h.crc32 = data.readUInt32LE();
        h.compressedSize = data.readUInt32LE();
        h.size = data.readUInt32LE();

        return h;
    }

    static fromEntry(entry) {

        var h = new this();
        Object.keys(this).forEach(k => entry[k] !== void 0 && (h[k] = entry[k]));
        return h;
    }

}
