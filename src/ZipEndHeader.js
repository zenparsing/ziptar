import { BufferReader } from "./BufferReader.js";
import { BufferWriter } from "./BufferWriter.js";

var FIXED_LENGTH = 22,
    SIGNATURE = 0x06054b50; // "PK\005\006"

export class ZipEndHeader {

    constructor() {

        this.disk = 0;
        this.startDisk = 0;
        this.volumeEntries = 0;
        this.totalEntries = 0;
        this.size = 0;
        this.offset = 0;
        this.commentLength = 0;
    }

    get headerSize() { return FIXED_LENGTH + this.variableSize; }
    get variableSize() { return this.commentLength; }

    write(buffer) {

        if (buffer === void 0)
            buffer = new Buffer(this.headerSize);
        else if (buffer.length < this.headerSize)
            throw new Error("Insufficient buffer");

        var w = new BufferWriter(buffer);

        w.writeUInt32LE(SIGNATURE);
        w.writeUInt16LE(this.disk);
        w.writeUInt16LE(this.startDisk);
        w.writeUInt16LE(this.volumeEntries);
        w.writeUInt16LE(this.totalEntries);
        w.writeUInt32LE(this.size);
        w.writeUInt32LE(this.offset);
        w.writeUInt16LE(this.commentLength);

        return buffer;
    }

    static get LENGTH() { return FIXED_LENGTH; }

    static get SIGNATURE() { return SIGNATURE; }

    static fromBuffer(buffer) {

        var h = new this();
        var r = new BufferReader(buffer);

        if (r.readUInt32LE() !== SIGNATURE)
            throw new Error("Invalid END header");

        h.disk = r.readUInt16LE();
        h.startDisk = r.readUInt16LE();
        h.volumeEntries = r.readUInt16LE();
        h.totalEntries = r.readUInt16LE();
        h.size = r.readUInt32LE();
        h.offset = r.readUInt32LE();
        h.commentLength = r.readUInt16LE();

        return h;
    }

}
