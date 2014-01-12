module FS from "node:fs";

import { ZipDataHeader as DataHeader } from "ZipDataHeader.js";
import { ZipDataDescriptor as DataDescriptor } from "ZipDataDescriptor.js";
import { ZipEntryHeader as EntryHeader } from "ZipEntryHeader.js";
import { Crc32, normalizePath } from "Utilities.js";
import { BufferWriter } from "BufferWriter.js";
import { InflateStream, DeflateStream, NullStream } from "ZipStream.js";

var STORED = 0,
    DEFLATED = 8,
    NO_LOCAL_SIZE = 8,
    MADE_BY_UNIX = 789;
    
export class ZipEntry {

    constructor(name) {
        
        this.versionMadeBy = MADE_BY_UNIX;
        this.version = 10;
        this.flags = 0;
        this.method = STORED;
        this.lastModified = new Date(0);
        this.crc32 = 0;
        this.compressedSize = 0;
        this.size = 0;
        this.startDisk = 0;
        this.internalAttributes = 0;
        this.attributes = 0;
        this.offset = 0;
        this.name = normalizePath(name || "");
        this.extra = null;
        this.comment = "";
        
        this.source = null;
        
        if (!this.isDirectory) {
        
            this.version = 20;
            this.flags = NO_LOCAL_SIZE;
            this.method = DEFLATED;
        }
    }
    
    get isDirectory() {
    
        return this.name.endsWith("/");
    }
    
    readHeader(buffer) {
    
        // Read the fixed-size portion of the header
        var header = EntryHeader.fromBuffer(buffer),
            offset = EntryHeader.LENGTH;
        
        // Set entry fields
        Object.keys(header).forEach(key => {
        
            if (this[key] !== void 0)
                this[key] = header[key];
        });
            
        // Read file name field
        if (header.fileNameLength) {
        
            this.name = buffer.toString("utf8", offset, offset += header.fileNameLength);
        }
        
        // Read extra data fields
        if (header.extraLength) {
        
            this.extra = new Buffer(header.extraLength);
            buffer.copy(this.extra, 0, offset, offset += header.extraLength);
        }
        
        // Read entry comment
        if (header.commentLength) {
        
            this.comment = buffer.toString("utf8", offset, offset += header.commentLength);
        }
        
        return offset;
    }
    
    writeHeader() {
    
        this._setLengthFields();
    
        var buffer = EntryHeader.toBuffer(this),
            writer = new BufferWriter(buffer);
        
        writer.position = EntryHeader.LENGTH;
        
        this.name && writer.writeString(this.name);
        this.extra && writer.write(this.extra);
        this.comment && writer.writeString(this.comment);
        
        return buffer;
    }
    
    writeDataHeader() {
    
        this._setLengthFields();
        
        var buffer = DataHeader.toBuffer(this),
            writer = new BufferWriter(buffer);
        
        writer.position = DataHeader.LENGTH;
        
        this.name && writer.writeString(this.name);
        this.extra && writer.write(this.extra);
        
        return buffer;
    }
    
    writeDataDescriptor() {
    
        return DataDescriptor.toBuffer(this);
    }
    
    async compress(inStream, outStream, buffer) {
    
        if (this.isDirectory)
            throw new Error("Entry is not a file");
        
        var crc = new Crc32(),
            compressed = 0,
            size = 0,
            abort = false,
            zipStream;
        
        // Create the compression stream
        switch (this.method) {
        
            case STORED:
                zipStream = new NullStream;
                break;
            
            case DEFLATED:
                zipStream = new DeflateStream;
                break;
            
            default:
                throw new Error("Unsupported compression method");
        }
        
        zipStream.on("data", event => {
        
            var data = event.data;
            
            // Accumulate data for the compressed output
            compressed += data.length;
            
            await outStream.write(data);
        });
        
        // Store the output position
        this.offset = outStream.position;
        
        // Write the data header
        await outStream.write(this.writeDataHeader());
        
        var count, data;
        
        // Read the file, one buffer at a time
        while (count = await inStream.read(buffer)) {
        
            data = buffer.slice(0, count);
            
            // Accumulate data for the raw input
            crc.accumulate(data);
            size += count;
            
            // Write data into compression stream
            await zipStream.write(data);
        }
        
        await zipStream.end();
        
        // Set entry data
        this.crc32 = crc.value;
        this.compressedSize = compressed;
        this.size = size;
    
        await outStream.write(this.writeDataDescriptor());
        
        return this;
    }
    
    async extract(fileStream, outStream, buffer) {
    
        if (this.isDirectory)
            throw new Error("Entry is not a file");
        
        var count, dataHeader;
        
        // === Read the Data Header ===
        
        fileStream.seek(this.offset);
        count = await fileStream.read(buffer, 0, DataHeader.LENGTH);
        dataHeader = DataHeader.fromBuffer(buffer);
        
        fileStream.seek(this.offset + dataHeader.headerSize);
        
        var zipStream, zipFinish, crc;
        
        // Create decompression stream
        switch (this.method) {
        
            case STORED:
                zipStream = new NullStream;
                break;
                
            case DEFLATED:
                zipStream = new InflateStream;
                crc = new Crc32();
                break;
            
            default:
                throw new Error("Unsupported compression method");
        }
        
        zipStream.on("data", event => {
    
            // Calculate CRC-32 on each chunk of decompressed data
            if (crc) 
                crc.accumulate(event.data);
        
            await outStream.write(event.data);
        });
        
        // === Decompress Data ==
            
        var end = fileStream.position + this.compressedSize,
            length,
            data;
        
        while (fileStream.position < end) {
        
            // Read the next chunk
            length = Math.min(buffer.length, end - fileStream.position);
            count = await fileStream.read(buffer, 0, length);
            
            // Write chunk into decompressor
            data = await zipStream.write(buffer.slice(0, count));
        }
        
        await zipStream.end();
        
        // === Finalize ===
            
        // Validate CRC-32
        if (crc && crc.value !== this.crc32)
            throw new Error("CRC-32 check failed");
        
        return this;
    }
    
    _setLengthFields() {
    
        this.fileNameLength = Buffer.byteLength(this.name);
        this.extraLength = this.extra ? this.extra.length : 0;
        this.commentLength = Buffer.byteLength(this.comment);
    }

}
