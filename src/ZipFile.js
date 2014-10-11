import * as Path from "node:path";
import { File } from "zen-fs";

import { ZipEndHeader } from "./ZipEndHeader.js";
import { ZipEntryHeader } from "./ZipEntryHeader.js";
import { ZipEntryReader, ZipEntryWriter } from "./ZipEntry.js";
import { BufferWriter } from "./BufferWriter.js";
import { BufferReader } from "./BufferReader.js";


export class ZipReader {

    constructor(reader, fileSize) {

        this.reader = reader;
        this.entryList = [];
        this.entryMap = {};
        this.current = 0;
        this.fileSize = fileSize;
    }

    getEntry(name) {

        let index = this.entryMap[name];
        return (typeof index !== "number") ? null : this.entryList[index];
    }

    entries() {

        return this.entryList;
    }

    async close() {

        await this.reader.close();
    }

    static async open(path) {

        path = Path.resolve(path);

        let stat = await File.stat(path),
            reader = await File.openRead(path),
            zip = new this(reader, stat.size);

        await zip._readDirectory();

        return zip;
    }

    // Read the zip file central directory
    async _readDirectory() {

        // == Read the Index Header ==

        let reader = this.reader,
            end = this.fileSize - ZipEndHeader.LENGTH, // Last possible location of start of end header
            start = Math.max(0, end - 0xffff);         // First possible location of start of end header

        await reader.seek(start);

        // Read the end-of-central-directory header
        let buffer = await reader.read(new Buffer(this.fileSize - start)),
            offset = -1;

        // Search backward until we find the start of the header
        for (let i = end - start; i >= 0; --i) {

            // Skip if byte is not "P"
            if (buffer[i] != 0x50)
                continue;

            // Look for header start value
            if (buffer.readUInt32LE(i) === ZipEndHeader.SIGNATURE) {

                offset = i;
                break;
            }
        }

        if (offset == -1)
            throw new Error("Cannot find header start");

        let endOffset = start + offset;

        // Read header
        let header = ZipEndHeader.fromBuffer(buffer.slice(offset));

        // Read optional comment
        if (header.commentLength) {

            offset += ZipEndHeader.LENGTH;
            this.comment = buffer.toString("utf8", offset, offset + header.commentLength);
        }

        // == Read the Entry Headers ==

        await reader.seek(header.offset);

        // Read all file entires into a single buffer
        buffer = await reader.read(new Buffer(endOffset - header.offset));

        let count = 0;

        // Read each file entry
        for (let i = 0; i < header.volumeEntries; ++i) {

            buffer = buffer.slice(count);

            let entry = new ZipEntryReader;

            count = this._readEntryHeader(buffer, entry);

            let index = this.entryMap[entry.name];

            if (index === void 0)
                this.entryMap[entry.name] = index = this.entryList.length;

            this.entryList[index] = entry;
        }
    }

    _readEntryHeader(buffer, entry) {

        let h = ZipEntryHeader.fromBuffer(buffer);
        Object.keys(h).forEach(k => entry[k] !== void 0 && (entry[k] = h[k]));

        let r = new BufferReader(buffer.slice(ZipEntryHeader.LENGTH));

        entry.reader = this.reader;
        entry.name = r.readString(h.fileNameLength);
        entry.extra = r.read(h.extraLength);
        entry.comment = r.readString(h.commentLength);

        return h.headerSize;
    }

}

export class ZipWriter {

    constructor(writer) {

        this.writer = writer;
        this.entryList = [];
    }

    createEntry(name) {

        let entry = new ZipEntryWriter(name);
        entry.writer = this.writer;
        this.entryList.push(entry);

        return entry;
    }

    async close() {

        // Store the start-of-central-directory offset
        let start = this.writer.position;

        // Write central directory
        for (let entry of this.entryList)
            await this.writer.write(this._packEntryHeader(entry));

        // Write end-of-central-directory header and close file
        await this.writer.write(this._packEndHeader(start));
        await this.writer.close();
    }

    static async open(path) {

        path = Path.resolve(path);
        return new this(await File.openWrite(path));
    }

    _packEndHeader(start) {

        let header = new ZipEndHeader,
            count = this.entryList.length;

        header.volumeEntries = count;
        header.totalEntries = count;
        header.size = this.writer.position - start;
        header.offset = start;
        header.commentLength = Buffer.byteLength(this.comment);

        let buffer = header.write();

        // Add comment
        if (this.comment)
            buffer.write(this.comment, ZipEndHeader.LENGTH);

        return buffer;
    }

    _packEntryHeader(entry) {

        let buffer = ZipEntryHeader.fromEntry(entry).write(),
            w = new BufferWriter(buffer.slice(ZipEntryHeader.LENGTH));

        if (entry.name) w.writeString(entry.name);
        if (entry.extra) w.write(entry.extra);
        if (entry.comment) w.writeString(entry.comment);

        return buffer;
    }
}

