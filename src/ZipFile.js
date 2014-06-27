var Path = require("path");

import { File } from "package:zen-fs";

import { ZipEndHeader } from "ZipEndHeader.js";
import { ZipEntryHeader } from "ZipEntryHeader.js";
import { ZipEntryReader, ZipEntryWriter } from "ZipEntry.js";
import { BufferWriter } from "BufferWriter.js";
import { BufferReader } from "BufferReader.js";


export class ZipReader {

    constructor(fileStream) {
    
        this.file = fileStream;
        this.entries = [];
        this.entryMap = {};
        this.current = 0;
    }
    
    getEntry(name) {
    
        var index = this.entryMap[name];
        return (typeof index !== "number") ? null : this.entries[index];
    }
    
    async nextEntry() {
    
        if (this.current >= this.entries.length)
            return null;
        
        return this.entries[this.current++];
    }
    
    async close() {
    
        await this.file.close();
    }
    
    static async open(path) {
    
        path = Path.resolve(path);
        
        var zip = new this(await File.openRead(path));
        await zip._readDirectory();
        return zip;
    }
    
    // Read the zip file central directory
    async _readDirectory() {
    
        // == Read the Index Header ==
        
        var file = this.file,
            end = file.length - ZipEndHeader.LENGTH, // Last possible location of start of end header
            start = Math.max(0, end - 0xffff);       // First possible location of start of end header
        
        await file.seek(start);
        
        // Read the end-of-central-directory header
        var buffer = await file.read(new Buffer(file.length - start)),
            offset = -1,
            i;
        
        // Search backward until we find the start of the header
        for (i = end - start; i >= 0; --i) {
        
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
        
        var endOffset = start + offset;
        
        // Read header
        var header = ZipEndHeader.fromBuffer(buffer.slice(offset));
        
        // Read optional comment
        if (header.commentLength) {
        
            offset += ZipEndHeader.LENGTH;
            this.comment = buffer.toString("utf8", offset, offset + header.commentLength);
        }
        
        // == Read the Entry Headers ==
        
        await file.seek(header.offset);
        
        // Read all file entires into a single buffer
        buffer = await file.read(new Buffer(endOffset - header.offset));
            
        var count = 0, 
            entry, 
            index;
            
        // Read each file entry
        for (i = 0; i < header.volumeEntries; ++i) {
        
            buffer = buffer.slice(count);
            entry = new ZipEntryReader;
            count = this._readEntryHeader(buffer, entry);
            
            index = this.entryMap[entry.name];
            
            if (index === void 0)
                this.entryMap[entry.name] = index = this.entries.length;
            
            this.entries[index] = entry;
        }
    }
    
    _readEntryHeader(buffer, entry) {
    
        var h = ZipEntryHeader.fromBuffer(buffer);
        Object.keys(h).forEach(k => entry[k] !== void 0 && (entry[k] = h[k]));
        
        var r = new BufferReader(buffer.slice(ZipEntryHeader.LENGTH));
        
        entry.stream = this.file;
        entry.name = r.readString(h.fileNameLength);
        entry.extra = r.read(h.extraLength);
        entry.comment = r.readString(h.commentLength);
        
        return h.headerSize;
    }
    
}

export class ZipWriter {

    constructor(fileStream) {
    
        this.file = fileStream;
        this.entries = [];
    }
    
    createEntry(name) {
    
        var entry = new ZipEntryWriter(name);
        entry.stream = this.file;
        this.entries.push(entry);
        
        return entry;
    }
    
    async close() {
    
        // Store the start-of-central-directory offset
        var start = this.file.position;
        
        // Write central directory
        for (var i = 0; i < this.entries.length; ++i)
            await this.file.write(this._packEntryHeader(this.entries[i]));
        
        // Write end-of-central-directory header and close file
        await this.file.write(this._packEndHeader(start));
        await this.file.close();
    }
    
    static async open(path) {
    
        path = Path.resolve(path);
        return new this(await File.openWrite(path));
    }
    
    _packEndHeader(start) {
    
        var header = new ZipEndHeader,
            count = this.entries.length;
        
        header.volumeEntries = count;
        header.totalEntries = count;
        header.size = this.file.position - start;
        header.offset = start;
        header.commentLength = Buffer.byteLength(this.comment);
        
        var buffer = header.write();
        
        // Add comment
        if (this.comment)
            buffer.write(this.comment, ZipEndHeader.LENGTH);
        
        return buffer;
    }
    
    _packEntryHeader(entry) {
    
        var buffer = ZipEntryHeader.fromEntry(entry).write();
        var w = new BufferWriter(buffer.slice(ZipEntryHeader.LENGTH));
    
        if (entry.name) w.writeString(entry.name);
        if (entry.extra) w.write(entry.extra);
        if (entry.comment) w.writeString(entry.comment);
        
        return buffer;
    }
}

