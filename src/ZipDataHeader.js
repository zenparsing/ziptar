import { toZipTime, fromZipTime } from "./Utilities.js";
import { BufferWriter } from "./BufferWriter.js";
import { BufferReader } from "./BufferReader.js";

var FIXED_LENGTH = 30,
    SIGNATURE = 0x04034b50; // "PK\003\004"

export class ZipDataHeader {

    constructor() {

        this.version = 0;
        this.flags = 0;
        this.method = 0;
        this.lastModified = new Date(0);
        this.crc32 = 0;
        this.compressedSize = 0;
        this.size = 0;
        this.fileNameLength = 0;
        this.extraLength = 0;
    }

    get headerSize() { return this.variableSize + FIXED_LENGTH; }
    get variableSize() { return this.fileNameLength + this.extraLength; }

    write(buffer) {

        if (buffer === void 0)
            buffer = new Buffer(this.headerSize);
        else if (buffer.length < this.headerSize)
            throw new Error("Insufficient buffer");

        var w = new BufferWriter(buffer);

        w.writeUInt32LE(SIGNATURE);
        w.writeUInt16LE(this.version);
        w.writeUInt16LE(this.flags);
        w.writeUInt16LE(this.method);
        w.writeUInt32LE(toZipTime(this.lastModified));
        w.writeInt32LE(this.crc32, true);
        w.writeUInt32LE(this.compressedSize);
        w.writeUInt32LE(this.size);
        w.writeUInt16LE(this.fileNameLength);
        w.writeUInt16LE(this.extraLength);

        return buffer;
    }

    static get LENGTH() { return FIXED_LENGTH; }

    static get SIGNATURE() { return SIGNATURE; }

    static fromEntry(entry) {

        var h = new this();

        Object.keys(h).forEach(k => entry[k] !== void 0 && (h[k] = entry[k]));

        h.fileNameLength = Buffer.byteLength(entry.name);
        h.extraLength = entry.extra ? entry.extra.length : 0;

        return h;
    }

    static fromBuffer(buffer) {

        var h = new this();
        var r = new BufferReader(buffer);

        if (r.readUInt32LE() !== SIGNATURE)
            throw new Error("Invalid LOC header");

        h.version = r.readUInt16LE();
        h.flags = r.readUInt16LE();
        h.method = r.readUInt16LE();
        h.lastModified = fromZipTime(r.readUInt32LE());
        h.crc32 = r.readUInt32LE();
        h.compressedSize = r.readUInt32LE();
        h.size = r.readUInt32LE();
        h.fileNameLength = r.readUInt16LE();
        h.extraLength = r.readUInt16LE();

        return h;
    }

}
