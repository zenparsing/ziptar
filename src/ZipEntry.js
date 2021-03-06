import {

    map,
    compose,
    limitBytes,
    pumpBytes,
    inflateRaw,
    deflateRaw,

} from "streamware";

import { ZipDataHeader } from "./ZipDataHeader.js";
import { ZipDataDescriptor } from "./ZipDataDescriptor.js";
import { Crc32, normalizePath } from "./Utilities.js";
import { BufferWriter } from "./BufferWriter.js";
import { BufferReader } from "./BufferReader.js";

const STORED = 0,
      DEFLATED = 8,
      NO_LOCAL_SIZE = 8,
      MADE_BY_UNIX = 789;

export class ZipEntry {

    constructor(name = "") {

        this._name = name;
        this.versionMadeBy = MADE_BY_UNIX;
        this.version = 20;
        this.flags = NO_LOCAL_SIZE;
        this.method = DEFLATED;
        this.lastModified = new Date(0);
        this.crc32 = 0;
        this.compressedSize = 0;
        this.size = 0;
        this.startDisk = 0;
        this.internalAttributes = 0;
        this.attributes = 0;
        this.offset = 0;
        this.extra = null;
        this.comment = "";
        this.reader = null;
        this.writer = null;

        // Set appropriate defaults for directories
        if (this.isDirectory) {

            this.version = 10;
            this.flags = 0;
            this.method = STORED;
        }
    }

    get name() { return this._name }
    set name(value) { this._name = normalizePath(value || "") }

    get isDirectory() { return this.name.endsWith("/") }
    get isFile() { return !this.name.endsWith("/") }

    async *read() {

        if (this.isDirectory)
            throw new Error("Cannot open a directory entry");

        if (!this.reader)
            throw new Error("No file reader");

        let compressed = false;

        switch (this.method) {

            case STORED: break;
            case DEFLATED: compressed = true; break;
            default: throw new Error("Unsupported compression method");
        }

        // Read the data header
        await this.reader.seek(this.offset);

        let buffer = await this.reader.read(new Buffer(ZipDataHeader.LENGTH)),
            dataHeader = ZipDataHeader.fromBuffer(buffer);

        // Advance to file data
        await this.reader.seek(this.offset + dataHeader.headerSize);

        async function *validateCRC(value) {

            let crc = new Crc32;

            for await (let buffer of this) {

                crc.accumulate(buffer);
                yield buffer;
            }

            if (crc.value !== value)
                throw new Error("Invalid checksum");
        }

        let stream = this.reader::limitBytes(this.compressedSize)::pumpBytes();

        if (compressed)
            stream = stream::inflateRaw()::pumpBytes()::validateCRC(this.crc32);

        for await (let chunk of stream)
            yield chunk;
    }

    async write(input = []) {

        if (!this.writer)
            throw new Error("No file writer");

        if (this.isDirectory)
            return this._writeDirectory(input);

        let compressed = false;

        // Create the compression stream
        switch (this.method) {

            case STORED: break;
            case DEFLATED: compressed = true; break;
            default: throw new Error("Unsupported compression method");
        }

        // Store the output position
        this.offset = this.writer.position;
        this.size = 0;
        this.compressedSize = 0;

        // Write the data header
        await this.writer.write(this._packDataHeader());

        let crc = compressed ? new Crc32 : null,
            inputSize = 0;

        let stream = input::map(buffer => {

            // Record the size of the raw data
            inputSize += buffer.length;

            // Perform checksum calculation
            if (crc)
                crc.accumulate(buffer);

            return buffer;
        });

        if (compressed)
            stream = stream::deflateRaw()::pumpBytes();

        for await (let chunk of stream) {

            // Record the size of the compressed data
            this.compressedSize += chunk.length;
            await this.writer.write(chunk);
        }

        // Store original file size
        this.size = inputSize;

        // Store checksum value
        this.crc32 = crc ? crc.value : 0;

        await this.writer.write(this._packDataDescriptor());
    }

    async _writeDirectory(input) {

        // Write the data header
        await this.writer.write(this._packDataHeader());

        // Throw if attempting to write any data to the entry
        for (let buffer of input)
            throw new Error("Cannot write to a directory entry");
    }

    _packDataHeader() {

        let buffer = ZipDataHeader.fromEntry(this).write(),
            w = new BufferWriter(buffer.slice(ZipDataHeader.LENGTH));

        if (this.name) w.writeString(this.name);
        if (this.extra) w.write(this.extra);

        return buffer;
    }

    _packDataDescriptor() {

        return ZipDataDescriptor.fromEntry(this).write();
    }

}
